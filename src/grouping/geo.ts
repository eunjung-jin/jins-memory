// 지리 계산 헬퍼 — 외부 의존성 없음
import type { LatLng } from './types.ts';

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** 두 좌표 간 대권 거리(km) — Haversine */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** 좌표 목록의 산술 평균 중심 (빈 배열이면 null) */
export function centroid(points: LatLng[]): LatLng | null {
  if (points.length === 0) return null;
  let sumLat = 0;
  let sumLng = 0;
  for (const p of points) {
    sumLat += p.lat;
    sumLng += p.lng;
  }
  return { lat: sumLat / points.length, lng: sumLng / points.length };
}

/**
 * 좌표를 약 cellSizeKm 크기의 격자 셀 키로 변환.
 * 위도 1도 ≈ 111km 기준. 경도는 위도에 따라 보정.
 */
export function gridCellKey(p: LatLng, cellSizeKm: number): string {
  const latDeg = cellSizeKm / 111;
  const lngDeg = cellSizeKm / (111 * Math.cos(toRad(p.lat)) || 1e-6);
  const latIdx = Math.floor(p.lat / latDeg);
  const lngIdx = Math.floor(p.lng / lngDeg);
  return `${latIdx}:${lngIdx}`;
}
