-- Per-student sector mastery (drives progression unlocks)

CREATE TABLE IF NOT EXISTS public.student_sector_mastery (
  student_id        UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  sector_id         UUID NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  mastery_percent   NUMERIC NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_id, sector_id)
);

CREATE INDEX IF NOT EXISTS idx_student_sector_mastery_sector
  ON public.student_sector_mastery (sector_id);

ALTER TABLE public.student_sector_mastery ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_sector_mastery_select_own ON public.student_sector_mastery;
CREATE POLICY student_sector_mastery_select_own ON public.student_sector_mastery
  FOR SELECT USING (student_id = auth.uid());

DROP POLICY IF EXISTS student_sector_mastery_select_teacher ON public.student_sector_mastery;
CREATE POLICY student_sector_mastery_select_teacher ON public.student_sector_mastery
  FOR SELECT USING (public.is_teacher() AND public.teacher_can_view_student(student_id));

DROP POLICY IF EXISTS student_sector_mastery_admin ON public.student_sector_mastery;
CREATE POLICY student_sector_mastery_admin ON public.student_sector_mastery
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS student_sector_mastery_insert_own ON public.student_sector_mastery;
CREATE POLICY student_sector_mastery_insert_own ON public.student_sector_mastery
  FOR INSERT WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS student_sector_mastery_update_own ON public.student_sector_mastery;
CREATE POLICY student_sector_mastery_update_own ON public.student_sector_mastery
  FOR UPDATE USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
