import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Droplets,
  HeartPulse,
  PersonStanding,
  Radar,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Thermometer,
  X,
} from 'lucide-react';
import AppLayout from '../components/AppLayout';
import {
  ActionButton,
  EmptyState,
  KpiCard,
  MotionBadge,
  Notice,
  PageHeader,
  Panel,
  PrimaryButton,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useThresholds } from '../context/ThresholdsContext';
import { useDashboard, useLiveClock } from '../hooks/useDashboard';
import { markDbAlertsRead } from '../services/dashboardService';
import { ALERT_TYPES, fmt, formatDateTime, formatTime, isSupervisorRole, isWorkerRole } from '../utils/metrics';

const READ_KEY = 'iwm-alerts-read';
const DISMISSED_KEY = 'iwm-alerts-dismissed';

const FILTERS = [
  { key: 'all', label: 'Toutes' },
  { key: 'unread', label: 'Non lues' },
  { key: 'critical', label: 'Critiques' },
  { key: 'heart_rate', label: 'Cardiaque' },
  { key: 'temperature', label: 'Température' },
  { key: 'humidity', label: 'Humidité' },
  { key: 'obstacle', label: 'Obstacle' },
  { key: 'no_motion', label: 'Immobilité' },
  { key: 'abnormal_motion', label: 'Mvt anormal' },
];

const SEVERITY = {
  critical: {
    label: 'Critique',
    badge: 'border-red-400/30 bg-red-400/10 text-red-300',
    icon: 'border-red-400/25 bg-red-400/10 text-red-300',
    bar: 'bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.7)]',
  },
  warning: {
    label: 'Attention',
    badge: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    icon: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
    bar: 'bg-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.6)]',
  },
};

const TYPE_ICON = {
  heart_rate: HeartPulse,
  temperature: Thermometer,
  humidity: Droplets,
  obstacle: Radar,
  no_motion: PersonStanding,
  abnormal_motion: Activity,
  other: Bell,
};

