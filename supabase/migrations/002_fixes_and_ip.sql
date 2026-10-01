-- =============================================================
--  002_fixes_and_ip.sql
--  Run this in Supabase Dashboard > SQL Editor AFTER the original schema.
--  Fully re-runnable: safe to press Run more than once.
-- =============================================================
--
--  WHAT THIS DOES
--   1. Fixes check_in() failing with 42804 "column status is of type
--      att_status but expression is of type text" (missing ::att_status cast).
--   2. Adds optional per-school IP restriction for check-in / check-out.
--   3. Lets an admin update their own school's settings.
--
--  IMPORTANT ORDERING
--   Add your allowed IPs BEFORE switching ip_restriction_enabled to true,
--   otherwise every staff member (including you) is locked out until
--   you turn it back off from the SQL editor.

-- ---------------------------------------------------------------
--  0) Drop old policies.
--     Guarded because allowed_ips may not exist yet on a first run
--     (dropping a policy on a missing table raises 42P01).
-- ---------------------------------------------------------------
do $$
begin
  if to_regclass('public.allowed_ips') is not null then
    execute 'drop policy if exists "admin read ips"   on allowed_ips';
    execute 'drop policy if exists "admin insert ips" on allowed_ips';
    execute 'drop policy if exists "admin delete ips" on allowed_ips';
  end if;
  if to_regclass('public.schools') is not null then
    execute 'drop policy if exists "admin update school" on schools';
  end if;
end $$;

-- ---------------------------------------------------------------
--  1) IP restriction tables / columns
-- ---------------------------------------------------------------
alter table schools add column if not exists ip_restriction_enabled boolean not null default false;

create table if not exists allowed_ips (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references schools(id) on delete cascade,
  ip_cidr    cidr not null,            -- plain IP like 1.2.3.4 becomes /32; ranges like 103.5.6.0/24 also allowed
  label      text,
  created_at timestamptz not null default now(),
  unique (school_id, ip_cidr)
);
alter table allowed_ips enable row level security;

create policy "admin read ips"   on allowed_ips for select using (is_admin() and school_id = current_school());
create policy "admin insert ips" on allowed_ips for insert with check (is_admin() and school_id = current_school());
create policy "admin delete ips" on allowed_ips for delete using (is_admin() and school_id = current_school());

create policy "admin update school" on schools for update
  using (is_admin() and id = current_school())
  with check (is_admin() and id = current_school());

-- ---------------------------------------------------------------
--  2) Real client IP from request headers (PostgREST/Supabase)
-- ---------------------------------------------------------------
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

-- for the staff portal banner
create or replace function ip_status()
returns table (enforced boolean, allowed boolean, ip text)
language sql stable security definer set search_path = public as $$
  select s.ip_restriction_enabled, ip_allowed(s.id), host(client_ip())
  from schools s join profiles p on p.school_id = s.id
  where p.id = auth.uid()
$$;

-- ---------------------------------------------------------------
--  3) check_in with cast fix + IP enforcement
-- ---------------------------------------------------------------
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

-- ---------------------------------------------------------------
--  4) check_out with IP enforcement
-- ---------------------------------------------------------------
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

-- ---------------------------------------------------------------
--  5) Execute permissions for the authenticated role
--     (client_ip is called internally only, no grant needed)
-- ---------------------------------------------------------------
grant execute on function public.client_ip()          to authenticated;
grant execute on function public.my_ip()              to authenticated;
grant execute on function public.ip_allowed(uuid)     to authenticated;
grant execute on function public.ip_status()          to authenticated;
grant execute on function public.check_in()           to authenticated;
grant execute on function public.check_out()          to authenticated;

-- ---------------------------------------------------------------
--  6) Emergency unlock (run this if you locked everyone out)
-- ---------------------------------------------------------------
-- update schools set ip_restriction_enabled = false;