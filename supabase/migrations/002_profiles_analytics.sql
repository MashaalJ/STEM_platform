-- Optional analytics / billing fields on profiles (mirror of local SQLite students extensions).
-- Apply in Supabase SQL editor or via CLI when using cloud auth.

alter table public.profiles add column if not exists gender text;
alter table public.profiles add column if not exists country_code text;
alter table public.profiles add column if not exists region text;
alter table public.profiles add column if not exists timezone text;
alter table public.profiles add column if not exists subscription_status text default 'free';
alter table public.profiles add column if not exists subscription_plan text default 'free';
alter table public.profiles add column if not exists billing_provider text default 'none';
alter table public.profiles add column if not exists mrr_cents integer default 0;
alter table public.profiles add column if not exists ltv_cents integer default 0;
alter table public.profiles add column if not exists last_active_at timestamptz;

comment on column public.profiles.gender is 'Optional: female, male, non_binary, prefer_not_say, other';
comment on column public.profiles.country_code is 'ISO 3166-1 alpha-2 when set';