export default function Alerts() {
  const { user } = useAuth();
  const { thresholds, setThresholds, resetThresholds } = useThresholds();
  const [filter, setFilter] = useState('all');
  const [draft, setDraft] = useState(thresholds);
  const [saved, setSaved] = useState(false);
  const [readIds, setReadIds] = useState(() => loadJson(READ_KEY, []));
  const [dismissedIds, setDismissedIds] = useState(() => loadJson(DISMISSED_KEY, []));

  const canView = isSupervisorRole(user?.role) || isWorkerRole(user?.role);
  const { data, loading, error, refresh } = useDashboard(canView ? user : null, null);
  const now = useLiveClock();
  const { date, time } = formatDateTime(now);
  const { workerStatus, dbAlerts, sidebar, kpis } = data;

  useEffect(() => setDraft(thresholds), [thresholds]);
  useEffect(() => saveJson(READ_KEY, readIds), [readIds]);
  useEffect(() => saveJson(DISMISSED_KEY, dismissedIds), [dismissedIds]);

  // Alertes en temps réel (calculées à partir des seuils) + alertes enregistrées dans Supabase
  const alerts = useMemo(() => {
    const live = workerStatus.flatMap((worker) =>
      worker.issues.map((issue) => ({
        id: `live-${issue.type}-${worker.workerId}`,
        source: 'live',
        type: issue.type,
        severity: issue.severity,
        value: issue.value,
        message: issue.message,
        worker: worker.name,
        matricule: worker.matricule,
        deviceId: worker.deviceId,
        motion: worker.motion,
        time: worker.lastSeen,
        read: readIds.includes(`live-${issue.type}-${worker.workerId}`),
      })),
    );

    const workerNames = new Map(workerStatus.map((w) => [w.workerId, w]));
    const stored = dbAlerts.map((alert) => {
      const worker = workerNames.get(alert.worker_id);
      return {
        id: `db-${alert.id}`,
        dbId: alert.id,
        source: 'db',
        type: alert.type,
        severity: alert.severity ?? 'warning',
        value: alert.value,
        message: alert.message,
        worker: worker?.name ?? 'Travailleur',
        matricule: worker?.matricule,
        deviceId: worker?.deviceId,
        motion: null,
        time: alert.created_at,
        read: alert.is_read || readIds.includes(`db-${alert.id}`),
      };
    });

    return [...live, ...stored]
      .filter((alert) => !dismissedIds.includes(alert.id))
      .sort(
        (a, b) =>
          Number(a.read) - Number(b.read) ||
          Number(a.severity !== 'critical') - Number(b.severity !== 'critical') ||
          new Date(b.time) - new Date(a.time),
      );
  }, [workerStatus, dbAlerts, readIds, dismissedIds]);

  const counts = useMemo(() => {
    const open = alerts.filter((a) => !a.read);
    return {
      active: open.length,
      critical: open.filter((a) => a.severity === 'critical').length,
      heart: open.filter((a) => a.type === 'heart_rate').length,
      environment: open.filter((a) => a.type === 'temperature' || a.type === 'humidity').length,
      obstacle: open.filter((a) => a.type === 'obstacle').length,
      motion: open.filter((a) => a.type === 'no_motion' || a.type === 'abnormal_motion').length,
    };
  }, [alerts]);

  const visible = alerts.filter((alert) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !alert.read;
    if (filter === 'critical') return alert.severity === 'critical';
    return alert.type === filter;
  });

  async function markRead(alert) {
    setReadIds((ids) => (ids.includes(alert.id) ? ids : [...ids, alert.id]));
    if (alert.source === 'db') await markDbAlertsRead([alert.dbId]);
  }

  async function markAllRead() {
    setReadIds((ids) => [...new Set([...ids, ...alerts.map((a) => a.id)])]);
    await markDbAlertsRead(alerts.filter((a) => a.source === 'db' && !a.read).map((a) => a.dbId));
  }

  function dismiss(id) {
    setDismissedIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
  }

  function handleSave() {
    setThresholds(draft);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  }

  return (
    <AppLayout stats={sidebar} alertCount={counts.active} loading={loading}>
      <PageHeader
        eyebrow="Sécurité des travailleurs"
        eyebrowIcon={<Bell />}
        title="Alertes & seuils"
        subtitle={`Rythme cardiaque, température, humidité, obstacles et intensité de mouvement · ${counts.active} alerte(s) ouverte(s)`}
        actions={
          <>
            <ActionButton onClick={refresh} icon={<RefreshCw />} label="Actualiser" />
            <PrimaryButton onClick={markAllRead} icon={<CheckCheck />} label="Tout marquer comme lu" />
          </>
        }
      />

      {error && (
        <Notice tone="red" title="Erreur">
          {error}
        </Notice>
      )}

      {canView && !loading && kpis.connectedWorkers === 0 && workerStatus.length > 0 && (
        <Notice tone="amber" icon={<AlertTriangle />} title="Aucun bracelet en ligne">
          Les alertes se basent sur la dernière mesure reçue. Allume les bracelets ESP pour recevoir les alertes en direct.
        </Notice>
      )}

      <section className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard title="Alertes ouvertes" value={counts.active} subtitle="Non lues" icon={<BellRing />} tone="amber" />
        <KpiCard title="Critiques" value={counts.critical} subtitle="Action immédiate" icon={<AlertTriangle />} tone="red" alert={counts.critical > 0} />
        <KpiCard title="Cardiaque" value={counts.heart} subtitle={`> ${thresholds.heartRateMax} bpm`} icon={<HeartPulse />} tone="rose" />
        <KpiCard
          title="Environnement"
          value={counts.environment}
          subtitle={`> ${thresholds.temperatureMax} °C / ${thresholds.humidityMax} %`}
          icon={<Thermometer />}
          tone="orange"
        />
        <KpiCard title="Obstacles" value={counts.obstacle} subtitle={`≤ ${thresholds.obstacleDistance} cm`} icon={<Radar />} tone="violet" />
        <KpiCard
          title="Mouvement"
          value={counts.motion}
          subtitle={`Immobile > ${thresholds.noMotionMinutes} min ou > ${thresholds.motionMax}/100`}
          icon={<PersonStanding />}
          tone="green"
        />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_.6fr]">
        <Panel title="Dernières alertes" subtitle="Calculées en direct à partir des seuils + historique Supabase" icon={<Bell />}>
          <div className="mb-4 flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`rounded-full border px-4 py-1.5 text-xs font-bold transition ${
                  filter === item.key
                    ? 'border-amber-400/40 bg-amber-400/15 text-amber-300'
                    : 'border-slate-500/20 text-slate-500 hover:text-slate-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {visible.length === 0 ? (
              <div className="panel-soft flex flex-col items-center justify-center rounded-2xl border-dashed px-4 py-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                  <CheckCheck className="h-6 w-6" />
                </div>
                <p className="font-bold text-white">Aucune alerte</p>
                <p className="mt-1 text-sm text-slate-500">Tous les travailleurs sont dans les seuils de sécurité.</p>
              </div>
            ) : (
              visible.map((alert) => (
                <AlertRow key={alert.id} alert={alert} onRead={() => markRead(alert)} onDismiss={() => dismiss(alert.id)} />
              ))
            )}
          </div>

          {dismissedIds.length > 0 && (
            <button
              type="button"
              onClick={() => setDismissedIds([])}
              className="mt-4 text-xs font-semibold text-slate-500 transition hover:text-amber-300"
            >
              Réafficher les alertes masquées ({dismissedIds.length})
            </button>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Seuils d'alerte" subtitle="Quand déclencher une alerte" icon={<SlidersHorizontal />}>
            <div className="space-y-6">
              <ThresholdSlider
                label="Rythme cardiaque max"
                icon={<HeartPulse className="h-4 w-4 text-rose-400" />}
                value={draft.heartRateMax}
                display={`> ${draft.heartRateMax} bpm`}
                min={80}
                max={180}
                onChange={(v) => setDraft({ ...draft, heartRateMax: v })}
              />
              <ThresholdSlider
                label="Température de l'air max"
                icon={<Thermometer className="h-4 w-4 text-orange-400" />}
                value={draft.temperatureMax}
                display={`> ${draft.temperatureMax} °C`}
                min={20}
                max={50}
                onChange={(v) => setDraft({ ...draft, temperatureMax: v })}
              />
              <ThresholdSlider
                label="Humidité de l'air max"
                icon={<Droplets className="h-4 w-4 text-sky-400" />}
                value={draft.humidityMax}
                display={`> ${draft.humidityMax} %`}
                min={30}
                max={95}
                onChange={(v) => setDraft({ ...draft, humidityMax: v })}
              />
              <ThresholdSlider
                label="Seuil de détection d'obstacle"
                icon={<Radar className="h-4 w-4 text-violet-400" />}
                value={draft.obstacleDistance}
                display={`≤ ${draft.obstacleDistance} cm`}
                min={5}
                max={200}
                step={5}
                onChange={(v) => setDraft({ ...draft, obstacleDistance: v })}
              />
              <ThresholdSlider
                label="Mouvement anormal (score)"
                icon={<Activity className="h-4 w-4 text-red-400" />}
                value={draft.motionMax}
                display={`> ${draft.motionMax} / 100`}
                min={30}
                max={100}
                onChange={(v) => setDraft({ ...draft, motionMax: v })}
              />
              <ThresholdSlider
                label="Seuil d'immobilité (score)"
                icon={<PersonStanding className="h-4 w-4 text-amber-400" />}
                value={draft.motionStill}
                display={`≤ ${draft.motionStill} / 100`}
                min={1}
                max={20}
                onChange={(v) => setDraft({ ...draft, motionStill: v })}
              />
              <ThresholdSlider
                label="Durée d'immobilité avant alerte"
                icon={<PersonStanding className="h-4 w-4 text-emerald-400" />}
                value={draft.noMotionMinutes}
                display={`> ${draft.noMotionMinutes} min`}
                min={1}
                max={15}
                onChange={(v) => setDraft({ ...draft, noMotionMinutes: v })}
              />
            </div>

            <div className="mt-6 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={resetThresholds}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-amber-300"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Valeurs par défaut
              </button>
              <PrimaryButton onClick={handleSave} icon={<Check />} label={saved ? 'Enregistré ✓' : 'Enregistrer'} />
            </div>
            <p className="mt-3 text-[11px] text-slate-600">Les seuils sont enregistrés sur cet appareil et appliqués à toutes les pages.</p>
          </Panel>

          <Panel title="Dernières mesures" subtitle="Par travailleur" icon={<HeartPulse />}>
            <div className="space-y-2">
              {workerStatus.length === 0 ? (
                <EmptyState text="Aucune mesure disponible" />
              ) : (
                workerStatus.slice(0, 8).map((w) => (
                  <div key={w.workerId} className="panel-soft flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">{w.name}</p>
                      <p className="text-[11px] text-slate-500">{w.matricule ?? '—'}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-bold">
                      <span className="text-rose-300">{fmt(w.heartRate)} bpm</span>
                      <span className="text-orange-300">{fmt(w.temperature, 1)}°</span>
                      <MotionBadge motion={w.motion} thresholds={thresholds} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-500/10 px-1 py-5 text-xs text-slate-600">
        <p>Safe Worker · Industrial Monitor · Alertes</p>
        <p>
          Mis à jour le {date} à {time}
        </p>
      </footer>
    </AppLayout>
  );
}

function AlertRow({ alert, onRead, onDismiss }) {
  const style = SEVERITY[alert.severity] ?? SEVERITY.warning;
  const Icon = TYPE_ICON[alert.type] ?? Bell;
  const meta = ALERT_TYPES[alert.type] ?? ALERT_TYPES.other;

  return (
    <div
      className={`panel-soft relative flex flex-wrap items-center gap-4 overflow-hidden rounded-2xl p-4 transition ${
        alert.read ? 'opacity-55' : 'hover:border-amber-400/25'
      }`}
    >
      <span className={`absolute bottom-3 left-0 top-3 w-1 rounded-r-full ${style.bar}`} />

      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${style.icon}`}>
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-[200px] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold text-white">{alert.worker}</p>
          {alert.matricule && <span className="text-xs text-slate-500">{alert.matricule}</span>}
          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${style.badge}`}>
            {style.label}
          </span>
          <span className="rounded-full border border-slate-500/20 px-2 py-0.5 text-[10px] text-slate-500">
            {alert.source === 'live' ? 'Temps réel' : 'Historique'}
          </span>
          {!alert.read && <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.8)]" />}
        </div>
        <p className="mt-1 text-sm leading-6 text-slate-400">{alert.message}</p>
        <p className="mt-0.5 text-xs text-slate-600">
          {alert.deviceId ?? 'Bracelet'} · {alert.time ? formatTime(alert.time) : '—'}
        </p>
      </div>

      <div className="text-right">
        <p className="text-2xl font-black leading-none text-white">
          {alert.value != null ? alert.value : '—'}
          <span className="ml-1 text-sm font-medium text-slate-500">{meta.unit}</span>
        </p>
        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{meta.label}</p>
      </div>

      <div className="flex gap-2">
        {!alert.read && (
          <button
            type="button"
            onClick={onRead}
            title="Marquer comme lu"
            className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-2 text-amber-300 transition hover:bg-amber-400/20"
          >
            <Check className="h-4 w-4" />
          </button>
        )}
        <button type="button" onClick={onDismiss} title="Masquer" className="btn-ghost rounded-xl p-2">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ThresholdSlider({ label, icon, value, display, min, max, step = 1, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-slate-400">
          {icon}
          {label}
        </span>
        <span className="font-black text-white">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="threshold-range mt-3"
      />
    </div>
  );
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // stockage indisponible
  }
}
