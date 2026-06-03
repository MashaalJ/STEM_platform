-- Student activity logs (mission complete, etc.)
CREATE TABLE IF NOT EXISTS public.student_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.student_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student own logs" ON public.student_activity_logs;
CREATE POLICY "student own logs" ON public.student_activity_logs
  FOR ALL USING (student_id = auth.uid());

DROP POLICY IF EXISTS "teacher read class logs" ON public.student_activity_logs;
CREATE POLICY "teacher read class logs" ON public.student_activity_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.class_students cs
      JOIN public.classes c ON c.id = cs.class_id
      WHERE cs.student_id = student_activity_logs.student_id
      AND c.teacher_id = auth.uid()
    )
  );
