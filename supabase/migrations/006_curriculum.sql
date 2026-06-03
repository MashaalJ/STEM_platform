-- Class-level and default mission curriculum customization

CREATE TABLE IF NOT EXISTS public.class_curriculum (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id                UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  sector_id               UUID REFERENCES public.sectors(id) ON DELETE SET NULL,
  mission_id              UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  is_enabled              BOOLEAN NOT NULL DEFAULT TRUE,
  custom_order            INTEGER,
  custom_title            TEXT,
  custom_description      TEXT,
  unlock_after_mission_id UUID REFERENCES public.missions(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_id, mission_id)
);

CREATE INDEX IF NOT EXISTS idx_class_curriculum_class ON public.class_curriculum (class_id);
CREATE INDEX IF NOT EXISTS idx_class_curriculum_sector ON public.class_curriculum (sector_id);

CREATE TABLE IF NOT EXISTS public.default_curriculum (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id               UUID REFERENCES public.sectors(id) ON DELETE SET NULL,
  mission_id              UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  is_enabled              BOOLEAN NOT NULL DEFAULT TRUE,
  custom_order            INTEGER,
  custom_title            TEXT,
  custom_description      TEXT,
  unlock_after_mission_id UUID REFERENCES public.missions(id) ON DELETE SET NULL,
  managed_by              UUID REFERENCES public.students(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sector_id, mission_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_default_curriculum_mission
  ON public.default_curriculum (mission_id);

ALTER TABLE public.class_curriculum ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.default_curriculum ENABLE ROW LEVEL SECURITY;

-- class_curriculum: teachers manage own classes; students read via server (service role)
DROP POLICY IF EXISTS class_curriculum_teacher_all ON public.class_curriculum;
CREATE POLICY class_curriculum_teacher_all ON public.class_curriculum
  FOR ALL
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_curriculum.class_id AND c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_curriculum.class_id AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS class_curriculum_student_read ON public.class_curriculum;
CREATE POLICY class_curriculum_student_read ON public.class_curriculum
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.class_students cs
      WHERE cs.class_id = class_curriculum.class_id AND cs.student_id = auth.uid()
    )
  );

-- default_curriculum: admin + teacher write; all authenticated read
DROP POLICY IF EXISTS default_curriculum_write ON public.default_curriculum;
CREATE POLICY default_curriculum_write ON public.default_curriculum
  FOR ALL
  USING (public.is_admin() OR public.is_teacher())
  WITH CHECK (public.is_admin() OR public.is_teacher());

DROP POLICY IF EXISTS default_curriculum_read ON public.default_curriculum;
CREATE POLICY default_curriculum_read ON public.default_curriculum
  FOR SELECT USING (auth.uid() IS NOT NULL);
