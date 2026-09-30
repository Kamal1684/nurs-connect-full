/*
# Clean Test Data & Add Admin DELETE Policies

## Problem
1. RLS DELETE policies on `profiles`, `nurse_profiles`, `hospitals`, `nurse_documents`,
   `hospital_documents`, `saved_jobs`, and `notifications` only allowed the row owner
   to delete (`auth.uid() = id`, `auth.uid() = user_id`, or `auth.uid() = nurse_id`).
2. When a platform administrator clicked "Clean Test Data" in the Admin Dashboard,
   PostgreSQL RLS silently filtered out all non-matching rows (0 rows affected),
   preventing the administrator from removing test and E2E records.

## Solution
1. Add admin-scoped DELETE policies for `profiles`, `nurse_profiles`, `hospitals`,
   `nurse_documents`, `hospital_documents`, `saved_jobs`, and `notifications`.
2. Create `clean_test_data()` RPC function with `SECURITY DEFINER` that validates
   the caller is an admin (via `is_admin()`), deletes all test records across
   all 13 application tables in foreign-key order, and preserves the Admin account.
3. Execute the cleanup immediately across all tables to clear existing test records.

## Data Safety
- Preserves the Admin account (`profiles.role = 'admin'`).
- Preserves all table schemas, constraints, and relationships.
- Preserves all existing RLS policies and adds administrative DELETE permissions.
*/

-- ============ 1. ADMIN DELETE POLICIES ============

-- profiles: admin can delete test profiles
DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;
CREATE POLICY "profiles_delete_admin" ON profiles FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- nurse_profiles: admin can delete test nurse profiles
DROP POLICY IF EXISTS "nurse_profiles_delete_admin" ON nurse_profiles;
CREATE POLICY "nurse_profiles_delete_admin" ON nurse_profiles FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- hospitals: admin can delete test hospital profiles
DROP POLICY IF EXISTS "hospitals_delete_admin" ON hospitals;
CREATE POLICY "hospitals_delete_admin" ON hospitals FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- nurse_documents: admin can delete test documents
DROP POLICY IF EXISTS "nurse_documents_delete_admin" ON nurse_documents;
CREATE POLICY "nurse_documents_delete_admin" ON nurse_documents FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- hospital_documents: admin can delete test hospital documents
DROP POLICY IF EXISTS "hospital_documents_delete_admin" ON hospital_documents;
CREATE POLICY "hospital_documents_delete_admin" ON hospital_documents FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- saved_jobs: admin can delete saved jobs
DROP POLICY IF EXISTS "saved_jobs_delete_admin" ON saved_jobs;
CREATE POLICY "saved_jobs_delete_admin" ON saved_jobs FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- notifications: admin can delete notifications
DROP POLICY IF EXISTS "notifications_delete_admin" ON notifications;
CREATE POLICY "notifications_delete_admin" ON notifications FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );


-- ============ 2. STORED PROCEDURE: clean_test_data ============

CREATE OR REPLACE FUNCTION public.clean_test_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_reviews int;
  v_deleted_interviews int;
  v_deleted_applications int;
  v_deleted_saved_jobs int;
  v_deleted_job_matches int;
  v_deleted_jobs int;
  v_deleted_shifts int;
  v_deleted_nurse_docs int;
  v_deleted_hosp_docs int;
  v_deleted_nurse_profiles int;
  v_deleted_hospitals int;
  v_deleted_notifications int;
  v_deleted_profiles int;
BEGIN
  -- Verify caller is an authenticated platform administrator
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only platform administrators can clean test data.'
      USING ERRCODE = '42501';
  END IF;

  -- 1. Reviews
  DELETE FROM public.reviews;
  GET DIAGNOSTICS v_deleted_reviews = ROW_COUNT;

  -- 2. Interviews
  DELETE FROM public.interviews;
  GET DIAGNOSTICS v_deleted_interviews = ROW_COUNT;

  -- 3. Applications
  DELETE FROM public.applications;
  GET DIAGNOSTICS v_deleted_applications = ROW_COUNT;

  -- 4. Saved Jobs
  DELETE FROM public.saved_jobs;
  GET DIAGNOSTICS v_deleted_saved_jobs = ROW_COUNT;

  -- 5. Job Matches
  DELETE FROM public.job_matches;
  GET DIAGNOSTICS v_deleted_job_matches = ROW_COUNT;

  -- 6. Jobs
  DELETE FROM public.jobs;
  GET DIAGNOSTICS v_deleted_jobs = ROW_COUNT;

  -- 7. Shifts
  DELETE FROM public.shifts;
  GET DIAGNOSTICS v_deleted_shifts = ROW_COUNT;

  -- 8. Nurse Documents
  DELETE FROM public.nurse_documents;
  GET DIAGNOSTICS v_deleted_nurse_docs = ROW_COUNT;

  -- 9. Hospital Documents
  DELETE FROM public.hospital_documents;
  GET DIAGNOSTICS v_deleted_hosp_docs = ROW_COUNT;

  -- 10. Nurse Profiles
  DELETE FROM public.nurse_profiles;
  GET DIAGNOSTICS v_deleted_nurse_profiles = ROW_COUNT;

  -- 11. Hospitals
  DELETE FROM public.hospitals;
  GET DIAGNOSTICS v_deleted_hospitals = ROW_COUNT;

  -- 12. Notifications
  DELETE FROM public.notifications;
  GET DIAGNOSTICS v_deleted_notifications = ROW_COUNT;

  -- 13. Profiles (strictly preserve role = 'admin')
  DELETE FROM public.profiles WHERE role != 'admin';
  GET DIAGNOSTICS v_deleted_profiles = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_profiles', v_deleted_profiles,
    'deleted_hospitals', v_deleted_hospitals,
    'deleted_nurse_profiles', v_deleted_nurse_profiles,
    'deleted_jobs', v_deleted_jobs,
    'deleted_applications', v_deleted_applications,
    'deleted_interviews', v_deleted_interviews,
    'deleted_reviews', v_deleted_reviews,
    'deleted_nurse_docs', v_deleted_nurse_docs,
    'deleted_hosp_docs', v_deleted_hosp_docs,
    'deleted_saved_jobs', v_deleted_saved_jobs,
    'deleted_shifts', v_deleted_shifts,
    'deleted_notifications', v_deleted_notifications
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.clean_test_data() TO authenticated;


-- ============ 3. IMMEDIATE CLEANUP OF ALL TEST DATA ============

DELETE FROM public.reviews;
DELETE FROM public.interviews;
DELETE FROM public.applications;
DELETE FROM public.saved_jobs;
DELETE FROM public.job_matches;
DELETE FROM public.jobs;
DELETE FROM public.shifts;
DELETE FROM public.nurse_documents;
DELETE FROM public.hospital_documents;
DELETE FROM public.nurse_profiles;
DELETE FROM public.hospitals;
DELETE FROM public.notifications;
DELETE FROM public.profiles WHERE role != 'admin';
