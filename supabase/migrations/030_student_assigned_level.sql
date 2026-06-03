-- Student onboarding level + default journey targeting

alter table public.students
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists assigned_level text;

alter table public.student_onboarding_profiles
  add column if not exists age integer,
  add column if not exists assigned_level text;

alter table public.journeys
  add column if not exists assigned_level text;

create index if not exists idx_journeys_default_deployed
  on public.journeys (is_default, is_deployed)
  where class_id is null;
