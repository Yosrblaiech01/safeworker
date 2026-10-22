import { supabase } from '../lib/supabase';
import { isSupervisorRole, isWorkerRole } from '../utils/metrics';

// Nombre maximum de mesures chargées (Supabase renvoie 1000 lignes par requête)
const PAGE_SIZE = 1000;
const MAX_PAGES = 5;

async function safeQuery(label, queryFn, fallback = null) {
  try {
    const result = await queryFn();
    if (result.error) {
      console.warn(`[Dashboard][${label}]`, result.error.message);
      return fallback;
    }
    return result.data ?? fallback;
  } catch (err) {
    console.warn(`[Dashboard][${label}]`, err);
    return fallback;
  }
}

async function fetchSiteById(siteId) {
  if (!siteId) return null;
  return safeQuery('sites.by_id', () =>
    supabase.from('sites').select('*').eq('id', siteId).maybeSingle(),
  );
}

/**
 * Trouve le site (atelier) à afficher pour l'utilisateur connecté.
 */
async function resolveSite(user, selectedWorkerId) {
  // Travailleur : son propre site
  if (isWorkerRole(user.role)) {
    const own = await safeQuery('workers.own', () =>
      supabase.from('workers').select('site_id').eq('user_id', user.id).limit(1).maybeSingle(),
    );
    return fetchSiteById(own?.site_id);
  }

  // Superviseur : site du travailleur sélectionné en priorité
  if (selectedWorkerId) {
    const selected = await safeQuery('workers.selected', () =>
      supabase
        .from('workers')
        .select('site_id')
        .or(`id.eq.${selectedWorkerId},user_id.eq.${selectedWorkerId}`)
        .limit(1)
        .maybeSingle(),
    );
    if (selected?.site_id) return fetchSiteById(selected.site_id);
  }

  // Puis le premier site supervisé par l'utilisateur
  const ownSites = await safeQuery(
    'sites.by_supervisor',
    () =>
      supabase
        .from('sites')
        .select('*')
        .eq('supervisor_id', user.id)
        .order('name', { ascending: true })
        .limit(1),
    [],
  );
  if (ownSites?.length) return ownSites[0];

  // Sinon : le site d'un travailleur actif quelconque
  const anyWorker = await safeQuery('workers.any_active', () =>
    supabase.from('workers').select('site_id').eq('status', 'active').not('site_id', 'is', null).limit(1).maybeSingle(),
  );
  return fetchSiteById(anyWorker?.site_id);
}

async function resolveShift(siteId, workerIds) {
  if (!siteId) return null;

  const shifts = await safeQuery(
    'shifts.by_site',
    () =>
      supabase
        .from('shifts')
        .select('*')
        .eq('site_id', siteId)
        .order('date', { ascending: false })
        .limit(10),
    [],
  );

  if (!workerIds.length) return shifts[0] ?? null;

  // Le poste le plus récent qui contient des mesures
  for (const shift of shifts) {
    const { count } = await supabase
      .from('sensor_readings')
      .select('id', { count: 'exact', head: true })
      .eq('shift_id', shift.id)
      .in('worker_id', workerIds);

    if (count > 0) return shift;
  }

  return shifts[0] ?? null;
}

async function fetchReadings(workerIds, shiftId) {
  if (!workerIds.length) return [];

  const loadPages = async (withShift) => {
    const rows = [];
    for (let page = 0; page < MAX_PAGES; page += 1) {
      let query = supabase
        .from('sensor_readings')
        .select('*')
        .in('worker_id', workerIds)
        .order('timestamp', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (withShift && shiftId) query = query.eq('shift_id', shiftId);

      const data = await safeQuery('sensor_readings', () => query, []);
      rows.push(...data);
      if (data.length < PAGE_SIZE) break;
    }
    return rows;
  };

  let rows = await loadPages(true);

  // Si le poste ne contient aucune mesure, on prend les dernières mesures sans filtre
  if (!rows.length && shiftId) rows = await loadPages(false);

  // Ordre chronologique
  return rows.reverse();
}

/**
 * Charge toutes les données brutes nécessaires au tableau de bord.
 * Les calculs (seuils, statuts, graphiques) sont faits dans utils/metrics.js.
 */
export async function fetchDashboardData(user, selectedWorkerId = null) {
  if (!supabase || !user?.id) return null;
  if (!isSupervisorRole(user.role) && !isWorkerRole(user.role)) return null;

  const site = await resolveSite(user, selectedWorkerId);

  let allWorkers = [];
  if (site?.id) {
    allWorkers = await safeQuery(
      'workers.by_site',
      () =>
        supabase
          .from('workers')
          .select('*')
          .eq('site_id', site.id)
          .eq('status', 'active')
          .order('name', { ascending: true }),
      [],
    );
  } else if (isWorkerRole(user.role)) {
    allWorkers = await safeQuery(
      'workers.own_only',
      () => supabase.from('workers').select('*').eq('user_id', user.id),
      [],
    );
  }

  // Un travailleur ne voit que ses propres données
  if (isWorkerRole(user.role)) {
    allWorkers = allWorkers.filter((w) => w.user_id === user.id);
  }

  const workerIds = allWorkers.map((w) => w.id);

  const shift = await resolveShift(site?.id, workerIds);

  const [readings, devices, dbAlerts, unread] = await Promise.all([
    fetchReadings(workerIds, shift?.id),

    workerIds.length
      ? safeQuery('devices', () => supabase.from('devices').select('*').in('worker_id', workerIds), [])
      : [],

    workerIds.length
      ? safeQuery(
          'worker_alerts',
          () =>
            supabase
              .from('worker_alerts')
              .select('*')
              .in('worker_id', workerIds)
              .order('created_at', { ascending: false })
              .limit(50),
          [],
        )
      : [],

    workerIds.length
      ? supabase
          .from('worker_alerts')
          .select('id', { count: 'exact', head: true })
          .eq('is_read', false)
          .in('worker_id', workerIds)
      : { count: 0 },
  ]);

  return {
    site,
    shift,
    allWorkers,
    readings,
    devices,
    dbAlerts,
    unreadAlerts: unread?.count ?? 0,
  };
}

export async function markDbAlertsRead(alertIds) {
  if (!supabase || !alertIds.length) return;
  await supabase.from('worker_alerts').update({ is_read: true }).in('id', alertIds);
}

export const REALTIME_TABLES = ['sensor_readings', 'worker_alerts', 'workers', 'devices', 'shifts'];
