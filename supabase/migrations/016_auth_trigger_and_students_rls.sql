-- Auth trigger must bypass RLS when creating students row
-- + explicit service_role policies if JWT is used without bypass

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
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

DROP POLICY IF EXISTS students_service_role_all ON public.students;
CREATE POLICY students_service_role_all ON public.students
  FOR ALL
  USING (coalesce(auth.jwt() ->> 'role', '') = 'service_role')
  WITH CHECK (coalesce(auth.jwt() ->> 'role', '') = 'service_role');

-- Re-assert roster RPC (safe if 015 already applied)
CREATE OR REPLACE FUNCTION public.provision_roster_student(
  p_id UUID,
  p_name TEXT,
  p_username TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_password TEXT DEFAULT 'password123'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  INSERT INTO public.students (
    id, name, username, email, avatar_url, password, role, level, xp
  )
  VALUES (
    p_id,
    p_name,
    NULLIF(trim(p_username), ''),
    NULLIF(trim(p_email), ''),
    NULLIF(trim(p_avatar_url), ''),
    COALESCE(NULLIF(trim(p_password), ''), 'password123'),
    'student',
    1,
    0
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    username = COALESCE(EXCLUDED.username, students.username),
    email = COALESCE(EXCLUDED.email, students.email),
    avatar_url = COALESCE(EXCLUDED.avatar_url, students.avatar_url),
    password = EXCLUDED.password,
    role = 'student';
  RETURN p_id;
END;
$$;
