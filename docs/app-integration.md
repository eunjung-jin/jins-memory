# Expo 앱 통합

| 항목 | 내용 |
|------|------|
| 작성일 | 2026-07-01 |
| 앱 진입점 | `App.tsx` (repo 루트) |
| 상태 | 셸 통합 완료 / 실기기 구동·Supabase 연결은 미검증 |

---

## 1. 앱 구조

```
App.tsx                         ← 루트: 익명 로그인 + 네비게이션
src/app/
  ├─ supabase.ts                ← Supabase 클라이언트 (app.json extra에서 키)
  ├─ scan.ts                    ← expo-media-library 사진첩 스캔 → PhotoInput[]
  ├─ pipeline.ts                ← 스캔→그룹핑→지명변환→영속화 단일 진입점
  ├─ useTimeline.ts             ← 여행 로드 + 커버 URI 해석 훅
  ├─ navigation.ts              ← 라우트 타입
  └─ screens/
       ├─ TimelineRoute.tsx     ← 타임라인 + "정리 시작" FAB
       └─ TripDetailRoute.tsx   ← 상세 사진 로드 + 제목/메모 저장
src/ui/                          ← 프레젠테이션 (이전 단계)
src/grouping, geocoding, persistence ← 코어 로직 (이전 단계)
```

## 2. 화면 흐름

```
앱 시작 → 익명 로그인(userId 확보)
   │
   ▼
[타임라인]  ──"✨ 사진 정리 시작"──▶ runFullPipeline()
   │                                  스캔→그룹핑→지명→저장 → 완료 알림 → reload
   │
   └─ 카드 탭 ─▶ [여행 상세] (사진 그리드, 제목/메모 편집·저장)
```

## 3. 데이터 파이프라인 (`pipeline.ts`)
이전 단계에서 각각 검증한 코어 로직을 하나로 연결:
1. `scanLibrary()` — 기기 사진 메타(시각·GPS·카메라) 수집 (PoC 로직의 실사용판)
2. `groupTrips()` — 4-Stage 그룹핑 ✅검증
3. `enrichTripsWithLocation()` — 역지오코딩 ✅검증
4. `persistGroupingResult()` — Supabase 저장 ✅검증(목)

## 4. 인증 (MVP)
- `signInAnonymously()`로 RLS용 `userId` 확보. 추후 이메일/소셜 로그인으로 전환.
- 익명 사용 시 Supabase 대시보드에서 Anonymous sign-in 활성화 필요.

## 5. 실행 방법
```bash
# 1) 의존성 설치
npm install

# 2) Supabase 설정 — app.json > expo.extra 에 채우기
#    "supabaseUrl": "https://xxxx.supabase.co",
#    "supabaseAnonKey": "eyJ..."

# 3) DB 마이그레이션 적용 (supabase/migrations/0001, 0002)
#    + Supabase Auth에서 Anonymous sign-in 활성화

# 4) 실행 (실기기 권장 — GPS 메타 때문)
npx expo start
```

코어 로직만 빠르게 검증:
```bash
npm run test:logic   # grouping + timeline-vm + persistence (DB/기기 불필요)
```

## 6. 미검증 / 다음 단계
RN·Expo·Supabase는 이 환경에서 구동할 수 없어 **셸 통합(코드 연결)까지**다. 실기기에서 확인 필요:
- [ ] `npm install` 후 Expo 빌드/구동
- [ ] 실제 Supabase 프로젝트 연결 + 마이그레이션 적용
- [ ] 사진첩 권한 → 스캔 → 파이프라인 → 타임라인 표시 E2E
- [ ] 익명 로그인 동작 확인
- [ ] 운영용: 역지오코딩을 Edge Function + `geocode_cache`로 전환 (docs/geocoding.md §6)
- [ ] 대용량 사진 스캔 성능/백그라운드 처리(`scan_jobs` 진행률 연동)

## 7. 참고
- 코어 로직(grouping/geocoding/persistence/ui-vm)은 모두 node로 **단위 검증 완료**.
- `poc/device-photo-exif/`는 사진첩 접근 검증용 별도 PoC(유지).
