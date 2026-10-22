// ============================================================
// IA — Score de risque, détection d'anomalie personnalisée et prévision
//
// 1. SCORE DE RISQUE (0–100) : combine FC, chaleur ressentie (indice de chaleur),
//    mouvement, immobilité, chute possible et obstacle. Les facteurs sont combinés
//    par un "OU bruité" (noisy-OR) : plusieurs facteurs moyens donnent un risque
//    plus élevé que chacun pris seul.
// 2. ANOMALIE PERSONNALISÉE : la FC récente est comparée à l'historique DU travailleur
//    (z-score). 95 bpm est normal pour l'un, anormal pour un autre.
// 3. PRÉVISION : régression linéaire sur le score des 10 dernières minutes,
//    extrapolée 10 minutes plus loin + temps estimé avant le niveau critique.
// ============================================================
import { num } from './metrics.js';

export const RISK_LEVELS = [
  { key: 'low', label: 'Faible', min: 0, color: '#34d399', tone: 'green' },
  { key: 'moderate', label: 'Modéré', min: 30, color: '#f59e0b', tone: 'amber' },
  { key: 'high', label: 'Élevé', min: 60, color: '#fb923c', tone: 'amber' },
  { key: 'critical', label: 'Critique', min: 80, color: '#ef4444', tone: 'red' },
];

export const RISK_CRITICAL = 80;
const RECENT_MS = 2 * 60 * 1000; // fenêtre "récente" pour l'anomalie et le mouvement
const FORECAST_MINUTES = 10; // horizon de la prévision
const MIN_HISTORY = 30; // mesures minimum pour apprendre le profil du travailleur
const DEFAULT_REST_HR = 70;

const clamp01 = (x) => Math.max(0, Math.min(1, x));

export function riskLevelOf(score) {
  if (score === null || score === undefined) return null;
  return [...RISK_LEVELS].reverse().find((level) => score >= level.min) ?? RISK_LEVELS[0];
}

// Indice de chaleur (formule de Rothfusz, NOAA) en °C
export function heatIndexC(tempC, humidity) {
  const t = (tempC * 9) / 5 + 32;
  const rh = humidity;
  let hi = 0.5 * (t + 61 + (t - 68) * 1.2 + rh * 0.094);
  if ((hi + t) / 2 >= 80) {
    hi =
      -42.379 + 2.04901523 * t + 10.14333127 * rh - 0.22475541 * t * rh - 0.00683783 * t * t -
      0.05481717 * rh * rh + 0.00122874 * t * t * rh + 0.00085282 * t * rh * rh -
      0.00000199 * t * t * rh * rh;
    if (rh < 13 && t >= 80 && t <= 112) hi -= ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(t - 95)) / 17);
    if (rh > 85 && t >= 80 && t <= 87) hi += ((rh - 85) / 10) * ((87 - t) / 5);
  }
  return ((hi - 32) * 5) / 9;
}

