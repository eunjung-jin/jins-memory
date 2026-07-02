// 기기 사진첩 스캔 → PhotoInput[] (PoC 검증 로직의 실사용 버전)
// 근거: poc/device-photo-exif, docs/poc-device-photo-exif.md
// SDK 57: expo-media-library에서 직접 부른 legacy 함수는 런타임 에러.
// legacy 서브패스로 동일 API 유지 (향후 Query/Asset 클래스 API로 마이그레이션 가능).
import * as MediaLibrary from 'expo-media-library/legacy';
import type { PhotoInput } from '../persistence/port.ts';

export interface ScanProgress {
  done: number;
  total: number;
}

/**
 * 사진첩을 순회하며 촬영시각·GPS·카메라 정보를 수집한다.
 * @param onProgress 진행률 콜백 (UI 진행바용)
 */
export async function scanLibrary(
  onProgress?: (p: ScanProgress) => void,
): Promise<PhotoInput[]> {
  const perm = await MediaLibrary.requestPermissionsAsync();
  if (perm.status !== 'granted') {
    throw new Error('사진첩 접근 권한이 필요합니다.');
  }

  const out: PhotoInput[] = [];
  let after: string | undefined;
  let total = 0;

  // 1차: 총 개수 파악
  const first = await MediaLibrary.getAssetsAsync({
    mediaType: MediaLibrary.MediaType.photo,
    first: 1,
  });
  total = first.totalCount;

  // 2차: 페이지네이션 순회
  let hasNext = true;
  while (hasNext) {
    const page = await MediaLibrary.getAssetsAsync({
      mediaType: MediaLibrary.MediaType.photo,
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      first: 100,
      after,
    });

    for (const asset of page.assets) {
      const info = await MediaLibrary.getAssetInfoAsync(asset);
      out.push({
        localAssetId: asset.id,
        takenAt: asset.creationTime,
        lat: info.location?.latitude ?? null,
        lng: info.location?.longitude ?? null,
        width: asset.width,
        height: asset.height,
        cameraMake: info.exif?.Make ?? null,
        cameraModel: info.exif?.Model ?? null,
      });
      onProgress?.({ done: out.length, total });
    }

    after = page.endCursor;
    hasNext = page.hasNextPage;
  }

  return out;
}
