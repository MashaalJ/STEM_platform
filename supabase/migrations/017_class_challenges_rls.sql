-- FIX 1: class_challenges already exists (001_stemverse_schema.sql, composite PK class_id+challenge_id).
-- PostgREST cannot join class_challenges ↔ class_students directly (no FK). App code uses two-step queries.
-- This migration ensures RLS policies exist for class_challenges.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'class_challenges'
  ) THEN
    CREATE TABLE public.class_challenges (
      class_id       UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
      challenge_id   UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
      assigned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (class_id, challenge_id)
    );
    CREATE INDEX IF NOT EXISTS idx_class_challenges_challenge ON public.class_challenges (challenge_id);
  END IF;
END $$;

ALTER TABLE public.class_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teacher manages class challenges" ON public.class_challenges;
DROP POLICY IF EXISTS "student views class challenges" ON public.class_challenges;
DROP POLICY IF EXISTS junction_admin ON public.class_challenges;
DROP POLICY IF EXISTS junction_teacher ON public.class_challenges;
DROP POLICY IF EXISTS junction_student ON public.class_challenges;

CREATE POLICY "teacher manages class challenges"
  ON public.class_challenges FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE id = class_challenges.class_id
        AND teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE id = class_challenges.class_id
        AND teacher_id = auth.uid()
    )
  );

CREATE POLICY "student views class challenges"
  ON public.class_challenges FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.class_students
      WHERE class_id = class_challenges.class_id
        AND student_id = auth.uid()
    )
  );

CREATE POLICY junction_admin ON public.class_challenges FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());
