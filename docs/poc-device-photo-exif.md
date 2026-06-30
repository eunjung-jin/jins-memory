# PoC 검증 결과 — 기기 사진첩 EXIF/GPS 접근 (옵션 B, 네이티브 앱)

| 항목 | 내용 |
|------|------|
| 검증일 | 2026-06-30 |
| 목적 | React Native/Expo 앱이 기기 사진첩의 EXIF·GPS를 직접 읽어 자동 분류가 가능한지 확인 |
| 결론 | **가능** — 전체 사진 enumeration + GPS 위치 + EXIF 모두 접근 가능 |
| 판정 | 🟢 옵션 B로 진행 가능. 원래 비전(완전 자동 + 장소 기록) 실현 가능 |

---

## 1. 검증 배경
구글 포토 API가 막히면서(→ `poc-google-photos-api.md`), 기기 사진첩에 직접 접근하는
네이티브 앱(옵션 B)으로 전환. 핵심은 "기기에서 읽으면 EXIF의 GPS/촬영시각을 원본 그대로
얻을 수 있는가"였고, 검증 결과 **가능**.

## 2. 핵심 발견 (expo-media-library 기준)

### 2.1 전체 사진 목록 조회 가능
- `Query` API(구 `getAssetsAsync`)로 라이브러리 전체 사진을 페이지네이션하며 enumeration 가능.
- 미디어 타입/정렬/오프셋 필터 지원 → 사진만, 촬영일 순으로 순회 가능.

### 2.2 GPS 위치 + EXIF 접근 가능
- `getAssetInfoAsync(asset)` → `location { latitude, longitude }` 와 `exif` 맵 반환.
- 개별 getter `getLocation()`, `getExif()` 로 필요한 것만 조회(성능 유리).
- → **장소 자동 기록의 핵심인 GPS 좌표 확보 가능** (구글 포토 Picker API와의 결정적 차이).

### 2.3 촬영 시각
- asset의 `creationTime` + EXIF의 촬영일시 모두 확보 가능 → 시간 기반 여행 그룹핑 가능.

## 3. 플랫폼별 권한 / 제약

| 플랫폼 | 필요 설정 | 비고 |
|--------|-----------|------|
| iOS | `Info.plist`에 `NSPhotoLibraryUsageDescription` | "제한적 접근(Limited)" 선택 가능 — 사용자가 일부 사진만 허용 시 그 범위만 조회됨. `presentPermissionsPicker()`로 재선택 유도 |
| Android | `ACCESS_MEDIA_LOCATION` 권한 필수 | 이 권한이 **없으면 GPS가 EXIF에서 제거됨**. 반드시 추가 |
| Android (구버전) | scoped storage(10+) | 일부 구버전/기기에서 EXIF·location 누락 사례 보고됨 → 실기기 검증 필요 |

## 4. 알려진 리스크 (실기기 검증 권장)
- **iOS 제한적 접근**: 사용자가 "전체 허용"이 아닌 "일부 선택"을 고르면 자동 스캔 범위가 줄어듦. 온보딩에서 전체 허용 안내 필요.
- **Android 기기 편차**: 일부 Android 버전/제조사에서 location/EXIF가 비어 오는 이슈가 깃헙에 보고됨(API 30 등). 타깃 기기에서 직접 확인 필요.
- **GPS 없는 사진**: 위치 꺼두고 찍은 사진은 좌표 없음 → 시간 기준 보조 그룹핑 유지.

## 5. 아키텍처 영향
- 프론트: **React Native + Expo** (요구사항 정의서의 "모바일 웹" → "네이티브 앱"으로 변경).
- 백엔드: **Supabase 그대로 사용** (Auth, Postgres, Storage). Vercel은 API/관리용 또는 불필요.
- 처리 흐름:
  1. 앱이 기기에서 사진 메타데이터(시각·GPS) 로컬 수집
  2. 그룹핑/지명변환/AI선별은 서버(Supabase Edge Functions 등) 또는 일부 온디바이스
  3. 결과(여행·선별 사진 참조)만 Supabase에 저장, 원본은 기기 유지

## 6. 검증용 PoC 앱
- 위치: `poc/device-photo-exif/`
- 동작: 권한 요청 → 최근 사진 N장 순회 → 각 사진의 `creationTime`, `location(lat/lng)`, EXIF 일부를 화면/콘솔에 출력.
- 실행:
  ```bash
  cd poc/device-photo-exif
  npm install
  npx expo start
  # Expo Go 또는 dev build로 실기기에서 실행 (시뮬레이터는 GPS 메타 없는 샘플뿐이라 실기기 권장)
  ```
- 검증 포인트: 가족 여행 사진에서 **lat/lng가 실제로 찍혀 나오는지** 확인.

## 7. 권고
1. 위 PoC를 **본인 실기기(가족 여행 사진 포함)** 에서 실행해 GPS 출력률 확인.
2. iOS/Android 양쪽에서 location 누락률 체크 → 그룹핑 정확도 가늠.
3. 결과 양호 시 요구사항 정의서 v0.2로 갱신(플랫폼=네이티브 앱, 소스=기기 사진첩).

## 8. 참고 자료
- expo-media-library (MediaLibrary) — https://docs.expo.dev/versions/latest/sdk/media-library/
- ACCESS_MEDIA_LOCATION / EXIF 이슈 — https://github.com/expo/expo/issues/13123
- Android EXIF lat-lng 이슈 — https://github.com/expo/expo/issues/17399
