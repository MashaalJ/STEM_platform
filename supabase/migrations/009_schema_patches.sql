-- Patches for partial / older schemas (safe to re-run)

ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'available';
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS domains_json TEXT;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS learning_outcomes_json TEXT;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS embed_code TEXT;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS grade_level TEXT;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS prerequisite_mission_id UUID;

ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS curriculum_track TEXT;
