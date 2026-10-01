# Project Status — School Attendance Management System

Build: `npm run lint` → **0 errors, 0 warnings**. `npm run build` → **success** (entry chunk ~27 kB gz ~8.5 kB; react / supabase / recharts split into lazy chunks).

---

## Change log (v2)

| Part | Change | Status | Files | Notes |
| --- | --- | --- | --- | --- |
| **A** | SQL: `check_in()` 42804 cast fix, IP restriction tables/functions/policies, admin school update | ✅ | `supabase/migrations/002_fixes_and_ip.sql` (new), `supabase/schema.sql` | Same SQL merged into `schema.sql` so fresh installs get it. The CASE result is cast `::att_status`. Both files are **re-runnable**: types use `duplicate_object` guards, tables/indexes use `if not exists`, functions use `create or replace`, policies are dropped before creation, and the migration's drops are wrapped in a `to_regclass` guard so a first run without `allowed_ips` does not raise 42P01. |
| **B** | Fix endless loading on open / refresh | ✅ | `src/context/AuthContext.jsx`, `src/routes/ProtectedRoute.jsx`, `src/components/AuthStalled.jsx` (new), `src/App.jsx` | See root cause below. Synchronous auth callback, single joined query, 8s timeout with Retry / Sign out, StrictMode-safe, lazy limited to Reports. |
| **C** | Staff layout: desktop sidebar, mobile bottom nav, history Back button | ✅ | `src/pages/staff/StaffLayout.jsx` (new), `StaffPortal.jsx`, `StaffHistory.jsx`, `src/components/StaffHeader.jsx` (deleted) | No hamburger, no drawer on staff side. Bottom nav respects `env(safe-area-inset-bottom)`; content gets `pb-28`. |
| **D** | Admin nav: sidebar on desktop only, bottom nav on mobile only; Logs → Attendance | ✅ | `src/pages/admin/AdminLayout.jsx`, `src/pages/admin/Attendance.jsx` (new), `src/pages/admin/Logs.jsx` (deleted), `AdminDashboard.jsx`, `src/App.jsx` | Drawer/hamburger/overlay removed entirely. 5-item bottom nav: Dashboard, Staff, Attendance, Reports, Network. `/admin/logs` redirects to `/admin/attendance`. Every row/card leads with staff name + designation. |
| **E** | Add Staff form: confirm password, show/hide toggles, min 8 chars | ✅ | `src/pages/admin/StaffManagement.jsx`, `src/components/Input.jsx` | "Temporary password" wording removed. Submit disabled until valid. `confirm_password` is stripped before the Edge Function call. |
| **F** | IP restriction: Network page, staff banner, error mapping, hooks | ✅ | `src/lib/ipHooks.js` (new), `src/pages/admin/Network.jsx` (new), `src/lib/attendanceActions.js`, `src/pages/staff/StaffPortal.jsx` | `useIpStatus`, `useAllowedIps`, `useMyIp`, `useSchoolSettings` (+ `useToggleIpRestriction`, `useAddIp`, `useDeleteIp`). `IP_NOT_ALLOWED` → friendly toast; 42804/22P02/PGRST-style errors collapse to a generic message. |
| **G** | Verification and documentation | ✅ | `README.md`, `PROJECT_STATUS.md` | Lint + build clean. Mobile re-checked at all six widths. |

### Root cause of the loading bug (Part B)

Three separate defects combined to make the app hang on open and on refresh:

1. **`await` inside `onAuthStateChange` (the main cause).** `AuthContext` called `await loadProfile(nextSession)` — which itself awaited two `supabase.from(...)` queries — directly inside the `onAuthStateChange` callback. supabase-js holds an internal lock while dispatching that callback, so a PostgREST request started from within it can never complete. The `.finally()` that was supposed to clear `loading` never ran, so the full-page spinner stayed forever. The callback is now fully synchronous and only calls `setSession(...)`; the profile fetch lives in a separate effect keyed on `session?.user?.id`.
2. **`loading` was reset to `true` on every auth event.** `TOKEN_REFRESHED` fires roughly every 50 minutes and `SIGNED_IN` can re-fire on tab focus, each re-arming the loader and flashing the whole UI. A `resolvedUserId` ref now records which user id has already been resolved, and the callback takes a silent path (`setSession` only) when the id is unchanged.
3. **Two sequential queries plus no failure path.** Profile and school were fetched one after the other (two round trips, doubling the deadlock window) and a rejected request could leave `loading` stuck. They are now a single joined query — `.select('..., school:schools(...)')` — and every path goes through `try/catch/finally`.

