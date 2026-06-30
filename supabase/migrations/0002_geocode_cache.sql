-- =============================================================================
-- 역지오코딩 캐시 — 좌표→지명 변환 결과 공유 캐시
-- 근거: docs/geocoding.md
-- 특징:
--   * 사용자별 데이터가 아닌 전역(공유) 캐시 → 동일 지역 중복 호출 방지
--   * 쓰기는 Edge Function(service_role)만, 읽기는 인증 사용자 허용
-- =============================================================================

create table public.geocode_cache (
  cell_key     text primary key,            -- 좌표를 ~1km 격자로 반올림한 키
  lat          double precision,            -- 대표 좌표 (참고용)
  lng          double precision,
  country      text,
  city         text,
  place        text,
  summary      text not null,               -- "제주시, 대한민국"
  provider     text not null,               -- 'nominatim' | 'google' ...
  created_at   timestamptz not null default now()
);

alter table public.geocode_cache enable row level security;

-- 읽기: 인증된 사용자 누구나 (공유 캐시이므로 개인정보 아님)
create policy "geocode_cache_select_authenticated" on public.geocode_cache
  for select to authenticated using (true);

-- 쓰기 정책 없음 → 일반 클라이언트는 insert/update 불가.
-- Edge Function이 service_role 키로 접근하여 RLS를 우회해 캐시를 채운다.
