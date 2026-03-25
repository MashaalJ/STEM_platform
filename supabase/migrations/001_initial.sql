-- STEMverse initial Supabase schema (fresh start)
-- Auth source: auth.users (Supabase Auth)

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('educator','student','admin')),
  display_name text not null,
  school text,
  grade_level text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sectors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  required_level int not null default 1,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  sector_id uuid not null references public.sectors(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  difficulty text not null default 'easy',
  xp_reward int not null default 100,
  embed_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  join_code text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.class_students (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

create table if not exists public.class_missions (
  class_id uuid not null references public.classes(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  assigned_by uuid not null references auth.users(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (class_id, mission_id)
);

create table if not exists public.student_mission_completions (
  student_id uuid not null references auth.users(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (student_id, mission_id)
);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  type text not null,
  content_json jsonb not null,
  xp_reward int not null default 50,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.class_challenges (
  class_id uuid not null references public.classes(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  assigned_by uuid not null references auth.users(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (class_id, challenge_id)
);

create table if not exists public.student_challenges (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  score int not null default 0,
  total_xp int not null default 0,
  completed_at timestamptz not null default now()
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  questions jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.class_quizzes (
  class_id uuid not null references public.classes(id) on delete cascade,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  assigned_by uuid not null references auth.users(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (class_id, quiz_id)
);

create table if not exists public.student_quizzes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  score int not null default 0,
  total_questions int not null default 0,
  completed_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  message text not null,
  type text,
  xp_change int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_classes_teacher on public.classes(teacher_id);
create index if not exists idx_class_students_student on public.class_students(student_id);
create index if not exists idx_missions_sector on public.missions(sector_id);
create index if not exists idx_missions_created_by on public.missions(created_by);
create index if not exists idx_student_quizzes_student on public.student_quizzes(student_id);
create index if not exists idx_student_challenges_student on public.student_challenges(student_id);
create index if not exists idx_notifications_user_read on public.notifications(user_id, is_read);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_missions_updated_at on public.missions;
create trigger trg_missions_updated_at
before update on public.missions
for each row execute function public.set_updated_at();

drop trigger if exists trg_challenges_updated_at on public.challenges;
create trigger trg_challenges_updated_at
before update on public.challenges
for each row execute function public.set_updated_at();

drop trigger if exists trg_quizzes_updated_at on public.quizzes;
create trigger trg_quizzes_updated_at
before update on public.quizzes
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_students enable row level security;
alter table public.class_missions enable row level security;
alter table public.student_mission_completions enable row level security;
alter table public.challenges enable row level security;
alter table public.class_challenges enable row level security;
alter table public.student_challenges enable row level security;
alter table public.quizzes enable row level security;
alter table public.class_quizzes enable row level security;
alter table public.student_quizzes enable row level security;
alter table public.notifications enable row level security;
alter table public.logs enable row level security;

-- Idempotency: allow migration re-runs without policy name conflicts.
drop policy if exists "profiles_self_read" on public.profiles;
drop policy if exists "profiles_self_update" on public.profiles;
drop policy if exists "profiles_insert_self" on public.profiles;
drop policy if exists "teacher_manage_own_classes" on public.classes;
drop policy if exists "students_view_own_class_membership" on public.class_students;
drop policy if exists "teacher_manage_class_students" on public.class_students;
drop policy if exists "teacher_manage_own_missions" on public.missions;
drop policy if exists "students_view_assigned_missions" on public.missions;
drop policy if exists "teacher_manage_class_missions" on public.class_missions;
drop policy if exists "student_manage_own_completion" on public.student_mission_completions;
drop policy if exists "teacher_manage_own_challenges" on public.challenges;
drop policy if exists "students_view_assigned_challenges" on public.challenges;
drop policy if exists "teacher_manage_class_challenges" on public.class_challenges;
drop policy if exists "student_manage_own_challenge_results" on public.student_challenges;
drop policy if exists "teacher_manage_own_quizzes" on public.quizzes;
drop policy if exists "students_view_assigned_quizzes" on public.quizzes;
drop policy if exists "teacher_manage_class_quizzes" on public.class_quizzes;
drop policy if exists "student_manage_own_quiz_results" on public.student_quizzes;
drop policy if exists "notifications_own_only" on public.notifications;
drop policy if exists "logs_actor_read_own" on public.logs;

create policy "profiles_self_read" on public.profiles
for select using (auth.uid() = id);

create policy "profiles_self_update" on public.profiles
for update using (auth.uid() = id);

create policy "profiles_insert_self" on public.profiles
for insert with check (auth.uid() = id);

create policy "teacher_manage_own_classes" on public.classes
for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

create policy "students_view_own_class_membership" on public.class_students
for select using (student_id = auth.uid());

create policy "teacher_manage_class_students" on public.class_students
for all using (
  exists (
    select 1 from public.classes c
    where c.id = class_students.class_id and c.teacher_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.classes c
    where c.id = class_students.class_id and c.teacher_id = auth.uid()
  )
);

create policy "teacher_manage_own_missions" on public.missions
for all using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy "students_view_assigned_missions" on public.missions
for select using (
  exists (
    select 1
    from public.class_missions cm
    join public.class_students cs on cs.class_id = cm.class_id
    where cm.mission_id = missions.id and cs.student_id = auth.uid()
  )
);

create policy "teacher_manage_class_missions" on public.class_missions
for all using (
  exists (
    select 1 from public.classes c
    where c.id = class_missions.class_id and c.teacher_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.classes c
    where c.id = class_missions.class_id and c.teacher_id = auth.uid()
  )
);

create policy "student_manage_own_completion" on public.student_mission_completions
for all using (student_id = auth.uid()) with check (student_id = auth.uid());

create policy "teacher_manage_own_challenges" on public.challenges
for all using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy "students_view_assigned_challenges" on public.challenges
for select using (
  exists (
    select 1
    from public.class_challenges cc
    join public.class_students cs on cs.class_id = cc.class_id
    where cc.challenge_id = challenges.id and cs.student_id = auth.uid()
  )
);

create policy "teacher_manage_class_challenges" on public.class_challenges
for all using (
  exists (
    select 1 from public.classes c
    where c.id = class_challenges.class_id and c.teacher_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.classes c
    where c.id = class_challenges.class_id and c.teacher_id = auth.uid()
  )
);

create policy "student_manage_own_challenge_results" on public.student_challenges
for all using (student_id = auth.uid()) with check (student_id = auth.uid());

create policy "teacher_manage_own_quizzes" on public.quizzes
for all using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy "students_view_assigned_quizzes" on public.quizzes
for select using (
  exists (
    select 1
    from public.class_quizzes cq
    join public.class_students cs on cs.class_id = cq.class_id
    where cq.quiz_id = quizzes.id and cs.student_id = auth.uid()
  )
);

create policy "teacher_manage_class_quizzes" on public.class_quizzes
for all using (
  exists (
    select 1 from public.classes c
    where c.id = class_quizzes.class_id and c.teacher_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.classes c
    where c.id = class_quizzes.class_id and c.teacher_id = auth.uid()
  )
);

create policy "student_manage_own_quiz_results" on public.student_quizzes
for all using (student_id = auth.uid()) with check (student_id = auth.uid());

create policy "notifications_own_only" on public.notifications
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "logs_actor_read_own" on public.logs
for select using (actor_id = auth.uid());
-- STEMverse initial Supabase schema (fresh start)
-- Auth users live in auth.users. App profile data is in public.profiles.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'teacher', 'admin')),
  display_name text not null default '',
  avatar_url text,
  age int,
  grade text,
  school text,
  city text,
  email text,
  parent_email text,
  contact_number text,
  level int not null default 1,
  xp int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sectors (
  id bigserial primary key,
  name text not null,
  description text,
  xp_reward int default 0,
  required_level int default 1,
  mastery_percent int default 0,
  status text default 'locked',
  image_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.missions (
  id bigserial primary key,
  sector_id bigint references public.sectors(id) on delete cascade,
  title text not null,
  description text,
  difficulty text,
  xp_reward int default 0,
  status text default 'available',
  image_url text,
  embed_code text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.classes (
  id bigserial primary key,
  name text not null,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  description text,
  join_code text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.class_students (
  class_id bigint not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

create table if not exists public.class_missions (
  class_id bigint not null references public.classes(id) on delete cascade,
  mission_id bigint not null references public.missions(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (class_id, mission_id)
);

create table if not exists public.challenges (
  id bigserial primary key,
  title text not null,
  type text not null,
  world text,
  zone text,
  xp_reward int default 0,
  xp_bonus_first_try int default 0,
  xp_retry_penalty int default 0,
  content_json jsonb not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.class_challenges (
  class_id bigint not null references public.classes(id) on delete cascade,
  challenge_id bigint not null references public.challenges(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (class_id, challenge_id)
);

create table if not exists public.student_challenges (
  student_id uuid not null references public.profiles(id) on delete cascade,
  challenge_id bigint not null references public.challenges(id) on delete cascade,
  score int default 0,
  completed boolean not null default false,
  submitted_at timestamptz not null default now(),
  primary key (student_id, challenge_id)
);

create table if not exists public.quizzes (
  id bigserial primary key,
  title text not null,
  questions jsonb not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.class_quizzes (
  class_id bigint not null references public.classes(id) on delete cascade,
  quiz_id bigint not null references public.quizzes(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (class_id, quiz_id)
);

create table if not exists public.student_quizzes (
  id bigserial primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  quiz_id bigint not null references public.quizzes(id) on delete cascade,
  score int default 0,
  total_questions int default 0,
  completed boolean not null default false,
  completed_at timestamptz
);

create table if not exists public.student_mission_completions (
  id bigserial primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  mission_id bigint not null references public.missions(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (student_id, mission_id)
);

create table if not exists public.student_badges (
  id bigserial primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  badge_name text not null,
  badge_icon text default '🏅',
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  link text,
  is_read int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.logs (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete set null,
  type text not null,
  message text not null,
  xp_change int default 0,
  timestamp timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_classes_teacher on public.classes(teacher_id);
create index if not exists idx_class_students_student on public.class_students(student_id);
create index if not exists idx_class_missions_mission on public.class_missions(mission_id);
create index if not exists idx_student_quizzes_student on public.student_quizzes(student_id);
create index if not exists idx_student_mission_completions_student on public.student_mission_completions(student_id);
create index if not exists idx_notifications_user on public.notifications(user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, display_name, email)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'role')::text, 'student'),
    coalesce((new.raw_user_meta_data->>'full_name')::text, split_part(coalesce(new.email, ''), '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.sectors enable row level security;
alter table public.missions enable row level security;
alter table public.classes enable row level security;
alter table public.class_students enable row level security;
alter table public.class_missions enable row level security;
alter table public.challenges enable row level security;
alter table public.class_challenges enable row level security;
alter table public.student_challenges enable row level security;
alter table public.quizzes enable row level security;
alter table public.class_quizzes enable row level security;
alter table public.student_quizzes enable row level security;
alter table public.student_mission_completions enable row level security;
alter table public.student_badges enable row level security;
alter table public.notifications enable row level security;
alter table public.logs enable row level security;

-- Idempotency for the policy set below (some names also appear earlier in this file).
drop policy if exists "profiles_select_self_or_teacher_admin" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "profiles_insert_self" on public.profiles;
drop policy if exists "sectors_read_all" on public.sectors;
drop policy if exists "missions_read_assigned_or_teacher" on public.missions;
drop policy if exists "missions_teacher_admin_write" on public.missions;
drop policy if exists "classes_teacher_member_read" on public.classes;
drop policy if exists "classes_teacher_admin_write" on public.classes;
drop policy if exists "class_students_read_member_or_teacher" on public.class_students;
drop policy if exists "class_students_teacher_admin_write" on public.class_students;
drop policy if exists "student_quizzes_self_or_teacher_read" on public.student_quizzes;
drop policy if exists "student_quizzes_self_write" on public.student_quizzes;
drop policy if exists "notifications_self_read_write" on public.notifications;

create policy "profiles_select_self_or_teacher_admin"
on public.profiles for select
using (
  auth.uid() = id
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('teacher', 'admin'))
);

create policy "profiles_update_self"
on public.profiles for update
using (auth.uid() = id);

create policy "profiles_insert_self"
on public.profiles for insert
with check (auth.uid() = id);

create policy "sectors_read_all"
on public.sectors for select
using (true);

create policy "missions_read_assigned_or_teacher"
on public.missions for select
using (
  exists (
    select 1
    from public.class_missions cm
    join public.class_students cs on cs.class_id = cm.class_id
    where cm.mission_id = missions.id and cs.student_id = auth.uid()
  )
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('teacher', 'admin'))
);

create policy "missions_teacher_admin_write"
on public.missions for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('teacher', 'admin')))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('teacher', 'admin')));

create policy "classes_teacher_member_read"
on public.classes for select
using (
  teacher_id = auth.uid()
  or exists (select 1 from public.class_students cs where cs.class_id = classes.id and cs.student_id = auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "classes_teacher_admin_write"
on public.classes for all
using (teacher_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (teacher_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "class_students_read_member_or_teacher"
on public.class_students for select
using (
  student_id = auth.uid()
  or exists (select 1 from public.classes c where c.id = class_students.class_id and c.teacher_id = auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "class_students_teacher_admin_write"
on public.class_students for all
using (
  exists (select 1 from public.classes c where c.id = class_students.class_id and c.teacher_id = auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
)
with check (
  exists (select 1 from public.classes c where c.id = class_students.class_id and c.teacher_id = auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "student_quizzes_self_or_teacher_read"
on public.student_quizzes for select
using (
  student_id = auth.uid()
  or exists (
    select 1
    from public.class_students cs
    join public.classes c on c.id = cs.class_id
    where cs.student_id = student_quizzes.student_id and c.teacher_id = auth.uid()
  )
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "student_quizzes_self_write"
on public.student_quizzes for insert
with check (student_id = auth.uid());

create policy "notifications_self_read_write"
on public.notifications for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- When a user signs up via Supabase Auth, mirror into public.profiles (backup if app upsert fails).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r text;
  dn text;
begin
  r := lower(coalesce(new.raw_user_meta_data->>'role', 'student'));
  if r = 'teacher' then
    r := 'educator';
  end if;
  if r not in ('educator', 'student', 'admin') then
    r := 'student';
  end if;
  dn := coalesce(
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(coalesce(new.email, ''), '@', 1),
    'User'
  );
  insert into public.profiles (id, role, display_name)
  values (new.id, r, dn)
  on conflict (id) do update
    set display_name = excluded.display_name,
        role = excluded.role;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

