// 여행 카드 — 타임라인의 개별 여행 표시 (커버/제목/기간/장소/사진수)
import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import type { TripCardVM } from '../timeline-view-model.ts';

interface Props {
  trip: TripCardVM;
  /** coverAssetId(기기 자산 ID)를 표시용 URI로 해석. 없으면 플레이스홀더 */
  coverUri?: string | null;
  onPress?: (tripId: string) => void;
}

export function TripCard({ trip, coverUri, onPress }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => onPress?.(trip.id)}
    >
      {coverUri ? (
        <Image source={{ uri: coverUri }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.coverPlaceholder]}>
          <Text style={styles.placeholderText}>📷</Text>
        </View>
      )}

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {trip.title}
        </Text>
        {trip.locationSummary && (
          <Text style={styles.location} numberOfLines={1}>
            📍 {trip.locationSummary}
          </Text>
        )}
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{trip.dateRange}</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.meta}>{trip.duration}</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.meta}>사진 {trip.photoCount}장</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pressed: { opacity: 0.85 },
  cover: { width: '100%', height: 180, backgroundColor: '#eaeaea' },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderText: { fontSize: 40, opacity: 0.4 },
  body: { padding: 14 },
  title: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  location: { fontSize: 13, color: '#5a7d9a', marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  meta: { fontSize: 12, color: '#777' },
  dot: { fontSize: 12, color: '#bbb', marginHorizontal: 6 },
});
