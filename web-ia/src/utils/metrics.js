// ============================================================
// Mesures, seuils et calculs pour le suivi des travailleurs
// ============================================================

import { assessWorker } from './aiRisk.js';

export const THRESHOLDS_STORAGE_KEY = 'iwm-thresholds';

// Seuils par défaut (modifiables dans la page Alertes)
export const DEFAULT_THRESHOLDS = {
  heartRateMax: 120, // bpm  → alerte si au-dessus
  temperatureMax: 35, // °C   → alerte si au-dessus
  humidityMax: 70, // %    → alerte si au-dessus
  obstacleDistance: 50, // cm   → obstacle détecté si distance <= seuil
  noMotionMinutes: 2, // min  → alerte si immobile pendant cette durée
  motionStill: 5, // score → en dessous, le travailleur est considéré immobile
  motionMax: 70, // score → au-dessus, mouvement anormal (chute, choc, geste brusque)
};

// Une mesure est "en ligne" si elle date de moins de 2 minutes
export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

export const METRICS = {
  heartRate: { label: 'Rythme cardiaque', unit: 'bpm', color: '#f43f5e' },
  temperature: { label: "Température de l'air", unit: '°C', color: '#f59e0b' },
  humidity: { label: "Humidité de l'air", unit: '%', color: '#38bdf8' },
  obstacle: { label: 'Distance obstacle', unit: 'cm', color: '#a78bfa' },
  motion: { label: 'Intensité de mouvement', unit: '/100', color: '#34d399' },
};

export const HEART_ZONES = [
  { key: 'rest', name: 'Repos', range: '< 90 bpm', min: 0, max: 90, color: '#38bdf8' },
  { key: 'moderate', name: 'Modéré', range: '90 – 110 bpm', min: 90, max: 110, color: '#34d399' },
  { key: 'high', name: 'Soutenu', range: '110 – 130 bpm', min: 110, max: 130, color: '#f59e0b' },
  { key: 'critical', name: 'Critique', range: '> 130 bpm', min: 130, max: Infinity, color: '#f43f5e' },
];

export const ALERT_TYPES = {
  heart_rate: { label: 'Rythme cardiaque', unit: 'bpm' },
  temperature: { label: 'Température', unit: '°C' },
  humidity: { label: 'Humidité', unit: '%' },
  obstacle: { label: 'Obstacle', unit: 'cm' },
  no_motion: { label: 'Immobilité prolongée', unit: 'min' },
  abnormal_motion: { label: 'Mouvement anormal', unit: '/100' },
  other: { label: 'Événement', unit: '' },
};

export const WORKER_STATUS = {
  active: { label: 'Actif', tone: 'green' },
  leave: { label: 'En congé', tone: 'amber' },
  inactive: { label: 'Inactif', tone: 'red' },
};

// ------------------------------------------------------------
// Formatage
// ------------------------------------------------------------
export function num(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function fmt(value, decimals = 0, fallback = '—') {
  const n = num(value);
  if (n === null) return fallback;
  return n.toFixed(decimals);
}

export function fmtUnit(value, unit, decimals = 0) {
  const text = fmt(value, decimals);
  return text === '—' ? '—' : `${text}${unit ? ` ${unit}` : ''}`;
}

export function formatTime(timestamp) {
  if (!timestamp) return '--:--:--';
  return new Date(timestamp).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDateTime(date = new Date()) {
  return {
    date: date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }),
    time: date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };
}

export function initialsOf(name, fallback = 'SU') {
  return (
    name
      ?.split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || fallback
  );
}

// ------------------------------------------------------------
// Rôles
// ------------------------------------------------------------
export function isSupervisorRole(role) {
  return ['Superviseur', 'Coach', 'Admin', 'Analyste'].includes(role);
}

export function isWorkerRole(role) {
  return ['Travailleur', 'Player'].includes(role);
}

// ------------------------------------------------------------
// Seuils
// ------------------------------------------------------------
export function loadThresholds() {
  try {
    const raw = localStorage.getItem(THRESHOLDS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_THRESHOLDS };
    return { ...DEFAULT_THRESHOLDS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_THRESHOLDS };
  }
}

export function saveThresholds(thresholds) {
  try {
    localStorage.setItem(THRESHOLDS_STORAGE_KEY, JSON.stringify(thresholds));
  } catch {
    // stockage indisponible
  }
}

