-- Sector presentation + progressive unlock metadata
ALTER TABLE public.sectors ADD COLUMN IF NOT EXISTS theme_color TEXT;
ALTER TABLE public.sectors ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE public.sectors ADD COLUMN IF NOT EXISTS unlock_sector_id UUID REFERENCES public.sectors(id) ON DELETE SET NULL;
ALTER TABLE public.sectors ADD COLUMN IF NOT EXISTS unlock_mastery_percent INTEGER NOT NULL DEFAULT 80;

-- Mission thumbnails (older Supabase projects may predate this column)
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS image_url TEXT;
