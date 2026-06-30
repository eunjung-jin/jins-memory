# Supabase 스키마 설계 문서

| 항목 | 내용 |
|------|------|
| 작성일 | 2026-06-30 |
| 대상 | Supabase (PostgreSQL) |
| 마이그레이션 | `supabase/migrations/0001_initial_schema.sql` |
| 근거 | `docs/requirements.md` v0.2 §8 |

---

## 1. 테이블 개요

| 테이블 | 역할 | 행 단위 |
|--------|------|---------|
| `profiles` | auth.users 확장 프로필 | 사용자 1명 |
| `trips` | 자동 그룹핑된 여행 | 여행 1건 |
| `photos` | 기기 사진의 메타데이터 | 사진 1장 |
| `scan_jobs` | 스캔/분석 작업 진행 상태 | 작업 1건 |

관계: `profiles 1 — N trips`, `trips 1 — N photos`, `profiles 1 — N scan_jobs`.

## 2. 주요 설계 결정

### 2.1 사진 원본은 저장하지 않는다
- `photos`는 메타데이터(촬영시각·GPS·EXIF)와 `local_asset_id`(기기 자산 ID), 선택적 `thumb_url`만 보관.
- 원본 이미지는 기기에 유지 → 저장 비용·저작권·프라이버시 모두 유리.

### 2.2 trip_photos 조인 테이블 미사용
- 사진은 한 여행에서 촬영되므로 **한 여행에만 속함** → `photos.trip_id` 직접 참조.
- 베스트 컷 여부(`is_selected`)·정렬(`sort_order`)도 사진 속성으로 `photos`에 둠.
- 장점: 조인 1단계 감소, 쿼리 단순/고속.
- 트레이드오프: "한 사진을 여러 여행에 노출"이 필요해지면 그때 조인 테이블로 확장.

### 2.3 증분 스캔 멱등성
- `unique (user_id, local_asset_id)` 제약으로 같은 기기 사진을 중복 등록하지 않음.
- 증분 스캔은 `upsert (on conflict do nothing/update)` 로 안전하게 반복 가능.

### 2.4 순환 참조 처리
- `trips.cover_photo_id → photos.id` 와 `photos.trip_id → trips.id` 가 상호 참조.
- `photos` 생성 후 `alter table`로 `cover_photo_id` FK를 나중에 추가하여 해결.
- 양쪽 모두 `on delete set null` → 한쪽 삭제 시 참조만 끊고 데이터 보존.

### 2.5 RLS 전면 적용
- 4개 테이블 모두 `enable row level security` + `auth.uid() = user_id` 정책.
- 클라이언트가 anon key로 직접 접근해도 본인 행만 보임 → 앱에서 별도 권한 체크 부담 감소.

### 2.6 신규 가입 자동 프로필
- `auth.users` insert 트리거(`handle_new_user`)로 `profiles` 자동 생성.
- `security definer`로 권한 우회하여 안전하게 삽입.

## 3. 인덱스 근거

| 인덱스 | 목적 |
|--------|------|
| `idx_trips_user_start (user_id, start_date desc)` | 타임라인 연도/최신순 조회 |
| `idx_photos_user_taken (user_id, taken_at)` | 시간 기반 그룹핑·정렬 |
| `idx_photos_trip (trip_id)` | 여행 상세에서 사진 로드 |
| `idx_photos_user_cluster (user_id, group_cluster_id)` | 그룹핑 작업 |
| `idx_photos_user_latlng (user_id, lat, lng)` | 위치 필터/군집 |
| `idx_scan_jobs_user_created` | 최근 작업 상태 조회 |

## 4. 향후 검토 사항
- **위치 반경 검색**: 본격적인 "N km 이내" 군집이 필요하면 PostGIS(`geography`) + GiST 인덱스 도입.
- **썸네일 저장**: Supabase Storage 버킷 + RLS 정책 별도 마이그레이션 필요.
- **AI 선별 결과 이력**: 재분석/모델 교체 대비 별도 `photo_analyses` 테이블 분리 고려.
- **소프트 삭제**: 여행/사진 복구가 필요하면 `deleted_at` 컬럼 + 정책 추가.

## 5. 적용 방법
```bash
# Supabase CLI 사용 시
supabase db push        # 또는
supabase migration up

# 또는 Supabase 대시보드 SQL Editor에 0001_initial_schema.sql 붙여넣기
```

## 6. 검증 체크리스트
- [ ] 가입 시 `profiles` 행이 자동 생성되는가
- [ ] 다른 사용자의 trips/photos가 RLS로 안 보이는가
- [ ] 같은 `local_asset_id` 재삽입이 unique 제약에 막히는가(upsert 동작)
- [ ] 여행 삭제 시 사진의 `trip_id`가 null로 풀리는가
- [ ] 사진 삭제 시 `trips.cover_photo_id`가 null로 풀리는가
