/*
# Prevent privilege escalation and unauthorized verification status modifications

## Vulnerability Addressed
Authenticated users (nurses or hospitals) could previously execute direct UPDATE queries
against `public.profiles` changing `role = 'admin'` or `verification_status = 'verified'`
due to unrestricted column updates in the owner update RLS policy.

## Fix
1. Create `protect_profile_sensitive_fields()` BEFORE UPDATE / INSERT trigger function:
   - Validates that non-admin users cannot alter `role` or `verification_status`.
   - Rejects unauthorized changes with error 42501 (insufficient_privilege).
   - Allows platform administrators (verified via `is_admin()`) to update any role or verification status.
   - Allows backend/service role processes (where `auth.uid() IS NULL`) to operate unimpeded.
   - Allows users to update all other self-editable profile fields (full_name, phone, bio, city, state, etc.).
2. Create `protect_nurse_profile_verification_status()` BEFORE UPDATE trigger function for `nurse_profiles`.
3. Create `protect_hospital_verification_status()` BEFORE UPDATE trigger function for `hospitals`.
4. Attach BEFORE UPDATE triggers to `profiles`, `nurse_profiles`, and `hospitals`.

## Data Safety
- No tables created or deleted.
- No columns added, removed, or renamed.
- No legitimate data modified.
- Existing RLS policies remain intact.
*/

-- ============ FUNCTION: protect_profile_sensitive_fields ============
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service-role / background migrations where auth.uid() is null
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- If user is NOT an administrator, enforce column-level immutability
  IF NOT public.is_admin() THEN
    -- Check role mutation
    IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Unauthorized: Only platform administrators can change user roles.'
        USING ERRCODE = '42501';
    END IF;

    -- Check verification_status mutation
    IF TG_OP = 'UPDATE' AND NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
      RAISE EXCEPTION 'Unauthorized: Only platform administrators can change verification status.'
        USING ERRCODE = '42501';
    END IF;

    -- Check direct insert escalation
    IF TG_OP = 'INSERT' THEN
      IF NEW.role = 'admin' THEN
        RAISE EXCEPTION 'Unauthorized: Cannot register directly as platform administrator.'
          USING ERRCODE = '42501';
      END IF;
      IF NEW.verification_status = 'verified' THEN
        RAISE EXCEPTION 'Unauthorized: Initial profile cannot be self-verified.'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ============ FUNCTION: protect_nurse_profile_verification_status ============
CREATE OR REPLACE FUNCTION public.protect_nurse_profile_verification_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_admin() THEN
    IF TG_OP = 'UPDATE' AND NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
      RAISE EXCEPTION 'Unauthorized: Only platform administrators can change verification status.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ============ FUNCTION: protect_hospital_verification_status ============
CREATE OR REPLACE FUNCTION public.protect_hospital_verification_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_admin() THEN
    IF TG_OP = 'UPDATE' AND NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
      RAISE EXCEPTION 'Unauthorized: Only platform administrators can change verification status.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ============ ATTACH TRIGGERS ============
DROP TRIGGER IF EXISTS trg_protect_profile_sensitive_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_sensitive_fields
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_sensitive_fields();

DROP TRIGGER IF EXISTS trg_protect_nurse_profile_verification_status ON public.nurse_profiles;
CREATE TRIGGER trg_protect_nurse_profile_verification_status
  BEFORE UPDATE ON public.nurse_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_nurse_profile_verification_status();

DROP TRIGGER IF EXISTS trg_protect_hospital_verification_status ON public.hospitals;
CREATE TRIGGER trg_protect_hospital_verification_status
  BEFORE UPDATE ON public.hospitals
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_hospital_verification_status();

-- Revoke direct execution permissions so functions can only be invoked by triggers
REVOKE EXECUTE ON FUNCTION public.protect_profile_sensitive_fields() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_nurse_profile_verification_status() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_hospital_verification_status() FROM anon, authenticated;
