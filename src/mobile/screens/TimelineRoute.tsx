// 타임라인 라우트 — 데이터 로딩 + "정리 시작" 파이프라인 실행 + 상세 이동
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation.ts';
import { TimelineScreen } from '../../ui/screens/TimelineScreen.tsx';
import { buildTimeline } from '../../ui/timeline-view-model.ts';
import { useTimeline } from '../useTimeline.ts';
import { runFullPipeline } from '../pipeline.ts';

type Props = NativeStackScreenProps<RootStackParamList, 'Timeline'> & {
  userId: string;
};

export function TimelineRoute({ navigation, userId }: Props) {
  const { trips, coverUris, loading, reload } = useTimeline(userId);
  const [busy, setBusy] = useState<string | null>(null);

  const onOrganize = async () => {
    try {
      setBusy('스캔 준비 중…');
      const result = await runFullPipeline({
        userId,
        onPhase: (p) => setBusy(`${p} 중…`),
        onScanProgress: (pr) =>
          setBusy(`스캔 중… ${pr.done}/${pr.total}`),
      });
      setBusy(null);
      Alert.alert(
        '정리 완료',
        `여행 ${result.createdTrips}건 · 사진 ${result.upsertedPhotos}장`,
      );
      reload();
    } catch (e) {
      setBusy(null);
      Alert.alert('오류', String(e));
    }
  };

  return (
    <View style={styles.fill}>
      <TimelineScreen
        trips={trips}
        loading={loading}
        coverUris={coverUris}
        onSelectTrip={(tripId) => {
          // 카드 뷰모델에서 표시 정보 추출해 상세로 전달
          const card = buildTimeline(trips)
            .flatMap((s) => s.trips)
            .find((c) => c.id === tripId);
          if (!card) return;
          navigation.navigate('TripDetail', {
            tripId,
            title: card.title,
            dateRange: card.dateRange,
            locationSummary: card.locationSummary,
          });
        }}
      />

      <Pressable
        style={[styles.fab, busy ? styles.fabBusy : null]}
        onPress={onOrganize}
        disabled={!!busy}
      >
        <Text style={styles.fabText}>
          {busy ?? '✨ 사진 정리 시작'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  fab: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 28,
    backgroundColor: '#1a1a1a',
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fabBusy: { backgroundColor: '#666' },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
