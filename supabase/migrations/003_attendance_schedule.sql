-- Attendance schedule and automatic end-of-shift checkout.
-- Apply after 002_fixes_and_ip.sql in Supabase SQL Editor.
alter table public.schools
  add column if not exists check_in_start time not null default '07:00',
  add column if not exists auto_checkout_at time not null default '17:00';
alter table public.attendance
  add column if not exists auto_checked_out boolean not null default false;

alter table public.schools drop constraint if exists schools_attendance_schedule_order;
alter table public.schools add constraint schools_attendance_schedule_order
  check (check_in_start <= late_after and late_after < auto_checkout_at);

create or replace function public.check_in() returns public.attendance
language plpgsql security definer set search_path = public as $$
declare p public.profiles; s public.schools; local_now timestamp; rec public.attendance;
begin
  select * into p from public.profiles where id = auth.uid();
  if p.id is null then raise exception 'Profile not found'; end if;
  if not public.ip_allowed(p.school_id) then
    raise exception 'IP_NOT_ALLOWED: Attendance can only be marked from the school network';
  end if;
  select * into s from public.schools where id = p.school_id;
  local_now := now() at time zone s.timezone;
  if local_now::time < s.check_in_start then raise exception 'Check-in has not opened yet'; end if;
  if local_now::time >= s.auto_checkout_at then raise exception 'Check-in window has ended'; end if;
  insert into public.attendance (school_id, staff_id, attendance_date, status)
  values (p.school_id, p.id, local_now::date,
          (case when local_now::time > s.late_after then 'late' else 'present' end)::public.att_status)
  returning * into rec;
  return rec;
exception when unique_violation then
  raise exception 'Already checked in today';
end $$;

create or replace function public.auto_checkout_overdue() returns integer
language plpgsql security definer set search_path = public as $$
declare changed integer;
begin
  with due as (
    select a.id, timezone(s.timezone, a.attendance_date + s.auto_checkout_at) as cutoff
    from public.attendance a
    join public.schools s on s.id = a.school_id
    where a.check_out is null
      and timezone(s.timezone, a.attendance_date + s.auto_checkout_at) <= now()
  )
  update public.attendance a
     set check_out = due.cutoff, auto_checked_out = true
    from due where a.id = due.id and a.check_out is null;
  get diagnostics changed = row_count;
  return changed;
end $$;

-- Supabase hosted Postgres supports pg_cron. The function only updates overdue
-- rows and runs once per minute, so a missed staff check-out is closed promptly.
create extension if not exists pg_cron;
do $$
declare old_job record;
begin
  for old_job in select jobid from cron.job where jobname = 'attendance-auto-checkout'
  loop perform cron.unschedule(old_job.jobid); end loop;
  perform cron.schedule('attendance-auto-checkout', '* * * * *',
    'select public.auto_checkout_overdue()');
end $$;
