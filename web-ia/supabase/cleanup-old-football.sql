-- ============================================================
-- OPTIONNEL — Supprime les anciennes tables du projet football
-- ⚠️ Action irréversible : toutes les données football sont effacées.
-- Exécute seulement si tu n'en as plus besoin.
-- (La table "profiles" et tes comptes sont conservés.)
-- ============================================================

drop table if exists public.imported_files cascade;
drop table if exists public.biomechanics cascade;
drop table if exists public.heatmap_cells cascade;
drop table if exists public.jumps cascade;
drop table if exists public.speed_zone_stats cascade;
drop table if exists public.gateways cascade;
drop table if exists public.player_loads cascade;
drop table if exists public.sprints cascade;
drop table if exists public.alerts cascade;
drop table if exists public.live_tracking cascade;
drop table if exists public.session_players cascade;
drop table if exists public.training_sessions cascade;
drop table if exists public.sensor_metadata cascade;
drop table if exists public.players cascade;
drop table if exists public.teams cascade;
