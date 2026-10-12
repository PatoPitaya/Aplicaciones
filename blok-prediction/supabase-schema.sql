-- LA APUESTA / BLOK
-- Ejecuta este archivo una sola vez en Supabase: SQL Editor > New query > Run.
-- Después crea el usuario de organización en Authentication > Users y añade su UUID
-- a la última instrucción de este archivo.

create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  participant_name text not null check (char_length(trim(participant_name)) between 1 and 60),
  climber_name text not null check (char_length(trim(climber_name)) between 1 and 80),
  created_at timestamptz not null default now()
);

create unique index predictions_unique_participant_name
  on public.predictions (lower(trim(participant_name)));

create table public.event_settings (
  id text primary key default 'main' check (id = 'main'),
  official_winner text,
  predictions_open boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.event_settings (id) values ('main');

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.predictions enable row level security;
alter table public.event_settings enable row level security;
alter table public.admin_users enable row level security;

create policy "public can read predictions" on public.predictions for select using (true);
create policy "public can add predictions while open" on public.predictions for insert
  with check ((select predictions_open from public.event_settings where id = 'main') = true);
create policy "public can read event result" on public.event_settings for select using (true);
create policy "admins can change event settings" on public.event_settings for update to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));
create policy "admins can delete predictions" on public.predictions for delete to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()));
create policy "users can check their own admin access" on public.admin_users for select to authenticated using (user_id = auth.uid());

-- Contactos de los participantes (correo o teléfono). Privados: solo la organización puede leerlos.
-- Si ya ejecutaste el esquema anterior, ejecuta solo este bloque hasta la última policy de prediction_contacts.
create table if not exists public.prediction_contacts (
  prediction_id uuid primary key references public.predictions(id) on delete cascade,
  contact_type text not null check (contact_type in ('email', 'phone')),
  contact_value text not null check (char_length(trim(contact_value)) between 3 and 120),
  created_at timestamptz not null default now()
);

alter table public.prediction_contacts enable row level security;

create policy "public can add contact while open" on public.prediction_contacts for insert
  with check ((select predictions_open from public.event_settings where id = 'main') = true);
create policy "admins can read contacts" on public.prediction_contacts for select to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()));

-- Sustituye este UUID por el UUID del usuario de organización que creaste.
-- insert into public.admin_users (user_id) values ('PEGA-AQUI-EL-UUID');
