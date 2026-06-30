// 영속화 오케스트레이션 검증 (DB 없이 인메모리 포트 + 스텁 지오코더)
// 실행: node src/persistence/persist.test.ts
import { groupTrips, DEFAULT_PARAMS } from '../grouping/index.ts';
import type { PhotoMeta, LatLng } from '../grouping/index.ts';
import { enrichTripsWithLocation } from '../geocoding/enrich-trips.ts';
import type { GeocodeProvider } from '../geocoding/index.ts';
import { createMemoryCache } from '../geocoding/index.ts';
import { persistGroupingResult } from './persist.ts';
import type { PersistencePort, PhotoInput, TripRow } from './port.ts';

// ── 인메모리 포트 (DB 흉내) ─────────────────────────────────────────────
interface PhotoRow {
  id: string;
  user_id: string;
  local_asset_id: string;
  trip_id: string | null;
}
interface TripRecord extends TripRow {
  id: string;
  user_id: string;
  cover_photo_id: string | null;
}

function createMemoryPort() {
  const photos = new Map<string, PhotoRow>(); // key: user|localAssetId
  const trips = new Map<string, TripRecord>();
  let pSeq = 0;
  let tSeq = 0;

  const port: PersistencePort = {
    async upsertPhotos(userId, input: PhotoInput[]) {
      const map = new Map<string, string>();
      for (const p of input) {
        const key = `${userId}|${p.localAssetId}`;
        let row = photos.get(key);
        if (!row) {
          row = {
            id: `p${pSeq++}`,
            user_id: userId,
            local_asset_id: p.localAssetId,
            trip_id: null,
          };
          photos.set(key, row);
        }
        map.set(p.localAssetId, row.id);
      }
      return map;
    },
    async deleteTripsForUser(userId) {
      for (const [id, t] of [...trips]) if (t.user_id === userId) trips.delete(id);
      for (const row of photos.values()) if (row.user_id === userId) row.trip_id = null;
    },
    async insertTrip(userId, trip) {
      const id = `t${tSeq++}`;
      trips.set(id, { id, user_id: userId, cover_photo_id: null, ...trip });
      return id;
    },
    async assignPhotosToTrip(userId, tripId, localAssetIds) {
      for (const lid of localAssetIds) {
        const row = photos.get(`${userId}|${lid}`);
        if (row) row.trip_id = tripId;
      }
    },
    async setTripCover(tripId, coverPhotoId) {
      const t = trips.get(tripId);
      if (t) t.cover_photo_id = coverPhotoId;
    },
  };

  return { port, photos, trips };
}

// ── 스텁 지오코더 (네트워크 없음) ──────────────────────────────────────
function stubProvider(): GeocodeProvider {
  const name = (p: LatLng) =>
    p.lat > 35 ? '부산광역시' : '서귀포시'; // 대충 구분
  return {
    name: 'stub',
    async reverse(p: LatLng) {
      const city = name(p);
      return { country: '대한민국', city, place: null, summary: `${city}, 대한민국`, provider: 'stub' };
    },
  };
}

// ── 테스트 데이터 (그룹핑 sanity와 동일 골격) ──────────────────────────
const SEOUL = { lat: 37.5665, lng: 126.978 };
const JEJU = { lat: 33.4996, lng: 126.5312 };
const BUSAN = { lat: 35.1796, lng: 129.0756 };
function day(y: number, m: number, d: number, h = 12) {
  return new Date(y, m - 1, d, h).getTime();
}
let seq = 0;
function photo(at: number, loc: LatLng | null): PhotoMeta {
  return { localAssetId: `a${seq++}`, takenAt: at, lat: loc?.lat ?? null, lng: loc?.lng ?? null };
}

const photos: PhotoMeta[] = [
  photo(day(2025, 1, 5, 23), SEOUL),
  photo(day(2025, 1, 6, 9), SEOUL),
  // 제주 6장 + GPS없음 1장
  photo(day(2025, 3, 14, 11), JEJU),
  photo(day(2025, 3, 14, 15), JEJU),
  photo(day(2025, 3, 15, 10), JEJU),
  photo(day(2025, 3, 15, 14), null),
  photo(day(2025, 3, 15, 19), JEJU),
  photo(day(2025, 3, 16, 9), JEJU),
  // 부산 당일치기 5장
  photo(day(2025, 5, 3, 9), BUSAN),
  photo(day(2025, 5, 3, 11), BUSAN),
  photo(day(2025, 5, 3, 13), BUSAN),
  photo(day(2025, 5, 3, 16), BUSAN),
  photo(day(2025, 5, 3, 18), BUSAN),
];

// ── 파이프라인 실행 ────────────────────────────────────────────────────
const USER = 'user-1';
const trips = groupTrips(photos, DEFAULT_PARAMS);
const enriched = await enrichTripsWithLocation(trips, {
  provider: stubProvider(),
  cache: createMemoryCache(),
  throttleMs: 0,
});

const { port, photos: dbPhotos, trips: dbTrips } = createMemoryPort();
const result = await persistGroupingResult(port, USER, photos, enriched, { mode: 'replace' });

// ── 검증 ───────────────────────────────────────────────────────────────
console.log('영속화 결과:', result);
console.log('\n생성된 여행:');
for (const t of dbTrips.values()) {
  const assigned = [...dbPhotos.values()].filter((p) => p.trip_id === t.id).length;
  console.log(
    `- ${t.title} | ${t.startDate}~${t.endDate} | ${t.locationSummary} | ` +
      `사진 ${assigned}장 | 커버 ${t.cover_photo_id ?? 'none'}`,
  );
}

const checks: [string, boolean][] = [
  ['사진 13장 upsert', result.upsertedPhotos === 13],
  ['여행 2건 생성', result.createdTrips === 2],
  ['제주 여행에 6장 귀속', [...dbTrips.values()].some(
    (t) => t.locationSummary?.startsWith('서귀포') &&
      [...dbPhotos.values()].filter((p) => p.trip_id === t.id).length === 6,
  )],
  ['부산 여행에 5장 귀속', [...dbTrips.values()].some(
    (t) => t.locationSummary?.startsWith('부산') &&
      [...dbPhotos.values()].filter((p) => p.trip_id === t.id).length === 5,
  )],
  ['모든 여행 커버 지정', [...dbTrips.values()].every((t) => t.cover_photo_id !== null)],
  ['일상 사진(서울 2장)은 미귀속', [...dbPhotos.values()].filter((p) => p.trip_id === null).length === 2],
  ['제목 자동 생성', [...dbTrips.values()].every((t) => (t.title ?? '').includes('2025'))],
];

let allOk = true;
console.log('\n검증:');
for (const [label, ok] of checks) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}`);
  if (!ok) allOk = false;
}
console.log(`\n${allOk ? '✅ ALL PASS' : '❌ FAIL'}`);
process.exit(allOk ? 0 : 1);
