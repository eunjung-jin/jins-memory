// 역지오코딩 — 타입 정의
import type { LatLng } from '../grouping/types.ts';

/** 역지오코딩 결과 (정규화된 공통 형태) */
export interface GeocodeResult {
  /** 국가명 (예: "대한민국") */
  country: string | null;
  /** 도시/시군구 (예: "제주시") */
  city: string | null;
  /** 명소/상세 지명 (예: "성산일출봉") — 있으면 */
  place: string | null;
  /** 사람이 읽는 요약 (예: "제주시, 대한민국") */
  summary: string;
  /** 제공자 식별자 */
  provider: string;
}

/** 좌표 → 지명 변환 제공자 인터페이스 (Nominatim/Google 등 교체 가능) */
export interface GeocodeProvider {
  readonly name: string;
  reverse(point: LatLng): Promise<GeocodeResult | null>;
}

/** 캐시 인터페이스 (인메모리/Supabase 등 교체 가능) */
export interface GeocodeCache {
  get(cellKey: string): Promise<GeocodeResult | null>;
  set(cellKey: string, value: GeocodeResult): Promise<void>;
}
