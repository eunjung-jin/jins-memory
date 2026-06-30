// 역지오코딩 공개 API — 캐시 우선 + 제공자 호출
import type { LatLng } from '../grouping/types.ts';
import { gridCellKey } from '../grouping/geo.ts';
import type {
  GeocodeCache,
  GeocodeProvider,
  GeocodeResult,
} from './types.ts';

export type { GeocodeResult, GeocodeProvider, GeocodeCache } from './types.ts';
export { createNominatimProvider } from './nominatim.ts';

/** 캐시 키: 좌표를 약 cacheCellKm 격자로 반올림 (인접 좌표는 동일 지명으로 간주) */
export function geocodeCellKey(point: LatLng, cacheCellKm = 1): string {
  return gridCellKey(point, cacheCellKm);
}

/** 간단한 인메모리 캐시 (테스트/단일 세션용) */
export function createMemoryCache(): GeocodeCache {
  const store = new Map<string, GeocodeResult>();
  return {
    async get(key) {
      return store.get(key) ?? null;
    },
    async set(key, value) {
      store.set(key, value);
    },
  };
}

export interface ReverseGeocodeOptions {
  provider: GeocodeProvider;
  cache?: GeocodeCache;
  /** 캐시 격자 크기(km). 기본 1km */
  cacheCellKm?: number;
}

/**
 * 캐시 우선 역지오코딩.
 * 1) 캐시 히트 → 즉시 반환 (API 호출 0)
 * 2) 미스 → 제공자 호출 후 캐시에 저장
 */
export async function reverseGeocode(
  point: LatLng,
  opts: ReverseGeocodeOptions,
): Promise<GeocodeResult | null> {
  const key = geocodeCellKey(point, opts.cacheCellKm ?? 1);

  if (opts.cache) {
    const cached = await opts.cache.get(key);
    if (cached) return cached;
  }

  const result = await opts.provider.reverse(point);
  if (result && opts.cache) {
    await opts.cache.set(key, result);
  }
  return result;
}
