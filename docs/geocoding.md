# 역지오코딩 연동 설계

| 항목 | 내용 |
|------|------|
| 작성일 | 2026-07-01 |
| 근거 | `docs/requirements.md` v0.2 §5 FR-3.2 |
| 구현 | `src/geocoding/` |
| 캐시 테이블 | `supabase/migrations/0002_geocode_cache.sql` |
| 상태 | 실제 Nominatim 호출 검증 완료 |

---

## 1. 목적
여행 centroid 좌표를 사람이 읽는 지명(`location_summary`, 예: "서귀포시, 대한민국")으로 변환.

## 2. 핵심 설계 결정

### 2.1 여행당 1회 호출
- 사진마다가 아니라 **여행 1건의 centroid 1개**만 변환 → 호출량 최소.
- 여행 100건이어도 호출 100회 수준. 캐시까지 고려하면 그 이하.

### 2.2 제공자 추상화 (교체 가능)
- `GeocodeProvider` 인터페이스로 분리. MVP 기본 = **Nominatim(무료)**.
- 정확도/한국어 품질이 부족하면 `createGoogleProvider`로 교체(인터페이스만 맞추면 됨).

| 제공자 | 비용 | 비고 |
|--------|------|------|
| Nominatim (OSM) | 무료 | 사용정책: 초당 1요청, User-Agent 필수, 캐싱 권장 |
| Google Geocoding | 유료 | 한국어 지명·명소 정확도 높음, 키 필요 |

### 2.3 캐시 우선 (2단계)
1. **격자 캐시**: 좌표를 ~1km 격자(`geocodeCellKey`)로 반올림. 인접 좌표는 같은 지명으로 간주 → 중복 호출 제거.
2. **저장소**: MVP는 `geocode_cache` 테이블(전역 공유). 모든 사용자가 같은 지역 결과를 재사용.

### 2.4 정책 준수
- Nominatim: 식별 가능한 User-Agent(연락처 포함), 호출 간 ≥1.1s 지연(`enrichTripsWithLocation`의 throttle), 결과 캐싱.

## 3. 모듈 구성 (`src/geocoding/`)

| 파일 | 역할 |
|------|------|
| `types.ts` | `GeocodeResult` / `GeocodeProvider` / `GeocodeCache` 인터페이스 |
| `nominatim.ts` | Nominatim 제공자 구현 |
| `index.ts` | `reverseGeocode`(캐시 우선) + 인메모리 캐시 + 셀 키 |
| `enrich-trips.ts` | 그룹핑 결과(Trip[])에 지명 부여 |
| `live-check.ts` | 실제 호출 검증 스크립트 |

## 4. 데이터 흐름

```
groupTrips() → Trip[] (centroid 보유)
      │
      ▼
enrichTripsWithLocation(trips, { provider, cache })
   ├─ 캐시 히트 → 즉시 반환 (API 0회)
   └─ 미스 → Nominatim 호출 → 캐시 저장
      │
      ▼
TripWithLocation[] (locationSummary, country, city)
      │
      ▼
trips.location_summary 영속화 (다음 단계)
```

## 5. 검증 결과 (실제 호출)
```
제주(성산 인근): 서귀포시, 대한민국
부산(해운대 인근): 부산광역시, 대한민국
캐시 재호출(제주): 서귀포시, 대한민국 — API 호출 없이 반환
```
→ 한국어 지명 정확. 캐시 동작 확인.

## 6. 운영 시 적용
- **앱에서 직접 Nominatim 호출 금지** 권장: 키/정책·CORS·throttle 관리를 위해 **Supabase Edge Function** 경유.
  - Edge Function이 `geocode_cache` 조회 → 미스 시 Nominatim 호출 → 캐시 저장(service_role) → 반환.
- 인메모리 캐시(`createMemoryCache`)는 테스트/단일 세션용. 운영은 `geocode_cache` 기반 캐시 구현으로 교체.

## 7. GPS 없는 여행
- centroid가 null인 여행(위치 사진 0개)은 지명 null → UI에서 사용자가 직접 장소 입력 유도.

## 8. 다음 단계
- [ ] `geocode_cache` 기반 `GeocodeCache` 구현 (인메모리 → DB)
- [ ] Edge Function 래퍼 (`/geocode`)
- [ ] 그룹핑 결과 영속화 시 `location_summary` 함께 저장
- [ ] (선택) 명소 단위(zoom↑) 표시 옵션
