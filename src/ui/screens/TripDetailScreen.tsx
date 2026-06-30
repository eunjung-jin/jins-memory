// 여행 상세 화면 — 선별 사진을 시간순 그리드로 표시 + 제목/메모 편집 (FR-5.3~5.4)
import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  FlatList,
  StyleSheet,
  Pressable,
} from 'react-native';

/** 상세 화면에 표시할 사진 1장 */
export interface TripPhotoVM {
  assetId: string;
  uri: string; // 기기 자산 URI (앱에서 해석)
  takenAtLabel?: string; // "03.14 11:20"
}

interface Props {
  title: string;
  dateRange: string;
  locationSummary: string | null;
  photos: TripPhotoVM[];
  memo?: string;
  /** 제목/메모 저장 (FR-5.4) */
  onSave?: (changes: { title: string; memo: string }) => void;
}

const GAP = 2;
const COLS = 3;

export function TripDetailScreen({
  title,
  dateRange,
  locationSummary,
  photos,
  memo = '',
  onSave,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const [memoDraft, setMemoDraft] = useState(memo);

  const header = (
    <View style={styles.header}>
      {editing ? (
        <TextInput
          style={styles.titleInput}
          value={titleDraft}
          onChangeText={setTitleDraft}
          placeholder="여행 제목"
        />
      ) : (
        <Text style={styles.title}>{title}</Text>
      )}

      <View style={styles.metaRow}>
        <Text style={styles.meta}>{dateRange}</Text>
        {locationSummary && (
          <>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.meta}>📍 {locationSummary}</Text>
          </>
        )}
        <Text style={styles.dot}>·</Text>
        <Text style={styles.meta}>{photos.length}장</Text>
      </View>

      {editing ? (
        <TextInput
          style={styles.memoInput}
          value={memoDraft}
          onChangeText={setMemoDraft}
          placeholder="메모를 남겨보세요"
          multiline
        />
      ) : memo ? (
        <Text style={styles.memo}>{memo}</Text>
      ) : null}

      <Pressable
        style={styles.editBtn}
        onPress={() => {
          if (editing) onSave?.({ title: titleDraft, memo: memoDraft });
          setEditing((v) => !v);
        }}
      >
        <Text style={styles.editBtnText}>{editing ? '저장' : '편집'}</Text>
      </Pressable>
    </View>
  );

  return (
    <FlatList
      data={photos}
      keyExtractor={(p) => p.assetId}
      numColumns={COLS}
      ListHeaderComponent={header}
      renderItem={({ item }) => (
        <View style={styles.cell}>
          <Image source={{ uri: item.uri }} style={styles.photo} />
          {item.takenAtLabel && (
            <Text style={styles.photoLabel}>{item.takenAtLabel}</Text>
          )}
        </View>
      )}
      contentContainerStyle={styles.content}
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#fff' },
  content: { paddingBottom: 24 },
  header: { padding: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#1a1a1a' },
  titleInput: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingVertical: 4,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, flexWrap: 'wrap' },
  meta: { fontSize: 13, color: '#777' },
  dot: { fontSize: 13, color: '#bbb', marginHorizontal: 6 },
  memo: { fontSize: 15, color: '#333', marginTop: 12, lineHeight: 22 },
  memoInput: {
    fontSize: 15,
    color: '#333',
    marginTop: 12,
    minHeight: 60,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 10,
    textAlignVertical: 'top',
  },
  editBtn: {
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
  },
  editBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  cell: { flex: 1 / COLS, aspectRatio: 1, margin: GAP },
  photo: { width: '100%', height: '100%', borderRadius: 4, backgroundColor: '#eee' },
  photoLabel: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    fontSize: 10,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 4,
    borderRadius: 3,
  },
});
