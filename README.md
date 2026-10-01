# School Attendance Management System

Cloud-based school attendance portal. Staff check in and out from their phone with a single tap; administrators get a live dashboard, staff management and Day / Week / Month / Year attendance analytics. Fully multi-tenant — every row is scoped to a `school_id`.

---

## Features

### Staff
- Single-tap **Check In** / **Check Out**, one per day (enforced by a database constraint).
- **Present / Late decided on the server only** — the client never computes lateness.
- Live clock in the school's timezone, today's status card, hours worked.
- Personal attendance history with a month filter, summary chips and an empty state.
- **Optional IP restriction**: when the admin turns it on, staff can only mark attendance from an approved school IP. Blocked users see a red banner with their detected IP.
- Desktop sidebar (Home / My History), mobile bottom nav (Home / My History / Logout), plus a Back button on the history page.

### Admin
- Live dashboard: Total Staff, Present, Late, Absent + attendance-rate bar, auto-refreshing every 60s.
- Staff management: add, edit, delete. Search by name/email, filter by designation. Add form validates an 8-character password with a confirm field.
- Reports for **Day / Week / Month / Year**, filterable by designation, with a recharts bar chart and CSV export.
- **Attendance**: every check-in/check-out with date range, designation, status and staff-name filters plus server-side pagination (25 rows/page). Staff name and designation lead every row and card.
- **Network**: toggle IP restriction, view your current IP, and manage the allow list.
- Desktop shows a fixed sidebar only; mobile shows a bottom tab bar only. No drawer, no hamburger.

### Platform
- Row Level Security on `schools`, `profiles` and `attendance` — staff can only read their own rows.
- Staff can never write attendance directly; only the `check_in()` / `check_out()` RPCs write.
- Toasts, skeleton loaders, error states, error boundary, 404 page, per-page titles.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19 + Vite, plain JavaScript, functional components + hooks |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`), mobile-first |
| Icons | lucide-react |
| Routing | react-router-dom 7 (BrowserRouter) |
| Charts | recharts 3 (`ResponsiveContainer`) |
| Backend / DB | Supabase (Auth, Postgres, RLS, Edge Functions) |
| Hosting | Vercel (SPA rewrite via `vercel.json`) |

Frontend environment variables — **only** these two, both safe to expose publicly:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

The `service_role` key is never used in the frontend. It only lives inside the Edge Function, where Supabase injects it as `SUPABASE_SERVICE_ROLE_KEY`.

---

## Folder structure

```
.
├── index.html                     # viewport meta, page shell
├── vercel.json                    # SPA rewrite
├── vite.config.js                 # react + tailwind + manual chunk groups
├── .env.example
├── public/favicon.svg
├── supabase/
│   ├── schema.sql                 # tables, enums, RLS policies, RPCs (fresh install, includes v2)
│   ├── seed_first_admin.sql       # commented template for school + first admin
│   ├── migrations/
│   │   └── 002_fixes_and_ip.sql   # existing projects: check_in cast fix + IP restriction
│   └── functions/manage-staff/index.ts
└── src/
    ├── App.jsx                    # routes + providers (Reports lazy-loaded only)
    ├── main.jsx
    ├── index.css                  # Tailwind theme, focus rings, safe-area utils
    ├── lib/
    │   ├── supabase.js            # client (anon key only)
    │   ├── queries.js             # data hooks for every RLS-dependent read
    │   ├── attendanceActions.js   # check_in / check_out + friendly error mapping
    │   └── ipHooks.js             # IP status, allow list, CIDR validation
    ├── context/
    │   ├── AuthContext.jsx        # provider: session, profile, school, 8s timeout
    │   ├── auth.js                # useAuth()
    │   ├── ToastContext.jsx       # provider
    │   └── toast.js               # useToast()
    ├── components/
    │   ├── AuthStalled.jsx        # timeout screen with Retry / Sign out
    │   ├── Badge.jsx              # StatusBadge, DesignationBadge, StatCard, Chip
    │   ├── Button.jsx             # Button, IconButton (44px min targets)
    │   ├── ErrorBoundary.jsx
    │   ├── Feedback.jsx           # Spinner, skeletons, Empty/Error states
    │   ├── Input.jsx              # TextInput, SelectInput, PasswordInput (show/hide)
    │   ├── Layout.jsx             # Card, PageHeader, SegmentedControl, FilterToggle
    │   └── Modal.jsx              # bottom sheet on mobile, dialog from md
    ├── pages/
    │   ├── Login.jsx  NoProfile.jsx  NotFound.jsx
    │   ├── staff/ StaffLayout.jsx  StaffPortal.jsx  StaffHistory.jsx
    │   └── admin/ AdminLayout.jsx  AdminDashboard.jsx
    │              StaffManagement.jsx  Attendance.jsx  Reports.jsx  Network.jsx
    ├── routes/ProtectedRoute.jsx  # session + role guard
    └── utils/
        ├── format.js              # timezone-aware date/time/CSV helpers
        └── hooks.js               # usePageTitle, useNow, useTodayKey, ...
