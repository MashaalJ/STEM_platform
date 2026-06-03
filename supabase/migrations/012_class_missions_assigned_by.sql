-- Track who assigned a mission to a class (required on some deployments)

ALTER TABLE public.class_missions
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES public.students(id) ON DELETE SET NULL;

UPDATE public.class_missions cm
SET assigned_by = c.teacher_id
FROM public.classes c
WHERE cm.class_id = c.id
  AND cm.assigned_by IS NULL
  AND c.teacher_id IS NOT NULL;
