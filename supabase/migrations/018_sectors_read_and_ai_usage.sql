-- FIX 2: ensure authenticated users can read sectors (client-side Supabase)
DROP POLICY IF EXISTS "authenticated read sectors" ON public.sectors;
DROP POLICY IF EXISTS authenticated_read_sectors ON public.sectors;
DROP POLICY IF EXISTS "all authenticated users read sectors" ON public.sectors;

CREATE POLICY "all authenticated users read sectors"
  ON public.sectors FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Server-side sector list (bypasses RLS loops)
CREATE OR REPLACE FUNCTION public.list_sectors_admin()
RETURNS SETOF public.sectors
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT * FROM public.sectors ORDER BY sort_order ASC, created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.list_sectors_admin() TO authenticated, service_role;

-- FIX: ai_usage_logs inserts from server (STEMbot quota)
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_usage_service ON public.ai_usage_logs;
DROP POLICY IF EXISTS ai_usage_insert_own ON public.ai_usage_logs;

CREATE POLICY ai_usage_service ON public.ai_usage_logs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY ai_usage_insert_own ON public.ai_usage_logs
  FOR INSERT
  WITH CHECK (user_id = auth.uid());