Secondary issue: `React.lazy` + a `FullPageLoader` fallback meant *every* navigation blanked the screen. Only `Reports` (the recharts page) is still lazy, and its fallback is a small inline skeleton. `FullPageLoader` is now reserved for the one-time auth bootstrap.

Safety net: the provider caps the initial load at **8 seconds**; past that it renders `AuthStalled` with **Retry** and **Sign out** instead of an infinite spinner. A late-arriving successful response clears the timeout, so a slow connection does not get stranded on the error screen.

StrictMode note: the profile effect marks a user as resolved only on **success**, and uses an `active` cleanup flag. Marking it on *start* (the first attempt) would make the effect's StrictMode double-run hit its own early-return and leave `loading` true permanently in development.

No debug timing logs were left behind — they were added while isolating the deadlock and removed once the cause was confirmed.

---

## Module status (v1 modules, as built)

| Module | Status | Files | Details |
| --- | --- | --- | --- |
| **M1 — Setup** | ✅ complete | `vite.config.js`, `index.html`, `vercel.json`, `.env.example`, `.gitignore`, `public/favicon.svg`, `src/index.css`, `src/lib/supabase.js` | Vite 8 + React 19, Tailwind v4 via `@tailwindcss/vite`, lucide-react, react-router-dom 7, recharts 3, supabase-js. Folders `lib/context/components/pages/routes/utils` created. Supabase client uses the anon key only; warns in console when env vars are missing. Manual chunk groups split react / supabase / charts / icons. |
| **M2 — Auth & routing** | ✅ complete | `src/context/AuthContext.jsx`, `src/context/auth.js`, `src/routes/ProtectedRoute.jsx`, `src/pages/Login.jsx`, `src/pages/NoProfile.jsx`, `src/components/AuthStalled.jsx` | `AuthProvider` exposes session, profile, school, timezone, lateAfter, role, loading, timedOut, loadError, retry, signIn, signOut. Profile + school fetched in one joined query, keyed on the user id. Session survives refresh via `persistSession`. `ProtectedRoute` supports a `roles` guard, redirects staff↔admin, and shows the 8s stall screen. Signed-in user with no `profiles` row lands on `/no-profile`. |
| **M3 — Staff portal** | ✅ complete | `src/pages/staff/StaffPortal.jsx`, `src/pages/staff/StaffLayout.jsx`, `src/lib/attendanceActions.js` | Live clock in school timezone, long date, Sunday notice. Status card shows Not checked in / Checked in + Present\|Late badge / Checked out, plus hours worked. One full-width 64px button: Check In → Check Out → disabled "Done for today". Writes only via `supabase.rpc('check_in')` / `rpc('check_out')`. Double-click guarded by a `pending` flag, friendly error toasts, resync after a failed call. Red IP banner / green "School network verified" chip. |
| **M4 — Staff history** | ✅ complete | `src/pages/staff/StaffHistory.jsx` | Reads the caller's own `attendance` rows (RLS-limited), month filter (last 12 months), newest first, summary chips. Columns: Date, Check in, Check out, Hours, Status. Stacked cards below `md`, table from `md` up, explicit empty state, plus a Back button to `/staff`. |
| **M5 — Admin layout + dashboard** | ✅ complete | `src/pages/admin/AdminLayout.jsx`, `src/pages/admin/AdminDashboard.jsx`, `src/components/Layout.jsx` | Fixed dark sidebar at `lg`+ only; below `lg` a slim top header plus a 5-item safe-area bottom nav. No drawer, no hamburger. Dashboard calls `rpc('dashboard_today')` for Total / Present / Late / Absent (2 cols mobile → 4 cols at `lg`), an attendance-rate progress bar, and the "Checked in today" list. Auto-refresh every 60s plus manual refresh. |
| **M6 — Staff management** | ✅ complete | `src/pages/admin/StaffManagement.jsx`, `src/components/Modal.jsx` | Directory table with search (name/email) and designation filter; **admins are excluded** (`app_role = 'staff'`). Add Staff sheet (name, email, designation, password, confirm password) → `supabase.functions.invoke('manage-staff')`. Edit sheet (name, designation) → direct `profiles` update. Delete with confirmation → `manage-staff { action: 'delete' }`. Inline validation, submit disabled until valid, toasts. |
| **M7 — Reports** | ✅ complete | `src/pages/admin/Reports.jsx` | Day / Week / Month / Year segmented control (scrollable, fits 320px). Ranges computed in `Asia/Karachi`, passed to `rpc('attendance_report')`. Designation filter. Summary cards, stacked recharts `BarChart` in a `ResponsiveContainer`, detail table with Attendance %, and an **Export CSV** button. Only lazy-loaded route. |
| **M8 — Attendance (was Logs)** | ✅ complete | `src/pages/admin/Attendance.jsx` | All school attendance rows joined to `profiles!attendance_staff_id_fkey(full_name, designation)`. Filters: date range, designation (resolved to staff ids first), status, staff name search. Server-side pagination with `.range()`, 25 rows/page, `count: 'exact'`. Staff name + designation lead every card and table row. `/admin/logs` redirects here. |
| **M9 — Polish** | ✅ complete | `src/components/Feedback.jsx`, `src/components/ErrorBoundary.jsx`, `src/components/AuthStalled.jsx`, `src/pages/NotFound.jsx`, `src/utils/hooks.js`, `src/context/ToastContext.jsx`, all pages | Toasts, skeleton loaders, `ErrorState` with retry, class error boundary, 404 page, `usePageTitle` per layout, custom SVG favicon, `aria-*` attributes, `sr-only` captions, visible focus rings, labelled inputs, 44px touch targets, 16px input font. |
| **M10 — Network / IP (new)** | ✅ complete | `src/pages/admin/Network.jsx`, `src/lib/ipHooks.js` | Toggle, current-IP card with "Add this IP", add form with client-side IPv4/IPv6/CIDR validation, allow list with delete + confirm, and dynamic-IP / static-IP / mobile-data / IPv6 caveats. |

