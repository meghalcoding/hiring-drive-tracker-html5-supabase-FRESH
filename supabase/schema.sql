-- ============================================================================
-- Walk-In Hiring Drive Candidate Tracker — Full Schema (HTML/JS + Supabase build)
-- Run this ONCE in the Supabase SQL Editor on a fresh project.
-- This is the combined equivalent of the original project's three migration
-- files (001_schema, 002_add_interview_comments, 003_interviewer_tracking)
-- PLUS the generate_candidate_code() function the app needs (added here —
-- it was referenced by the app but missing from the original migrations).
-- Not idempotent by design: run once, on a clean project.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ENUM TYPES
-- ----------------------------------------------------------------------------

create type public.app_role as enum (
  'admin', 'reception', 'hr', 'cabin_1', 'cabin_2', 'cabin_3', 'cabin_4', 'loi_desk', 'viewer'
);

create type public.candidate_stage as enum (
  'reception', 'hr_screening', 'cabin_1', 'cabin_2', 'cabin_3', 'cabin_4', 'loi', 'completed', 'rejected'
);

-- ----------------------------------------------------------------------------
-- 2. PROFILES  (one row per Supabase Auth user, holds their role)
-- ----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role public.app_role not null default 'reception',
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Maps each auth.users row to an app_role. Row is auto-created by the on_auth_user_created trigger below.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'reception')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 3. CANDIDATES
-- ----------------------------------------------------------------------------

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  candidate_code text not null unique,
  full_name text not null,
  phone text not null unique,
  email text,
  position_applied text not null,
  experience_years numeric(4,1) not null default 0,
  is_experienced boolean generated always as (experience_years > 0) stored,

  resume_received boolean not null default false,
  registration_complete boolean not null default false,

  stage public.candidate_stage not null default 'reception',

  hr_feedback text,
  hr_interviewer text,
  hr_started_at timestamptz,
  hr_completed_at timestamptz,

  cabin_number smallint,
  cabin_interviewer text,
  cabin_started_at timestamptz,
  cabin_completed_at timestamptz,
  interview_rating smallint check (interview_rating between 1 and 5),
  interview_recommendation text check (interview_recommendation in ('select','hold','reject')),
  interview_comments text,

  loi_officer text,
  loi_issued boolean not null default false,
  aadhaar_received boolean not null default false,
  exit_time timestamptz,

  comments_history text default '',

  rejected_at_stage public.candidate_stage,
  rejection_reason text,

  registered_at timestamptz not null default now(),
  completed_at timestamptz,

  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),

  constraint cabin_4_requires_experience check (
    cabin_number is distinct from 4 or is_experienced
  ),
  constraint cabin_number_range check (cabin_number is null or cabin_number between 1 and 4),
  constraint stage_cabin_consistency check (
    (stage = 'cabin_1' and cabin_number = 1) or
    (stage = 'cabin_2' and cabin_number = 2) or
    (stage = 'cabin_3' and cabin_number = 3) or
    (stage = 'cabin_4' and cabin_number = 4) or
    (stage not in ('cabin_1','cabin_2','cabin_3','cabin_4'))
  )
);

comment on column public.candidates.is_experienced is 'Generated column: true when experience_years > 0. Drives the Cabin-4-experienced-only rule.';
comment on column public.candidates.interview_comments is 'Detailed written feedback from the Cabin interviewer, in addition to the 1-5 rating.';
comment on column public.candidates.comments_history is 'Running append-only log of HR/cabin feedback entries, built client-side.';

create index idx_candidates_stage on public.candidates(stage);
create index idx_candidates_phone on public.candidates(phone);
create index idx_candidates_code on public.candidates(candidate_code);
create index idx_candidates_registered_at on public.candidates(registered_at);
create index idx_candidates_position on public.candidates(position_applied);
create index idx_candidates_cabin on public.candidates(cabin_number) where cabin_number is not null;

create or replace function public.enforce_cabin4_experience()
returns trigger
language plpgsql
as $$
begin
  if new.cabin_number = 4 and not new.is_experienced then
    raise exception 'Cabin 4 is reserved for experienced candidates only (experience_years must be > 0).';
  end if;
  return new;
end;
$$;

create trigger trg_enforce_cabin4_experience
  before insert or update on public.candidates
  for each row execute function public.enforce_cabin4_experience();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_candidates_updated_at
  before update on public.candidates
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. ACTIVITY LOG  (immutable audit trail, populated only by trigger)
-- ----------------------------------------------------------------------------

create table public.activity_log (
  id bigint generated always as identity primary key,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  from_stage public.candidate_stage,
  to_stage public.candidate_stage not null,
  changed_by uuid references public.profiles(id),
  changed_by_email text,
  changed_at timestamptz not null default now(),
  note text
);

create index idx_activity_log_candidate on public.activity_log(candidate_id);
create index idx_activity_log_changed_at on public.activity_log(changed_at);

create or replace function public.log_candidate_stage_change()
returns trigger
security definer
set search_path = public
language plpgsql as $$
declare
  actor_email text;
