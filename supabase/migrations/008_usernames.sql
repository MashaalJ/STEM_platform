-- Ensure student usernames column + index (001 may already define these)

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS username TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_username_lower
  ON public.students (LOWER(username)) WHERE username IS NOT NULL;
