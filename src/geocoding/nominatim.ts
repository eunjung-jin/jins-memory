// Nominatim(OpenStreetMap) 역지오코딩 제공자
// 무료. 사용정책 준수 필수:
//   - 초당 1요청 이하 (호출부에서 캐시 + 직렬화로 보장)
//   - 식별 가능한 User-Agent 필수
//   - 결과 캐싱 권장 (geocode_cache 테이블)
// 정책: https://operations.osmfoundation.org/policies/nominatim/
import type { LatLng } from '../grouping/types.ts';
import type { GeocodeProvider, GeocodeResult } from './types.ts';

const ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';

export interface NominatimOptions {
  /** 사용정책상 필수: 연락처 포함 식별자 (예: "family-trip-app/1.0 (you@example.com)") */
  userAgent: string;
  /** 결과 언어 (기본 한국어) */
  language?: string;
  /** zoom: 10(시/도)~18(건물). 도시 수준이면 12~14 권장 */
  zoom?: number;
}

export function createNominatimProvider(
  opts: NominatimOptions,
): GeocodeProvider {
  const language = opts.language ?? 'ko';
  const zoom = opts.zoom ?? 12;

  return {
    name: 'nominatim',
    async reverse(point: LatLng): Promise<GeocodeResult | null> {
      const url =
        `${ENDPOINT}?format=jsonv2&lat=${point.lat}&lon=${point.lng}` +
        `&zoom=${zoom}&accept-language=${language}`;

      const res = await fetch(url, {
        headers: { 'User-Agent': opts.userAgent, 'Accept-Language': language },
      });
      if (!res.ok) {
        throw new Error(`Nominatim ${res.status}: ${await res.text()}`);
      }
      const data = (await res.json()) as NominatimResponse;
      if (!data || !data.address) return null;

      const a = data.address;
      const country = a.country ?? null;
      // 도시 수준: city > town > village > county > state 순으로 우선
      const city =
        a.city ?? a.town ?? a.village ?? a.county ?? a.state ?? null;
      // 명소: tourism/attraction/leisure 등 상세 명칭
      const place =
        a.tourism ?? a.attraction ?? a.leisure ?? a.neighbourhood ?? null;

      const summary = [city, country].filter(Boolean).join(', ') || (data.display_name ?? '알 수 없는 위치');

      return { country, city, place, summary, provider: 'nominatim' };
    },
  };
}

// Nominatim 응답의 사용 필드만 정의
interface NominatimResponse {
  display_name?: string;
  address?: {
    country?: string;
    state?: string;
    county?: string;
    city?: string;
    town?: string;
    village?: string;
    neighbourhood?: string;
    suburb?: string;
    tourism?: string;
    attraction?: string;
    leisure?: string;
  };
}
