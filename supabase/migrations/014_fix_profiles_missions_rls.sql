-- Fix infinite RLS recursion on profiles (often hit when loading missions)
-- Safe if profiles table does not exist

DO $$
DECLARE
  pol RECORD;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'profiles'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
    END LOOP;

    DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
    DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
    DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
    DROP POLICY IF EXISTS profiles_admin ON public.profiles;

    CREATE POLICY profiles_select_own ON public.profiles
      FOR SELECT USING (id = auth.uid());

    CREATE POLICY profiles_update_own ON public.profiles
      FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

    CREATE POLICY profiles_insert_own ON public.profiles
      FOR INSERT WITH CHECK (id = auth.uid());

    CREATE POLICY profiles_admin ON public.profiles
      FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;

-- Server-side mission reads without tripping profiles ↔ missions RLS loops
CREATE OR REPLACE FUNCTION public.list_missions_admin()
RETURNS SETOF public.missions
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT * FROM public.missions ORDER BY created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.list_missions_admin() TO authenticated, service_role;
