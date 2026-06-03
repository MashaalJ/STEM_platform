-- Reusable code so multiple teachers can join the same school (principal shares one code).

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS teacher_join_code TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_schools_teacher_join_code
  ON public.schools (teacher_join_code)
  WHERE teacher_join_code IS NOT NULL;
