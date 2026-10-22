-- ============================================================
-- Migration : le mouvement devient une intensité (score 0–100)
--   0–5    : immobile
--   5–70   : mouvement normal
--   > 70   : mouvement anormal (chute, choc, geste brusque)
-- Exécute dans Supabase → SQL Editor → New query → Run
-- Les anciennes valeurs 0/1 restent valides.
-- ============================================================

-- 1. La colonne motion accepte maintenant un nombre décimal de 0 à 100
alter table public.sensor_readings drop constraint if exists readings_motion_check;
alter table public.sensor_readings alter column motion type double precision;
alter table public.sensor_readings add constraint readings_motion_check
  check (motion is null or (motion >= 0 and motion <= 100));

-- 2. Nouveau type d'alerte : mouvement anormal
alter table public.worker_alerts drop constraint if exists worker_alerts_type_check;
alter table public.worker_alerts add constraint worker_alerts_type_check
  check (type in ('heart_rate', 'temperature', 'humidity', 'obstacle', 'no_motion', 'abnormal_motion', 'other'));
