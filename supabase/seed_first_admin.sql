-- ============================================================
--  SEED: first school + first admin account
-- ============================================================
--  The admin password can never be set from SQL, so do it in the
--  Supabase Dashboard first, then paste the user's UUID below.
--
--  STEP 1 - Supabase Dashboard > Authentication > Users > Add user
--           Email     : admin@yourschool.edu
--           Password  : a strong password you choose
--           Tick "Auto Confirm User"
--           Copy the generated User UUID.
--
--  STEP 2 - Run the SQL below, replacing the placeholders.
-- ============================================================

-- ---- 2a. Create the school (keep the RETURNING id) -----------
insert into schools (name, timezone, late_after)
values ('Your School Name', 'Asia/Karachi', '08:00')
returning id;   -- e.g. 11111111-2222-3333-4444-555555555555

-- ---- 2b. Create the admin profile for that user -------------
-- Replace <SCHOOL_UUID_FROM_ABOVE> and <ADMIN_USER_UUID_FROM_STEP_1>.
-- app_role must be 'admin' so the admin dashboard/reports unlock.
-- designation stays NULL for admins (the enum only covers staff roles).
--
-- insert into profiles (id, school_id, full_name, email, app_role)
-- values (
--   '<ADMIN_USER_UUID_FROM_STEP_1>',
--   '<SCHOOL_UUID_FROM_ABOVE>',
--   'System Admin',
--   'admin@yourschool.edu',
--   'admin'
-- );

-- ============================================================
--  ADDING MORE SCHOOLS (multi-tenant)
-- ============================================================
-- 1. insert into schools (name, timezone, late_after) values (...) returning id;
-- 2. Create each admin user in Authentication > Users.
-- 3. insert into profiles (id, school_id, full_name, email, app_role)
--    values ('<admin uuid>', '<new school uuid>', 'Admin Name', 'admin@...', 'admin');
-- Every admin is scoped to their own school_id by RLS.
-- ============================================================