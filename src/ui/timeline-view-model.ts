// 타임라인 뷰모델 — 여행 목록을 "연도별 타임라인" 구조로 변환 (순수 로직)
// 근거: docs/requirements.md v0.2 §5 FR-5

/** DB에서 조회한 여행 요약 (trips + 사진 수 + 커버 자산) */
export interface TripSummary {
  id: string;
  title: string | null;
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD'
  locationSummary: string | null;
  photoCount: number;
  /** 커버 사진의 기기 자산 ID (앱에서 URI로 해석) */
  coverAssetId: string | null;
}

/** 타임라인 카드 뷰모델 */
export interface TripCardVM {
  id: string;
  title: string;
  dateRange: string; // "2025.03.14 – 03.16" 또는 "2025.05.03"
  duration: string; // "2박 3일" / "당일"
  locationSummary: string | null;
  photoCount: number;
  coverAssetId: string | null;
}

/** 연도 섹션 */
export interface TimelineSection {
  year: number;
  trips: TripCardVM[];
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** 'YYYY-MM-DD' → Date (로컬 자정) */
function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 날짜 범위 표시: 같은 날이면 단일, 같은 해/월이면 축약 */
export function formatDateRange(startDate: string, endDate: string): string {
  const s = parseYmd(startDate);
  const e = parseYmd(endDate);
  const sStr = `${s.getFullYear()}.${pad(s.getMonth() + 1)}.${pad(s.getDate())}`;
  if (startDate === endDate) return sStr;

  // 같은 해 → 끝쪽은 월.일만
  if (s.getFullYear() === e.getFullYear()) {
    return `${sStr} – ${pad(e.getMonth() + 1)}.${pad(e.getDate())}`;
  }
  const eStr = `${e.getFullYear()}.${pad(e.getMonth() + 1)}.${pad(e.getDate())}`;
  return `${sStr} – ${eStr}`;
}

/** 기간 표시: "N박 M일" / "당일" */
export function formatDuration(startDate: string, endDate: string): string {
  const s = parseYmd(startDate);
  const e = parseYmd(endDate);
  const nights = Math.round((e.getTime() - s.getTime()) / (24 * 3600 * 1000));
  if (nights <= 0) return '당일';
  return `${nights}박 ${nights + 1}일`;
}

function toCard(t: TripSummary): TripCardVM {
  const year = parseYmd(t.startDate).getFullYear();
  return {
    id: t.id,
    title: t.title ?? `${year} 여행`,
    dateRange: formatDateRange(t.startDate, t.endDate),
    duration: formatDuration(t.startDate, t.endDate),
    locationSummary: t.locationSummary,
    photoCount: t.photoCount,
    coverAssetId: t.coverAssetId,
  };
}

/**
 * 여행 목록 → 연도별 타임라인.
 * - 연도 내림차순(최신 먼저), 연도 내 시작일 내림차순.
 */
export function buildTimeline(trips: TripSummary[]): TimelineSection[] {
  const byYear = new Map<number, TripSummary[]>();
  for (const t of trips) {
    const year = parseYmd(t.startDate).getFullYear();
    const arr = byYear.get(year);
    if (arr) arr.push(t);
    else byYear.set(year, [t]);
  }

  const years = [...byYear.keys()].sort((a, b) => b - a);
  return years.map((year) => ({
    year,
    trips: byYear
      .get(year)!
      .sort((a, b) => (a.startDate < b.startDate ? 1 : -1))
      .map(toCard),
  }));
}