```

---

## Supabase setup

1. **Create a project** at [supabase.com/dashboard](https://supabase.com/dashboard). Note the project URL and anon key (Project Settings → API).

2. **Run the schema.** Open SQL Editor → New query → paste `supabase/schema.sql` → Run. This creates:
   - enums `app_role`, `staff_role`, `att_status`
   - tables `schools`, `profiles`, `attendance`
   - helper functions `current_school()`, `is_admin()`
   - RLS policies
   - RPCs `check_in()`, `check_out()`, `attendance_report()`, `dashboard_today()`

   Grant execute on the functions if your project defaults to revoking it:
   ```sql
   grant execute on function public.check_in() to authenticated;
   grant execute on function public.check_out() to authenticated;
   grant execute on function public.attendance_report(date, date, staff_role) to authenticated;
   grant execute on function public.dashboard_today() to authenticated;
   ```

4. **Run the v2 migration (existing projects only).** If you already installed the first version of the schema, run `supabase/migrations/002_fixes_and_ip.sql` in the SQL Editor. It:
   - fixes `check_in()` failing with `42804: column "status" is of type att_status but expression is of type text` by casting the CASE result,
   - adds the `allowed_ips` table, the `schools.ip_restriction_enabled` column, the `client_ip()` / `my_ip()` / `ip_allowed()` / `ip_status()` functions and their RLS policies.

   Fresh installs already contain all of this — `schema.sql` is the merged version.

   > Both `schema.sql` and the migration are **safe to run more than once**. Types are wrapped in `duplicate_object` guards, tables/indexes use `if not exists`, functions use `create or replace`, and policies are dropped before being created. If you get `42710 type "app_role" already exists` you are running an older copy of the file — pull the latest version.

5. **Apply the attendance schedule migration.** Run `supabase/migrations/003_attendance_schedule.sql` after the schema, and after migration 002 on existing projects. It adds configurable check-in start and late times, shift end, and automatic check-out using Supabase `pg_cron`.

6. Apply holidays and weekly schedule migration. Run supabase/migrations/004_holidays_events.sql after migration 003. It creates the holidays table, per-week attendance schedules, calendar policies, and holiday-aware reports. In the admin calendar, the default weekday pattern is only a fallback; click a date and save a Sunday?Saturday schedule to customize that exact week without affecting later weeks. Re-run this updated migration if 004 was previously applied. If PostgREST still reports a table missing, refresh the schema cache and reload the app.

7. **Create the first admin.** Follow `supabase/seed_first_admin.sql`:
   - Dashboard → Authentication → Users → **Add user** with your admin email and a password, tick **Auto Confirm User**, and copy the UUID.
   - Run the SQL: insert the `schools` row (note the returned `id`), then insert the `profiles` row with `app_role = 'admin'`, `designation` left `NULL`.

4. **Deploy the Edge Function** (needed for add/delete staff — it uses `service_role`):
   ```bash
   npm install -g supabase
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase functions deploy manage-staff
   ```
   No extra secrets to set: `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform.

