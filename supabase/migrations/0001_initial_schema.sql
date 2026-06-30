-- =============================================================================
-- 가족 여행 자동 기록 서비스 — 초기 스키마 (v1)
-- 대상: Supabase (PostgreSQL)
-- 근거: docs/requirements.md v0.2 §8 데이터 모델
-- 원칙:
--   * 사진 원본은 기기에 보관 → 서버는 메타데이터/썸네일/여행 결과만 저장
--   * 모든 사용자 데이터는 RLS로 본인만 접근 (auth.uid())
--   * 사진은 한 여행에만 속함 → photos.trip_id 직접 참조 (조인 테이블 미사용)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 확장 (Supabase 기본 제공)
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- 공통: updated_at 자동 갱신 트리거 함수
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- ENUM 타입
-- ---------------------------------------------------------------------------
create type public.scan_job_type as enum ('full', 'incremental');
create type public.scan_job_status as enum ('pending', 'running', 'completed', 'failed', 'canceled');

-- =============================================================================
-- 1. profiles — auth.users 1:1 확장 프로필
-- =============================================================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 신규 가입 시 profiles 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- 2. trips — 자동 그룹핑된 여행
-- =============================================================================
create table public.trips (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  title             text,                      -- 자동 생성 후 사용자가 편집 가능
  start_date        date,                      -- 여행 시작일 (사진 촬영일 기준)
  end_date          date,                      -- 여행 종료일
  location_summary  text,                      -- 대표 지명 (예: "제주, 대한민국")
  cover_photo_id    uuid,                      -- 대표 커버 사진 (FK는 아래에서 추가)
  memo              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger trg_trips_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

create index idx_trips_user_start on public.trips (user_id, start_date desc);

-- =============================================================================
-- 3. photos — 기기 사진의 메타데이터 (원본은 기기에 유지)
-- =============================================================================
create table public.photos (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  trip_id         uuid references public.trips(id) on delete set null,  -- 그룹핑 전엔 null

  local_asset_id  text not null,              -- 기기 사진첩 자산 식별자 (expo-media-library)
  taken_at        timestamptz,                -- 촬영 시각 (creationTime / EXIF)
  lat             double precision,           -- EXIF GPS 위도 (없을 수 있음)
  lng             double precision,           -- EXIF GPS 경도
  place_name      text,                       -- 역지오코딩 결과 지명
  thumb_url       text,                       -- Supabase Storage 썸네일 (선택)

  width           int,
  height          int,
  camera_make     text,
  camera_model    text,

  quality_score   real,                       -- AI 품질 점수 (0~1)
  group_cluster_id text,                       -- 그룹핑 작업용 임시 군집 키
  is_selected     boolean not null default false,  -- 베스트 컷 여부
  sort_order      int,                        -- 여행 내 정렬 순서

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- 동일 사용자가 같은 기기 자산을 중복 등록하지 않도록 보장 (증분 스캔 멱등성)
  constraint uq_photos_user_asset unique (user_id, local_asset_id)
);

create trigger trg_photos_updated_at
  before update on public.photos
  for each row execute function public.set_updated_at();

-- 조회 패턴별 인덱스
create index idx_photos_user_taken on public.photos (user_id, taken_at);
create index idx_photos_trip on public.photos (trip_id);
create index idx_photos_user_cluster on public.photos (user_id, group_cluster_id);
-- 위치 기반 군집/필터용 (간단 인덱스; 본격 반경 검색은 추후 PostGIS 검토)
create index idx_photos_user_latlng on public.photos (user_id, lat, lng);

-- trips.cover_photo_id → photos.id (순환 참조라 테이블 생성 후 FK 추가)
alter table public.trips
  add constraint fk_trips_cover_photo
  foreign key (cover_photo_id) references public.photos(id) on delete set null;

-- =============================================================================
-- 4. scan_jobs — 사진 스캔/분석 작업 진행 상태
-- =============================================================================
create table public.scan_jobs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        public.scan_job_type   not null default 'incremental',
  status      public.scan_job_status not null default 'pending',
  progress    int not null default 0,          -- 0~100
  total_count int,                             -- 처리 대상 사진 수
  done_count  int not null default 0,
  error       text,
  started_at  timestamptz,
  finished_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint chk_progress_range check (progress between 0 and 100)
);

create trigger trg_scan_jobs_updated_at
  before update on public.scan_jobs
  for each row execute function public.set_updated_at();

create index idx_scan_jobs_user_created on public.scan_jobs (user_id, created_at desc);

-- =============================================================================
-- RLS (Row Level Security) — 본인 데이터만 접근
-- =============================================================================
alter table public.profiles  enable row level security;
alter table public.trips     enable row level security;
alter table public.photos    enable row level security;
alter table public.scan_jobs enable row level security;

-- profiles: 본인 행만
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- trips: 본인 소유만 (select/insert/update/delete)
create policy "trips_select_own" on public.trips
  for select using (auth.uid() = user_id);
create policy "trips_insert_own" on public.trips
  for insert with check (auth.uid() = user_id);
create policy "trips_update_own" on public.trips
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "trips_delete_own" on public.trips
  for delete using (auth.uid() = user_id);

-- photos: 본인 소유만
create policy "photos_select_own" on public.photos
  for select using (auth.uid() = user_id);
create policy "photos_insert_own" on public.photos
  for insert with check (auth.uid() = user_id);
create policy "photos_update_own" on public.photos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "photos_delete_own" on public.photos
  for delete using (auth.uid() = user_id);

-- scan_jobs: 본인 소유만
create policy "scan_jobs_select_own" on public.scan_jobs
  for select using (auth.uid() = user_id);
create policy "scan_jobs_insert_own" on public.scan_jobs
  for insert with check (auth.uid() = user_id);
create policy "scan_jobs_update_own" on public.scan_jobs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "scan_jobs_delete_own" on public.scan_jobs
  for delete using (auth.uid() = user_id);
