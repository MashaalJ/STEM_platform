alter table if exists public.journeys
  add column if not exists is_deployed boolean not null default true;

create index if not exists idx_journeys_class_deployed
  on public.journeys(class_id, is_deployed);
