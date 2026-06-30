import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  Text,
  View,
  Button,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';

// PoC 목적: 기기 사진첩에서 EXIF/GPS(위치)·촬영시각을 실제로 읽을 수 있는지 검증한다.
// 가장 중요한 확인 포인트 -> 가족 여행 사진에서 location(lat/lng)이 실제로 출력되는가?

const SAMPLE_COUNT = 30; // 검증용으로 최근 30장만 조회

export default function App() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    setItems([]);
    setSummary(null);

    try {
      // 1) 권한 요청 (iOS: 사진 접근, Android: READ_MEDIA_IMAGES + ACCESS_MEDIA_LOCATION)
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (perm.status !== 'granted') {
        setError('사진첩 접근 권한이 거부되었습니다. 설정에서 허용해주세요.');
        setLoading(false);
        return;
      }

      // 2) 최근 사진 N장 enumeration
      const page = await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.photo,
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        first: SAMPLE_COUNT,
      });

      // 3) 각 사진의 상세 정보(location + exif) 조회
      const results = [];
      let withGps = 0;
      for (const asset of page.assets) {
        const info = await MediaLibrary.getAssetInfoAsync(asset);
        const loc = info.location || null;
        if (loc) withGps += 1;
        results.push({
          id: asset.id,
          filename: asset.filename,
          creationTime: new Date(asset.creationTime).toLocaleString(),
          location: loc,
          make: info.exif?.Make || info.exif?.['{TIFF}']?.Make,
          model: info.exif?.Model || info.exif?.['{TIFF}']?.Model,
        });
      }

      setItems(results);
      setSummary({
        total: results.length,
        withGps,
        gpsRate:
          results.length > 0
            ? Math.round((withGps / results.length) * 100)
            : 0,
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>기기 사진첩 EXIF/GPS PoC</Text>
      <Text style={styles.subtitle}>
        최근 {SAMPLE_COUNT}장의 사진에서 촬영시각·위치(GPS)·카메라 정보를 읽어옵니다.
      </Text>

      <View style={styles.buttonRow}>
        <Button title="사진첩 읽기 실행" onPress={run} disabled={loading} />
      </View>

      {loading && <ActivityIndicator style={{ marginTop: 20 }} size="large" />}

      {error && <Text style={styles.error}>⚠️ {error}</Text>}

      {summary && (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>
            총 {summary.total}장 중 GPS 보유 {summary.withGps}장 (
            {summary.gpsRate}%)
          </Text>
          <Text style={styles.hint}>
            {summary.gpsRate > 0
              ? '✅ 위치 기반 장소 자동 분류 가능성 확인됨'
              : '⚠️ GPS가 안 잡힙니다. Android면 ACCESS_MEDIA_LOCATION 권한/실기기 확인 필요'}
          </Text>
        </View>
      )}

      <ScrollView style={styles.list}>
        {items.map((it) => (
          <View key={it.id} style={styles.card}>
            <Text style={styles.filename}>{it.filename}</Text>
            <Text style={styles.line}>📅 {it.creationTime}</Text>
            <Text style={styles.line}>
              📍{' '}
              {it.location
                ? `${it.location.latitude.toFixed(5)}, ${it.location.longitude.toFixed(5)}`
                : '위치 없음'}
            </Text>
            {(it.make || it.model) && (
              <Text style={styles.line}>
                📷 {it.make || '?'} {it.model || ''}
              </Text>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: 'bold', marginTop: 8 },
  subtitle: { fontSize: 13, color: '#666', marginTop: 4, marginBottom: 12 },
  buttonRow: { marginVertical: 8 },
  error: { color: '#c0392b', marginTop: 12 },
  summaryBox: {
    backgroundColor: '#f1f8ff',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  summaryText: { fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 13, color: '#444', marginTop: 4 },
  list: { marginTop: 12 },
  card: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  filename: { fontWeight: '600', marginBottom: 4 },
  line: { fontSize: 13, color: '#333' },
});
