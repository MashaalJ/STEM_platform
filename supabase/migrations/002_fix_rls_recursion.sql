-- Fix infinite RLS recursion (class_students ↔ students policies)
-- Run in Supabase SQL Editor after 001_stemverse_schema.sql

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$ SELECT role FROM public.students WHERE id = auth.uid(); $$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$ SELECT COALESCE(public.current_user_role(), '') = 'admin'; $$;

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$ SELECT COALESCE(public.current_user_role(), '') IN ('teacher', 'admin'); $$;

CREATE OR REPLACE FUNCTION public.teacher_can_view_student(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_students cs
    JOIN public.classes c ON c.id = cs.class_id
    WHERE cs.student_id = p_student_id AND c.teacher_id = auth.uid()
  );
$$;

-- Junction tables: explicit policies (avoid admin_all → is_admin → students → class_students loop)
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'class_students', 'class_missions', 'class_quizzes', 'class_challenges'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS admin_all ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS junction_admin ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS junction_teacher ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS junction_student ON public.%I', t);
  END LOOP;
END $$;

CREATE POLICY junction_admin ON public.class_students FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY junction_teacher ON public.class_students FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_students.class_id AND c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_students.class_id AND c.teacher_id = auth.uid()
    )
  );
CREATE POLICY junction_student ON public.class_students FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY junction_admin ON public.class_missions FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY junction_teacher ON public.class_missions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_missions.class_id AND c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_missions.class_id AND c.teacher_id = auth.uid()
    )
  );
CREATE POLICY junction_student ON public.class_missions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.class_students cs
      WHERE cs.class_id = class_missions.class_id AND cs.student_id = auth.uid()
    )
  );

CREATE POLICY junction_admin ON public.class_quizzes FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY junction_teacher ON public.class_quizzes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_quizzes.class_id AND c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_quizzes.class_id AND c.teacher_id = auth.uid()
    )
  );
CREATE POLICY junction_student ON public.class_quizzes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.class_students cs
      WHERE cs.class_id = class_quizzes.class_id AND cs.student_id = auth.uid()
    )
  );

CREATE POLICY junction_admin ON public.class_challenges FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY junction_teacher ON public.class_challenges FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_challenges.class_id AND c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_challenges.class_id AND c.teacher_id = auth.uid()
    )
  );
CREATE POLICY junction_student ON public.class_challenges FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.class_students cs
      WHERE cs.class_id = class_challenges.class_id AND cs.student_id = auth.uid()
    )
  );

-- Missions table patches (older partial schemas)
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS domains_json TEXT;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS learning_outcomes_json TEXT;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS embed_code TEXT;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS grade_level TEXT;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS prerequisite_mission_id UUID;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS image_url TEXT;
