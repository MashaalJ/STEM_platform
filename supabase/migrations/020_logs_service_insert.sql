-- FIX 3: allow server-side activity log writes (service role / backend)

ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS logs_service_insert ON public.logs;

CREATE POLICY logs_service_insert ON public.logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);
