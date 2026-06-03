-- FIX 4: challenges.created_by (parity with missions)

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.students(id) ON DELETE SET NULL;

UPDATE public.challenges c
SET created_by = sub.id
FROM (
  SELECT id FROM public.students
  WHERE role IN ('teacher', 'admin')
  ORDER BY created_at NULLS LAST, id
  LIMIT 1
) sub
WHERE c.created_by IS NULL AND sub.id IS NOT NULL;

ALTER TABLE public.challenges
  ALTER COLUMN created_by DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_challenges_created_by ON public.challenges (created_by);
