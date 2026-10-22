-- ============================================================
-- Données de démo — Industrial Worker Monitor
-- Exécute APRÈS schema.sql (Supabase → SQL Editor → Run)
--
-- Le site est automatiquement lié au premier compte "Superviseur".
-- → Crée d'abord ton compte Superviseur dans l'application,
--   puis exécute ce fichier.
--
-- Tu peux le relancer : il supprime et recrée la démo.
-- ============================================================

do $$
declare
  v_supervisor uuid;
  v_site uuid := 'a1000000-0000-0000-0000-000000000001';
  v_shift uuid := 'c1000000-0000-0000-0000-000000000001';
begin
  select id into v_supervisor
  from public.profiles
  where role in ('Superviseur', 'Coach')
  order by created_at
  limit 1;

  -- Nettoyage de l'ancienne démo
  delete from public.sensor_readings where worker_id in (
    select id from public.workers where site_id = v_site
  );
  delete from public.worker_alerts where worker_id in (
    select id from public.workers where site_id = v_site
  );
  delete from public.devices where device_id like 'ESP-W0%';
  delete from public.shifts where site_id = v_site;
  delete from public.workers where site_id = v_site;
  delete from public.sites where id = v_site;

  -- 1. Site / atelier
  insert into public.sites (id, name, supervisor_id, location)
  values (v_site, 'Atelier Assemblage A', v_supervisor, 'Zone industrielle Ariana');

  -- 2. Travailleurs
  insert into public.workers (id, site_id, name, matricule, job_title, status) values
    ('b1000000-0000-0000-0000-000000000001', v_site, 'Ahmed Ben Ali',    'MAT-1001', 'Opérateur machine', 'active'),
    ('b1000000-0000-0000-0000-000000000002', v_site, 'Mohamed Khaled',   'MAT-1002', 'Soudeur',           'active'),
    ('b1000000-0000-0000-0000-000000000003', v_site, 'Youssef Miled',    'MAT-1003', 'Cariste',           'active'),
    ('b1000000-0000-0000-0000-000000000004', v_site, 'Oussema Trabelsi', 'MAT-1004', 'Technicien maintenance', 'active'),
    ('b1000000-0000-0000-0000-000000000005', v_site, 'Karim Jebali',     'MAT-1005', 'Magasinier',        'active');

  -- 3. Bracelets / capteurs
  insert into public.devices (device_id, worker_id, firmware_version, status, last_seen_at) values
    ('ESP-W01', 'b1000000-0000-0000-0000-000000000001', '1.0.0', 'active', now()),
    ('ESP-W02', 'b1000000-0000-0000-0000-000000000002', '1.0.0', 'active', now()),
    ('ESP-W03', 'b1000000-0000-0000-0000-000000000003', '1.0.0', 'active', now()),
    ('ESP-W04', 'b1000000-0000-0000-0000-000000000004', '1.0.0', 'active', now()),
    ('ESP-W05', 'b1000000-0000-0000-0000-000000000005', '1.0.0', 'active', now());

  -- 4. Poste de travail actif
  insert into public.shifts (id, site_id, name, status, location, started_at)
  values (v_shift, v_site, 'Poste du matin', 'active', 'Atelier Assemblage A', now() - interval '60 minutes');

  -- 5. Mesures : 1 mesure / 30 s pendant 60 minutes pour chaque travailleur
  --    (+ quelques situations anormales pour tester les alertes)
  insert into public.sensor_readings (
    worker_id, shift_id, device_id, timestamp,
    heart_rate, air_temperature, air_humidity,
    obstacle_distance, obstacle_detected, motion
  )
  select
    w.id,
    v_shift,
    w.device_id,
    now() - (g.i * interval '30 seconds'),

    -- Rythme cardiaque
    round((
      w.base_hr
      + 8 * sin(g.i / 6.0)
      + random() * 6
      + case when w.n = 2 and g.i < 20 then 38 else 0 end   -- Soudeur : effort élevé récent
    )::numeric, 0),

    -- Température de l'air
    round((w.base_temp + 1.5 * sin(g.i / 15.0) + random())::numeric, 1),

    -- Humidité de l'air
    round((w.base_hum + 5 * cos(g.i / 12.0) + random() * 3)::numeric, 1),

    -- Distance obstacle (cm)
    round((
      case
        when w.n = 3 and g.i % 9 = 0 then 18 + random() * 20     -- Cariste : obstacles fréquents
        when g.i % 37 = 5 then 30 + random() * 15
        else 120 + random() * 180
      end
    )::numeric, 0),

    null,  -- obstacle_detected : calculé par l'appli avec le seuil

    -- Intensité de mouvement (score 0–100)
    round((
      case
        when w.n = 4 and g.i < 10 then random() * 3          -- Technicien : immobile depuis 5 min
        when w.n = 2 and g.i = 3 then 88 + random() * 8      -- Soudeur : choc / chute récente
        when w.n = 3 and g.i = 40 then 76 + random() * 6     -- Cariste : geste brusque
        when random() < 0.10 then 1 + random() * 3           -- courtes pauses
        else 15 + random() * 35                              -- travail normal
      end
    )::numeric, 0)
  from (
    values
      ('b1000000-0000-0000-0000-000000000001'::uuid, 'ESP-W01', 1, 82, 29.0, 48),
      ('b1000000-0000-0000-0000-000000000002'::uuid, 'ESP-W02', 2, 96, 36.5, 41),
      ('b1000000-0000-0000-0000-000000000003'::uuid, 'ESP-W03', 3, 88, 27.5, 52),
      ('b1000000-0000-0000-0000-000000000004'::uuid, 'ESP-W04', 4, 74, 31.0, 75),
      ('b1000000-0000-0000-0000-000000000005'::uuid, 'ESP-W05', 5, 79, 25.5, 55)
  ) as w(id, device_id, n, base_hr, base_temp, base_hum)
  cross join generate_series(0, 120) as g(i);

  -- 6. Alertes enregistrées
  insert into public.worker_alerts (worker_id, shift_id, type, severity, value, message, is_read, created_at) values
    ('b1000000-0000-0000-0000-000000000002', v_shift, 'heart_rate',  'critical', 138, 'Rythme cardiaque élevé (138 bpm)', false, now() - interval '3 minutes'),
    ('b1000000-0000-0000-0000-000000000002', v_shift, 'temperature', 'warning',  37.2, 'Température ambiante élevée (37.2 °C)', false, now() - interval '9 minutes'),
    ('b1000000-0000-0000-0000-000000000003', v_shift, 'obstacle',    'warning',  22, 'Obstacle détecté à 22 cm', false, now() - interval '4 minutes'),
    ('b1000000-0000-0000-0000-000000000004', v_shift, 'no_motion',   'critical', 5, 'Immobile depuis 5 min', false, now() - interval '1 minute'),
    ('b1000000-0000-0000-0000-000000000002', v_shift, 'abnormal_motion', 'critical', 92, 'Mouvement très violent (92/100) : chute ou choc possible', false, now() - interval '90 seconds'),
    ('b1000000-0000-0000-0000-000000000004', v_shift, 'humidity',    'warning',  78, 'Humidité élevée (78 %)', true, now() - interval '20 minutes');
end $$;
