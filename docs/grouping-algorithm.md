# 여행 자동 그룹핑 알고리즘 — 파라미터 정의

| 항목 | 내용 |
|------|------|
| 작성일 | 2026-07-01 |
| 근거 | `docs/requirements.md` v0.2 §5 FR-3 |
| 입력 | `photos` (taken_at, lat, lng) — 한 사용자의 전체 사진 |
| 출력 | `trips` + 각 사진의 `trip_id`, `group_cluster_id` |
| 상태 | 파라미터 초안 (실데이터로 캘리브레이션 필요) |

---

## 1. 핵심 난제: "여행" vs "일상"

사진첩에는 여행 사진뿐 아니라 집·동네에서 찍은 일상 사진이 섞여 있다.
시간·거리만으로 묶으면 일상 사진도 "여행"이 되어버린다.
→ **생활권(집)을 먼저 추정하고, 생활권에서 충분히 떨어진 사진 묶음만 여행으로 판별**한다.

## 2. 알고리즘 단계 (4-Stage)

```
[Stage 0] 집(생활권) 좌표 추정
[Stage 1] 시간 기반 세그먼트 분할
[Stage 2] 여행 여부 판별 (생활권 거리 + 최소 조건)
[Stage 3] 여행 메타 산출 (기간·대표지명) + GPS 없는 사진 귀속
```

### Stage 0 — 집(생활권) 추정
- 전체 사진 좌표를 격자(예: 약 1km 셀)로 집계하여 **가장 많은 사진이 찍힌 셀**을 생활권 중심으로 추정.
- 대안: 야간(예: 22시~07시) 촬영 사진의 최빈 위치 → 집일 확률↑.
- 사용자가 직접 "집 위치"를 설정하면 그 값을 우선 사용(향후 기능).

### Stage 1 — 시간 세그먼트 분할
- 사진을 `taken_at` 오름차순 정렬.
- 인접 사진 간 시간 간격이 `TIME_GAP_HOURS`를 초과하면 그 지점에서 세그먼트를 분리.
- 다일(多日) 여행은 매일 사진이 찍혀 내부 간격이 작으므로 한 세그먼트로 유지됨.

### Stage 2 — 여행 판별
세그먼트별로 다음을 모두 만족하면 "여행"으로 채택:
- 세그먼트 중심(centroid)이 생활권에서 `HOME_RADIUS_KM` 이상 떨어짐, **그리고**
- 사진 수 ≥ `MIN_TRIP_PHOTOS`.
- (선택) 지속시간 ≥ `MIN_TRIP_DURATION_HOURS` — 당일치기 허용을 위해 작게 설정.

생활권 이내 세그먼트, 사진 수 미달 세그먼트는 여행에서 제외(일상).

### Stage 3 — 메타 산출 & GPS 없는 사진 처리
- 여행 기간 = 세그먼트 내 최소/최대 `taken_at`의 날짜.
- 대표 지명 = 세그먼트 내 GPS 사진의 주 군집을 역지오코딩(별도).
- 세그먼트 안에 멀리 떨어진 하위 군집(예: 두 도시)이 있어도 MVP에선 **한 여행**으로 두되 복수 장소를 기록.
- **GPS 없는 사진**: 좌표가 없으므로 위치 판별 불가 → `taken_at`이 어느 여행 세그먼트의 시간 범위에 들어가면 그 여행에 귀속. 어디에도 안 들면 일상으로 분류.

## 3. 파라미터 정의 (튜닝 대상)

| 파라미터 | 기본값 | 단위 | 의미 | 너무 작으면 | 너무 크면 |
|----------|--------|------|------|-------------|-----------|
| `TIME_GAP_HOURS` | **36** | 시간 | 이 간격 넘으면 다른 여행으로 분리 | 한 여행이 날짜별로 쪼개짐 | 별개 여행이 하나로 합쳐짐 |
| `HOME_RADIUS_KM` | **30** | km | 생활권 반경. 이 안은 일상 | 근교 나들이를 여행으로 과탐지 | 가까운 여행을 일상으로 누락 |
| `MIN_TRIP_PHOTOS` | **5** | 장 | 여행 성립 최소 사진 수 | 우연히 찍은 몇 장이 여행됨 | 사진 적게 찍은 여행 누락 |
| `MIN_TRIP_DURATION_HOURS` | **2** | 시간 | 여행 최소 지속시간(당일치기 허용) | 스쳐간 곳이 여행됨 | 짧은 나들이 누락 |
| `HOME_CELL_SIZE_KM` | **1** | km | 생활권 추정 격자 셀 크기 | 집 군집이 흩어짐 | 집과 인근이 뭉침 |
| `NIGHT_HOURS` | **22–07** | 시 | 집 추정용 야간 시간대 | — | — |
| `SUBCLUSTER_SPLIT_KM` | **100** | km | (선택) 이 이상 떨어진 하위군집은 별도 여행 후보 | 도시 이동이 분리됨 | 원거리 이동이 한 여행 |

