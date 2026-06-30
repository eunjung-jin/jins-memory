// 타임라인 화면 — 연도별 섹션으로 여행 목록 표시 (FR-5.1~5.2)
import React, { useMemo } from 'react';
import {
  SectionList,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { TripCard } from '../components/TripCard.tsx';
import {
  buildTimeline,
  type TripSummary,
} from '../timeline-view-model.ts';

interface Props {
  trips: TripSummary[];
  loading?: boolean;
  /** coverAssetId → 표시용 URI 매핑 (앱에서 expo-media-library로 해석해 주입) */
  coverUris?: Record<string, string>;
  onSelectTrip?: (tripId: string) => void;
}

export function TimelineScreen({
  trips,
  loading,
  coverUris,
  onSelectTrip,
}: Props) {
  const sections = useMemo(
    () =>
      buildTimeline(trips).map((s) => ({
        title: String(s.year),
        data: s.trips,
      })),
    [trips],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.hint}>사진을 정리하는 중…</Text>
      </View>
    );
  }

  if (trips.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyEmoji}>🗺️</Text>
        <Text style={styles.emptyTitle}>아직 여행이 없어요</Text>
        <Text style={styles.hint}>
          사진을 정리하면 여행이 자동으로 만들어집니다.
        </Text>
      </View>
    );
  }

  return (
    <SectionList
      style={styles.list}
      sections={sections}
      keyExtractor={(item) => item.id}
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionHeader}>{section.title}</Text>
      )}
      renderItem={({ item }) => (
        <TripCard
          trip={item}
          coverUri={item.coverAssetId ? coverUris?.[item.coverAssetId] : null}
          onPress={onSelectTrip}
        />
      )}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={styles.content}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#f5f6f8' },
  content: { paddingTop: 8, paddingBottom: 24 },
  sectionHeader: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  hint: { marginTop: 8, fontSize: 14, color: '#888', textAlign: 'center' },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#444' },
});
