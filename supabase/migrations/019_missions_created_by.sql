-- FIX 3: missions.created_by (required on some deployments)

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.students(id) ON DELETE SET NULL;

UPDATE public.missions m
SET created_by = sub.id
FROM (
  SELECT id FROM public.students
  WHERE role IN ('teacher', 'admin')
  ORDER BY created_at NULLS LAST, id
  LIMIT 1
) sub
WHERE m.created_by IS NULL AND sub.id IS NOT NULL;

ALTER TABLE public.missions
  ALTER COLUMN created_by DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_missions_created_by ON public.missions (created_by);