---

## Routes

| Path | Access | Component |
| --- | --- | --- |
| `/` | any | `RoleHome` — redirects to `/login`, `/no-profile`, `/admin` or `/staff` |
| `/login` | public | `Login` |
| `/no-profile` | signed in, no profile row | `NoProfile` |
| `/staff` | any signed-in user | `StaffLayout` → `StaffPortal` (index) |
| `/staff/history` | any signed-in user | `StaffHistory` |
| `/admin` | `app_role = 'admin'` | `AdminLayout` → `AdminDashboard` (index) |
| `/admin/staff` | admin | `StaffManagement` |
| `/admin/attendance` | admin | `Attendance` |
| `/admin/logs` | admin | redirect → `/admin/attendance` |
| `/admin/reports` | admin | `Reports` (lazy) |
| `/admin/network` | admin | `Network` |
| `*` | public | `NotFound` |

`Reports` is the only `React.lazy` route. Everything else is a normal import, so navigation never blanks the screen.

---

## Components

`Button` (+`IconButton`) · `TextInput` / `SelectInput` / `PasswordInput` (show/hide) / `Label` · `Modal` / `ConfirmDialog` · `StatusBadge` / `DesignationBadge` / `StatCard` / `Chip` · `Card` / `PageHeader` / `SegmentedControl` / `FilterToggle` · `Spinner` / `FullPageLoader` / `SkeletonLine` / `SkeletonCard` / `SkeletonTable` / `EmptyState` / `ErrorState` · `ErrorBoundary` · `AuthStalled`

## Hooks & libs

`useAuth` · `useToast` · `usePageTitle` · `useNow` · `useTodayKey` · `useInterval` · `useBodyScrollLock` · `useAsync` · `useTodayAttendance` · `useMyHistory` · `useDashboardToday` · `useCheckedInToday` · `useStaffList` · `useAttendanceReport` · `useAttendanceLogs` · `useAttendanceActions` · `friendlyMessage` / `isIpBlocked` / `IP_BLOCKED_MESSAGE` · `useIpStatus` · `useAllowedIps` · `useMyIp` · `useSchoolSettings` · `useToggleIpRestriction` · `useAddIp` · `useDeleteIp` · `normaliseCidr` / `validateCidr`

---

## Supabase objects used

