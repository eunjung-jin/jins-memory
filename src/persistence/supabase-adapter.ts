// Supabase 어댑터 — PersistencePort 구현
// 의존: @supabase/supabase-js (SupabaseClient)
// 사용 측에서 createClient(url, key)로 만든 클라이언트를 주입.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PersistencePort, PhotoInput, TripRow } from './port.ts';

export function createSupabaseAdapter(
  client: SupabaseClient,
): PersistencePort {
  return {
    async upsertPhotos(userId, photos: PhotoInput[]) {
      if (photos.length === 0) return new Map();

      const rows = photos.map((p) => ({
        user_id: userId,
        local_asset_id: p.localAssetId,
        taken_at: new Date(p.takenAt).toISOString(),
        lat: p.lat,
        lng: p.lng,
        width: p.width ?? null,
        height: p.height ?? null,
        camera_make: p.cameraMake ?? null,
        camera_model: p.cameraModel ?? null,
        quality_score: p.qualityScore ?? null,
      }));

      // unique(user_id, local_asset_id) 기준 멱등 upsert
      const { data, error } = await client
        .from('photos')
        .upsert(rows, { onConflict: 'user_id,local_asset_id' })
        .select('id, local_asset_id');
      if (error) throw error;

      const map = new Map<string, string>();
      for (const r of data ?? []) {
        map.set(r.local_asset_id as string, r.id as string);
      }
      return map;
    },

    async deleteTripsForUser(userId) {
      const { error } = await client
        .from('trips')
        .delete()
        .eq('user_id', userId);
      if (error) throw error;
    },

    async insertTrip(userId, trip: TripRow) {
      const { data, error } = await client
        .from('trips')
        .insert({
          user_id: userId,
          title: trip.title,
          start_date: trip.startDate,
          end_date: trip.endDate,
          location_summary: trip.locationSummary,
          memo: trip.memo,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },

    async assignPhotosToTrip(userId, tripId, localAssetIds) {
      if (localAssetIds.length === 0) return;
      const { error } = await client
        .from('photos')
        .update({ trip_id: tripId })
        .eq('user_id', userId)
        .in('local_asset_id', localAssetIds);
      if (error) throw error;
    },

    async setTripCover(tripId, coverPhotoId) {
      const { error } = await client
        .from('trips')
        .update({ cover_photo_id: coverPhotoId })
        .eq('id', tripId);
      if (error) throw error;
    },
  };
}
