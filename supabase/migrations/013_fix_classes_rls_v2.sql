-- BUG 1 follow-up: drop ALL policies on classes/class_students (old names may remain)
-- + SECURITY DEFINER join_code_exists for server join-code checks

-- 1) Remove every policy on these tables (avoids leftover recursive policies)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'classes'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.classes', pol.policyname);
  END LOOP;

  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'class_students'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.class_students', pol.policyname);
  END LOOP;
END $$;

-- 2) Helpers (row_security off = no RLS recursion)
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

-- 3) Recreate minimal non-recursive policies
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

-- 4) class_missions / quizzes / challenges: stop querying classes under RLS
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['class_missions', 'class_quizzes', 'class_challenges'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS junction_teacher ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS junction_admin ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS junction_student ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS admin_all ON public.%I', t);

    EXECUTE format(
      'CREATE POLICY junction_teacher ON public.%I FOR ALL
       USING (public.teacher_owns_class(class_id))
       WITH CHECK (public.teacher_owns_class(class_id))',
      t
    );
    EXECUTE format(
      'CREATE POLICY junction_admin ON public.%I FOR ALL
       USING (public.is_admin()) WITH CHECK (public.is_admin())',
      t
    );
    EXECUTE format(
      'CREATE POLICY junction_student ON public.%I FOR SELECT
       USING (EXISTS (
         SELECT 1 FROM public.class_students cs
         WHERE cs.class_id = %I.class_id AND cs.student_id = auth.uid()
       ))',
      t, t
    );
  END LOOP;
END $$;
