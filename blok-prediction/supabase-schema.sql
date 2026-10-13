-- BLOK OPEN XXL / Klimzaal Blok
-- Execute this once in Supabase: SQL Editor > New query > Run.
-- Then create the organization admin user in Authentication > Users
-- and add their UUID to the admin_users table at the bottom.

create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  participant_name text not null check (char_length(trim(participant_name)) between 1 and 80),
  climber_name text not null check (char_length(trim(climber_name)) between 1 and 80),
  created_at timestamptz not null default now()
);

-- Event settings (official champion, raffle winner, and predictions status)
create table if not exists public.event_settings (
  id text primary key default 'main' check (id = 'main'),
  official_winner text,
  raffle_winner text,
  predictions_open boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.event_settings (id)
  values ('main')
  on conflict (id) do nothing;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Participant contacts (email or phone). Private: only organization can read them.
create table if not exists public.prediction_contacts (
  prediction_id uuid primary key references public.predictions(id) on delete cascade,
  contact_type text not null check (contact_type in ('email', 'phone')),
  contact_value text not null check (char_length(trim(contact_value)) between 3 and 120),
  created_at timestamptz not null default now()
);

-- Uniqueness constraint on contact value ensures 1 prediction per person (email/phone),
-- while allowing two participants with the same first name (e.g. "Thomas") to both join!
create unique index if not exists prediction_contacts_unique_value
  on public.prediction_contacts (lower(trim(contact_value)));

-- Row Level Security
alter table public.predictions enable row level security;
alter table public.event_settings enable row level security;
alter table public.admin_users enable row level security;
alter table public.prediction_contacts enable row level security;

-- Policies for predictions
create policy "public can read predictions" on public.predictions
  for select using (true);

create policy "public can add predictions while open" on public.predictions
  for insert with check ((select predictions_open from public.event_settings where id = 'main') = true);

create policy "admins can delete predictions" on public.predictions
  for delete to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()));

-- Policies for event settings
create policy "public can read event result" on public.event_settings
  for select using (true);

create policy "admins can change event settings" on public.event_settings
  for update to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

-- Policies for admin verification
create policy "users can check their own admin access" on public.admin_users
  for select to authenticated using (user_id = auth.uid());

-- Policies for prediction contacts
create policy "public can add contact while open" on public.prediction_contacts
  for insert with check ((select predictions_open from public.event_settings where id = 'main') = true);

create policy "admins can read contacts" on public.prediction_contacts
  for select to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()));

-- Replace with the UUID of the organization user you created in Supabase:
-- insert into public.admin_users (user_id) values ('PASTE-ORGANIZATION-UUID-HERE');
