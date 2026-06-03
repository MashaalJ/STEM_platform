-- Teacher roster: create/sync student rows without RLS blocking server writes

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

CREATE OR REPLACE FUNCTION public.enroll_student_in_class(
  p_class_id UUID,
  p_student_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  INSERT INTO public.class_students (class_id, student_id)
  VALUES (p_class_id, p_student_id)
  ON CONFLICT (class_id, student_id) DO NOTHING;
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.provision_roster_student(UUID, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enroll_student_in_class(UUID, UUID)
  TO authenticated, service_role;
