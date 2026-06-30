// 타임라인 뷰모델 검증 — `node src/ui/timeline-view-model.test.ts`
import {
  buildTimeline,
  formatDateRange,
  formatDuration,
  type TripSummary,
} from './timeline-view-model.ts';

const trips: TripSummary[] = [
  { id: 't1', title: '2025 서귀포시', startDate: '2025-03-14', endDate: '2025-03-16', locationSummary: '서귀포시, 대한민국', photoCount: 6, coverAssetId: 'a2' },
  { id: 't2', title: '2025 부산광역시', startDate: '2025-05-03', endDate: '2025-05-03', locationSummary: '부산광역시, 대한민국', photoCount: 5, coverAssetId: 'a8' },
  { id: 't3', title: null, startDate: '2024-08-01', endDate: '2024-08-04', locationSummary: '강릉시, 대한민국', photoCount: 12, coverAssetId: 'a20' },
];

const sections = buildTimeline(trips);

console.log('=== 타임라인 ===');
for (const sec of sections) {
  console.log(`\n[${sec.year}]`);
  for (const c of sec.trips) {
    console.log(`  ${c.title} | ${c.dateRange} (${c.duration}) | ${c.locationSummary} | ${c.photoCount}장`);
  }
}

const checks: [string, boolean][] = [
  ['연도 2개 섹션', sections.length === 2],
  ['최신 연도(2025) 먼저', sections[0].year === 2025],
  ['2025 내 최신순(부산 먼저)', sections[0].trips[0].id === 't2'],
  ['제목 null → 자동("2024 여행")', sections[1].trips[0].title === '2024 여행'],
  ['당일 표기', formatDuration('2025-05-03', '2025-05-03') === '당일'],
  ['2박3일 표기', formatDuration('2025-03-14', '2025-03-16') === '2박 3일'],
  ['같은해 범위 축약', formatDateRange('2025-03-14', '2025-03-16') === '2025.03.14 – 03.16'],
  ['단일일 표기', formatDateRange('2025-05-03', '2025-05-03') === '2025.05.03'],
  ['해 넘김 전체표기', formatDateRange('2024-12-30', '2025-01-02') === '2024.12.30 – 2025.01.02'],
];

let ok = true;
console.log('\n검증:');
for (const [label, pass] of checks) {
  console.log(`  ${pass ? '✅' : '❌'} ${label}`);
  if (!pass) ok = false;
}
console.log(`\n${ok ? '✅ ALL PASS' : '❌ FAIL'}`);
process.exit(ok ? 0 : 1);