6. **Set frontend env vars** — copy `.env.example` to `.env` and fill in the URL and anon key.

---

## Local development

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
# edit .env with your Supabase URL + anon key
npm run dev               # http://localhost:5173
```

Other scripts:

```bash
npm run build             # production build into dist/
npm run preview           # serve the built output
npm run lint              # oxlint
```

---

## Vercel deployment

1. Push the project to a Git repository and import it on Vercel (Framework Preset: **Vite**).
2. Set the environment variables for **Production / Preview**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Build settings — Vercel detects these automatically, but confirm:
   - Build command: `npm run build`
   - Output directory: `dist`
   - Node version: 20 or newer
4. Deploy. `vercel.json` already contains the SPA rewrite so deep links like `/admin/attendance` resolve correctly:
   ```json
   { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
   ```
5. Supabase → Authentication → URL Configuration: add your Vercel domain to **Site URL** and **Redirect URLs** (both `https://your-app.vercel.app` and any preview domains).

---

## How roles, RLS, lateness and absences work

### Roles
- `profiles.app_role` is either `admin` or `staff`. `profiles.designation` holds the job title (`teacher`, `principal`, `peon`, `driver`, `security_guard`, `accountant`) and is `NULL` for admins.
- The frontend reads the signed-in user's own `profiles` row after login and routes accordingly: admins to `/admin/*`, staff to `/staff`.

### Row Level Security
| Policy | Rule |
| --- | --- |
| `own school` (schools, select) | `id = current_school()` |
| `admin update school` (schools, update) | admin updating **their own** school (this is what the IP toggle and settings use) |
| `read profiles` (profiles, select) | own row, **or** admin in the same school |
| `admin update` (profiles, update) | admin in the same school |
| `read attendance` (attendance, select) | own rows, **or** admin in the same school |
| `admin read / insert / delete ips` (allowed_ips) | admin in the same school |

`current_school()`, `is_admin()`, `ip_allowed()` and `ip_status()` are `security definer`, so they can read the caller's own profile row without hitting RLS recursion. There is no client-facing `insert`/`update` policy on `attendance` at all — the only way to write is through `check_in()` / `check_out()`, which are `security definer` functions that derive the staff id from `auth.uid()` rather than trusting anything the client sends.

### Late marking (server-side only)
```sql
local_now := now() at time zone s.timezone;
... case when local_now::time > s.late_after then 'late' else 'present' end
```
The RPC converts the current instant into the school's timezone, compares it against `schools.late_after`, and stores `present` or `late` in the row. The client only renders the value it reads back, so it can never be spoofed or skewed by a wrong device clock.

### One check-in per day
`unique (staff_id, attendance_date)` on `attendance`. A second `check_in()` on the same day raises `unique_violation`, which the function converts into the friendly message `Already checked in today`; the UI shows it as a toast.

### Check-out
`check_out()` updates the row for today where `check_out is null` and stamps `now()`. If there is nothing to close it raises `No active check-in for today`.

### Absent
Absence is *derived, never stored*. `attendance_report()` generates the date series for the range, excludes Sundays (`extract(dow …) <> 0`), clips the end to today (future days are ignored), left-joins attendance per staff, and counts rows where `a.id is null` as absent days. `dashboard_today()` does the same for the current day.

### Timestamps
`check_in` / `check_out` are `timestamptz` (stored UTC). `attendance_date` is a plain `date` already resolved to the school's timezone. Every display goes through `Intl.DateTimeFormat` with the school's IANA timezone, so a staff member in another country still sees school-local times.

---

## IP restriction (optional)

Staff can be forced to mark attendance **only from the school network**. Everything is enforced in Postgres — the UI merely explains the rule, so it cannot be bypassed by calling the API directly.

### How it works

1. `client_ip()` reads the real client IP from the request headers: `cf-connecting-ip` first (Supabase sits behind Cloudflare), otherwise the first entry of `x-forwarded-for`. If the header is missing or unparseable it returns `NULL`.
2. Each allowed entry is stored in `allowed_ips.ip_cidr` (a `cidr` column). A plain IP such as `1.2.3.4` is normalised by the UI to `1.2.3.4/32`; ranges such as `103.5.6.0/24` work too.
3. `ip_allowed(school)` returns `true` when the school has not enabled the restriction. When it has, it checks `client_ip() <<= a.ip_cidr` — Postgres' "is contained in network" operator, so a `/24` entry covers every address in that range.
4. `check_in()` and `check_out()` both call `ip_allowed()` first and raise `IP_NOT_ALLOWED: ...` when it fails. The frontend maps that to a friendly toast and the staff portal shows a red banner with the detected IP.

### Enabling it safely

> **Add your current IP first or everyone will be locked out.**

1. Open **Network** in the admin menu.
2. Read **Your current IP**, press **Add this IP**. It is now on the allow list.
3. Add anything else you need (the office range, a second campus).
4. Only then flip **Only allow attendance from approved IPs** on.

The toggle refuses to turn on when the allow list is empty, and the page keeps warning you if it is ever empty while enabled.

**Locked everybody out?** Run this in the SQL Editor:

```sql
update schools set ip_restriction_enabled = false;
```

### Caveats you should know before turning it on

- **School IPs change.** Most broadband connections use a *dynamic* IP, so your public IP can change overnight and staff will suddenly be blocked. Ask your ISP for a **static IP**, or add the ISP's whole range.
- **Mobile data will be blocked** while the restriction is on. Only Wi-Fi from an approved address works.
- **IPv6 is supported** (`cidr` handles both), but many networks still hand out IPv4, so IPv4 ranges are usually what you need.
- If the app is served from a different domain, the IP seen is the **user's** IP, not Vercel's.
- Staff on a phone hotspot or a different building need their range added explicitly.

---

## Changing the late time, timezone, or adding a school

These are per-school values on the `schools` table, so each school can have its own rules.

**Change the late cutoff for one school**
```sql
update schools set late_after = '08:30' where name = 'Your School Name';
```
Takes effect immediately — `check_in()` reads the row on every call.

**Change the timezone for one school**
```sql
update schools set timezone = 'Asia/Dubai' where name = 'Your School Name';
```
Use any valid IANA zone name. Existing rows keep their `attendance_date`; new check-ins resolve against the new zone. Note that a large timezone shift can move "today" for staff who have not yet checked in.

**Add another school (multi-tenancy)**
```sql
-- 1. create the school
insert into schools (name, timezone, late_after)
values ('Second School', 'Asia/Karachi', '08:00')
returning id;

-- 2. create the admin's auth user in Dashboard > Authentication > Users, then:
insert into profiles (id, school_id, full_name, email, app_role)
values ('<ADMIN_USER_UUID>', '<SCHOOL_ID_FROM_STEP_1>', 'Admin Name', 'admin@school2.edu', 'admin');
```
Then add staff for that school from the new admin's **Staff** page — the Edge Function always writes to the caller's own `school_id`, so admins can never create staff in another school.

**Add a new staff designation**
1. `alter type staff_role add value 'accountant';` (or your value)
2. Add it to `DESIGNATIONS` in `src/utils/format.js`
3. Rebuild and redeploy the frontend. No SQL or Edge Function change needed.

**Turn IP restriction on or off for one school without the UI**
```sql
update schools set ip_restriction_enabled = true where name = 'Your School Name';
```

**Add an allowed range without the UI**
```sql
insert into allowed_ips (school_id, ip_cidr, label)
select id, '103.5.6.0/24', 'School range' from schools where name = 'Your School Name';
```

---

## Notes and assumptions

- Weekly workdays can be set per Sunday?Saturday week in the admin calendar; a saved week overrides the school default for that exact week. Holidays and off days do not count as absences, while events do not close the school.
- Check-in/check-out are whole minutes; there is no location capture or overtime.
- Hours worked is the raw elapsed time between check-in and check-out, rounded to two decimals.
- The delete action removes the auth user, which cascades to `profiles` and then to `attendance`.
- The frontend is a pure SPA: no SSR, no server component, no service worker.