> 기본값은 "국내 가족여행"을 기준으로 한 출발점이며, **실제 사진첩으로 검증 후 조정**해야 한다.
> 예: 해외여행 비중이 높으면 `HOME_RADIUS_KM`는 그대로 두되 `SUBCLUSTER_SPLIT_KM`로 도시 단위 분리를 켤 수 있다.

## 4. 의사코드

```
function groupTrips(photos, P):                 # P = 파라미터
    geo = photos.filter(p => p.lat != null)
    home = estimateHome(geo, P)                 # Stage 0

    sorted = photos.sortBy(p => p.taken_at)
    segments = []
    cur = [sorted[0]]
    for prev, p in pairs(sorted):               # Stage 1
        if hours(p.taken_at - prev.taken_at) > P.TIME_GAP_HOURS:
            segments.push(cur); cur = []
        cur.push(p)
    segments.push(cur)

    trips = []
    for seg in segments:                        # Stage 2
        segGeo = seg.filter(p => p.lat != null)
        if segGeo.isEmpty(): continue           # 위치 전혀 없음 → 보류(시간귀속 단계서 처리)
        c = centroid(segGeo)
        if distanceKm(c, home) >= P.HOME_RADIUS_KM
           and seg.length >= P.MIN_TRIP_PHOTOS
           and durationHours(seg) >= P.MIN_TRIP_DURATION_HOURS:
            trips.push(makeTrip(seg))            # Stage 3

    assignGpsLessPhotos(photos, trips)           # 시간 범위로 귀속
    return trips

function estimateHome(geo, P):
    night = geo.filter(p => hourOf(p.taken_at) in P.NIGHT_HOURS)
    pool  = night.nonEmpty() ? night : geo
    cells = groupByGridCell(pool, P.HOME_CELL_SIZE_KM)
    return centroid(cells.maxBy(c => c.count))
```

## 5. 엣지 케이스

| 상황 | 처리 |
|------|------|
| GPS 전혀 없는 사진만 있음 | 시간 세그먼트만으로 그룹핑, 장소는 미표시(사용자 입력 유도) |
| 집 근처에서 며칠 촬영(집들이 등) | 생활권 이내 → 일상으로 분류(여행 아님) |
| 출장/장기 체류 | 한 세그먼트로 묶임. 필요시 사용자 분리 기능(FR-3.5) |
| 자정 넘김 촬영 | 날짜가 아닌 `taken_at` 절대시간 간격으로 분할하므로 영향 없음 |
| 비행기/이동 중 | 하위군집 분리 옵션(`SUBCLUSTER_SPLIT_KM`)으로 출발지/도착지 분리 가능 |

## 6. 캘리브레이션 방법
1. 본인 사진첩 메타데이터를 추출(앞서 만든 PoC 앱 활용).
2. 위 의사코드를 스크립트로 돌려 자동 분류 결과를 본인이 기억하는 실제 여행과 대조.
3. 오탐(일상→여행)·누락(여행→일상) 사례를 보고 `HOME_RADIUS_KM`, `MIN_TRIP_PHOTOS`, `TIME_GAP_HOURS` 순으로 조정.
4. 사용자별 차이가 크면 파라미터를 사용자 설정으로 노출(향후).

## 7. 다음 단계
- [x] 의사코드를 TypeScript로 구현 → `src/grouping/` (순수 함수, 앱/Edge Function 공용)
- [x] 합성 데이터 검증 → `sanity-check.ts` PASS (여행 2건 감지, 일상 제외)
- [ ] PoC 메타데이터로 캘리브레이션 → `run-calibration.ts` 준비 완료, 실데이터 투입 대기
- [ ] 결과를 `photos.group_cluster_id` / `trips`에 반영하는 영속화 로직
- [x] 역지오코딩 연동(대표 지명) → `src/geocoding/` (실제 호출 검증 완료, `docs/geocoding.md`)
