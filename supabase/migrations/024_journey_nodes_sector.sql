alter table if exists public.journey_nodes
  add column if not exists sector_id uuid references public.sectors(id) on delete set null;

create index if not exists idx_journey_nodes_sector_id
  on public.journey_nodes(sector_id);