begin
  if (tg_op = 'INSERT') then
    select email into actor_email from public.profiles where id = new.created_by;
    insert into public.activity_log (candidate_id, from_stage, to_stage, changed_by, changed_by_email, note)
    values (new.id, null, new.stage, new.created_by, actor_email, 'Candidate registered');
    return new;
  end if;

  if (tg_op = 'UPDATE') and (old.stage is distinct from new.stage) then
    select email into actor_email from public.profiles where id = auth.uid();
    insert into public.activity_log (candidate_id, from_stage, to_stage, changed_by, changed_by_email, note)
    values (
      new.id, old.stage, new.stage, auth.uid(), actor_email,
      case when new.stage = 'rejected' then new.rejection_reason else null end
    );
  end if;

  return new;
end;
$$;

create trigger trg_log_candidate_stage_change
  after insert or update on public.candidates
  for each row execute function public.log_candidate_stage_change();

-- ----------------------------------------------------------------------------
-- 5. SETTINGS  (single-row config table for alert thresholds)
-- ----------------------------------------------------------------------------

create table public.settings (
  id smallint primary key default 1 check (id = 1),
  hr_wait_threshold_minutes int not null default 15,
  interview_duration_threshold_minutes int not null default 20,
  event_name text not null default 'Walk-In Hiring Drive',
  -- Volunteer name assignments shown on the public Volunteer screen.
  -- V1 Reception, V2 HR Screening & LOI Stage, V3 Cabin 1&2, V4 Cabin 3&4,
  -- V5 seated at WA1, V6 floating/relief duty. Left blank -> screen shows "V1".."V6".
  v1_name text,
  v2_name text,
  v3_name text,
  v4_name text,
  v5_name text,
  v6_name text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

insert into public.settings (id) values (1);

create trigger trg_settings_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 6. HELPER FUNCTIONS FOR RLS
-- ----------------------------------------------------------------------------

create or replace function public.current_role()
returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.role_owns_stage(r public.app_role)
returns public.candidate_stage
language sql immutable as $$
  select case r
    when 'reception' then 'reception'::public.candidate_stage
    when 'hr' then 'hr_screening'::public.candidate_stage
    when 'cabin_1' then 'cabin_1'::public.candidate_stage
    when 'cabin_2' then 'cabin_2'::public.candidate_stage
    when 'cabin_3' then 'cabin_3'::public.candidate_stage
    when 'cabin_4' then 'cabin_4'::public.candidate_stage
    when 'loi_desk' then 'loi'::public.candidate_stage
    else null
  end;
$$;

-- Generates the next human-facing candidate code, e.g. WD-0001, WD-0002…
-- (Called by the Reception "Register Candidate" form.)
create or replace function public.generate_candidate_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_num int;
begin
  select coalesce(max(substring(candidate_code from 'WD-(\d+)')::int), 0) + 1
  into next_num
  from public.candidates;
  return 'WD-' || lpad(next_num::text, 4, '0');
end;
$$;

grant execute on function public.generate_candidate_code() to authenticated;

-- ----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.candidates enable row level security;
alter table public.activity_log enable row level security;
alter table public.settings enable row level security;

create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);

create policy "profiles_update_self_or_admin" on public.profiles
  for update to authenticated
  using (auth.uid() = id or public.is_admin())
  with check (
    auth.uid() = id and role = (select role from public.profiles where id = auth.uid())
    or public.is_admin()
  );

create policy "candidates_select_all" on public.candidates
  for select to authenticated, anon using (true);

create policy "candidates_insert_reception_or_admin" on public.candidates
  for insert to authenticated
  with check (
    public.is_admin() or public.current_role() = 'reception'
  );

create policy "candidates_update_own_stage_or_admin" on public.candidates
  for update to authenticated
  using (
    public.is_admin()
    or stage = public.role_owns_stage(public.current_role())
  )
  with check (
    public.is_admin()
    or (
      stage = public.role_owns_stage(public.current_role())
      or stage = 'rejected'
      or (public.current_role() = 'reception' and stage = 'hr_screening')
      or (public.current_role() = 'hr' and stage in ('cabin_1','cabin_2','cabin_3','cabin_4'))
      or (public.current_role() in ('cabin_1','cabin_2','cabin_3','cabin_4') and stage = 'loi')
      or (public.current_role() = 'loi_desk' and stage = 'completed')
    )
  );

create policy "candidates_delete_admin_only" on public.candidates
  for delete to authenticated using (public.is_admin());

create policy "activity_log_select_all" on public.activity_log
  for select to authenticated, anon using (true);

create policy "settings_select_all" on public.settings
  for select to authenticated, anon using (true);

create policy "settings_update_admin_only" on public.settings
  for update to authenticated using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 8. REALTIME
-- ----------------------------------------------------------------------------

alter publication supabase_realtime add table public.candidates;
alter publication supabase_realtime add table public.activity_log;
alter publication supabase_realtime add table public.settings;

-- ----------------------------------------------------------------------------
-- 9. ADMIN "RESET FOR NEXT EVENT" RPC
-- ----------------------------------------------------------------------------

create or replace function public.reset_event_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can reset event data.';
  end if;
  delete from public.activity_log;
  delete from public.candidates;
end;
$$;

-- ============================================================================
-- End of schema. Next: run supabase/seed_optional.sql if you want sample
-- data, otherwise skip straight to creating your first admin user (README.md).
-- ============================================================================
