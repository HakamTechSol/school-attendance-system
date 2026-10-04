-- =============================================================
--  003_student_designation.sql
--  Adds 'student' as a designation so students can mark their own
--  attendance using the same check-in / check-out flow as staff.
--
--  Safe to run more than once (if not exists guard).
--  Fresh installs already include this in schema.sql.
-- =============================================================

alter type staff_role add value if not exists 'student';

-- ---------------------------------------------------------------
--  Notes
-- ---------------------------------------------------------------
--  A student is simply a profile with:
--      app_role    = 'staff'
--      designation = 'student'
--
--  Everything else already works and needs no change:
--    * check_in() / check_out() do not branch on designation
--    * RLS allows any app_role='staff' profile to read its own rows
--    * Admin adds the student from the Staff page (name, email,
--      designation = Student, password)
--    * Reports and Attendance both gain a "Student" filter
--    * Student logins land on /staff, exactly like any other person
--
--  No separate students table, no separate portal, no data migration.
-- =============================================================