**Tables**
| Table | Frontend access | RLS policy |
| --- | --- | --- |
| `schools` | `select` + `update` (own school; used by the IP toggle) | `own school`, `admin update school` |
| `profiles` | `select` (own row + admin's school), `update` (admin only, for edit) | `read profiles`, `admin update` |
| `attendance` | `select` only (never direct writes) | `read attendance` |
| `allowed_ips` | `select` / `insert` / `delete` (admin only, own school) | `admin read ips`, `admin insert ips`, `admin delete ips` |

**RPCs**
| Function | Called from | Purpose |
| --- | --- | --- |
| `check_in()` | `StaffPortal` | Cast fix, server-decides Present/Late, one-per-day, IP enforced |
| `check_out()` | `StaffPortal` | Closes today's active check-in, IP enforced |
| `attendance_report(p_from, p_to, p_designation)` | `Reports` | Per-staff present/late/absent over a range, Sundays excluded, future days clipped |
| `dashboard_today()` | `AdminDashboard` | Today's Total / Present / Late / Absent |
| `my_ip()` | `Network` | The caller's detected public IP |
| `ip_status()` | `StaffPortal` | `enforced` / `allowed` / `ip` for the banner |

**Helper SQL functions** — `current_school()`, `is_admin()`, `client_ip()`, `ip_allowed(uuid)` (called inside `check_in`/`check_out`)

**Edge Function**
`manage-staff` — admin-only. `create` (default) creates the auth user + profile; `{ action: 'delete', id }` removes both after a school-ownership check.

**Types**
`app_role` (`admin`, `staff`), `staff_role` (`teacher`, `principal`, `peon`, `driver`, `security_guard`, `accountant`), `att_status` (`present`, `late`)

---

## Test checklist

### Loading and auth (v2)
- [ ] Open `/staff` or `/admin` fresh → dashboard appears within ~1s, no stuck spinner
- [ ] Refresh on `/admin/attendance` → content returns, **no** full-page flash
- [ ] Sign in → lands on the role's home page without a blank frame
- [ ] Block the network / point at a bad URL → after **8 seconds** the "Taking too long" screen appears with working **Retry** and **Sign out** (not an infinite spinner)
- [ ] Click Retry with the network restored → app loads normally
- [ ] Switch browser tabs for a few minutes (token refresh fires) → **no** loader flash
- [ ] Dev mode with StrictMode double-render → no duplicate requests, no stuck spinner
- [ ] Wrong password → "Invalid email or password"
- [ ] Logged-in user whose `profiles` row is deleted → `/no-profile` with sign-out

### Attendance
- [ ] Staff Check In before `late_after` → badge **Present**, status card shows the time
- [ ] Staff Check In after `late_after` → badge **Late**
- [ ] Double-tap Check In (or two tabs) → "You have already checked in today"
- [ ] Check Out → status card shows out time + hours, button becomes disabled "Done for today"
- [ ] Check Out with no active check-in → "There is no active check-in to close for today"
- [ ] Changing the device clock does **not** change Present/Late (server decides)

### IP restriction (v2)
- [ ] **Restriction OFF (default)**, check in from any network → works, no banner
- [ ] Network page shows **Your current IP** and "Add this IP" adds it to the list
- [ ] Try to enable the toggle with an **empty** list → blocked, message shown
- [ ] **Restriction ON** + current IP on the list → staff portal shows the green "School network verified" chip, check in works
- [ ] **Restriction ON** + current IP **not** on the list → red banner with the detected IP, Check In/Out button replaced by "Check in blocked"
- [ ] Calling `check_in()` from a non-allowed IP directly → `IP_NOT_ALLOWED: ...`, mapped to the friendly toast
- [ ] Add the **same** IP twice → unique constraint error surfaced as a friendly toast, list not duplicated
- [ ] Enter `1.2.3.999`, `1.2.3.4/33`, or `not-an-ip` → inline validation, no request sent
- [ ] `1.2.3.4` is stored/displayed as `1.2.3.4/32`; `103.5.6.0/24` matches any address in that range
- [ ] Flip the toggle **off** → everyone can check in again, banner disappears
- [ ] Emergency: `update schools set ip_restriction_enabled = false;` unlocks the school
- [ ] Mobile data while restriction is ON → correctly blocked

### Add / edit / delete staff (v2)
- [ ] Add staff with mismatched confirm password → inline **"Passwords do not match"**, submit stays disabled
- [ ] Password of 7 characters → "Password must be at least 8 characters", submit disabled
- [ ] Both password fields have working show/hide toggles
- [ ] No "temporary password" wording anywhere in the form
- [ ] Valid form → account created, row appears, toast shown, staff can sign in immediately
- [ ] Edit staff name + designation → table reflects it
- [ ] Delete staff → confirmation required, row gone, that user's `auth.users` row removed
- [ ] **The admin account itself does not appear in the staff directory**
- [ ] Admin of school A cannot see or delete staff from school B

### Navigation (v2)
- [ ] **Staff, desktop ≥1024px**: fixed sidebar with logo, Home, My History, name + designation, Logout. **No bottom bar.**
- [ ] **Staff, mobile <1024px**: slim top header + bottom nav (Home, My History, Logout). **No sidebar, no hamburger.**
- [ ] History page shows a **Back** button that returns to `/staff`, in addition to the bottom nav
- [ ] Active nav item is highlighted in both layouts
- [ ] **Admin, desktop ≥1024px**: sidebar only, **no bottom bar, no hamburger, no drawer**
- [ ] **Admin, mobile <1024px**: bottom nav only with all 5 items (Dashboard, Staff, Attendance, Reports, Network), **no sidebar**
- [ ] `/admin/logs` redirects to `/admin/attendance`
- [ ] Bottom nav never covers content; safe-area padding works on a notched phone

### Attendance page (v2)
- [ ] Every card and table row leads with the **staff name**, then designation, then date / in / out / hours / status
- [ ] Date range, designation, status and staff-name filters each narrow results
- [ ] With >25 rows, Next loads a different set (server-side, not client slicing)
- [ ] Prev disabled on page 1, Next disabled on the last page
- [ ] Empty result → empty state with a working "Reset filters"

### Reports
- [ ] Day tab → single day; Week → Mon–Sun; Month → full month; Year → Jan 1 – Dec 31
- [ ] Designation filter narrows the table and the chart; `to` is never in the future
- [ ] Sunday contributes 0 to the working-day denominator
- [ ] Export CSV opens in Excel with correct headers and one row per staff

### RLS isolation
- [ ] Staff A's history contains only staff A's rows
- [ ] Staff A hitting the REST API directly for staff B's attendance → 0 rows
- [ ] Staff calling `attendance_report()` or `dashboard_today()` → "Admins only"
- [ ] Staff attempting a direct `insert` into `attendance` → permission denied (no policy exists)
- [ ] Staff inserting into `allowed_ips` → permission denied
- [ ] Unauthenticated request to any table → 0 rows

---

## Mobile responsiveness checklist

Tested by construction against the Tailwind breakpoints (base / `sm` 640 / `md` 768 / `lg` 1024 / `xl` 1280), `min-h-dvh`, `overflow-x-hidden` on `body`, `pb-safe` / `pb-safe-lg` for notched phones, and `text-base` (16px) on all inputs.

| Page | 320 | 375 | 414 | 768 | 1024 | 1440 | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Login** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Single column capped at `max-w-md`; 48px submit button; 44px password toggle; no horizontal scroll. |
| **Stall / error screen** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | New in v2. Centered card, buttons stack on mobile, inline from `sm`. |
| **No-profile** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Centered card; long emails `break-all`. |
| **Staff portal** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Sidebar at `lg`+, bottom nav below. Status card stacks; 64px full-width Check In/Out; 3-up time grid with `truncate`; IP banner wraps cleanly. |
| **Staff history** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 44px Back button; cards below `md`; table from `md`; month filter behind a Filters accordion below `lg`. |
| **Admin dashboard** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Sidebar `lg`+, 5-item bottom nav below. Stat cards 2 cols base → 4 at `lg`; checked-in list cards below `md`, table from `md`; rate bar full width. |
| **Staff management** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Cards below `md`, table from `md`. Add/Edit/Delete are bottom sheets with sticky footers; both password fields have 44px show/hide buttons inside the field (`pr-12` keeps the text clear). |
| **Attendance** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Name + designation lead every card/row. Cards below `md`; table `min-w-[760px]` in `overflow-x-auto` from `md`. Prev/Next only on mobile, numbered controls from `sm`. Bottom nav clears content (`pb-28`). |
| **Reports** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Segmented control is a scrollable strip, tabs `shrink-0`. Filters stack below `lg`. Chart in `ResponsiveContainer` (h-72 → h-80 at `sm`), 11px ticks, angled labels. |
| **Network** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | New in v2. Toggle is 44×64px (≥44px touch target) with a 36px knob. Warning banner wraps. Cards below `md`, table from `md`; monospace IPs `truncate`. Caveat list uses `list-disc`. |
| **404** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Centered card, actions stack on mobile, inline from `sm`. |

Global checks:
- **No horizontal page scroll** at any width — `body { overflow-x: hidden }`, all wide tables wrapped in `overflow-x-auto`, charts in `ResponsiveContainer`, long names/emails/IPs use `truncate`.
- **Nav split** — at `lg`+ each layout shows the sidebar and *no* bottom bar; below `lg` each shows a bottom bar and *no* sidebar. Neither has a hamburger or drawer.
- **Bottom bars** are `fixed` with `pb-safe`, and page containers use `pb-28` so nothing hides behind them.
- **Modals** are full-width bottom sheets with `max-h-[92dvh]` scrollable bodies and sticky footers on mobile, centred dialogs from `md`.
- **Touch targets** ≥ 44×44px for all buttons, links, inputs and icon buttons (`min-h-11` on every `Button` size, `h-11 w-11` on `IconButton`, `h-11 w-16` on the IP toggle).
- **Inputs** are `text-base` (16px) so iOS never zooms on focus.

No page is marked ⚠️ — all eleven pages are responsive at all six widths.

---

## Known limitations & assumptions

1. **Sunday is the only weekly off.** Saturday counts as a working day, matching the schema's `extract(dow from d) <> 0`. A per-school holiday calendar would need a new table.
2. **IP restriction is per-request, not per-device.** It keys off the public IP, so a shared campus IP lets any staff member on that network check in. It stops remote check-ins; it is not identity-grade. Pair it with device accounts if you need stronger proof.
3. **Dynamic school IPs are the main operational risk.** A school whose broadband IP changes overnight will block everyone until the admin updates the list. The Network page warns about this and offers a SQL escape hatch.
4. **A failed/denied header lookup means `client_ip()` returns `NULL`**, which never matches any CIDR — so if your deployment strips `x-forwarded-for`, enabling the restriction blocks all staff. Behind Supabase Cloud this is not an issue (Cloudflare always sets `cf-connecting-ip`); on self-hosted PostgREST behind a proxy it must forward the header.
5. **No leave / absence justification.** Absent is derived purely from a missing attendance row.
6. **No self-service password reset or password change.** Admin sets the password in the Add Staff sheet.
7. **Email is not verified.** `manage-staff` calls `createUser({ email_confirm: true })`, so a typo'd address locks out that person until an admin deletes and recreates them.
8. **Hours worked is elapsed time**, not net of breaks. Overtime is not computed or flagged.
9. **No live push updates.** The dashboard polls every 60s; there is no Realtime subscription.
10. **Staff directory search is client-side** over the school's staff rows (RLS already limits them). The Attendance search is server-side.
11. **Edit is limited to name + designation.** Email and role changes are not exposed, preventing accidental lockouts.
12. **Reports "Week" is Monday-based** (`startOfWeek`), which may differ from a school's week.
13. **No automated tests.** Verification was `npm run lint` (clean) + `npm run build` (clean) + static review. Live testing requires the migration to be applied.

### Suggested next improvements

- Realtime channel on `attendance` so the dashboard and staff portal update instantly.
- A `holidays` table (school_id + date) folded into `attendance_report()` and `dashboard_today()`.
- CSV export on the Attendance page, and a PDF/print stylesheet for monthly reports.
- Staff self-service password change + forgot-password flow.
- Device fingerprint or QR-code pairing instead of bare IP matching.
- A "safe IP" grace period so a mid-day IP change does not lock a guard out mid-shift.
- Super-admin console to create additional schools without touching SQL.
- Unit tests for the date-range maths in `src/utils/format.js` and CIDR helpers in `src/lib/ipHooks.js`.

---

## Manual steps required (not possible from this repo)

1. **Run `supabase/migrations/002_fixes_and_ip.sql`** in the Supabase SQL Editor (or re-run the updated `supabase/schema.sql` — both are idempotent and produce the same result). Without it, `check_in()` still throws 42804 and the Network page has no table to write to.
2. **Add allowed IPs BEFORE enabling the restriction.** Open Network → "Add this IP" → then flip the toggle. Otherwise everybody, including you, gets locked out; recover with `update schools set ip_restriction_enabled = false;`.
3. Redeploy the frontend if it is already live (Netlify/Vercel push, or the new code is only local).
4. The Edge Function does not need redeploying — it was not changed.