create table if not exists public.curriculums (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null,
  description text,
  order_index integer not null default 0,
  is_published boolean not null default false,
  created_by uuid references public.students(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table if exists public.journeys
  add column if not exists curriculum_id uuid references public.curriculums(id) on delete cascade;

create index if not exists idx_curriculums_class_order
  on public.curriculums(class_id, order_index);

create index if not exists idx_journeys_curriculum_order
  on public.journeys(curriculum_id, order_index);
