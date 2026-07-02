// 여행 상세 라우트 — 여행의 사진 로드 + URI 해석 + 제목/메모 저장
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import * as MediaLibrary from 'expo-media-library/legacy'; // SDK 57: legacy 서브패스
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation.ts';
import {
  TripDetailScreen,
  type TripPhotoVM,
} from '../../ui/screens/TripDetailScreen.tsx';
import { getSupabase } from '../supabase.ts';

type Props = NativeStackScreenProps<RootStackParamList, 'TripDetail'>;

function timeLabel(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function TripDetailRoute({ route }: Props) {
  const { tripId, title, dateRange, locationSummary } = route.params;
  const [photos, setPhotos] = useState<TripPhotoVM[] | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = getSupabase();
      const { data } = await supabase
        .from('photos')
        .select('local_asset_id, taken_at')
        .eq('trip_id', tripId)
        .order('taken_at', { ascending: true });

      const vms: TripPhotoVM[] = [];
      for (const row of data ?? []) {
        try {
          const info = await MediaLibrary.getAssetInfoAsync(
            row.local_asset_id as string,
          );
          if (info.localUri) {
            vms.push({
              assetId: row.local_asset_id as string,
              uri: info.localUri,
              takenAtLabel: row.taken_at
                ? timeLabel(new Date(row.taken_at as string).getTime())
                : undefined,
            });
          }
        } catch {
          // 기기에서 사라진 사진은 건너뜀
        }
      }
      setPhotos(vms);
    })();
  }, [tripId]);

  const onSave = async (changes: { title: string; memo: string }) => {
    const supabase = getSupabase();
    await supabase
      .from('trips')
      .update({ title: changes.title, memo: changes.memo })
      .eq('id', tripId);
  };

  if (!photos) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <TripDetailScreen
      title={title}
      dateRange={dateRange}
      locationSummary={locationSummary}
      photos={photos}
      onSave={onSave}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
