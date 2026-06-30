# 여행 자동 그룹핑 모듈

`docs/grouping-algorithm.md`의 4-Stage 알고리즘을 구현한 **순수 TypeScript** 모듈.
외부 의존성이 없어 앱(온디바이스)과 Supabase Edge Function 양쪽에서 그대로 사용 가능.

## 구성
| 파일 | 역할 |
|------|------|
| `types.ts` | 입출력 타입 + `DEFAULT_PARAMS` |
| `geo.ts` | Haversine 거리, centroid, 격자 셀 |
| `grouping.ts` | 핵심 로직 (estimateHome / segmentByTime / groupTrips) |
| `index.ts` | 공개 API |
| `sanity-check.ts` | 합성 데이터 검증 |
| `run-calibration.ts` | 실데이터(JSON) 캘리브레이션 러너 |

## 사용 예
```ts
import { groupTrips, DEFAULT_PARAMS } from './grouping';

const trips = groupTrips(photos, DEFAULT_PARAMS);
// trips: { clusterId, startAt, endAt, centroid, photoIds, gpsLessCount }[]
```

## 검증 (합성 데이터)
```bash
node src/grouping/sanity-check.ts
# → 여행 2건(제주/부산) 감지, 집 일상·근교 나들이 제외 시 PASS
```

## 캘리브레이션 (실데이터)
PoC 앱(`poc/device-photo-exif`)에서 추출한 메타데이터를 아래 형식 JSON으로 저장:
```json
[{ "localAssetId": "x", "takenAt": 1710380000000, "lat": 33.5, "lng": 126.5 }]
```
실행:
```bash
node src/grouping/run-calibration.ts photos.json
# 파라미터 조정하며 반복
node src/grouping/run-calibration.ts photos.json homeRadiusKm=20 minTripPhotos=8
```

## 참고
- Node 22.6+ (권장 23+/24)에서 `.ts` 직접 실행. 별도 빌드 불필요.
- 본격 위치 반경 군집이 필요해지면 `geo.ts`를 PostGIS 기반으로 교체 검토.
