-- First-login guided tutorial flag on students

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS tutorial_completed BOOLEAN NOT NULL DEFAULT FALSE;
