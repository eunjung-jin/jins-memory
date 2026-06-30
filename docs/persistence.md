# 영속화 로직 설계

| 항목 | 내용 |
|------|------|
| 작성일 | 2026-07-01 |
| 근거 | `docs/requirements.md` v0.2 §5 FR-3, §8 데이터 모델 |
| 구현 | `src/persistence/` |
| 상태 | 인메모리 포트로 오케스트레이션 검증 완료 (ALL PASS) |

---

## 1. 목적
그룹핑(`src/grouping`) + 역지오코딩(`src/geocoding`) 결과를 Supabase `photos`/`trips`에 저장.

## 2. 구조 — 포트/어댑터

```
persistGroupingResult()  ← 순수 오케스트레이션 (port.ts 인터페이스에만 의존)
        │
        ├── createSupabaseAdapter(client)   ← 운영: 실제 DB
        └── createMemoryPort() (테스트)      ← 검증: DB 없이 실행
```

| 파일 | 역할 |
|------|------|
| `port.ts` | `PersistencePort` 인터페이스 + 입력 타입 |
| `persist.ts` | 오케스트레이션 (upsert→여행생성→귀속→커버) |
| `supabase-adapter.ts` | `@supabase/supabase-js` 기반 포트 구현 |
| `persist.test.ts` | 인메모리 포트 + 스텁 지오코더로 E2E 검증 |

이 분리 덕분에 **실제 DB 없이도 핵심 로직을 검증**할 수 있고, 추후 DB를 바꿔도 오케스트레이션은 그대로다.

## 3. 처리 흐름 (persistGroupingResult)
1. **사진 upsert** — `unique(user_id, local_asset_id)` 기준 멱등. `localAssetId → DB photo id` 매핑 확보.
2. **기존 여행 처리** — `mode='replace'`면 사용자의 기존 여행 삭제(FK on delete set null로 photos.trip_id 해제).
3. **여행별 반복** — trips 행 생성 → 사진 귀속(`trip_id`) → 커버 사진 지정.

## 4. 주요 결정

### 4.1 제목 자동 생성
- 기본 규칙: `"YYYY 지명"` (예: "2025 서귀포시"). 지명 없으면 `"YYYY 여행"`.
- 사용자는 이후 편집 가능(FR-5.4). `titleFor` 옵션으로 규칙 교체 가능.

### 4.2 커버 사진
- MVP: 여행의 **첫 사진**(시간순). AI 선별(P1) 도입 시 **최고 품질 사진**으로 교체 예정.

### 4.3 replace vs append 모드
| 모드 | 동작 | 용도 | 주의 |
|------|------|------|------|
| `replace` | 기존 여행 삭제 후 재생성 | 전체 재그룹핑 | **사용자 편집(제목/메모) 사라짐** |
| `append` | 새 여행만 추가 | 증분 스캔 | 기존 여행과 중복/경계 처리 별도 필요 |

> ⚠️ 현재 `replace`는 단순·정확하지만 사용자 편집을 보존하지 못한다.
> 향후: 여행을 안정 키(예: 시작일+지역)로 매칭해 **편집 보존 머지** 전략 필요. (다음 단계)

### 4.4 멱등성
- 사진 upsert는 재실행해도 안전(중복 생성 없음). 증분 스캔의 토대.

## 5. 검증 결과 (persist.test.ts)
```
사진 13장 upsert / 여행 2건 생성 / 11장 귀속
- 2025 서귀포시 | 2025-03-14~16 | 서귀포시, 대한민국 | 6장 | 커버 지정
- 2025 부산광역시 | 2025-05-03    | 부산광역시, 대한민국 | 5장 | 커버 지정
→ 일상(서울 2장) 미귀속, 제목 자동생성, 커버 지정 모두 ✅ ALL PASS
```

## 6. 운영 연결 (앱/Edge Function)
```ts
import { createClient } from '@supabase/supabase-js';
import { createSupabaseAdapter } from './persistence/supabase-adapter';
import { persistGroupingResult } from './persistence/persist';

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { /* user JWT */ });
const port = createSupabaseAdapter(client);
await persistGroupingResult(port, userId, photos, enrichedTrips, { mode: 'replace' });
```
- RLS가 `auth.uid() = user_id`를 강제하므로, 사용자 JWT로 만든 클라이언트면 본인 데이터만 기록됨.
- 대량 처리는 `scan_jobs`로 진행률 추적(별도 연결 예정).

## 7. 다음 단계
- [ ] `append`/머지 전략 (사용자 편집 보존)
- [ ] `scan_jobs` 진행률 업데이트 연동
- [ ] `photos.place_name` 채우기(여행 지명 전파) — 선택
- [ ] 실제 Supabase 인스턴스에 마이그레이션 적용 후 통합 테스트
