# 타임라인 UI 설계

| 항목 | 내용 |
|------|------|
| 작성일 | 2026-07-01 |
| 근거 | `docs/requirements.md` v0.2 §5 FR-5 |
| 구현 | `src/ui/` (React Native) |
| 상태 | 뷰모델 로직 검증 완료 / RN 렌더링은 실기기 필요 |

---

## 1. 화면 구성

```
TimelineScreen (연도별 여행 목록)
   └─ 탭 → TripDetailScreen (선별 사진 그리드 + 제목/메모 편집)
```

## 2. 레이아웃 목업

### 타임라인 화면
```
┌─────────────────────────────┐
│ 2025                        │  ← 연도 섹션 헤더
│ ┌─────────────────────────┐ │
│ │      [커버 사진]         │ │
│ │ 2025 부산광역시          │ │
│ │ 📍 부산광역시, 대한민국   │ │
│ │ 2025.05.03 · 당일 · 5장  │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │      [커버 사진]         │ │
│ │ 2025 서귀포시            │ │
│ │ 📍 서귀포시, 대한민국     │ │
│ │ 2025.03.14–03.16 ·2박3일 │ │
│ └─────────────────────────┘ │
│ 2024                        │
│ ┌─────────────────────────┐ │
│ │ 2024 여행 …              │ │
└─────────────────────────────┘
```

### 여행 상세 화면
```
┌─────────────────────────────┐
│ 2025 서귀포시          [편집]│
│ 2025.03.14–03.16 · 📍서귀포 │
│ · 6장                       │
│ (메모 영역)                  │
│ ┌───┐┌───┐┌───┐             │  ← 3열 사진 그리드
│ │   ││   ││   │             │
│ └───┘└───┘└───┘             │
│ ┌───┐┌───┐┌───┐             │
│ │   ││   ││   │             │
│ └───┘└───┘└───┘             │
└─────────────────────────────┘
```

## 3. 모듈 구성 (`src/ui/`)

| 파일 | 역할 | 검증 |
|------|------|------|
| `timeline-view-model.ts` | 여행 목록 → 연도별 타임라인 변환, 날짜/기간 포맷 | ✅ node 테스트 |
| `timeline-view-model.test.ts` | 뷰모델 검증 | ALL PASS |
| `components/TripCard.tsx` | 여행 카드 (커버/제목/기간/장소/사진수) | RN |
| `screens/TimelineScreen.tsx` | 연도 섹션 리스트 + 로딩/빈 상태 | RN |
| `screens/TripDetailScreen.tsx` | 사진 그리드 + 제목/메모 편집 | RN |

## 4. 데이터 흐름 (관심사 분리)
- **뷰모델은 순수**: `TripSummary[]`(DB 조회 결과) → `TimelineSection[]`. 날짜 포맷·정렬·연도 그룹화 담당.
- **컴포넌트는 표시만**: 커버 이미지는 `coverAssetId`(기기 자산 ID)를 받아 **앱이 URI로 해석**해 주입.
  - 원본은 기기에 있으므로(서버 비저장), `expo-media-library`의 `getAssetInfoAsync(assetId).localUri`로 표시용 URI 확보.

## 5. 검증 결과 (뷰모델)
```
[2025] 부산광역시(당일,5장) → 서귀포시(2박3일,6장)   ← 최신 연도·최신순
[2024] 2024 여행(3박4일,12장)                        ← 제목 null 자동생성
날짜/기간 포맷(당일/2박3일/해넘김) 전부 ✅ ALL PASS
```

## 6. 앱 연동 (커버 URI 해석 예)
```ts
import * as MediaLibrary from 'expo-media-library';

async function resolveCoverUris(trips: TripSummary[]) {
  const uris: Record<string, string> = {};
  for (const t of trips) {
    if (!t.coverAssetId) continue;
    const info = await MediaLibrary.getAssetInfoAsync(t.coverAssetId);
    if (info.localUri) uris[t.coverAssetId] = info.localUri;
  }
  return uris;
}
// <TimelineScreen trips={trips} coverUris={uris} onSelectTrip={...} />
```

## 7. 한계 / 다음 단계
- RN 컴포넌트는 **실기기/Expo에서 렌더링 확인 필요** (여기선 뷰모델 로직만 검증).
- [ ] Expo 앱 셸에 네비게이션(타임라인 ↔ 상세) 연결
- [ ] 커버/사진 URI 해석을 실제 expo-media-library와 연결
- [ ] 제목/메모 편집 저장을 Supabase `trips` update로 연결
- [ ] 사진 그리드 가상화·썸네일 최적화(대량 사진)