export function isObstacleDetected(reading, thresholds) {
  if (!reading) return false;
  if (reading.obstacle_detected === 1) return true;
  const distance = num(reading.obstacle_distance);
  return distance !== null && distance <= thresholds.obstacleDistance;
}

export function heartZoneOf(bpm) {
  const n = num(bpm);
  if (n === null) return null;
  return HEART_ZONES.find((zone) => n >= zone.min && n < zone.max) ?? HEART_ZONES.at(-1);
}

// Intensité de mouvement (score 0–100 envoyé par le MPU6050)
export function isMoving(motion, thresholds) {
  const n = num(motion);
  return n !== null && n > thresholds.motionStill;
}

export function isStill(motion, thresholds) {
  const n = num(motion);
  return n !== null && n <= thresholds.motionStill;
}

export function isAbnormalMotion(motion, thresholds) {
  const n = num(motion);
  return n !== null && n > thresholds.motionMax;
}

export function motionLabel(motion, thresholds) {
  const n = num(motion);
  if (n === null) return '—';
  if (n > thresholds.motionMax) return 'Anormal';
  if (n <= thresholds.motionStill) return 'Immobile';
  return 'Normal';
}

// ------------------------------------------------------------
// Analyse
// ------------------------------------------------------------
function average(values) {
  const valid = values.map(num).filter((v) => v !== null);
  if (!valid.length) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

function maxOf(values) {
  const valid = values.map(num).filter((v) => v !== null);
  return valid.length ? Math.max(...valid) : null;
}

function minOf(values) {
  const valid = values.map(num).filter((v) => v !== null);
  return valid.length ? Math.min(...valid) : null;
}

// Minutes écoulées depuis le dernier mouvement (si la dernière mesure est immobile)
function immobileMinutes(rowsDesc, thresholds) {
  const withMotion = rowsDesc.filter((row) => num(row.motion) !== null);
  if (!withMotion.length || !isStill(withMotion[0].motion, thresholds)) return 0;
  const latest = new Date(withMotion[0].timestamp).getTime();
  const lastMoving = withMotion.find((row) => isMoving(row.motion, thresholds));
  const reference = lastMoving
    ? new Date(lastMoving.timestamp).getTime()
    : new Date(withMotion.at(-1).timestamp).getTime();
  return Math.max(0, (latest - reference) / 60000);
}

/**
 * Évalue la dernière mesure d'un travailleur par rapport aux seuils.
 * Retourne la liste des problèmes détectés.
 */
export function evaluateWorker(latest, immobileMin, thresholds) {
  const issues = [];
  if (!latest) return issues;

  const hr = num(latest.heart_rate);
  if (hr !== null && hr > thresholds.heartRateMax) {
    const critical = hr > thresholds.heartRateMax + 20;
    issues.push({
      type: 'heart_rate',
      severity: critical ? 'critical' : 'warning',
      value: Math.round(hr),
      message: critical
        ? `Rythme cardiaque très élevé (${Math.round(hr)} bpm). Arrêter l'activité et vérifier l'état du travailleur.`
        : `Rythme cardiaque élevé (${Math.round(hr)} bpm). Prévoir une pause.`,
    });
  }

  const temp = num(latest.air_temperature);
  if (temp !== null && temp > thresholds.temperatureMax) {
    const critical = temp > thresholds.temperatureMax + 5;
    issues.push({
      type: 'temperature',
      severity: critical ? 'critical' : 'warning',
      value: Number(temp.toFixed(1)),
      message: critical
        ? `Chaleur excessive (${temp.toFixed(1)} °C). Risque de coup de chaleur : évacuer la zone.`
        : `Température ambiante élevée (${temp.toFixed(1)} °C). Hydratation recommandée.`,
    });
  }

  const hum = num(latest.air_humidity);
  if (hum !== null && hum > thresholds.humidityMax) {
    const critical = hum > thresholds.humidityMax + 15;
    issues.push({
      type: 'humidity',
      severity: critical ? 'critical' : 'warning',
      value: Math.round(hum),
      message: critical
        ? `Humidité très élevée (${Math.round(hum)} %). Ventiler la zone immédiatement.`
        : `Humidité élevée (${Math.round(hum)} %). Surveiller la ventilation.`,
    });
  }

  if (isObstacleDetected(latest, thresholds)) {
    const distance = num(latest.obstacle_distance);
    const critical = distance !== null && distance <= thresholds.obstacleDistance / 2;
    issues.push({
      type: 'obstacle',
      severity: critical ? 'critical' : 'warning',
      value: distance !== null ? Math.round(distance) : null,
      message:
        distance !== null
          ? `Obstacle détecté à ${Math.round(distance)} cm (seuil ${thresholds.obstacleDistance} cm).`
          : 'Obstacle détecté par le capteur.',
    });
  }

  const motion = num(latest.motion);
  if (motion !== null && motion > thresholds.motionMax) {
    const critical = motion > thresholds.motionMax + 20;
    issues.push({
      type: 'abnormal_motion',
      severity: critical ? 'critical' : 'warning',
      value: Math.round(motion),
      message: critical
        ? `Mouvement très violent (${Math.round(motion)}/100) : chute ou choc possible. Vérifier immédiatement.`
        : `Mouvement anormal détecté (${Math.round(motion)}/100, seuil ${thresholds.motionMax}).`,
    });
  }

  if (immobileMin >= thresholds.noMotionMinutes) {
    const critical = immobileMin >= thresholds.noMotionMinutes * 2;
    issues.push({
      type: 'no_motion',
      severity: critical ? 'critical' : 'warning',
      value: Number(immobileMin.toFixed(1)),
      message: critical
        ? `Immobile depuis ${immobileMin.toFixed(0)} min (intensité ≤ ${thresholds.motionStill}). Vérifier immédiatement : malaise ou chute possible.`
        : `Travailleur immobile depuis ${immobileMin.toFixed(1)} min (intensité ≤ ${thresholds.motionStill}).`,
    });
  }

  return issues;
}

function levelOf(issues) {
  if (issues.some((issue) => issue.severity === 'critical')) return 'critical';
  if (issues.length) return 'warning';
  return 'ok';
}

function minuteKey(timestamp) {
  return new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function buildTimeline(rowsAsc, thresholds) {
  const buckets = new Map();

  for (const row of rowsAsc) {
    const key = minuteKey(row.timestamp);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }

  return Array.from(buckets.entries()).map(([time, rows]) => {
    const hr = average(rows.map((r) => r.heart_rate));
    const temp = average(rows.map((r) => r.air_temperature));
    const hum = average(rows.map((r) => r.air_humidity));
    const obstacle = minOf(rows.map((r) => r.obstacle_distance));
    const motionPeak = maxOf(rows.map((r) => r.motion));
    const motionAvg = average(rows.map((r) => r.motion));

    return {
      time,
      heartRate: hr !== null ? Math.round(hr) : null,
      temperature: temp !== null ? Number(temp.toFixed(1)) : null,
      humidity: hum !== null ? Number(hum.toFixed(1)) : null,
      obstacle: obstacle !== null ? Math.round(obstacle) : null,
      obstacleThreshold: thresholds.obstacleDistance,
      obstacles: rows.filter((r) => isObstacleDetected(r, thresholds)).length,
      motion: motionPeak !== null ? Math.round(motionPeak) : null,
      motionAvg: motionAvg !== null ? Math.round(motionAvg) : null,
    };
  });
}

function buildHeartZones(rows) {
  const counts = Object.fromEntries(HEART_ZONES.map((zone) => [zone.key, 0]));
  let total = 0;

  for (const row of rows) {
    const zone = heartZoneOf(row.heart_rate);
    if (zone) {
      counts[zone.key] += 1;
      total += 1;
    }
  }

  if (!total) return [];

  return HEART_ZONES.map((zone) => ({
    name: zone.name,
    range: zone.range,
    color: zone.color,
    value: Math.round((counts[zone.key] / total) * 100),
  }));
}

/**
 * Transforme les données brutes Supabase en données prêtes pour l'affichage.
 */
export function buildDashboard(raw, thresholds, selectedWorkerId) {
  const empty = emptyDashboard();
  if (!raw) return empty;

  const allWorkers = raw.allWorkers ?? [];
  const readings = raw.readings ?? [];
  const devices = raw.devices ?? [];
  const now = Date.now();

  const deviceByWorker = new Map(devices.filter((d) => d.worker_id).map((d) => [d.worker_id, d]));

  const readingsByWorker = new Map();
  for (const row of readings) {
    if (!row.worker_id) continue;
    if (!readingsByWorker.has(row.worker_id)) readingsByWorker.set(row.worker_id, []);
    readingsByWorker.get(row.worker_id).push(row);
  }

  const selectedWorker = selectedWorkerId
    ? allWorkers.find((w) => w.id === selectedWorkerId || w.user_id === selectedWorkerId) ?? null
    : null;

  const workerStatus = allWorkers.map((worker) => {
    const rowsAsc = readingsByWorker.get(worker.id) ?? [];
    const rowsDesc = [...rowsAsc].reverse();
    const latest = rowsDesc[0] ?? null;
    const device = deviceByWorker.get(worker.id);
    const lastSeen = latest?.timestamp ?? device?.last_seen_at ?? null;
    const online = lastSeen ? now - new Date(lastSeen).getTime() < ONLINE_WINDOW_MS : false;
    const immobileMin = immobileMinutes(rowsDesc, thresholds);
    const issues = evaluateWorker(latest, immobileMin, thresholds);
    const motionValues = rowsAsc.map((r) => num(r.motion)).filter((m) => m !== null);

    return {
      workerId: worker.id,
      name: worker.name ?? 'Travailleur',
      matricule: worker.matricule ?? null,
      jobTitle: worker.job_title ?? null,
      photoUrl: worker.photo_url ?? null,
      deviceId: device?.device_id ?? null,
      online,
      lastSeen,
      latest,
      readingsCount: rowsAsc.length,
      heartRate: num(latest?.heart_rate),
      temperature: num(latest?.air_temperature),
      humidity: num(latest?.air_humidity),
      obstacleDistance: num(latest?.obstacle_distance),
      obstacleNow: isObstacleDetected(latest, thresholds),
      motion: num(latest?.motion),
      avgHeartRate: average(rowsAsc.map((r) => r.heart_rate)),
      maxHeartRate: maxOf(rowsAsc.map((r) => r.heart_rate)),
      avgTemperature: average(rowsAsc.map((r) => r.air_temperature)),
      maxTemperature: maxOf(rowsAsc.map((r) => r.air_temperature)),
      avgHumidity: average(rowsAsc.map((r) => r.air_humidity)),
      minObstacle: minOf(rowsAsc.map((r) => r.obstacle_distance)),
      obstacleCount: rowsAsc.filter((r) => isObstacleDetected(r, thresholds)).length,
      motionRate: motionValues.length
        ? (motionValues.filter((m) => m > thresholds.motionStill).length / motionValues.length) * 100
        : null,
      avgMotion: motionValues.length ? motionValues.reduce((a, b) => a + b, 0) / motionValues.length : null,
      maxMotion: motionValues.length ? Math.max(...motionValues) : null,
      abnormalMotionCount: motionValues.filter((m) => m > thresholds.motionMax).length,
      immobileMinutes: immobileMin,
      issues,
      level: levelOf(issues),
      // Analyse IA : aussi pour un bracelet hors ligne (sur sa dernière mesure), signalé par "stale"
      ai: (() => {
        const result = assessWorker(rowsAsc, thresholds, online ? immobileMin : 0);
        return result ? { ...result, stale: !online, lastSeen } : null;
      })(),
      isSelected: worker.id === selectedWorker?.id,
    };
  });

  // Tri : critiques d'abord, puis rythme cardiaque décroissant
  const levelRank = { critical: 0, warning: 1, ok: 2 };
  workerStatus.sort(
    (a, b) =>
      levelRank[a.level] - levelRank[b.level] || (b.heartRate ?? -1) - (a.heartRate ?? -1),
  );

  const scopedStatus = selectedWorker
    ? workerStatus.filter((w) => w.workerId === selectedWorker.id)
    : workerStatus;

  const scopedIds = new Set(scopedStatus.map((w) => w.workerId));
  const scopedReadings = readings.filter((r) => scopedIds.has(r.worker_id));
  const latestScoped = scopedStatus.map((w) => w.latest).filter(Boolean);

  const kpis = {
    totalWorkers: scopedStatus.length,
    connectedWorkers: scopedStatus.filter((w) => w.online).length,
    avgHeartRate: average(latestScoped.map((r) => r.heart_rate)),
    maxHeartRate: maxOf(latestScoped.map((r) => r.heart_rate)),
    avgTemperature: average(latestScoped.map((r) => r.air_temperature)),
    avgHumidity: average(latestScoped.map((r) => r.air_humidity)),
    obstacleCount: scopedReadings.filter((r) => isObstacleDetected(r, thresholds)).length,
    obstaclesNow: scopedStatus.filter((w) => w.obstacleNow).length,
    movingWorkers: scopedStatus.filter((w) => isMoving(w.motion, thresholds)).length,
    immobileWorkers: scopedStatus.filter((w) => isStill(w.motion, thresholds)).length,
    abnormalWorkers: scopedStatus.filter((w) => isAbnormalMotion(w.motion, thresholds)).length,
    avgMotion: average(latestScoped.map((r) => r.motion)),
    abnormalMotionCount: scopedReadings.filter((r) => isAbnormalMotion(r.motion, thresholds)).length,
    maxRisk: Math.max(0, ...scopedStatus.map((w) => w.ai?.score ?? 0)),
    riskyWorkers: scopedStatus.filter((w) => (w.ai?.score ?? 0) >= 60).length,
    criticalWorkers: scopedStatus.filter((w) => w.level === 'critical').length,
    warningWorkers: scopedStatus.filter((w) => w.level === 'warning').length,
  };

  // Événements : alertes enregistrées + obstacles détectés + immobilité
  const workerById = new Map(allWorkers.map((w) => [w.id, w]));
  const dbEvents = (raw.dbAlerts ?? [])
    .filter((a) => scopedIds.has(a.worker_id))
    .map((a) => ({
      id: `db-${a.id}`,
      time: a.created_at,
      type: a.type,
      severity: a.severity,
      label: ALERT_TYPES[a.type]?.label ?? a.type,
      worker: workerById.get(a.worker_id),
      value:
        a.value != null
          ? `${fmt(a.value, a.type === 'temperature' ? 1 : 0)} ${ALERT_TYPES[a.type]?.unit ?? ''}`.trim()
          : '—',
      message: a.message,
    }));

  const obstacleEvents = scopedReadings
    .filter((r) => isObstacleDetected(r, thresholds))
    .map((r) => ({
      id: `obs-${r.id}`,
      time: r.timestamp,
      type: 'obstacle',
      severity: 'warning',
      label: 'Obstacle détecté',
      worker: workerById.get(r.worker_id),
      value: r.obstacle_distance != null ? `${Math.round(r.obstacle_distance)} cm` : '—',
    }));

  const motionEvents = scopedReadings
    .filter((r) => isAbnormalMotion(r.motion, thresholds))
    .map((r) => ({
      id: `mvt-${r.id}`,
      time: r.timestamp,
      type: 'abnormal_motion',
      severity: num(r.motion) > thresholds.motionMax + 20 ? 'critical' : 'warning',
      label: 'Mouvement anormal',
      worker: workerById.get(r.worker_id),
      value: `${Math.round(r.motion)}/100`,
    }));

  const events = [...dbEvents, ...obstacleEvents, ...motionEvents]
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 8);

  const onlineDevices = workerStatus.filter((w) => w.deviceId && w.online).length;

  return {
    site: raw.site ?? null,
    shift: raw.shift ?? null,
    allWorkers,
    selectedWorker,
    workerStatus,
    scopedStatus,
    kpis,
    sidebar: {
      devices: devices.filter((d) => d.worker_id).length,
      onlineDevices,
    },
    timeline: buildTimeline(scopedReadings, thresholds),
    heartZones: buildHeartZones(scopedReadings),
    events,
    unreadAlerts: raw.unreadAlerts ?? 0,
    dbAlerts: raw.dbAlerts ?? [],
  };
}

export function emptyDashboard() {
  return {
    site: null,
    shift: null,
    allWorkers: [],
    selectedWorker: null,
    workerStatus: [],
    scopedStatus: [],
    kpis: {
      totalWorkers: 0,
      connectedWorkers: 0,
      avgHeartRate: null,
      maxHeartRate: null,
      avgTemperature: null,
      avgHumidity: null,
      obstacleCount: 0,
      obstaclesNow: 0,
      movingWorkers: 0,
      immobileWorkers: 0,
      abnormalWorkers: 0,
      avgMotion: null,
      abnormalMotionCount: 0,
      criticalWorkers: 0,
      warningWorkers: 0,
    },
    sidebar: { devices: 0, onlineDevices: 0 },
    timeline: [],
    heartZones: [],
    events: [],
    unreadAlerts: 0,
    dbAlerts: [],
  };
}
