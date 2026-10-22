// Configuration des capteurs et des règles d'anomalie.
// Adapte les seuils ici : ils sont utilisés partout dans l'app.

export const TABLE = 'sensor_readings';

// Nom de la colonne d'heure. null = détection automatique au démarrage
// (created_at, timestamp, recorded_at, inserted_at, time…). Mets le nom exact si tu le connais.
export const TIME_COLUMN_OVERRIDE = null;

export const TIME_CANDIDATES = [
  'created_at', 'timestamp', 'recorded_at', 'inserted_at', 'measured_at',
  'reading_time', 'read_at', 'time', 'datetime', 'date', 'ts',
];

// Rempli par detectTimeColumn() dans hooks/useReadings.js
export const timeCol = { name: TIME_COLUMN_OVERRIDE };

export const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

// Heure d'une mesure en ms. Si la table n'a pas d'heure, on utilise l'heure de réception.
export const rowTime = (r) => {
  const v = timeCol.name ? r[timeCol.name] : undefined;
  if (v !== undefined && v !== null && v !== '') {
    // accepte ISO, ms ou secondes (epoch)
    const t = typeof v === 'number' || /^\d+$/.test(String(v))
      ? (Number(v) < 1e12 ? Number(v) * 1000 : Number(v))
      : new Date(v).getTime();
    if (Number.isFinite(t)) return t;
  }
  return Number.isFinite(r.__receivedAt) ? r.__receivedAt : NaN;
};

export const SENSORS = [
  {
    key: 'heart_rate',
    label: 'Rythme cardiaque',
    unit: 'bpm',
    icon: 'pulse',
    color: '#FF8A7A',
    decimals: 0,
    refLines: [
      { value: 120, label: 'Max 120' },
      { value: 50, label: 'Min 50' },
    ],
    // 0 = pas de doigt / pas de mesure → ignoré
    value: (r) => {
      const v = num(r.heart_rate);
      return v && v > 0 ? v : null;
    },
    anomaly: (r, v) => {
      if (v == null) return null;
      if (v > 120) return { label: 'Fréquence cardiaque élevée', high: true };
      if (v < 50) return { label: 'Fréquence cardiaque basse', high: false };
      return null;
    },
  },
  {
    key: 'air_temperature',
    label: 'Température',
    unit: '°C',
    icon: 'temp',
    color: '#F5A524',
    decimals: 1,
    refLines: [{ value: 35, label: 'Max 35 °C' }],
    value: (r) => num(r.air_temperature),
    anomaly: (r, v) => (v != null && v > 35 ? { label: 'Température élevée', high: true } : null),
  },
  {
    key: 'air_humidity',
    label: 'Humidité',
    unit: '%',
    icon: 'drop',
    color: '#6CB8FF',
    decimals: 0,
    refLines: [{ value: 80, label: 'Max 80 %' }],
    value: (r) => num(r.air_humidity),
    anomaly: (r, v) => (v != null && v > 80 ? { label: 'Humidité élevée', high: true } : null),
  },
  {
    key: 'obstacle_distance',
    label: 'Obstacles',
    unit: 'cm',
    icon: 'radar',
    color: '#C9A7FF',
    decimals: 0,
    refLines: [{ value: 30, label: 'Min 30 cm' }],
    value: (r) => num(r.obstacle_distance),
    anomaly: (r, v) =>
      r.obstacle_detected === true || r.obstacle_detected === 1 || (v != null && v > 0 && v < 30)
        ? { label: 'Obstacle très proche', high: false }
        : null,
  },
  {
    key: 'motion',
    label: 'Mouvement',
    unit: 'g',
    icon: 'walk',
    color: '#5FE3B8',
    decimals: 2,
    // Si ta colonne "motion" a une autre échelle (ou est un texte), adapte ces seuils.
    refLines: [
      { value: 2.5, label: 'Brusque 2,5' },
      { value: 0.05, label: 'Immobile' },
    ],
    value: (r) => num(r.motion),
    anomaly: (r, v) => {
      if (v == null) return null;
      if (v > 2.5) return { label: 'Mouvement anormal / brusque', high: true };
      if (v < 0.05) return { label: 'Immobilité (fatigue ?)', high: false };
      return null;
    },
  },
];

export const getSensor = (key) => SENSORS.find((s) => s.key === key);

// Série {t, v} pour un capteur
export const seriesFor = (rows, sensor) => {
  const out = [];
  for (const r of rows) {
    const v = sensor.value(r);
    if (v != null) out.push({ t: rowTime(r), v });
  }
  return out;
};

// Regroupe les lectures anormales consécutives en "épisodes"
// (une lecture toutes les 2 s → sinon 30 alertes pour une seule minute).
export const anomalyEpisodes = (rows, sensor, maxGapMs = 10000) => {
  const eps = [];
  let cur = null;
  for (const r of rows) {
    const v = sensor.value(r);
    const a = sensor.anomaly(r, v);
    if (!a) continue;
    const t = rowTime(r);
    if (cur && cur.label === a.label && t - cur.end <= maxGapMs) {
      cur.end = t;
      cur.count += 1;
      if (v != null) {
        if (a.high ? v > cur.peak : v < cur.peak) {
          cur.peak = v;
          cur.peakT = t;
        }
      }
    } else {
      cur = { label: a.label, high: a.high, start: t, end: t, peak: v, peakT: t, count: 1, sensorKey: sensor.key };
      eps.push(cur);
    }
  }
  return eps.reverse(); // plus récent en premier
};

export const downsample = (points, max = 240) => {
  if (points.length <= max) return points;
  const size = Math.ceil(points.length / max);
  const out = [];
  for (let i = 0; i < points.length; i += size) {
    const chunk = points.slice(i, i + size);
    const v = chunk.reduce((s, p) => s + p.v, 0) / chunk.length;
    out.push({ t: chunk[Math.floor(chunk.length / 2)].t, v });
  }
  return out;
};

export const fmtValue = (v, sensor) =>
  v == null ? '—' : v.toFixed(sensor.decimals).replace('.', ',');
