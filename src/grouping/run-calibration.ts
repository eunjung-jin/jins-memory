// 실데이터 캘리브레이션 러너
// 사용법:
//   node src/grouping/run-calibration.ts <photos.json> [paramKey=value ...]
//
// <photos.json> 형식: PhotoMeta[] 배열
//   [{ "localAssetId": "...", "takenAt": 1710380000000, "lat": 33.5, "lng": 126.5 }, ...]
//   (PoC 앱이 추출한 메타데이터를 이 형식으로 export 하면 됨. takenAt은 epoch ms)
//
// 파라미터 오버라이드 예:
//   node src/grouping/run-calibration.ts photos.json homeRadiusKm=20 minTripPhotos=8
import { readFileSync } from 'node:fs';
import { groupTrips, DEFAULT_PARAMS } from './index.ts';
import type { GroupingParams, PhotoMeta } from './index.ts';

const [, , file, ...overrides] = process.argv;

if (!file) {
  console.error('사용법: node src/grouping/run-calibration.ts <photos.json> [key=value ...]');
  process.exit(1);
}

// 파라미터 오버라이드 파싱
const params: GroupingParams = { ...DEFAULT_PARAMS };
for (const ov of overrides) {
  const [k, v] = ov.split('=');
  if (k in params && v !== undefined) {
    (params as Record<string, number>)[k] = Number(v);
  } else {
    console.warn(`무시된 파라미터: ${ov}`);
  }
}

const raw = readFileSync(file, 'utf8');
const photos: PhotoMeta[] = JSON.parse(raw);

const withGps = photos.filter((p) => p.lat != null && p.lng != null).length;
const trips = groupTrips(photos, params);

console.log('=== 입력 ===');
console.log(`사진 ${photos.length}장 (GPS 보유 ${withGps}장, ${
  photos.length ? Math.round((withGps / photos.length) * 100) : 0
}%)`);
console.log('파라미터:', JSON.stringify(params));

console.log('\n=== 감지된 여행 ===');
console.log(`총 ${trips.length}건\n`);
for (const t of trips) {
  const s = new Date(t.startAt).toISOString().slice(0, 10);
  const e = new Date(t.endAt).toISOString().slice(0, 10);
  const span = s === e ? s : `${s} ~ ${e}`;
  console.log(
    `- ${span} | 사진 ${t.photoIds.length}장 (GPS없음 ${t.gpsLessCount}) | 중심 ` +
      `${t.centroid ? `${t.centroid.lat.toFixed(3)},${t.centroid.lng.toFixed(3)}` : 'N/A'}`,
  );
}

const inTrips = trips.reduce((n, t) => n + t.photoIds.length, 0);
console.log(
  `\n여행에 포함된 사진 ${inTrips}장 / 일상으로 분류 ${photos.length - inTrips}장`,
);
console.log(
  '\n[캘리브레이션 팁] 실제 여행보다 적게 잡히면 homeRadiusKm↓ 또는 minTripPhotos↓, ' +
    '일상이 여행으로 잡히면 homeRadiusKm↑ 또는 minTripPhotos↑',
);
