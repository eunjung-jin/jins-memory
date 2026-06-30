// 그룹핑 결과 ↔ 역지오코딩 통합
// 여행 centroid를 지명으로 변환하여 location_summary를 채운다.
import type { Trip } from '../grouping/types.ts';
import { reverseGeocode, type ReverseGeocodeOptions } from './index.ts';

/** 지명이 채워진 여행 */
export interface TripWithLocation extends Trip {
  locationSummary: string | null;
  country: string | null;
  city: string | null;
}

/**
 * 여행 목록에 지명을 부여한다.
 * - centroid가 없는 여행(GPS 사진 0개)은 지명 null.
 * - 여행당 1회만 호출 (캐시로 인접 여행 간 중복도 방지).
 * - Nominatim 정책(초당 1요청) 준수를 위해 순차 처리 + 호출 간 지연.
 */
export async function enrichTripsWithLocation(
  trips: Trip[],
  opts: ReverseGeocodeOptions & { throttleMs?: number },
): Promise<TripWithLocation[]> {
  const throttleMs = opts.throttleMs ?? 1100; // Nominatim: 초당 1요청 이하
  const out: TripWithLocation[] = [];

  for (let i = 0; i < trips.length; i++) {
    const t = trips[i];
    let locationSummary: string | null = null;
    let country: string | null = null;
    let city: string | null = null;

    if (t.centroid) {
      const r = await reverseGeocode(t.centroid, opts);
      if (r) {
        locationSummary = r.summary;
        country = r.country;
        city = r.city;
      }
    }

    out.push({ ...t, locationSummary, country, city });

    // 마지막이 아니고, 다음 호출이 캐시 미스일 수 있으니 정책상 지연
    if (i < trips.length - 1 && throttleMs > 0) {
      await new Promise((res) => setTimeout(res, throttleMs));
    }
  }
  return out;
}
