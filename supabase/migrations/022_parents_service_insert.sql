-- FIX 6: server-side parent profile bootstrap (service role)

ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS parents_service_insert ON public.parents;

CREATE POLICY parents_service_insert ON public.parents
  FOR INSERT
  TO service_role
  WITH CHECK (true);
