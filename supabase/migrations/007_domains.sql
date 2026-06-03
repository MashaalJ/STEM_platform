-- Content domains + sector/mission metadata for admin CMS

CREATE TABLE IF NOT EXISTS public.domains (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,
  color        TEXT,
  icon         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_domains_name_lower ON public.domains (LOWER(name));

ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS domain_id UUID REFERENCES public.domains(id) ON DELETE SET NULL;
ALTER TABLE public.sectors ADD COLUMN IF NOT EXISTS domain_ids UUID[];

INSERT INTO public.domains (name, description, color, icon)
SELECT v.name, v.description, v.color, v.icon
FROM (VALUES
  ('Electronics', 'Circuits, sensors, and power systems', '#00bfa5', '⚡'),
  ('Coding', 'Programming, blocks, and logic', '#6366f1', '💻'),
  ('Robotics', 'Mechanisms, actuators, and automation', '#FF6B35', '⚙️'),
  ('AI', 'Machine learning and intelligent systems', '#00C4CC', '🧠'),
  ('General', 'Cross-disciplinary STEM activities', '#94a3b8', '🔬')
) AS v(name, description, color, icon)
WHERE NOT EXISTS (SELECT 1 FROM public.domains d WHERE LOWER(d.name) = LOWER(v.name));

ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS domains_admin_all ON public.domains;
CREATE POLICY domains_admin_all ON public.domains
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS domains_read_authenticated ON public.domains;
CREATE POLICY domains_read_authenticated ON public.domains
  FOR SELECT USING (auth.uid() IS NOT NULL);
