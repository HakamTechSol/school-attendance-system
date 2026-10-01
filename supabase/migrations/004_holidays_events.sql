-- School holidays and events.
create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  holiday_date date not null,
  kind text not null default 'holiday',
  description text not null,
  created_at timestamptz not null default now()
);
alter table public.holidays drop constraint if exists holidays_kind_check;
alter table public.holidays add constraint holidays_kind_check check (kind in ('holiday', 'event', 'off_day', 'working_day'));

alter table public.schools add column if not exists working_days smallint[] not null default array[1,2,3,4,5,6]::smallint[];
alter table public.schools drop constraint if exists schools_working_days_valid;
alter table public.schools add constraint schools_working_days_valid
  check (cardinality(working_days) between 0 and 7 and working_days <@ array[0,1,2,3,4,5,6]::smallint[]);

create table if not exists public.school_work_weeks (
  school_id uuid not null references public.schools(id) on delete cascade,
  week_start date not null,
  working_days smallint[] not null,
  created_at timestamptz not null default now(),
  primary key (school_id, week_start),
  constraint school_work_weeks_sunday check (extract(dow from week_start) = 0),
  constraint school_work_weeks_days check (cardinality(working_days) between 1 and 7 and working_days <@ array[0,1,2,3,4,5,6]::smallint[])
);
alter table public.school_work_weeks drop constraint if exists school_work_weeks_sunday;
alter table public.school_work_weeks add constraint school_work_weeks_sunday check (extract(dow from week_start) = 0);
alter table public.school_work_weeks drop constraint if exists school_work_weeks_days;
alter table public.school_work_weeks add constraint school_work_weeks_days check (cardinality(working_days) between 0 and 7 and working_days <@ array[0,1,2,3,4,5,6]::smallint[]);
alter table public.school_work_weeks enable row level security;
revoke all on table public.school_work_weeks from anon;
grant select, insert, update, delete on table public.school_work_weeks to authenticated;
drop policy if exists "read school work weeks" on public.school_work_weeks;
drop policy if exists "admin insert school work weeks" on public.school_work_weeks;
drop policy if exists "admin update school work weeks" on public.school_work_weeks;
drop policy if exists "admin delete school work weeks" on public.school_work_weeks;
create policy "read school work weeks" on public.school_work_weeks for select to authenticated
  using (school_id = (select public.current_school()));
create policy "admin insert school work weeks" on public.school_work_weeks for insert to authenticated
  with check ((select public.is_admin()) and school_id = (select public.current_school()));
create policy "admin update school work weeks" on public.school_work_weeks for update to authenticated
  using ((select public.is_admin()) and school_id = (select public.current_school()))
  with check ((select public.is_admin()) and school_id = (select public.current_school()));
create policy "admin delete school work weeks" on public.school_work_weeks for delete to authenticated
  using ((select public.is_admin()) and school_id = (select public.current_school()));

create index if not exists holidays_school_date_idx
  on public.holidays (school_id, holiday_date);
alter table public.holidays enable row level security;
revoke all on table public.holidays from anon;
grant select, insert, update, delete on table public.holidays to authenticated;
drop policy if exists "read school holidays" on public.holidays;
drop policy if exists "admin insert holidays" on public.holidays;
drop policy if exists "admin update holidays" on public.holidays;
drop policy if exists "admin delete holidays" on public.holidays;
create policy "read school holidays" on public.holidays for select to authenticated
  using (school_id = (select public.current_school()));
create policy "admin insert holidays" on public.holidays for insert to authenticated
  with check ((select public.is_admin()) and school_id = (select public.current_school()));
create policy "admin update holidays" on public.holidays for update to authenticated
  using ((select public.is_admin()) and school_id = (select public.current_school()))
  with check ((select public.is_admin()) and school_id = (select public.current_school()));
create policy "admin delete holidays" on public.holidays for delete to authenticated
  using ((select public.is_admin()) and school_id = (select public.current_school()));

create or replace function public.attendance_report(
  p_from date, p_to date, p_designation public.staff_role default null
)
returns table (
  staff_id uuid, full_name text, designation public.staff_role,
  present_days int, late_days int, absent_days int
)
language plpgsql stable security definer set search_path = public as $$
declare tz text; today date; workdays smallint[];
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select timezone, working_days into tz, workdays from public.schools where id = public.current_school();
  today := (now() at time zone tz)::date;
  return query
  with days as (
    select d::date as d
    from generate_series(p_from, least(p_to, today), interval '1 day') d
    where (extract(dow from d)::smallint = any(coalesce((select ww.working_days from public.school_work_weeks ww where ww.school_id = public.current_school() and ww.week_start = (d::date - extract(dow from d)::int)), workdays))
        or exists (select 1 from public.holidays w where w.school_id = public.current_school() and w.holiday_date = d::date and w.kind = 'working_day'))
      and not exists (
        select 1 from public.holidays h
        where h.school_id = public.current_school()
          and h.holiday_date = d::date and h.kind in ('holiday', 'off_day')
      )
  )
  select pr.id, pr.full_name, pr.designation,
         count(a.id) filter (where a.status = 'present')::int,
         count(a.id) filter (where a.status = 'late')::int,
         count(*) filter (where a.id is null)::int
  from public.profiles pr
  cross join days
  left join public.attendance a
    on a.staff_id = pr.id and a.attendance_date = days.d
  where pr.school_id = public.current_school() and pr.app_role = 'staff'
    and (p_designation is null or pr.designation = p_designation)
  group by pr.id, pr.full_name, pr.designation
  order by pr.full_name;
end $$;

create or replace function public.dashboard_today()
returns table (total int, present int, late int, absent int)
language plpgsql stable security definer set search_path = public as $$
declare tz text; today date; workdays smallint[]; plan_days smallint[]; school_closed boolean;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select timezone, working_days into tz, workdays from public.schools where id = public.current_school();
  today := (now() at time zone tz)::date;
  select working_days into plan_days from public.school_work_weeks where school_id = public.current_school() and week_start = today - extract(dow from today)::int;
  plan_days := coalesce(plan_days, workdays);
  school_closed := exists (
    select 1 from public.holidays h
    where h.school_id = public.current_school()
      and h.holiday_date = today and h.kind in ('holiday', 'off_day')
  ) or (
    not (extract(dow from today)::smallint = any(plan_days)) and not exists (
      select 1 from public.holidays w
      where w.school_id = public.current_school() and w.holiday_date = today and w.kind = 'working_day'
    )
  );
  return query
  select count(pr.id)::int,
         count(a.id) filter (where a.status = 'present')::int,
         count(a.id) filter (where a.status = 'late')::int,
         case when school_closed then 0 else count(*) filter (where a.id is null)::int end
  from public.profiles pr
  left join public.attendance a on a.staff_id = pr.id and a.attendance_date = today
  where pr.school_id = public.current_school() and pr.app_role = 'staff';
end $$;

grant execute on function public.attendance_report(date, date, public.staff_role) to authenticated;
grant execute on function public.dashboard_today() to authenticated;
grant select, insert, update, delete on table public.school_work_weeks to authenticated;

notify pgrst, 'reload schema';
