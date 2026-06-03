-- Journeys: educator-authored ordered learning paths

create table if not exists public.journeys (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  sector_id uuid references public.sectors(id) on delete set null,
  class_id uuid references public.classes(id) on delete cascade,
  created_by uuid references public.students(id) on delete set null,
  is_default boolean not null default false,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.journey_nodes (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.journeys(id) on delete cascade,
  node_type text not null,
  content_id uuid,
  content_url text,
  title text,
  order_index integer not null,
  prerequisite_node_id uuid references public.journey_nodes(id) on delete set null,
  xp_reward integer not null default 0,
  created_at timestamptz not null default now(),
  constraint journey_nodes_node_type_check check (
    node_type in ('mission', 'challenge', 'video', 'reading', 'practice')
  )
);

create table if not exists public.student_journey_progress (
  student_id uuid not null references public.students(id) on delete cascade,
  journey_id uuid not null references public.journeys(id) on delete cascade,
  node_id uuid not null references public.journey_nodes(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (student_id, node_id)
);

create index if not exists idx_journeys_class_order
  on public.journeys(class_id, order_index);
create index if not exists idx_journey_nodes_journey_order
  on public.journey_nodes(journey_id, order_index);
create index if not exists idx_student_journey_progress_student
  on public.student_journey_progress(student_id, journey_id);

alter table public.journeys enable row level security;
alter table public.journey_nodes enable row level security;
alter table public.student_journey_progress enable row level security;

drop policy if exists journeys_read_policy on public.journeys;
create policy journeys_read_policy
on public.journeys
for select
using (
  exists (
    select 1 from public.students s
    where s.id = auth.uid()
      and (
        s.role = 'admin'
        or s.role = 'teacher'
        or (
          s.role = 'student'
          and exists (
            select 1 from public.class_students cs
            where cs.class_id = journeys.class_id
              and cs.student_id = s.id
          )
        )
      )
  )
);

drop policy if exists journeys_write_policy on public.journeys;
create policy journeys_write_policy
on public.journeys
for all
using (
  exists (
    select 1
    from public.students s
    left join public.classes c on c.id = journeys.class_id
    where s.id = auth.uid()
      and (
        s.role = 'admin'
        or (s.role = 'teacher' and c.teacher_id = s.id)
      )
  )
)
with check (
  exists (
    select 1
    from public.students s
    left join public.classes c on c.id = journeys.class_id
    where s.id = auth.uid()
      and (
        s.role = 'admin'
        or (s.role = 'teacher' and c.teacher_id = s.id)
      )
  )
);

drop policy if exists journey_nodes_read_policy on public.journey_nodes;
create policy journey_nodes_read_policy
on public.journey_nodes
for select
using (
  exists (
    select 1
    from public.journeys j
    join public.students s on s.id = auth.uid()
    where j.id = journey_nodes.journey_id
      and (
        s.role = 'admin'
        or s.role = 'teacher'
        or (
          s.role = 'student'
          and exists (
            select 1 from public.class_students cs
            where cs.class_id = j.class_id and cs.student_id = s.id
          )
        )
      )
  )
);

drop policy if exists journey_nodes_write_policy on public.journey_nodes;
create policy journey_nodes_write_policy
on public.journey_nodes
for all
using (
  exists (
    select 1
    from public.journeys j
    join public.classes c on c.id = j.class_id
    join public.students s on s.id = auth.uid()
    where j.id = journey_nodes.journey_id
      and (
        s.role = 'admin'
        or (s.role = 'teacher' and c.teacher_id = s.id)
      )
  )
)
with check (
  exists (
    select 1
    from public.journeys j
    join public.classes c on c.id = j.class_id
    join public.students s on s.id = auth.uid()
    where j.id = journey_nodes.journey_id
      and (
        s.role = 'admin'
        or (s.role = 'teacher' and c.teacher_id = s.id)
      )
  )
);

drop policy if exists student_journey_progress_read_policy on public.student_journey_progress;
create policy student_journey_progress_read_policy
on public.student_journey_progress
for select
using (
  student_id = auth.uid()
  or exists (
    select 1
    from public.students s
    where s.id = auth.uid()
      and s.role = 'admin'
  )
  or exists (
    select 1
    from public.students t
    join public.class_students cs on cs.student_id = student_journey_progress.student_id
    join public.classes c on c.id = cs.class_id
    where t.id = auth.uid()
      and t.role = 'teacher'
      and c.teacher_id = t.id
  )
);

drop policy if exists student_journey_progress_write_policy on public.student_journey_progress;
create policy student_journey_progress_write_policy
on public.student_journey_progress
for all
using (
  student_id = auth.uid()
  or exists (
    select 1 from public.students s
    where s.id = auth.uid() and s.role = 'admin'
  )
)
with check (
  student_id = auth.uid()
  or exists (
    select 1 from public.students s
    where s.id = auth.uid() and s.role = 'admin'
  )
);
