// 합성 데이터로 그룹핑 로직 검증 — `node src/grouping/sanity-check.ts`
import { groupTrips, DEFAULT_PARAMS } from './index.ts';
import type { PhotoMeta } from './index.ts';

const SEOUL = { lat: 37.5665, lng: 126.978 }; // 집(생활권)
const JEJU = { lat: 33.4996, lng: 126.5312 }; // 여행지 1
const BUSAN = { lat: 35.1796, lng: 129.0756 }; // 여행지 2

function day(y: number, m: number, d: number, h = 12): number {
  return new Date(y, m - 1, d, h).getTime();
}

let seq = 0;
function photo(at: number, loc: { lat: number; lng: number } | null): PhotoMeta {
  return {
    localAssetId: `a${seq++}`,
    takenAt: at,
    lat: loc?.lat ?? null,
    lng: loc?.lng ?? null,
  };
}

const photos: PhotoMeta[] = [
  // 집에서 일상 사진 (여행 아님) — 여러 날, 야간 포함
  photo(day(2025, 1, 5, 23), SEOUL),
  photo(day(2025, 1, 6, 9), SEOUL),
  photo(day(2025, 1, 12, 22), SEOUL),
  photo(day(2025, 2, 2, 21), SEOUL),

  // 제주 가족여행: 2025-03-14 ~ 03-16 (사진 6장, 집에서 멀리)
  photo(day(2025, 3, 14, 11), JEJU),
  photo(day(2025, 3, 14, 15), JEJU),
  photo(day(2025, 3, 15, 10), JEJU),
  photo(day(2025, 3, 15, 14), null), // GPS 없는 사진 → 시간으로 귀속되어야 함
  photo(day(2025, 3, 15, 19), JEJU),
  photo(day(2025, 3, 16, 9), JEJU),

  // 집 복귀 후 일상
  photo(day(2025, 3, 20, 22), SEOUL),

  // 부산 당일치기: 2025-05-03 (사진 5장)
  photo(day(2025, 5, 3, 9), BUSAN),
  photo(day(2025, 5, 3, 11), BUSAN),
  photo(day(2025, 5, 3, 13), BUSAN),
  photo(day(2025, 5, 3, 16), BUSAN),
  photo(day(2025, 5, 3, 18), BUSAN),

  // 근교 나들이 (집에서 가까움, 사진 적음) → 여행 아님이어야 함
  photo(day(2025, 6, 1, 12), { lat: 37.6, lng: 127.0 }),
  photo(day(2025, 6, 1, 13), { lat: 37.6, lng: 127.0 }),
];

const trips = groupTrips(photos, DEFAULT_PARAMS);

console.log(`감지된 여행 수: ${trips.length}\n`);
for (const t of trips) {
  const start = new Date(t.startAt).toISOString().slice(0, 10);
  const end = new Date(t.endAt).toISOString().slice(0, 10);
  console.log(
    `- ${t.clusterId}: ${start} ~ ${end} | 사진 ${t.photoIds.length}장 ` +
      `(GPS없음 ${t.gpsLessCount}장) | 중심 ` +
      `${t.centroid ? `${t.centroid.lat.toFixed(3)},${t.centroid.lng.toFixed(3)}` : 'N/A'}`,
  );
}

// 기대: 여행 2건(제주 6장+GPS없음 포함, 부산 5장). 집 일상/근교 나들이는 제외.
const ok = trips.length === 2;
console.log(`\n검증: ${ok ? '✅ PASS (여행 2건 감지)' : '❌ FAIL'}`);
process.exit(ok ? 0 : 1);
