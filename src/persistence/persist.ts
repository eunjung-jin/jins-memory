// 영속화 오케스트레이션 — 그룹핑+지명 결과를 DB에 저장 (순수 로직, 포트에만 의존)
import type { TripWithLocation } from '../geocoding/enrich-trips.ts';
import type { PersistencePort, PhotoInput } from './port.ts';

export interface PersistResult {
  upsertedPhotos: number;
  createdTrips: number;
  assignedPhotos: number;
}

export interface PersistOptions {
  /**
   * 'replace': 기존 여행 삭제 후 재생성 (전체 재그룹핑용. 사용자 편집 제목/메모 사라짐).
   * 'append' : 기존 여행 유지하고 새 여행만 추가 (증분 스캔용).
   * 기본 'replace'.
   */
  mode?: 'replace' | 'append';
  /** 여행 제목 자동 생성기. 기본: "YYYY 지명" */
  titleFor?: (trip: TripWithLocation) => string | null;
}

function ymd(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

function defaultTitle(trip: TripWithLocation): string | null {
  const year = new Date(trip.startAt).getFullYear();
  if (trip.locationSummary) {
    // "서귀포시, 대한민국" → "서귀포시"
    const place = trip.locationSummary.split(',')[0].trim();
    return `${year} ${place}`;
  }
  return `${year} 여행`;
}

/**
 * 그룹핑+지명 결과를 영속화한다.
 * 1) 사진 메타 upsert → id 매핑 확보
 * 2) (replace) 기존 여행 삭제
 * 3) 여행별: 생성 → 사진 귀속 → 커버 지정
 */
export async function persistGroupingResult(
  port: PersistencePort,
  userId: string,
  photos: PhotoInput[],
  trips: TripWithLocation[],
  options: PersistOptions = {},
): Promise<PersistResult> {
  const mode = options.mode ?? 'replace';
  const titleFor = options.titleFor ?? defaultTitle;

  // 1) 사진 upsert
  const idMap = await port.upsertPhotos(userId, photos);

  // 2) 기존 여행 처리
  if (mode === 'replace') {
    await port.deleteTripsForUser(userId);
  }

  // 3) 여행 생성 + 귀속 + 커버
  let assignedPhotos = 0;
  for (const trip of trips) {
    const tripId = await port.insertTrip(userId, {
      title: titleFor(trip),
      startDate: ymd(trip.startAt),
      endDate: ymd(trip.endAt),
      locationSummary: trip.locationSummary,
      memo: null,
    });

    await port.assignPhotosToTrip(userId, tripId, trip.photoIds);
    assignedPhotos += trip.photoIds.length;

    // 커버: 첫 사진(시간순 정렬되어 있음). AI 선별(P1) 도입 시 최고 품질로 교체.
    const coverLocalId = trip.photoIds[0];
    const coverDbId = coverLocalId ? idMap.get(coverLocalId) : undefined;
    if (coverDbId) {
      await port.setTripCover(tripId, coverDbId);
    }
  }

  return {
    upsertedPhotos: idMap.size,
    createdTrips: trips.length,
    assignedPhotos,
  };
}
