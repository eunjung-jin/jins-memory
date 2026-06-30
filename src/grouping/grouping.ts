// 여행 자동 그룹핑 — 핵심 로직 (순수 함수)
// 근거: docs/grouping-algorithm.md §2 4-Stage
import type { GroupingParams, LatLng, PhotoMeta, Trip } from './types.ts';
import { DEFAULT_PARAMS } from './types.ts';
import { centroid, distanceKm, gridCellKey } from './geo.ts';

const HOUR_MS = 3600 * 1000;

function asLatLng(p: PhotoMeta): LatLng | null {
  return p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null;
}

function hourOf(epochMs: number): number {
  return new Date(epochMs).getHours();
}

/** 야간 시간대 여부 (예: 22~07은 22,23,0..6) */
function isNight(epochMs: number, startHour: number, endHour: number): boolean {
  const h = hourOf(epochMs);
  return startHour <= endHour
    ? h >= startHour && h < endHour
    : h >= startHour || h < endHour; // 자정을 넘는 구간
}

/**
 * Stage 0 — 집(생활권) 좌표 추정.
 * 야간 사진 우선, 없으면 전체. 격자 셀 중 사진이 가장 많은 셀의 중심.
 */
export function estimateHome(
  photos: PhotoMeta[],
  params: GroupingParams,
): LatLng | null {
  const geo = photos.filter((p) => asLatLng(p) !== null);
  if (geo.length === 0) return null;

  const night = geo.filter((p) =>
    isNight(p.takenAt, params.nightStartHour, params.nightEndHour),
  );
  const pool = night.length > 0 ? night : geo;

  const cells = new Map<string, LatLng[]>();
  for (const p of pool) {
    const ll = asLatLng(p)!;
    const key = gridCellKey(ll, params.homeCellSizeKm);
    const arr = cells.get(key);
    if (arr) arr.push(ll);
    else cells.set(key, [ll]);
  }

  let best: LatLng[] | null = null;
  for (const arr of cells.values()) {
    if (best === null || arr.length > best.length) best = arr;
  }
  return best ? centroid(best) : null;
}

/** Stage 1 — taken_at 정렬 후 시간 간격으로 세그먼트 분할 */
export function segmentByTime(
  photos: PhotoMeta[],
  params: GroupingParams,
): PhotoMeta[][] {
  if (photos.length === 0) return [];
  const sorted = [...photos].sort((a, b) => a.takenAt - b.takenAt);
  const gapMs = params.timeGapHours * HOUR_MS;

  const segments: PhotoMeta[][] = [];
  let cur: PhotoMeta[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].takenAt - sorted[i - 1].takenAt > gapMs) {
      segments.push(cur);
      cur = [];
    }
    cur.push(sorted[i]);
  }
  segments.push(cur);
  return segments;
}

/**
 * 전체 그룹핑 파이프라인.
 * @returns 여행 목록 (집/일상/조건 미달 세그먼트는 제외)
 */
export function groupTrips(
  photos: PhotoMeta[],
  params: GroupingParams = DEFAULT_PARAMS,
): Trip[] {
  if (photos.length === 0) return [];

  const home = estimateHome(photos, params); // Stage 0
  const segments = segmentByTime(photos, params); // Stage 1

  const trips: Trip[] = [];
  let clusterSeq = 0;

  for (const seg of segments) {
    // Stage 2 — 여행 판별
    const geo = seg.map(asLatLng).filter((x): x is LatLng => x !== null);
    if (geo.length === 0) continue; // 위치 전혀 없음 → 시간귀속 단계에서 처리

    const c = centroid(geo)!;
    const farEnough =
      home === null || distanceKm(c, home) >= params.homeRadiusKm;
    const durationHours =
      (seg[seg.length - 1].takenAt - seg[0].takenAt) / HOUR_MS;

    if (
      farEnough &&
      seg.length >= params.minTripPhotos &&
      durationHours >= params.minTripDurationHours
    ) {
      // Stage 3 — 메타 산출
      trips.push({
        clusterId: `trip-${clusterSeq++}`,
        startAt: seg[0].takenAt,
        endAt: seg[seg.length - 1].takenAt,
        centroid: c,
        photoIds: seg.map((p) => p.localAssetId),
        gpsLessCount: seg.length - geo.length,
      });
    }
  }

  assignGpsLessPhotos(photos, trips); // Stage 3 — GPS 없는 사진 귀속
  return trips;
}

/**
 * GPS 좌표가 없어 아직 어느 여행에도 못 들어간 사진을,
 * takenAt이 여행 시간 범위에 들면 해당 여행에 귀속.
 * (이미 세그먼트에 GPS 사진과 함께 묶인 경우는 photoIds에 이미 포함됨)
 */
function assignGpsLessPhotos(photos: PhotoMeta[], trips: Trip[]): void {
  const assigned = new Set<string>();
  for (const t of trips) for (const id of t.photoIds) assigned.add(id);

  for (const p of photos) {
    if (asLatLng(p) !== null) continue; // GPS 있는 사진은 대상 아님
    if (assigned.has(p.localAssetId)) continue; // 이미 귀속됨
    for (const t of trips) {
      if (p.takenAt >= t.startAt && p.takenAt <= t.endAt) {
        t.photoIds.push(p.localAssetId);
        t.gpsLessCount++;
        assigned.add(p.localAssetId);
        break;
      }
    }
  }
}
