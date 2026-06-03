create table if not exists public.student_onboarding_profiles (
  student_id uuid primary key references public.students(id) on delete cascade,
  age_grade text,
  interests text[] not null default '{}',
  experience_level text,
  learning_goal text,
  recommended_sector_ids uuid[] not null default '{}',
  start_sector_id uuid references public.sectors(id) on delete set null,
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_student_onboarding_start_sector
  on public.student_onboarding_profiles(start_sector_id);

alter table public.student_onboarding_profiles enable row level security;

drop policy if exists student_onboarding_select_own on public.student_onboarding_profiles;
create policy student_onboarding_select_own on public.student_onboarding_profiles
  for select using (student_id = auth.uid());

drop policy if exists student_onboarding_select_teacher on public.student_onboarding_profiles;
create policy student_onboarding_select_teacher on public.student_onboarding_profiles
  for select using (public.is_teacher() and public.teacher_can_view_student(student_id));

drop policy if exists student_onboarding_insert_own on public.student_onboarding_profiles;
create policy student_onboarding_insert_own on public.student_onboarding_profiles
  for insert with check (student_id = auth.uid());

drop policy if exists student_onboarding_update_own on public.student_onboarding_profiles;
create policy student_onboarding_update_own on public.student_onboarding_profiles
  for update using (student_id = auth.uid()) with check (student_id = auth.uid());

drop policy if exists student_onboarding_admin on public.student_onboarding_profiles;
create policy student_onboarding_admin on public.student_onboarding_profiles
  for all using (public.is_admin()) with check (public.is_admin());
