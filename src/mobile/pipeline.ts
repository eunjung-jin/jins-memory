// 전체 파이프라인 오케스트레이션 (앱에서 호출하는 단일 진입점)
// 스캔 → 그룹핑 → 역지오코딩 → 영속화
import { groupTrips, DEFAULT_PARAMS } from '../grouping/index.ts';
import {
  createNominatimProvider,
  createMemoryCache,
} from '../geocoding/index.ts';
import { enrichTripsWithLocation } from '../geocoding/enrich-trips.ts';
import { persistGroupingResult } from '../persistence/persist.ts';
import { createSupabaseAdapter } from '../persistence/supabase-adapter.ts';
import type { PhotoInput } from '../persistence/port.ts';
import { getSupabase } from './supabase.ts';
import { scanLibrary, type ScanProgress } from './scan.ts';

export interface RunOptions {
  userId: string;
  onScanProgress?: (p: ScanProgress) => void;
  onPhase?: (phase: '스캔' | '그룹핑' | '지명변환' | '저장') => void;
}

/**
 * 사진첩 1회 전체 정리.
 * @returns 영속화 요약 (사진/여행 수)
 */
export async function runFullPipeline(opts: RunOptions) {
  const { userId, onScanProgress, onPhase } = opts;

  onPhase?.('스캔');
  const photos: PhotoInput[] = await scanLibrary(onScanProgress);

  onPhase?.('그룹핑');
  const trips = groupTrips(photos, DEFAULT_PARAMS);

  onPhase?.('지명변환');
  const provider = createNominatimProvider({
    userAgent: 'family-trip-app/0.1 (contact: jjinej@gmail.com)',
  });
  // TODO: 운영에선 Edge Function 경유 + geocode_cache 기반 캐시로 교체 (docs/geocoding.md §6)
  const enriched = await enrichTripsWithLocation(trips, {
    provider,
    cache: createMemoryCache(),
  });

  onPhase?.('저장');
  const port = createSupabaseAdapter(getSupabase());
  const result = await persistGroupingResult(port, userId, photos, enriched, {
    mode: 'replace',
  });

  return result;
}
