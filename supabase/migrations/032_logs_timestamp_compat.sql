-- Align logs table with app queries (some DBs only have created_at).
ALTER TABLE public.logs
  ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ;

UPDATE public.logs
SET timestamp = COALESCE(timestamp, created_at, NOW())
WHERE timestamp IS NULL;

ALTER TABLE public.logs
  ALTER COLUMN timestamp SET DEFAULT NOW();
