-- =============================================================
--  School Attendance Management System - full schema
--  Re-runnable: safe to press Run more than once on the same database.
-- =============================================================
--
--  Fresh install?  Just run this whole file.
--  Upgrading from v1? Run this, OR run migrations/002_fixes_and_ip.sql.
--  Both produce the same end state.
-- =============================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------
--  1) Types (42710 duplicate_object is swallowed so re-runs work)
-- ---------------------------------------------------------------
do $$ begin
  create type app_role   as enum ('admin','staff');
exception when duplicate_object then null; end $$;

do $$ begin
  create type staff_role as enum ('teacher','principal','peon','driver','security_guard','accountant','student');
exception when duplicate_object then null; end $$;

do $$ begin
  create type att_status as enum ('present','late');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------
--  2) Tables
-- ---------------------------------------------------------------
create table if not exists schools (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  timezone                text not null default 'Asia/Karachi',
  late_after              time not null default '08:00',
  ip_restriction_enabled  boolean not null default false,
  created_at              timestamptz not null default now()
);

-- Only added by v2; kept separate so older installs pick it up too.
alter table schools add column if not exists ip_restriction_enabled boolean not null default false;

create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  school_id   uuid not null references schools(id) on delete cascade,
  full_name   text not null,
  email       text not null,
  app_role    app_role not null default 'staff',
  designation staff_role,
  created_at  timestamptz not null default now()
);
create index if not exists profiles_school_id_idx on profiles(school_id);

create table if not exists attendance (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references schools(id) on delete cascade,
  staff_id        uuid not null references profiles(id) on delete cascade,
  attendance_date date not null,
  check_in        timestamptz not null default now(),
  check_out       timestamptz,
  status          att_status not null,
  unique (staff_id, attendance_date)
);
create index if not exists attendance_school_id_date_idx on attendance(school_id, attendance_date);

-- Approved IP addresses / ranges a school allows attendance to come from.
create table if not exists allowed_ips (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references schools(id) on delete cascade,
  ip_cidr    cidr not null,          -- plain IP like 1.2.3.4 becomes /32; ranges like 103.5.6.0/24 also allowed
  label      text,
  created_at timestamptz not null default now(),
  unique (school_id, ip_cidr)
);

-- ---------------------------------------------------------------
--  3) Helper functions
-- ---------------------------------------------------------------
create or replace function current_school() returns uuid
language sql stable security definer set search_path = public as
$$ select school_id from profiles where id = auth.uid() $$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and app_role = 'admin') $$;

-- Real client IP from PostgREST request headers (Cloudflare first, then proxy chain).
create or replace function client_ip() returns inet
language plpgsql stable as $$
declare h json; ip text;
begin
  h  := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  ip := coalesce(nullif(h->>'cf-connecting-ip',''), split_part(coalesce(h->>'x-forwarded-for',''), ',', 1));
  return nullif(trim(ip), '')::inet;
exception when others then
  return null;
end $$;

create or replace function my_ip() returns text
language sql stable as $$ select host(client_ip()) $$;

create or replace function ip_allowed(p_school uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when not s.ip_restriction_enabled then true
    else exists (select 1 from allowed_ips a where a.school_id = p_school and client_ip() <<= a.ip_cidr)
  end
  from schools s where s.id = p_school
$$;

-- Drives the staff portal banner.
create or replace function ip_status()
returns table (enforced boolean, allowed boolean, ip text)
language sql stable security definer set search_path = public as $$
  select s.ip_restriction_enabled, ip_allowed(s.id), host(client_ip())
  from schools s join profiles p on p.school_id = s.id
  where p.id = auth.uid()
$$;

-- ---------------------------------------------------------------
--  4) RLS
-- ---------------------------------------------------------------
alter table schools     enable row level security;
alter table profiles    enable row level security;
alter table attendance  enable row level security;
alter table allowed_ips enable row level security;

-- Postgres has no "create policy if not exists", so drop first.
-- Safe here: every table above was created before this block runs.
drop policy if exists "own school"         on schools;
drop policy if exists "admin update school" on schools;
drop policy if exists "read profiles"     on profiles;
drop policy if exists "admin update"      on profiles;
drop policy if exists "read attendance"   on attendance;
drop policy if exists "admin read ips"    on allowed_ips;
drop policy if exists "admin insert ips"  on allowed_ips;
drop policy if exists "admin delete ips"  on allowed_ips;

create policy "own school" on schools for select using (id = current_school());
create policy "admin update school" on schools for update
  using (is_admin() and id = current_school())
  with check (is_admin() and id = current_school());

