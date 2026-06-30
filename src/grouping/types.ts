// 여행 자동 그룹핑 — 타입 정의
// 근거: docs/grouping-algorithm.md
// 순수 데이터 타입만 정의 (런타임 의존성 없음 → 앱/Edge Function 공용)

/** 그룹핑 입력: 사진 1장의 메타데이터 (PoC 앱이 추출하는 형태) */
export interface PhotoMeta {
  /** 기기 사진첩 자산 ID (expo-media-library) */
  localAssetId: string;
  /** 촬영 시각 (epoch milliseconds) */
  takenAt: number;
  /** EXIF GPS 위도 (없으면 null) */
  lat: number | null;
  /** EXIF GPS 경도 (없으면 null) */
  lng: number | null;
}

/** 위경도 좌표 */
export interface LatLng {
  lat: number;
  lng: number;
}

/** 그룹핑 결과: 여행 1건 */
export interface Trip {
  /** 임시 군집 키 (영속화 시 trips.id로 치환) */
  clusterId: string;
  /** 여행 시작 시각 (epoch ms) */
  startAt: number;
  /** 여행 종료 시각 (epoch ms) */
  endAt: number;
  /** 여행 사진들의 위치 중심 (GPS 사진이 하나도 없으면 null) */
  centroid: LatLng | null;
  /** 소속 사진들의 localAssetId */
  photoIds: string[];
  /** GPS 좌표가 없어 시간으로 귀속된 사진 수 (디버깅/품질 참고용) */
  gpsLessCount: number;
}

/** 그룹핑 파라미터 (docs/grouping-algorithm.md §3) */
export interface GroupingParams {
  /** 이 간격(시간) 초과 시 다른 여행으로 분리 */
  timeGapHours: number;
  /** 생활권 반경(km). 집에서 이 거리 이상 떨어져야 여행 */
  homeRadiusKm: number;
  /** 여행 성립 최소 사진 수 */
  minTripPhotos: number;
  /** 여행 최소 지속시간(시간). 당일치기 허용 위해 작게 */
  minTripDurationHours: number;
  /** 생활권 추정 격자 셀 크기(km) */
  homeCellSizeKm: number;
  /** 집 추정용 야간 시작 시각(0~23) */
  nightStartHour: number;
  /** 집 추정용 야간 종료 시각(0~23) */
  nightEndHour: number;
}

/** 기본 파라미터 — 국내 가족여행 기준 출발점. 실데이터로 캘리브레이션 필요 */
export const DEFAULT_PARAMS: GroupingParams = {
  timeGapHours: 36,
  homeRadiusKm: 30,
  minTripPhotos: 5,
  minTripDurationHours: 2,
  homeCellSizeKm: 1,
  nightStartHour: 22,
  nightEndHour: 7,
};