function mean(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function stdDev(values) {
  if (values.length < 2) return null;
  const m = mean(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1));
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

// ------------------------------------------------------------
// Profil personnel du travailleur (appris sur son historique)
// ------------------------------------------------------------
export function learnBaseline(historyRows) {
  const hr = historyRows.map((r) => num(r.heart_rate)).filter((v) => v !== null && v > 0);
  if (hr.length < MIN_HISTORY) {
    return { learned: false, samples: hr.length, restHr: DEFAULT_REST_HR, meanHr: null, stdHr: null };
  }
  const rest = percentile(hr, 0.2);
  return {
    learned: true,
    samples: hr.length,
    restHr: Math.max(50, Math.min(90, rest)),
    meanHr: mean(hr),
    stdHr: Math.max(3, stdDev(hr) ?? 3), // plancher : évite les z-scores explosifs
  };
}

// ------------------------------------------------------------
// Score d'un échantillon (moyennes d'une fenêtre)
// ------------------------------------------------------------
function scoreSample(s, baseline, thresholds) {
  const factors = [];
  const add = (key, label, weight, f, detail) => {
    if (f > 0.02) factors.push({ key, label, weight, f, contribution: weight * f, detail });
  };

  if (s.temp !== null && s.hum !== null) {
    const hi = heatIndexC(s.temp, s.hum);
    add('heat', 'Chaleur ressentie', 0.55, clamp01((hi - 27) / 18), `indice de chaleur ${hi.toFixed(0)} °C`);
  }

  if (s.hr !== null && s.hr > 0) {
    const top = thresholds.heartRateMax + 20;
    add('hr', 'Effort cardiaque', 0.6, clamp01((s.hr - baseline.restHr) / (top - baseline.restHr)),
      `${Math.round(s.hr)} bpm (repos ≈ ${Math.round(baseline.restHr)})`);
    if (s.hr < 50) add('hr_low', 'FC basse', 0.5, clamp01((50 - s.hr) / 20), `${Math.round(s.hr)} bpm`);
  }

  if (s.motionPeak !== null) {
    add('motion', 'Mouvement brusque', 0.5, clamp01((s.motionPeak - thresholds.motionMax) / 30),
      `pic ${Math.round(s.motionPeak)}/100`);
  }

  if (s.immobileMin > 0) {
    add('still', 'Immobilité', 0.5, clamp01(s.immobileMin / (thresholds.noMotionMinutes * 2)),
      `${s.immobileMin.toFixed(1)} min`);
  }

  if (s.fall) add('fall', 'Chute possible', 0.9, 1, 'choc suivi d’une immobilité');

  if (s.obstacle !== null && s.obstacle > 0) {
    add('obstacle', 'Obstacle proche', 0.25, clamp01((thresholds.obstacleDistance - s.obstacle) / thresholds.obstacleDistance),
      `${Math.round(s.obstacle)} cm`);
  }

  if (s.z !== null) {
    add('anomaly', 'Écart au profil personnel', 0.35, clamp01((Math.abs(s.z) - 2) / 3),
      `FC ${s.z > 0 ? '+' : ''}${s.z.toFixed(1)} σ vs son habitude`);
  }

  // OU bruité : 1 - Π(1 - w·f)
  const survive = factors.reduce((p, x) => p * (1 - x.contribution), 1);
  return { score: Math.round((1 - survive) * 100), factors: factors.sort((a, b) => b.contribution - a.contribution) };
}

function zScore(hr, baseline) {
  if (!baseline.learned || hr === null) return null;
  return (hr - baseline.meanHr) / baseline.stdHr;
}

function windowStats(rows) {
  const col = (k) => rows.map((r) => num(r[k])).filter((v) => v !== null);
  const hr = col('heart_rate').filter((v) => v > 0);
  const temp = col('air_temperature');
  const hum = col('air_humidity');
  const obs = col('obstacle_distance').filter((v) => v > 0);
  const motion = col('motion');
  return {
    hr: mean(hr),
    temp: mean(temp),
    hum: mean(hum),
    obstacle: obs.length ? Math.min(...obs) : null,
    motionPeak: motion.length ? Math.max(...motion) : null,
  };
}

// Régression linéaire y = a + b·x
function linearFit(points) {
  const n = points.length;
  const mx = mean(points.map((p) => p.x));
  const my = mean(points.map((p) => p.y));
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sxx += (p.x - mx) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  return { slope, at: (x) => my + slope * (x - mx), n };
}

/**
 * Analyse complète d'un travailleur.
 * @param rowsAsc  mesures triées de la plus ancienne à la plus récente
 * @param thresholds seuils de l'application
 * @param immobileMin minutes d'immobilité (déjà calculées)
 * @returns null si pas de mesure
 */
export function assessWorker(rowsAsc, thresholds, immobileMin = 0) {
  if (!rowsAsc?.length) return null;

  const lastTime = new Date(rowsAsc.at(-1).timestamp).getTime();
  const recent = rowsAsc.filter((r) => lastTime - new Date(r.timestamp).getTime() <= RECENT_MS);
  const history = rowsAsc.filter((r) => lastTime - new Date(r.timestamp).getTime() > RECENT_MS);
  const baseline = learnBaseline(history);

  // --- Score actuel
  const w = windowStats(recent);
  const lastRows = recent.slice(-3).map((r) => num(r.motion)).filter((m) => m !== null);
  const stillNow = lastRows.length > 0 && lastRows.every((m) => m <= thresholds.motionStill);
  const fall = w.motionPeak !== null && w.motionPeak > thresholds.motionMax + 10 && stillNow;
  const z = zScore(w.hr, baseline);
  const current = scoreSample({ ...w, immobileMin, fall, z }, baseline, thresholds);

  // --- Série du score par minute (pour la prévision)
  const buckets = new Map();
  for (const r of rowsAsc) {
    const k = Math.floor(new Date(r.timestamp).getTime() / 60000);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(r);
  }
  const lastKey = Math.floor(lastTime / 60000);
  const series = [...buckets.entries()]
    .filter(([k]) => lastKey - k < FORECAST_MINUTES)
    .sort((a, b) => a[0] - b[0])
    .map(([k, rows]) => {
      const s = windowStats(rows);
      return { x: k - lastKey, y: scoreSample({ ...s, immobileMin: 0, fall: false, z: zScore(s.hr, baseline) }, baseline, thresholds).score };
    });

  let forecast = null;
  if (series.length >= 4) {
    const fit = linearFit(series);
    const now = fit.at(0);
    // l'augmentation prévue est plafonnée à +40 pts pour éviter les extrapolations extrêmes
    const projected = Math.max(0, Math.min(100, Math.round(Math.max(current.score, now) + Math.min(40, fit.slope * FORECAST_MINUTES))));
    let minutesToCritical = null;
    if (current.score >= RISK_CRITICAL) minutesToCritical = 0;
    else if (fit.slope > 0.5) {
      const m = (RISK_CRITICAL - current.score) / fit.slope;
      if (m <= 30) minutesToCritical = Math.max(1, Math.round(m));
    }
    const trend = fit.slope > 1 ? 'up' : fit.slope < -1 ? 'down' : 'flat';
    forecast = { projected, slopePerMin: fit.slope, trend, minutesToCritical, points: series.length };
  }

  return {
    score: current.score,
    level: riskLevelOf(current.score),
    factors: current.factors,
    forecast,
    baseline,
    anomaly: z !== null && Math.abs(z) > 3 ? { z, direction: z > 0 ? 'haut' : 'bas' } : null,
    fall,
  };
}