create policy "read profiles" on profiles for select
  using (id = auth.uid() or (is_admin() and school_id = current_school()));
create policy "admin update" on profiles for update
  using (is_admin() and school_id = current_school())
  with check (is_admin() and school_id = current_school());

create policy "read attendance" on attendance for select
  using (staff_id = auth.uid() or (is_admin() and school_id = current_school()));

create policy "admin read ips"   on allowed_ips for select using (is_admin() and school_id = current_school());
create policy "admin insert ips" on allowed_ips for insert with check (is_admin() and school_id = current_school());
create policy "admin delete ips" on allowed_ips for delete using (is_admin() and school_id = current_school());

-- ---------------------------------------------------------------
--  5) RPCs
-- ---------------------------------------------------------------
-- ::att_status cast is required: the CASE yields text, status is att_status
-- (without it Postgres raises 42804).
create or replace function check_in() returns attendance
language plpgsql security definer set search_path = public as $$
declare p profiles; s schools; local_now timestamp; rec attendance;
begin
  select * into p from profiles where id = auth.uid();
  if p.id is null then raise exception 'Profile not found'; end if;
  if not ip_allowed(p.school_id) then
    raise exception 'IP_NOT_ALLOWED: Attendance can only be marked from the school network';
  end if;
  select * into s from schools where id = p.school_id;
  local_now := now() at time zone s.timezone;
  insert into attendance (school_id, staff_id, attendance_date, status)
  values (p.school_id, p.id, local_now::date,
          (case when local_now::time > s.late_after then 'late' else 'present' end)::att_status)
  returning * into rec;
  return rec;
exception when unique_violation then
  raise exception 'Already checked in today';
end $$;

create or replace function check_out() returns attendance
language plpgsql security definer set search_path = public as $$
declare s schools; p profiles; rec attendance;
begin
  select * into p from profiles where id = auth.uid();
  if not ip_allowed(p.school_id) then
    raise exception 'IP_NOT_ALLOWED: Attendance can only be marked from the school network';
  end if;
  select * into s from schools where id = p.school_id;
  update attendance set check_out = now()
   where staff_id = auth.uid()
     and attendance_date = (now() at time zone s.timezone)::date
     and check_out is null
  returning * into rec;
  if not found then raise exception 'No active check-in for today'; end if;
  return rec;
end $$;

create or replace function attendance_report(p_from date, p_to date, p_designation staff_role default null)
returns table (staff_id uuid, full_name text, designation staff_role,
               present_days int, late_days int, absent_days int)
language plpgsql stable security definer set search_path = public as $$
declare tz text; today date;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  select timezone into tz from schools where id = current_school();
  today := (now() at time zone tz)::date;
  return query
  with days as (
    select d::date as d from generate_series(p_from, least(p_to, today), '1 day') d
    where extract(dow from d) <> 0
  )
  select p.id, p.full_name, p.designation,
         count(a.id) filter (where a.status = 'present')::int,
         count(a.id) filter (where a.status = 'late')::int,
         (count(*) filter (where a.id is null))::int
  from profiles p
  cross join days
  left join attendance a on a.staff_id = p.id and a.attendance_date = days.d
  where p.school_id = current_school() and p.app_role = 'staff'
    and (p_designation is null or p.designation = p_designation)
  group by p.id, p.full_name, p.designation
  order by p.full_name;
end $$;

create or replace function dashboard_today()
returns table (total int, present int, late int, absent int)
language plpgsql stable security definer set search_path = public as $$
declare tz text; today date;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  select timezone into tz from schools where id = current_school();
  today := (now() at time zone tz)::date;
  return query
  select count(p.id)::int,
         count(a.id) filter (where a.status = 'present')::int,
         count(a.id) filter (where a.status = 'late')::int,
         count(*) filter (where a.id is null)::int
  from profiles p
  left join attendance a on a.staff_id = p.id and a.attendance_date = today
  where p.school_id = current_school() and p.app_role = 'staff';
end $$;

-- ---------------------------------------------------------------
--  6) Execute permissions
-- ---------------------------------------------------------------
grant execute on function public.client_ip()                            to authenticated;
grant execute on function public.my_ip()                                to authenticated;
grant execute on function public.ip_allowed(uuid)                       to authenticated;
grant execute on function public.ip_status()                            to authenticated;
grant execute on function public.check_in()                             to authenticated;
grant execute on function public.check_out()                            to authenticated;
grant execute on function public.attendance_report(date, date, staff_role) to authenticated;
grant execute on function public.dashboard_today()                      to authenticated;