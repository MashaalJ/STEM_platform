-- School accounts layer (numbered 029; 015 is provision_roster_student)

CREATE TABLE IF NOT EXISTS public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT,
  country TEXT NOT NULL DEFAULT 'Pakistan',
  tier TEXT NOT NULL DEFAULT 'explorer',
  subscription_status TEXT NOT NULL DEFAULT 'trial',
  subscription_expires_at TIMESTAMPTZ,
  max_teachers INTEGER NOT NULL DEFAULT 2,
  max_students INTEGER NOT NULL DEFAULT 50,
  activation_code TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.students(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_schools_activation_code ON public.schools (activation_code) WHERE activation_code IS NOT NULL;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_students_school ON public.students (school_id);

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_classes_school ON public.classes (school_id);

ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_role_check;
ALTER TABLE public.students ADD CONSTRAINT students_role_check
  CHECK (role IN ('student', 'teacher', 'admin', 'parent', 'school_admin'));

CREATE TABLE IF NOT EXISTS public.teacher_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  email TEXT,
  used BOOLEAN NOT NULL DEFAULT false,
  used_by UUID REFERENCES public.students(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.students(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_teacher_invites_school ON public.teacher_invites (school_id);
CREATE INDEX IF NOT EXISTS idx_teacher_invites_code ON public.teacher_invites (code);

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_invites ENABLE ROW LEVEL SECURITY;

-- schools policies
DROP POLICY IF EXISTS schools_admin_all ON public.schools;
CREATE POLICY schools_admin_all ON public.schools
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS schools_school_admin_own ON public.schools;
CREATE POLICY schools_school_admin_own ON public.schools
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = auth.uid() AND s.role = 'school_admin' AND s.school_id = schools.id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = auth.uid() AND s.role = 'school_admin' AND s.school_id = schools.id
    )
  );

DROP POLICY IF EXISTS schools_teacher_read ON public.schools;
CREATE POLICY schools_teacher_read ON public.schools
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = auth.uid() AND s.role = 'teacher' AND s.school_id = schools.id
    )
  );

DROP POLICY IF EXISTS schools_student_read_name ON public.schools;
CREATE POLICY schools_student_read_name ON public.schools
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = auth.uid() AND s.role = 'student' AND s.school_id = schools.id
    )
  );

-- teacher_invites: school_admin for their school
DROP POLICY IF EXISTS teacher_invites_school_admin ON public.teacher_invites;
CREATE POLICY teacher_invites_school_admin ON public.teacher_invites
  FOR ALL
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = auth.uid() AND s.role = 'school_admin' AND s.school_id = teacher_invites.school_id
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = auth.uid() AND s.role = 'school_admin' AND s.school_id = teacher_invites.school_id
    )
  );
