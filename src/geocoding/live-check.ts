// 실제 Nominatim 호출 검증 — `node src/geocoding/live-check.ts`
// 주의: 실제 네트워크 호출. 사용정책 준수를 위해 호출 수를 최소화하고 캐시를 활용.
import {
  createNominatimProvider,
  createMemoryCache,
  reverseGeocode,
} from './index.ts';

const provider = createNominatimProvider({
  // 실제 배포 시 연락처 포함한 식별자로 교체할 것
  userAgent: 'family-trip-app-poc/0.1 (contact: jjinej@gmail.com)',
});
const cache = createMemoryCache();

const samples = [
  { name: '제주(성산 인근)', point: { lat: 33.458, lng: 126.942 } },
  { name: '부산(해운대 인근)', point: { lat: 35.158, lng: 129.16 } },
];

for (const s of samples) {
  const r = await reverseGeocode(s.point, { provider, cache });
  console.log(`${s.name}:`, r ? r.summary : '(결과 없음)');
}

// 캐시 검증: 동일 좌표 재호출 시 API 호출 없이 즉시 반환
const repeat = await reverseGeocode(samples[0].point, { provider, cache });
console.log('\n캐시 재호출(제주):', repeat?.summary, '— API 호출 없이 반환됨');
