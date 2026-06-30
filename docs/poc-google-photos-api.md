# PoC 검증 결과 — 구글 포토 API 접근 가능성

| 항목 | 내용 |
|------|------|
| 검증일 | 2026-06-30 |
| 목적 | "사진첩 전체를 자동 스캔해 시간·장소로 분류" 가 구글 포토 API로 가능한지 확인 |
| 결론 | **불가능** — 자동 전체 스캔 폐지, 위치 메타데이터 미제공 |
| 판정 | 🔴 원안(구글 포토 + 자동화) 그대로는 진행 불가, 방향 전환 필요 |

---

## 1. 검증 배경
요구사항 정의서의 최대 리스크로 지목한 "구글 포토 API 정책/쿼터 제한"을 착수 전 검증.

## 2. 핵심 발견

### 2.1 광범위 읽기 권한 폐지 (2025-03-31)
- `photoslibrary.readonly`, `photoslibrary.sharing`, `photoslibrary` **스코프 제거**.
- 해당 스코프에만 의존하는 API 호출은 2025년 3월 31일 이후 **403 PERMISSION_DENIED** 반환.
- Library API는 이제 **앱이 직접 업로드한 사진/앨범만** 조회 가능.
- → 기존 가족 여행 사진(앱이 만들지 않은 사진)에 **자동 접근 불가**.

### 2.2 대체재 Picker API의 한계
- 구글은 사진 선택 용도라면 **Picker API**로 이전할 것을 권장.
- Picker API는 사용자가 **세션마다 직접 사진을 검색·선택**해야 함 → 앱이 라이브러리를 자동 탐색할 수 없음.
- → 우리 서비스의 "**자동**" 전제와 충돌.

### 2.3 위치(GPS) 메타데이터 미제공
- Picker API 응답(`PickedMediaItem` / `mediaMetadata`) 제공 필드:
  - ✅ `creationTime` (촬영 시각)
  - ✅ `width`, `height`, `filename`, `mimeType`, `baseUrl`
  - ✅ 카메라 정보(make, model, aperture, ISO, exposure)
  - ❌ **GPS / 위치 정보 없음**
- → 시간 기반 그룹핑은 일부 가능하나, "**장소 자동 기록**"은 불가.
- (원본 다운로드 후 EXIF 추출도 구글이 위치 EXIF를 대부분 제거하여 신뢰 불가.)

## 3. 우리 요구사항에의 영향

| 핵심 기능 | 구글 포토 API로 가능? |
|-----------|----------------------|
| 사진첩 전체 자동 스캔 | ❌ (수동 선택만) |
| 시간 기반 여행 그룹핑 | △ (선택한 사진 한정, creationTime 제공) |
| **장소 자동 기록** | ❌ (GPS 미제공) |
| AI 품질·중복 선별 | ⭕ (baseUrl로 이미지 접근은 가능) |

→ 핵심 가치 2개 중 **자동화**와 **장소 기록**이 동시에 막힘.

## 4. 방향 전환 옵션

### 옵션 A — 구글 포토 + Picker API 수용 (웹 유지)
- 사용자가 여행마다 사진을 직접 골라 업로드(선택)하는 **반자동** 서비스로 축소.
- 장소는 사용자가 수동 입력하거나 생략.
- 장점: 기존 웹/Vercel/Supabase 스택 유지, 개발 빠름.
- 단점: "자동으로 알아서" 라는 원래 핵심 가치 상실.

### 옵션 B — 네이티브 앱으로 전환 (권장 검토) ⭐
- React Native / Expo 앱이 **기기 사진첩에 직접 접근**.
- 기기에서 읽으면 **EXIF의 GPS·촬영시각을 원본 그대로** 확보 → 진짜 자동 분류·장소 기록 가능.
- 장점: 원래 비전(완전 자동 + 장소 기록) 그대로 실현.
- 단점: 웹 대비 개발 비용↑, 앱스토어 배포·권한 처리 필요. (단, Supabase는 그대로 백엔드로 사용 가능)
- 비고: 이 발견은 요구사항 정의서의 "웹 vs 앱" 결정을 **재검토**하게 만듦.

### 옵션 C — 다른 사진 소스
- iCloud / Apple Photos 등은 공개 API가 더 제한적이라 실효성 낮음.
- 사실상 "기기 직접 접근(옵션 B)" 또는 "수동 업로드(웹)" 로 수렴.

## 5. 권고
1. **자동화·장소 기록을 포기할 수 없다면 → 옵션 B (네이티브 앱)** 로 전환하고, 기기 사진첩 EXIF로 PoC 재검증.
2. **개발 속도·웹 유지가 우선이라면 → 옵션 A** 로 범위를 "반자동 + 시간 중심"으로 축소.
3. 요구사항 정의서 v0.2에 본 결과를 반영하여 플랫폼 결정 섹션 갱신.

## 6. 참고 자료
- Updates to the Google Photos APIs — https://developers.google.com/photos/support/updates
- Picker API launch & Library API updates (Google Developers Blog) — https://developers.googleblog.com/en/google-photos-picker-api-launch-and-library-api-updates/
- Picker API: List and retrieve media items — https://developers.google.com/photos/picker/guides/media-items
- Authorization scopes — https://developers.google.com/photos/overview/authorization
