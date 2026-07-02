# Supabase 셋업 가이드

| 항목 | 내용 |
|------|------|
| 작성일 | 2026-07-01 |
| 대상 | 가족 여행 기록 앱 (Expo) |
| 소요 | 약 15분 |
| 선행 | `supabase/migrations/0001_initial_schema.sql`, `0002_geocode_cache.sql` |

이 순서대로 따라 하면 앱이 실제 DB에 연결됩니다.

---

## 1. 프로젝트 생성
1. https://supabase.com 가입/로그인 → **New project**.
2. 입력:
   - **Name**: `family-trip-app`
   - **Database Password**: 강력한 비밀번호 (따로 보관)
   - **Region**: `Northeast Asia (Seoul)` ← 한국이면 지연 최소
3. 생성 완료까지 1~2분 대기.

## 2. API 키 확보

### 2.1 위치
좌측 하단 **⚙️ Project Settings → API**
(`app.supabase.com/project/<ref>/settings/api`).

### 2.2 Project URL
```
https://abcdefghijklmno.supabase.co
```
- 이게 `supabaseUrl`.
- `abcdefghijklmno` 부분이 **project ref** (CLI `supabase link --project-ref`에 사용).

### 2.3 API Keys — 두 체계 중 하나가 보임
프로젝트 생성 시점에 따라 아래 둘 중 하나로 표시된다.

**(A) 기존(legacy) — JWT 키**
| 키 | 생김새 | 용도 |
|----|--------|------|
| `anon` `public` | `eyJhbGciOi...` (긴 문자열) | ✅ **앱에 넣는 키** |
| `service_role` `secret` | `eyJhbGciOi...` | ❌ 서버 전용, 앱 금지 |

**(B) 새 방식 — 2025 개편 키** (최근 생성 프로젝트)
| 키 | 생김새 | 용도 |
|----|--------|------|
| `publishable` | `sb_publishable_xxxxx` | ✅ **앱에 넣는 키** (anon 대체) |
| `secret` | `sb_secret_xxxxx` | ❌ 서버 전용, 앱 금지 |

### 2.4 앱에 넣는 키
`app.json`의 `supabaseAnonKey`에는:
- (A) 방식 → **`anon public`** (`eyJ...`)
- (B) 방식 → **`publishable`** (`sb_publishable_...`)

두 키 모두 **클라이언트 노출을 전제로 설계**된 키다. 실제 보안은 **RLS**가 담당하므로,
이 키가 공개돼도 사용자는 본인 데이터만 접근 가능(→ 스키마에 RLS 전면 적용한 이유).

### 2.5 ⚠️ 절대 금지
- **`service_role` / `secret` 키를 앱·`app.json`·git에 넣지 말 것.**
  이 키는 **RLS를 우회**한다 → 유출 시 전체 사용자 데이터 노출.
  역지오코딩 Edge Function 등 **서버 사이드에서만** 사용.

### 2.6 구분 팁
- 앱용: 이름에 `anon`/`publishable`, "공개돼도 됨" 안내가 붙음.
- 금지: 이름에 `service_role`/`secret`, 보통 `Reveal`(눈 아이콘)로 가려져 있음
  → **가려져 있으면 앱에 넣으면 안 되는 키**.

### 2.7 재발급
같은 화면에서 **Copy**로 재복사, 유출 시 **Roll / Regenerate**로 무효화 가능.

## 3. 앱에 키 설정
`app.json`의 `expo.extra` 채우기:
```json
"extra": {
  "supabaseUrl": "https://xxxxxxxx.supabase.co",
  "supabaseAnonKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
}
```
> 키를 git에 올리기 싫으면 `.env` + `app.config.js`로 분리 가능(아래 §7).

## 4. 마이그레이션 적용
두 방법 중 택1.

### 방법 A — 대시보드 (간단, 추천)
1. 좌측 **SQL Editor → New query**.
2. `supabase/migrations/0001_initial_schema.sql` 전체 붙여넣기 → **Run**.
3. 새 쿼리로 `0002_geocode_cache.sql` 도 동일하게 **Run**.
4. 좌측 **Table Editor** 에서 `profiles / trips / photos / scan_jobs / geocode_cache` 생성 확인.

### 방법 B — Supabase CLI
```bash
npm i -g supabase
supabase login
supabase link --project-ref <프로젝트 ref>   # URL의 xxxxxxxx 부분
supabase db push
```

## 5. 익명 로그인 활성화 (필수)
앱이 MVP에서 `signInAnonymously()`로 사용자를 만든다.
1. 좌측 **Authentication → Sign In / Providers** (또는 **Providers**).
2. **Anonymous** 토글 **ON**.
> 활성화 안 하면 앱 시작 시 "익명 로그인 실패" 에러가 난다.

## 6. RLS 동작 확인 (권장)
스키마에 RLS가 이미 포함되어 있다. 빠른 점검:
1. **Authentication → Users** 에 (앱 첫 실행 후) 익명 유저가 생기는지.
2. **SQL Editor** 에서 아래로 정책이 걸려 있는지 확인:
   ```sql
   select tablename, policyname from pg_policies
   where schemaname = 'public' order by tablename;
   ```
   → `photos / trips / scan_jobs / profiles / geocode_cache` 정책이 보이면 정상.
3. 핵심: 익명 키로는 **본인 user_id 행만** 보인다(다른 사용자 데이터 격리).

## 7. (선택) 키를 코드에서 분리
`app.json` 대신 환경변수로 관리하려면 `app.config.js`:
```js
export default {
  expo: {
    // ...app.json 내용...
    extra: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    },
  },
};
```
`.env` 는 `.gitignore` 에 추가.

## 8. 연결 확인 (앱 실행)
```bash
npm install
npx expo start   # 실기기(Expo Go/dev build)에서 실행
```
체크:
- [ ] 앱이 에러 없이 타임라인 화면까지 뜸 (익명 로그인 성공)
- [ ] "✨ 사진 정리 시작" → 권한 허용 → 스캔/그룹핑/저장 진행
- [ ] 완료 알림 후 타임라인에 여행 카드 표시
- [ ] Supabase **Table Editor → trips/photos** 에 데이터 적재 확인

## 9. 자주 나는 문제
| 증상 | 원인/해결 |
|------|-----------|
| "Supabase 설정 누락" | `app.json > extra` 의 URL/Key 미입력 |
| "익명 로그인 실패" | §5 Anonymous provider 미활성화 |
| 데이터가 저장 안 됨 | 마이그레이션 미적용 또는 RLS user_id 불일치 |
| 사진 GPS 전부 없음 | Android `ACCESS_MEDIA_LOCATION` 미허용 / iOS 제한적 접근 → 전체 허용 |
| trips는 생기는데 사진 0장 | `assignPhotosToTrip`의 local_asset_id 매칭 확인 |

## 10. 비용 참고
- Supabase **Free 티어**로 MVP 충분 (DB 500MB, 월 활성 5만). 사진 원본은 기기 보관이라 저장량 부담 적음.
- 역지오코딩은 현재 무료 Nominatim. 호출량 늘면 Edge Function + 캐시로 전환(`docs/geocoding.md`).
