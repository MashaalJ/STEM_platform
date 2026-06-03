-- STEMverse PostgreSQL schema (SQLite parity)
-- students.id = auth.users.id for RLS (auth.uid())

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.students (
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  username              TEXT,
  password              TEXT DEFAULT 'password123',
  level                 INTEGER NOT NULL DEFAULT 1,
  xp                    INTEGER NOT NULL DEFAULT 0,
  avatar_url            TEXT,
  role                  TEXT NOT NULL DEFAULT 'student'
                        CHECK (role IN ('student', 'teacher', 'admin', 'parent')),
  age                   INTEGER,
  grade                 TEXT,
  school                TEXT,
  city                  TEXT,
  email                 TEXT,
  parent_email          TEXT,
  contact_number        TEXT,
  gender                TEXT,
  country_code          TEXT,
  region                TEXT,
  timezone              TEXT,
  subscription_status   TEXT NOT NULL DEFAULT 'free',
  subscription_plan     TEXT NOT NULL DEFAULT 'free',
  billing_provider      TEXT NOT NULL DEFAULT 'none',
  mrr_cents             INTEGER NOT NULL DEFAULT 0,
  ltv_cents             INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_username_lower
  ON public.students (LOWER(username)) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_students_role ON public.students (role);
CREATE INDEX IF NOT EXISTS idx_students_email ON public.students (email);

-- ---------------------------------------------------------------------------
-- sectors & missions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sectors (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  description      TEXT,
  xp_reward        INTEGER,
  required_level   INTEGER,
  mastery_percent  INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'locked',
  image_url        TEXT,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  is_starter       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.missions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id               UUID REFERENCES public.sectors(id) ON DELETE SET NULL,
  title                   TEXT NOT NULL,
  description             TEXT,
  difficulty              TEXT,
  xp_reward               INTEGER,
  status                  TEXT NOT NULL DEFAULT 'available',
  image_url               TEXT,
  embed_code              TEXT,
  grade_level             TEXT,
  prerequisite_mission_id UUID REFERENCES public.missions(id) ON DELETE SET NULL,
  learning_outcomes_json  TEXT,
  domains_json            TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_missions_sector ON public.missions (sector_id);

-- ---------------------------------------------------------------------------
-- quizzes & challenges
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.quizzes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  grade_level  TEXT,
  questions    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.challenges (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                TEXT NOT NULL,
  type                 TEXT NOT NULL,
  world                TEXT,
  zone                 TEXT,
  grade_level          TEXT,
  xp_reward            INTEGER NOT NULL DEFAULT 100,
  xp_bonus_first_try   INTEGER NOT NULL DEFAULT 0,
  xp_retry_penalty     INTEGER NOT NULL DEFAULT 0,
  content_json         TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- classes & junctions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.classes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  teacher_id        UUID REFERENCES public.students(id) ON DELETE SET NULL,
  description       TEXT,
  curriculum_track  TEXT,
  join_code         TEXT UNIQUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_classes_teacher ON public.classes (teacher_id);

CREATE TABLE IF NOT EXISTS public.class_students (
  class_id    UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (class_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_class_students_student ON public.class_students (student_id);

CREATE TABLE IF NOT EXISTS public.class_missions (
  class_id     UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  mission_id   UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (class_id, mission_id)
);

CREATE TABLE IF NOT EXISTS public.class_quizzes (
  class_id     UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  quiz_id      UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (class_id, quiz_id)
);

CREATE TABLE IF NOT EXISTS public.class_challenges (
  class_id       UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  challenge_id   UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  assigned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (class_id, challenge_id)
);

-- ---------------------------------------------------------------------------
-- student progress
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.student_mission_completions (
  student_id    UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  mission_id    UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_id, mission_id)
);

CREATE TABLE IF NOT EXISTS public.student_quizzes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID REFERENCES public.students(id) ON DELETE CASCADE,
  quiz_id           UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
  score             INTEGER,
  auto_score        INTEGER NOT NULL DEFAULT 0,
  reviewed_score    INTEGER NOT NULL DEFAULT 0,
  pending_reviews   INTEGER NOT NULL DEFAULT 0,
  total_questions   INTEGER,
  completed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_quizzes_student ON public.student_quizzes (student_id);

CREATE TABLE IF NOT EXISTS public.quiz_review_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_quiz_id  UUID NOT NULL REFERENCES public.student_quizzes(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  quiz_id          UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_index   INTEGER NOT NULL,
  question_type    TEXT NOT NULL,
  prompt           TEXT,
  response_text    TEXT,
  max_score        INTEGER NOT NULL DEFAULT 1,
  awarded_score    INTEGER NOT NULL DEFAULT 0,
  review_status    TEXT NOT NULL DEFAULT 'pending',
  reviewed_by      UUID REFERENCES public.students(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_review_items_pending
  ON public.quiz_review_items (review_status, created_at);
CREATE INDEX IF NOT EXISTS idx_quiz_review_items_student_quiz
  ON public.quiz_review_items (student_quiz_id);

CREATE TABLE IF NOT EXISTS public.challenge_attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  challenge_id    UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  attempt_number  INTEGER NOT NULL DEFAULT 1,
  score           NUMERIC NOT NULL,
  correct         INTEGER NOT NULL,
  response_json   TEXT,
  time_ms         INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_challenge_attempts_student
  ON public.challenge_attempts (student_id, challenge_id);

-- ---------------------------------------------------------------------------
-- projects, badges, notifications, interests
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.coding_projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  mission_id      UUID REFERENCES public.missions(id) ON DELETE SET NULL,
  title           TEXT,
  workspace_json  TEXT NOT NULL,
  generated_code  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coding_projects_student
  ON public.coding_projects (student_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.student_badges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID REFERENCES public.students(id) ON DELETE CASCADE,
  badge_name  TEXT NOT NULL,
  badge_icon  TEXT,
  earned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  link        TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications (user_id, is_read);

CREATE TABLE IF NOT EXISTS public.student_interest_votes (
  student_id    UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  interest_key  TEXT NOT NULL,
  weight        INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_id, interest_key)
);

CREATE INDEX IF NOT EXISTS idx_student_interest_votes_interest
  ON public.student_interest_votes (interest_key);

-- ---------------------------------------------------------------------------
-- ops / admin tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message     TEXT NOT NULL,
  type        TEXT,
  xp_change   INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint    TEXT NOT NULL,
  user_id     UUID REFERENCES public.students(id) ON DELETE SET NULL,
  success     INTEGER NOT NULL DEFAULT 1,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON public.ai_usage_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_endpoint_created ON public.ai_usage_logs (endpoint, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_created ON public.ai_usage_logs (user_id, created_at);

-- ---------------------------------------------------------------------------
-- RLS helpers (after all tables exist)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public SET row_security = off
AS $$ SELECT role FROM public.students WHERE id = auth.uid(); $$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public SET row_security = off
AS $$ SELECT COALESCE(public.current_user_role(), '') = 'admin'; $$;

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public SET row_security = off
AS $$ SELECT COALESCE(public.current_user_role(), '') IN ('teacher', 'admin'); $$;

CREATE OR REPLACE FUNCTION public.teacher_can_view_student(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_students cs
    JOIN public.classes c ON c.id = cs.class_id
    WHERE cs.student_id = p_student_id AND c.teacher_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_coding_projects_updated_at ON public.coding_projects;
CREATE TRIGGER trg_coding_projects_updated_at
  BEFORE UPDATE ON public.coding_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r TEXT;
  dn TEXT;
BEGIN
  r := lower(coalesce(NEW.raw_user_meta_data->>'role', 'student'));
  IF r IN ('educator', 'teacher') THEN r := 'teacher';
  ELSIF r <> 'admin' THEN r := 'student';
  END IF;
  dn := coalesce(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(coalesce(NEW.email, ''), '@', 1),
    'User'
  );
  INSERT INTO public.students (id, name, role, email)
  VALUES (NEW.id, dn, r, NEW.email)
  ON CONFLICT (id) DO UPDATE SET
    name = excluded.name,
    email = coalesce(excluded.email, students.email),
    role = excluded.role;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_mission_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_review_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coding_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_interest_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Admin full access
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'students','sectors','missions','quizzes','challenges','classes',
    'class_students','class_missions','class_quizzes','class_challenges',
    'student_mission_completions','student_quizzes','quiz_review_items',
    'challenge_attempts','coding_projects','student_badges','notifications',
    'student_interest_votes','logs','ai_usage_logs'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS admin_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY admin_all ON public.%I FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())',
      t
    );
  END LOOP;
END $$;

-- students: own row
DROP POLICY IF EXISTS student_select_own ON public.students;
CREATE POLICY student_select_own ON public.students FOR SELECT USING (id = auth.uid());
DROP POLICY IF EXISTS student_update_own ON public.students;
CREATE POLICY student_update_own ON public.students FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS student_insert_own ON public.students;
CREATE POLICY student_insert_own ON public.students FOR INSERT WITH CHECK (id = auth.uid());

-- teachers: view students in their classes
DROP POLICY IF EXISTS teacher_select_class_students ON public.students;
CREATE POLICY teacher_select_class_students ON public.students FOR SELECT USING (public.teacher_can_view_student(id));

-- student-owned rows + teacher read
DO $$
DECLARE rec RECORD;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('student_mission_completions', 'student_id'),
      ('student_quizzes', 'student_id'),
      ('challenge_attempts', 'student_id'),
      ('coding_projects', 'student_id'),
      ('student_badges', 'student_id'),
      ('student_interest_votes', 'student_id'),
      ('notifications', 'user_id')
    ) AS v(tbl, col)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS student_own ON public.%I', rec.tbl);
    EXECUTE format(
      'CREATE POLICY student_own ON public.%I FOR ALL USING (%I = auth.uid()) WITH CHECK (%I = auth.uid())',
      rec.tbl, rec.col, rec.col
    );
    EXECUTE format('DROP POLICY IF EXISTS teacher_read ON public.%I', rec.tbl);
    EXECUTE format(
      'CREATE POLICY teacher_read ON public.%I FOR SELECT USING (public.teacher_can_view_student(%I))',
      rec.tbl, rec.col
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS teacher_read_qri ON public.quiz_review_items;
CREATE POLICY teacher_read_qri ON public.quiz_review_items FOR SELECT
  USING (public.teacher_can_view_student(student_id));
DROP POLICY IF EXISTS student_own_qri ON public.quiz_review_items;
CREATE POLICY student_own_qri ON public.quiz_review_items FOR ALL
  USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid() OR public.is_teacher());

-- teachers manage classes
DROP POLICY IF EXISTS teacher_own_classes ON public.classes;
CREATE POLICY teacher_own_classes ON public.classes FOR ALL
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS student_view_class ON public.classes;
CREATE POLICY student_view_class ON public.classes FOR SELECT USING (
  teacher_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.class_students cs WHERE cs.class_id = classes.id AND cs.student_id = auth.uid())
);

-- world content read
DROP POLICY IF EXISTS authenticated_read_sectors ON public.sectors;
CREATE POLICY authenticated_read_sectors ON public.sectors FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS authenticated_read_missions ON public.missions;
CREATE POLICY authenticated_read_missions ON public.missions FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS teacher_write_content ON public.missions;
CREATE POLICY teacher_write_content ON public.missions FOR ALL
  USING (public.is_teacher()) WITH CHECK (public.is_teacher());
DROP POLICY IF EXISTS teacher_write_quizzes ON public.quizzes;
CREATE POLICY teacher_write_quizzes ON public.quizzes FOR ALL
  USING (public.is_teacher()) WITH CHECK (public.is_teacher());
DROP POLICY IF EXISTS teacher_write_challenges ON public.challenges;
CREATE POLICY teacher_write_challenges ON public.challenges FOR ALL
  USING (public.is_teacher()) WITH CHECK (public.is_teacher());

-- ---------------------------------------------------------------------------
-- Patches for projects that had partial / older schemas
-- ---------------------------------------------------------------------------

ALTER TABLE public.sectors ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.sectors ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.sectors ADD COLUMN IF NOT EXISTS is_starter BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.sectors ADD COLUMN IF NOT EXISTS mastery_percent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.sectors ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'locked';
ALTER TABLE public.sectors ADD COLUMN IF NOT EXISTS required_level INTEGER;
ALTER TABLE public.sectors ADD COLUMN IF NOT EXISTS xp_reward INTEGER;
ALTER TABLE public.sectors ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS domains_json TEXT;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS learning_outcomes_json TEXT;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS embed_code TEXT;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS grade_level TEXT;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS prerequisite_mission_id UUID;
