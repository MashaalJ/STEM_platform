-- Parent accounts + child linking

ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_role_check;
ALTER TABLE public.students ADD CONSTRAINT students_role_check
  CHECK (role IN ('student', 'teacher', 'admin', 'parent'));

CREATE TABLE IF NOT EXISTS public.parents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id       UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  student_id    UUID REFERENCES public.students(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parents_auth_id ON public.parents (auth_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_parents_student_id_unique
  ON public.parents (student_id) WHERE student_id IS NOT NULL;

ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS parent_select_own ON public.parents;
CREATE POLICY parent_select_own ON public.parents FOR SELECT USING (auth_id = auth.uid());

DROP POLICY IF EXISTS parent_update_own ON public.parents;
CREATE POLICY parent_update_own ON public.parents FOR UPDATE
  USING (auth_id = auth.uid()) WITH CHECK (auth_id = auth.uid());

DROP POLICY IF EXISTS parent_insert_own ON public.parents;
CREATE POLICY parent_insert_own ON public.parents FOR INSERT WITH CHECK (auth_id = auth.uid());

DROP POLICY IF EXISTS admin_all ON public.parents;
CREATE POLICY admin_all ON public.parents FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Auth trigger: recognize parent role
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r TEXT;
  dn TEXT;
BEGIN
  r := lower(coalesce(NEW.raw_user_meta_data->>'role', 'student'));
  IF r IN ('educator', 'teacher') THEN r := 'teacher';
  ELSIF r = 'admin' THEN r := 'admin';
  ELSIF r = 'parent' THEN r := 'parent';
  ELSE r := 'student';
  END IF;
  dn := coalesce(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(coalesce(NEW.email, ''), '@', 1),
    'User'
  );
  INSERT INTO public.students (id, name, role, email)
  VALUES (NEW.id, dn, r, NEW.email)
  ON CONFLICT (id) DO UPDATE SET
    name = excluded.name,
    email = coalesce(excluded.email, students.email),
    role = excluded.role;
  IF r = 'parent' THEN
    INSERT INTO public.parents (auth_id, name, email, student_id)
    VALUES (NEW.id, dn, coalesce(NEW.email, ''), NULL)
    ON CONFLICT (auth_id) DO UPDATE SET
      name = excluded.name,
      email = coalesce(excluded.email, parents.email);
  END IF;
  RETURN NEW;
END;
$$;
