// 영속화 포트 — 오케스트레이션이 의존하는 DB 연산만 추상화
// (Supabase 어댑터 / 테스트용 목으로 교체 가능)
import type { PhotoMeta } from '../grouping/types.ts';

/** DB 저장용 사진 입력 (그룹핑 입력 + 선택 메타) */
export interface PhotoInput extends PhotoMeta {
  width?: number | null;
  height?: number | null;
  cameraMake?: string | null;
  cameraModel?: string | null;
  qualityScore?: number | null;
}

/** trips 테이블에 넣을 행 */
export interface TripRow {
  title: string | null;
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD'
  locationSummary: string | null;
  memo: string | null;
}

/** 영속화 포트 */
export interface PersistencePort {
  /**
   * 사진 메타데이터를 upsert (멱등: user_id + local_asset_id 충돌 시 갱신).
   * @returns localAssetId → DB photo id 매핑
   */
  upsertPhotos(
    userId: string,
    photos: PhotoInput[],
  ): Promise<Map<string, string>>;

  /** 해당 사용자의 기존 여행 전부 삭제 (photos.trip_id는 FK on delete set null) */
  deleteTripsForUser(userId: string): Promise<void>;

  /** 여행 1건 생성 → 생성된 trip id 반환 */
  insertTrip(userId: string, trip: TripRow): Promise<string>;

  /** 사진들을 여행에 귀속 (photos.trip_id 설정) */
  assignPhotosToTrip(
    userId: string,
    tripId: string,
    localAssetIds: string[],
  ): Promise<void>;

  /** 여행 커버 사진 지정 */
  setTripCover(tripId: string, coverPhotoId: string): Promise<void>;
}
