// 타임라인 데이터 훅 — Supabase에서 여행 로드 + 커버 URI 해석
import { useCallback, useEffect, useState } from 'react';
import * as MediaLibrary from 'expo-media-library/legacy'; // SDK 57: legacy 서브패스
import type { TripSummary } from '../ui/timeline-view-model.ts';
import { getSupabase } from './supabase.ts';

interface TimelineState {
  trips: TripSummary[];
  coverUris: Record<string, string>;
  loading: boolean;
  error: string | null;
}

/** trips + 사진수 + 커버 자산ID 조회 → TripSummary[] */
async function fetchTrips(userId: string): Promise<TripSummary[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('trips')
    .select(
      'id, title, start_date, end_date, location_summary, ' +
        'cover:photos!fk_trips_cover_photo(local_asset_id), ' +
        'photos(count)',
    )
    .eq('user_id', userId)
    .order('start_date', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    locationSummary: row.location_summary,
    photoCount: row.photos?.[0]?.count ?? 0,
    coverAssetId: row.cover?.local_asset_id ?? null,
  }));
}

/** 커버 자산ID → 표시용 localUri 매핑 */
async function resolveCoverUris(
  trips: TripSummary[],
): Promise<Record<string, string>> {
  const uris: Record<string, string> = {};
  for (const t of trips) {
    if (!t.coverAssetId) continue;
    try {
      const info = await MediaLibrary.getAssetInfoAsync(t.coverAssetId);
      if (info.localUri) uris[t.coverAssetId] = info.localUri;
    } catch {
      // 기기에서 사라진 사진 등은 건너뜀
    }
  }
  return uris;
}

export function useTimeline(userId: string | null) {
  const [state, setState] = useState<TimelineState>({
    trips: [],
    coverUris: {},
    loading: true,
    error: null,
  });

  const reload = useCallback(async () => {
    if (!userId) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const trips = await fetchTrips(userId);
      const coverUris = await resolveCoverUris(trips);
      setState({ trips, coverUris, loading: false, error: null });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: String(e) }));
    }
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload };
}
