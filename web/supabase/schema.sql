-- ============================================================
-- Industrial Worker Monitor — Schéma SQL complet
-- Suivi des travailleurs en milieu industriel
--
-- Mesures suivies (5) :
--   1. heart_rate         → rythme cardiaque (bpm)
--   2. air_temperature    → température de l'air (°C)
--   3. air_humidity       → humidité de l'air (%)
--   4. obstacle_distance  → distance mesurée par le capteur d'obstacle (cm)
--                           comparée au SEUIL de détection
--      obstacle_detected  → 1 = obstacle détecté, 0 = rien (optionnel)
--   5. motion             → intensité de mouvement (score 0–100)
--                           0–5 immobile · 5–70 normal · > 70 anormal
--
-- Exécute ce fichier dans : Supabase → SQL Editor → New query → Run
-- Il ne supprime PAS tes anciennes tables football (voir cleanup-old-football.sql).
-- RLS désactivé pour le développement.
-- ============================================================

-- =============================================
-- 0. FONCTIONS UTILITAIRES
-- =============================================
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================
-- 1. PROFILS (login / signup)
-- =============================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  role text not null default 'Superviseur',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.profiles alter column role set default 'Superviseur';

-- Les anciens comptes "Coach" deviennent "Superviseur", "Player" devient "Travailleur"
update public.profiles set role = 'Superviseur' where role = 'Coach';
update public.profiles set role = 'Travailleur' where role = 'Player';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'Utilisateur'),
    coalesce(new.raw_user_meta_data->>'role', 'Superviseur')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Crée le profil des comptes déjà inscrits avant ce script
insert into public.profiles (id, name, role)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'name', 'Utilisateur'),
  coalesce(u.raw_user_meta_data->>'role', 'Superviseur')
from auth.users u
on conflict (id) do nothing;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- =============================================
-- 2. SITES / ATELIERS (remplace "teams")
-- =============================================
create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  supervisor_id uuid references public.profiles(id) on delete set null,
  location text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

drop trigger if exists sites_updated_at on public.sites;
create trigger sites_updated_at
  before update on public.sites
  for each row execute function public.handle_updated_at();

-- =============================================
-- 3. TRAVAILLEURS (remplace "players")
-- =============================================
create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete set null,
  site_id uuid references public.sites(id) on delete cascade,
  name text not null,
  matricule text,
  job_title text,
  status text not null default 'active',
  photo_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint workers_status_check check (status in ('active', 'leave', 'inactive'))
);

drop trigger if exists workers_updated_at on public.workers;
create trigger workers_updated_at
  before update on public.workers
  for each row execute function public.handle_updated_at();

-- =============================================
-- 4. CAPTEURS / BRACELETS (remplace "sensor_metadata")
-- =============================================
create table if not exists public.devices (
  device_id text primary key,
  worker_id uuid references public.workers(id) on delete set null,
  firmware_version text,
  status text not null default 'active',
  last_seen_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

drop trigger if exists devices_updated_at on public.devices;
create trigger devices_updated_at
  before update on public.devices
  for each row execute function public.handle_updated_at();

-- =============================================
-- 5. POSTES DE TRAVAIL / SHIFTS (remplace "training_sessions")
-- =============================================
create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade,
  name text,
  date timestamptz default now() not null,
  started_at timestamptz,
  ended_at timestamptz,
  status text not null default 'planned',
  location text,
  notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint shifts_status_check check (status in ('planned', 'active', 'finished'))
);

drop trigger if exists shifts_updated_at on public.shifts;
create trigger shifts_updated_at
  before update on public.shifts
  for each row execute function public.handle_updated_at();

-- =============================================
-- 6. MESURES DES CAPTEURS (remplace "live_tracking")
-- =============================================
create table if not exists public.sensor_readings (
  id bigserial primary key,
  worker_id uuid references public.workers(id) on delete cascade,
  shift_id uuid references public.shifts(id) on delete set null,
  device_id text,
  timestamp timestamptz default now() not null,
  heart_rate double precision,          -- bpm
  air_temperature double precision,     -- °C
  air_humidity double precision,        -- %
  obstacle_distance double precision,   -- cm
  obstacle_detected smallint,           -- 1 / 0 (optionnel)
  motion double precision,              -- intensité de mouvement 0–100
  constraint readings_motion_check check (motion is null or (motion >= 0 and motion <= 100)),
  constraint readings_obstacle_check check (obstacle_detected is null or obstacle_detected in (0, 1))
);

-- Quand l'ESP envoie seulement device_id, on retrouve automatiquement
-- le travailleur et le poste actif + on met à jour "last_seen_at".
create or replace function public.fill_reading_context()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_site uuid;
begin
  if new.worker_id is null and new.device_id is not null then
    select worker_id into new.worker_id
    from public.devices
    where device_id = new.device_id;
  end if;

  if new.shift_id is null and new.worker_id is not null then
    select site_id into v_site from public.workers where id = new.worker_id;

    select id into new.shift_id
    from public.shifts
    where site_id = v_site and status = 'active'
    order by date desc
    limit 1;
  end if;

  if new.device_id is not null then
    insert into public.devices (device_id, worker_id, last_seen_at)
    values (new.device_id, new.worker_id, now())
    on conflict (device_id) do update set last_seen_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists sensor_readings_fill_context on public.sensor_readings;
create trigger sensor_readings_fill_context
  before insert on public.sensor_readings
  for each row execute function public.fill_reading_context();

-- =============================================
-- 7. ALERTES
-- =============================================
create table if not exists public.worker_alerts (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid references public.workers(id) on delete cascade,
  shift_id uuid references public.shifts(id) on delete set null,
  type text not null,
  severity text not null default 'warning',
  value double precision,
  message text,
  created_at timestamptz default now() not null,
  is_read boolean not null default false,
  constraint worker_alerts_type_check check (
    type in ('heart_rate', 'temperature', 'humidity', 'obstacle', 'no_motion', 'abnormal_motion', 'other')
  ),
  constraint worker_alerts_severity_check check (severity in ('warning', 'critical'))
);

-- =============================================
-- 8. INDEX
-- =============================================
create index if not exists idx_sites_supervisor on public.sites(supervisor_id);
create index if not exists idx_workers_site on public.workers(site_id);
create index if not exists idx_workers_user on public.workers(user_id);
create index if not exists idx_devices_worker on public.devices(worker_id);
create index if not exists idx_shifts_site_date on public.shifts(site_id, date desc);
create index if not exists idx_readings_worker_time on public.sensor_readings(worker_id, timestamp desc);
create index if not exists idx_readings_shift_time on public.sensor_readings(shift_id, timestamp desc);
create index if not exists idx_readings_device on public.sensor_readings(device_id);
create index if not exists idx_worker_alerts_worker on public.worker_alerts(worker_id);
create index if not exists idx_worker_alerts_unread on public.worker_alerts(is_read) where is_read = false;

-- =============================================
-- 9. RLS DÉSACTIVÉ (développement)
-- =============================================
alter table public.profiles disable row level security;
alter table public.sites disable row level security;
alter table public.workers disable row level security;
alter table public.devices disable row level security;
alter table public.shifts disable row level security;
alter table public.sensor_readings disable row level security;
alter table public.worker_alerts disable row level security;

-- =============================================
-- 10. TEMPS RÉEL
-- =============================================
do $$
declare
  t text;
begin
  foreach t in array array['sensor_readings', 'worker_alerts', 'workers', 'devices', 'shifts']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then
      null; -- déjà ajoutée
    end;
  end loop;
end $$;
