-- Activity bank: canonical content library for nodes

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  activity_type text not null check (activity_type in ('video', 'reading', 'tool', 'challenge', 'quiz', 'interactive')),
  content jsonb not null default '{}'::jsonb,
  sector_id uuid references public.sectors(id) on delete set null,
  domain_id uuid references public.domains(id) on delete set null,
  difficulty text default 'beginner',
  age_min integer not null default 6,
  age_max integer not null default 18,
  xp_reward integer not null default 50,
  estimated_minutes integer not null default 10,
  thumbnail_url text,
  tags text[] not null default '{}',
  created_by uuid references public.students(id) on delete set null,
  is_default boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create index if not exists idx_activities_status on public.activities(status);
create index if not exists idx_activities_type on public.activities(activity_type);
create index if not exists idx_activities_sector on public.activities(sector_id);
create index if not exists idx_activities_created_by on public.activities(created_by);

alter table public.activities enable row level security;

drop policy if exists activities_read_active on public.activities;
create policy activities_read_active
on public.activities
for select
to authenticated
using (status = 'active' or created_by = auth.uid());

drop policy if exists activities_insert_teacher_admin on public.activities;
create policy activities_insert_teacher_admin
on public.activities
for insert
to authenticated
with check (
  exists (
    select 1 from public.students s
    where s.id = auth.uid() and s.role in ('teacher', 'admin')
  )
);

drop policy if exists activities_update_own_or_admin on public.activities;
create policy activities_update_own_or_admin
on public.activities
for update
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1 from public.students s
    where s.id = auth.uid() and s.role = 'admin'
  )
)
with check (
  created_by = auth.uid()
  or exists (
    select 1 from public.students s
    where s.id = auth.uid() and s.role = 'admin'
  )
);

drop policy if exists activities_delete_own_or_admin on public.activities;
create policy activities_delete_own_or_admin
on public.activities
for delete
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1 from public.students s
    where s.id = auth.uid() and s.role = 'admin'
  )
);

-- Backfill: mirror existing missions into activity bank for compatibility.
insert into public.activities (
  title,
  description,
  activity_type,
  content,
  sector_id,
  difficulty,
  xp_reward,
  estimated_minutes,
  thumbnail_url,
  created_by,
  is_default,
  status
)
select
  m.title,
  m.description,
  case
    when coalesce(trim(m.embed_code), '') <> '' then 'interactive'
    else 'tool'
  end as activity_type,
  jsonb_build_object(
    'mission_id', m.id,
    'embed_code', m.embed_code
  ) as content,
  m.sector_id,
  coalesce(nullif(lower(m.difficulty), ''), 'beginner'),
  coalesce(m.xp_reward, 50),
  10,
  m.image_url,
  m.created_by,
  true,
  coalesce(nullif(lower(m.status), ''), 'active')
from public.missions m
where not exists (
  select 1
  from public.activities a
  where (a.content ->> 'mission_id')::uuid = m.id
);
