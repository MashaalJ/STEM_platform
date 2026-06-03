-- Fix infinite RLS recursion between classes ↔ class_students
-- Run in Supabase SQL Editor after 001–010
-- If recursion persists after this file, also run 013_fix_classes_rls_v2.sql

-- Drop ALL policies on these tables (leftover names cause recursion)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'classes'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.classes', pol.policyname);
  END LOOP;
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'class_students'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.class_students', pol.policyname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "teachers can manage their classes" ON public.classes;
DROP POLICY IF EXISTS "students can view enrolled classes" ON public.classes;
DROP POLICY IF EXISTS teacher_own_classes ON public.classes;
DROP POLICY IF EXISTS student_view_class ON public.classes;

-- SECURITY DEFINER helpers (no RLS recursion)
CREATE OR REPLACE FUNCTION public.get_student_class_ids(p_student_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT class_id FROM public.class_students WHERE student_id = p_student_id;
$$;

CREATE OR REPLACE FUNCTION public.teacher_owns_class(p_class_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes
    WHERE id = p_class_id AND teacher_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.join_code_exists(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes
    WHERE join_code = upper(trim(p_code))
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_student_class_ids(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.teacher_owns_class(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_code_exists(TEXT) TO authenticated, service_role;

-- Classes: non-recursive policies
CREATE POLICY "teacher owns class"
  ON public.classes FOR ALL
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "student views enrolled class"
  ON public.classes FOR SELECT
  USING (id IN (SELECT public.get_student_class_ids(auth.uid())));

CREATE POLICY "admin full access classes"
  ON public.classes FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- class_students: never query classes under RLS (use teacher_owns_class)
CREATE POLICY "teacher manages enrollment"
  ON public.class_students FOR ALL
  USING (public.teacher_owns_class(class_id))
  WITH CHECK (public.teacher_owns_class(class_id));

CREATE POLICY "student views own enrollment"
  ON public.class_students FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "student joins class"
  ON public.class_students FOR INSERT
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "admin manages all enrollments"
  ON public.class_students FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
