import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Bell,
  Calendar,
  Cpu,
  Droplets,
  Factory,
  HeartPulse,
  PersonStanding,
  Radar,
  RefreshCw,
  Thermometer,
  Users,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import AppLayout from '../components/AppLayout';
import RiskPanel from '../components/RiskPanel';
import {
  ActionButton,
  Avatar,
  EmptyState,
  KpiCard,
  LEVEL_META,
  LevelBadge,
  Notice,
  OnlineBadge,
  PageHeader,
  Panel,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useSelectedWorker } from '../context/SelectedWorkerContext';
import { useThresholds } from '../context/ThresholdsContext';
import { useTheme } from '../context/ThemeContext';
import { useDashboard, useLiveClock } from '../hooks/useDashboard';
import {
  ALERT_TYPES,
  METRICS,
  fmt,
  formatDateTime,
  formatTime,
  isSupervisorRole,
  isWorkerRole,
  motionLabel,
} from '../utils/metrics';

const CHART_TABS = [
  { key: 'heartRate', label: 'Rythme cardiaque', thresholdKey: 'heartRateMax' },
  { key: 'temperature', label: 'Température', thresholdKey: 'temperatureMax' },
  { key: 'humidity', label: 'Humidité', thresholdKey: 'humidityMax' },
];

export default function Dashboard() {
  const { user } = useAuth();
  const { selectedWorkerId, setSelectedWorkerId, clearSelectedWorker } = useSelectedWorker();
  const { thresholds } = useThresholds();
  const { isLight } = useTheme();
  const navigate = useNavigate();
  const [chartTab, setChartTab] = useState('heartRate');

  const canView = isSupervisorRole(user?.role) || isWorkerRole(user?.role);
  const { data, loading, error, refresh } = useDashboard(canView ? user : null, selectedWorkerId);
  const now = useLiveClock();
  const { date, time } = formatDateTime(now);

  const chart = useMemo(
    () =>
      isLight
        ? { grid: '#e2e8f0', axis: '#64748b', tipBg: '#ffffff', tipBorder: '1px solid #e2e8f0', tipText: '#0f172a' }
        : {
            grid: 'rgba(148,163,184,0.1)',
            axis: '#64748b',
            tipBg: '#12171e',
            tipBorder: '1px solid rgba(245,158,11,0.2)',
            tipText: '#e2e8f0',
          },
    [isLight],
  );

  const tooltipStyle = {
    backgroundColor: chart.tipBg,
    border: chart.tipBorder,
    borderRadius: '10px',
    color: chart.tipText,
    fontSize: 12,
  };

  const { kpis, sidebar, workerStatus, scopedStatus, timeline, heartZones, events, unreadAlerts, site, shift, selectedWorker } =
    data;

  const activeTab = CHART_TABS.find((tab) => tab.key === chartTab);
  const activeMetric = METRICS[chartTab];
  const activeAlerts = workerStatus.reduce((sum, w) => sum + w.issues.length, 0);

  function handleSelectWorker(workerId) {
    if (!workerId) return;
    setSelectedWorkerId(workerId === selectedWorkerId ? null : workerId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <AppLayout stats={sidebar} alertCount={activeAlerts} loading={loading}>
      <PageHeader
        live
        eyebrow="Centre de surveillance en direct"
        title={selectedWorker?.name || `Vue d'ensemble${site ? ` — ${site.name}` : ''}`}
        subtitle={
          <>
            {shift ? `${shift.name || 'Poste'} · ${shiftStatusLabel(shift.status)}` : 'Suivi en temps réel'}
            {site && <span className="text-slate-500"> · {site.name}</span>}
            {selectedWorker && (
              <span className="text-amber-400">
                {' '}
                · {selectedWorker.job_title || 'Travailleur'} {selectedWorker.matricule ? `(${selectedWorker.matricule})` : ''}
              </span>
            )}
          </>
        }
        actions={
          <>
            {selectedWorker && isSupervisorRole(user?.role) && (
              <ActionButton onClick={clearSelectedWorker} icon={<X />} label="Tout l'atelier" />
            )}
            <button type="button" onClick={refresh} className="btn-ghost group rounded-xl p-2.5" title="Actualiser">
              <RefreshCw className="h-5 w-5 transition group-hover:rotate-90" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/alerts')}
              className="btn-ghost relative rounded-xl p-2.5"
              title="Alertes"
            >
              <Bell className="h-5 w-5" />
              {activeAlerts + unreadAlerts > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white">
                  {activeAlerts + unreadAlerts > 9 ? '9+' : activeAlerts + unreadAlerts}
                </span>
              )}
            </button>
            <div className="btn-ghost flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm">
              <Calendar className="h-4 w-4 text-amber-400" />
              <span>{date}</span>
              <span className="text-slate-600">|</span>
              <span className="font-semibold text-white">{time}</span>
            </div>
          </>
        }
      />

      {!canView && (
        <Notice tone="amber" title="Accès restreint">
          Seuls les superviseurs et les travailleurs peuvent consulter les mesures.
        </Notice>
      )}

      {canView && error && (
        <Notice tone="red" title="Erreur">
          {error}
        </Notice>
      )}

      {canView && !loading && !site && (
        <Notice tone="amber" icon={<Factory />} title="Aucun atelier trouvé">
          Exécute <code>supabase/schema.sql</code> puis <code>supabase/seed-demo.sql</code> dans Supabase pour créer un atelier
          de démonstration, ou crée un atelier lié à ton compte superviseur.
        </Notice>
      )}

      {canView && (
        <>
          {/* ---------- KPIs ---------- */}
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <KpiCard
              title="Travailleurs"
              value={kpis.totalWorkers}
              subtitle={`${kpis.connectedWorkers} en ligne`}
              icon={<Users />}
              tone="amber"
            />
            <KpiCard
              title="Rythme cardiaque"
              value={fmt(kpis.avgHeartRate)}
              unit="bpm"
              subtitle={`Max ${fmt(kpis.maxHeartRate)} bpm · seuil ${thresholds.heartRateMax}`}
              icon={<HeartPulse className="animate-heartbeat" />}
              tone="rose"
              alert={kpis.maxHeartRate > thresholds.heartRateMax}
            />
            <KpiCard
              title="Température air"
              value={fmt(kpis.avgTemperature, 1)}
              unit="°C"
              subtitle={`Seuil ${thresholds.temperatureMax} °C`}
              icon={<Thermometer />}
              tone="orange"
              alert={kpis.avgTemperature > thresholds.temperatureMax}
            />
            <KpiCard
              title="Humidité air"
              value={fmt(kpis.avgHumidity)}
              unit="%"
              subtitle={`Seuil ${thresholds.humidityMax} %`}
              icon={<Droplets />}
              tone="sky"
              progress={kpis.avgHumidity}
            />
            <KpiCard
              title="Obstacles détectés"
              value={kpis.obstacleCount}
              subtitle={`${kpis.obstaclesNow} en ce moment · seuil ${thresholds.obstacleDistance} cm`}
              icon={<Radar />}
              tone="violet"
              alert={kpis.obstaclesNow > 0}
            />
            <KpiCard
              title="Mouvement"
              value={fmt(kpis.avgMotion)}
              unit="/100"
              subtitle={
                kpis.abnormalWorkers > 0
                  ? `${kpis.abnormalWorkers} mouvement(s) anormal(aux)`
                  : kpis.immobileWorkers > 0
                    ? `${kpis.immobileWorkers} immobile(s) · seuil ${thresholds.motionMax}`
                    : `${kpis.movingWorkers} actif(s) · seuil ${thresholds.motionMax}`
              }
              icon={<PersonStanding />}
              tone="green"
              alert={kpis.abnormalWorkers > 0 || kpis.immobileWorkers > 0}
            />
          </div>

          {/* ---------- Analyse IA : travailleur sélectionné, sinon le plus à risque ---------- */}
          <div className="mb-6">
            <RiskPanel
              worker={
                selectedWorker
                  ? scopedStatus[0]
                  : [...workerStatus].sort((a, b) => (b.ai?.score ?? -1) - (a.ai?.score ?? -1))[0]
              }
              onOpen={selectedWorker ? undefined : handleSelectWorker}
            />
          </div>

          {/* ---------- État des travailleurs + graphique principal ---------- */}
          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Panel
              title="État des travailleurs"
              subtitle="Cliquez sur un travailleur pour ouvrir son suivi"
              icon={<Users />}
            >
              <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
                {workerStatus.length === 0 ? (
                  <EmptyState text="Aucun travailleur dans cet atelier" />
                ) : (
                  workerStatus.map((worker) => (
                    <WorkerRow key={worker.workerId} worker={worker} thresholds={thresholds} onClick={handleSelectWorker} />
                  ))
                )}
              </div>
            </Panel>

            <Panel
              className="lg:col-span-2"
              title={`${activeMetric.label} en temps réel`}
              subtitle={selectedWorker ? selectedWorker.name : "Moyenne de l'atelier, par minute"}
              icon={<Activity />}
              action={
                <div className="flex flex-wrap gap-1.5">
                  {CHART_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setChartTab(tab.key)}
                      className={`rounded-full border px-3 py-1 text-[11px] font-bold transition ${
                        chartTab === tab.key
                          ? 'border-amber-400/40 bg-amber-400/15 text-amber-300'
                          : 'border-slate-500/20 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              }
            >
              <div className="h-[300px]">
                {timeline.length === 0 ? (
                  <EmptyState text="En attente des mesures des capteurs" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="metricFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={activeMetric.color} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={activeMetric.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                      <XAxis dataKey="time" stroke={chart.axis} fontSize={10} tickLine={false} axisLine={false} minTickGap={24} />
                      <YAxis stroke={chart.axis} fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value) => [`${value} ${activeMetric.unit}`, activeMetric.label]}
                      />
                      <ReferenceLine
                        y={thresholds[activeTab.thresholdKey]}
                        stroke="#ef4444"
                        strokeDasharray="6 4"
                        label={{ value: `Seuil ${thresholds[activeTab.thresholdKey]}`, fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }}
                      />
                      <Area isAnimationActive={false}
                        type="monotone"
                        dataKey={chartTab}
                        stroke={activeMetric.color}
                        strokeWidth={2.2}
                        fill="url(#metricFill)"
                        dot={false}
                        connectNulls
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Panel>
          </div>

          {/* ---------- Obstacles / zones cardiaques / événements ---------- */}
          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Panel
              title="Détection d'obstacles"
              subtitle={`Distance minimale mesurée · seuil ${thresholds.obstacleDistance} cm`}
              icon={<Radar />}
            >
              <div className="h-48">
                {timeline.length === 0 ? (
                  <EmptyState text="Aucune mesure d'obstacle" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timeline} margin={{ top: 10, right: 6, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                      <XAxis dataKey="time" stroke={chart.axis} fontSize={10} tickLine={false} axisLine={false} minTickGap={24} />
                      <YAxis stroke={chart.axis} fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value} cm`, 'Distance min.']} />
                      <ReferenceLine y={thresholds.obstacleDistance} stroke="#ef4444" strokeDasharray="6 4" />
                      <Line isAnimationActive={false}
                        type="monotone"
                        dataKey="obstacle"
                        stroke={METRICS.obstacle.color}
                        strokeWidth={2}
                        connectNulls
                        dot={(props) => {
                          const { cx, cy, payload, index } = props;
                          if (payload.obstacle == null || payload.obstacle > thresholds.obstacleDistance) {
                            return <g key={`dot-${index}`} />;
                          }
                          return <circle key={`dot-${index}`} cx={cx} cy={cy} r={4} fill="#ef4444" stroke="#fff" strokeWidth={1} />;
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>
                  <span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" />
                  Obstacle détecté (≤ {thresholds.obstacleDistance} cm)
                </span>
                <span className="font-bold text-white">{kpis.obstacleCount} détection(s)</span>
              </div>
            </Panel>

            <Panel title="Zones cardiaques" subtitle="Répartition du temps par intensité" icon={<HeartPulse />}>
              <div className="flex h-52 items-center">
                {heartZones.length === 0 ? (
                  <EmptyState text="Aucune mesure cardiaque" />
                ) : (
                  <>
                    <div className="h-full w-1/2">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie isAnimationActive={false} data={heartZones} innerRadius={42} outerRadius={66} paddingAngle={2} dataKey="value">
                            {heartZones.map((zone) => (
                              <Cell key={zone.name} fill={zone.color} stroke="none" />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`${value} %`, name]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-1/2 space-y-2 text-xs">
                      {heartZones.map((zone) => (
                        <div key={zone.name} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: zone.color }} />
                            <div>
                              <p className="text-slate-300">{zone.name}</p>
                              <p className="text-[10px] text-slate-500">{zone.range}</p>
                            </div>
                          </div>
                          <span className="font-bold text-white">{zone.value}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </Panel>

            <Panel title="Derniers événements" subtitle="Alertes et détections récentes" icon={<Bell />}>
              <div className="space-y-1">
                {events.length === 0 ? (
                  <EmptyState text="Aucun événement" />
                ) : (
                  events.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between gap-2 border-b border-slate-500/10 px-1 py-2.5 text-xs last:border-0"
                    >
                      <span className="w-16 shrink-0 text-slate-500">{formatTime(event.time)}</span>
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        {eventIcon(event.type)}
                        <span className="truncate">{event.label}</span>
                      </div>
                      <span className="max-w-[90px] truncate text-slate-400">{event.worker?.name?.split(' ')[0] ?? '—'}</span>
                      <span
                        className={`w-16 truncate text-right font-semibold ${
                          event.severity === 'critical' ? 'text-red-400' : 'text-amber-300'
                        }`}
                      >
                        {event.value}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </Panel>
          </div>

          {/* ---------- Mouvement + bracelets ---------- */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Panel
              title="Intensité de mouvement"
              subtitle={`Pic par minute (0–100) · immobile ≤ ${thresholds.motionStill} · anormal > ${thresholds.motionMax}`}
              icon={<PersonStanding />}
            >
              <div className="h-48">
                {timeline.length === 0 ? (
                  <EmptyState text="Aucune mesure de mouvement" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={timeline} margin={{ top: 10, right: 6, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                      <XAxis dataKey="time" stroke={chart.axis} fontSize={10} tickLine={false} axisLine={false} minTickGap={24} />
                      <YAxis stroke={chart.axis} fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value, name) => [`${value}/100`, name === 'motion' ? 'Pic' : 'Moyenne']}
                      />
                      <ReferenceLine y={thresholds.motionMax} stroke="#ef4444" strokeDasharray="6 4" />
                      <ReferenceLine y={thresholds.motionStill} stroke="#f59e0b" strokeDasharray="3 3" />
                      <Bar isAnimationActive={false} dataKey="motion" radius={[4, 4, 0, 0]}>
                        {timeline.map((entry, index) => (
                          <Cell
                            key={`m-${index}`}
                            fill={
                              entry.motion > thresholds.motionMax
                                ? '#ef4444'
                                : entry.motion <= thresholds.motionStill
                                  ? '#f59e0b'
                                  : METRICS.motion.color
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" />Immobile</span>
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />Normal</span>
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" />Anormal</span>
              </div>
            </Panel>

            <Panel
              className="lg:col-span-2"
              title="Bracelets connectés"
              subtitle="Dernière mesure reçue par travailleur"
              icon={<Cpu />}
              action={<ActionButton onClick={() => navigate('/settings')} icon={<Cpu />} label="Gérer" />}
            >
              {scopedStatus.length === 0 ? (
                <EmptyState text="Aucun bracelet enregistré" />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {scopedStatus.map((worker) => (
                    <DeviceCard key={worker.workerId} worker={worker} thresholds={thresholds} />
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </AppLayout>
  );
}

function shiftStatusLabel(status) {
  if (status === 'active') return 'En cours';
  if (status === 'finished') return 'Terminé';
  return 'Planifié';
}

function eventIcon(type) {
  const cls = 'h-4 w-4 shrink-0';
  if (type === 'heart_rate') return <HeartPulse className={`${cls} text-rose-400`} />;
  if (type === 'temperature') return <Thermometer className={`${cls} text-orange-400`} />;
  if (type === 'humidity') return <Droplets className={`${cls} text-sky-400`} />;
  if (type === 'obstacle') return <Radar className={`${cls} text-violet-400`} />;
  if (type === 'no_motion') return <PersonStanding className={`${cls} text-amber-400`} />;
  if (type === 'abnormal_motion') return <PersonStanding className={`${cls} text-red-400`} />;
  return <Bell className={`${cls} text-slate-400`} />;
}

function motionColor(motion, thresholds) {
  if (motion === null || motion === undefined) return 'text-slate-500';
  if (motion > thresholds.motionMax) return 'text-red-400';
  if (motion <= thresholds.motionStill) return 'text-amber-400';
  return 'text-emerald-400';
}

function WorkerRow({ worker, thresholds, onClick }) {
  const meta = LEVEL_META[worker.level];

  return (
    <button
      type="button"
      onClick={() => onClick(worker.workerId)}
      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400/30 ${
        worker.isSelected ? 'border-amber-400/40 bg-amber-400/[0.07]' : `${meta.ring} panel-soft`
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative">
          <Avatar name={worker.name} photoUrl={worker.photoUrl} size="h-9 w-9" />
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#12171e] ${
              worker.online ? 'bg-emerald-400' : 'bg-slate-500'
            }`}
          />
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">{worker.name}</p>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <PersonStanding className={`h-3 w-3 ${motionColor(worker.motion, thresholds)}`} />
              {worker.motion !== null ? `${Math.round(worker.motion)}/100` : '—'}
            </span>
            <span className="flex items-center gap-1">
              <Radar className={`h-3 w-3 ${worker.obstacleNow ? 'text-red-400' : 'text-slate-500'}`} />
              {worker.obstacleDistance != null ? `${Math.round(worker.obstacleDistance)} cm` : '—'}
            </span>
          </div>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p className="flex items-center justify-end gap-1 font-black text-white">
          <HeartPulse className="h-3.5 w-3.5 text-rose-400" />
          {fmt(worker.heartRate)}
          <span className="text-[10px] font-medium text-slate-500">bpm</span>
        </p>
        <div className="mt-1 flex items-center justify-end gap-1.5">
          {worker.ai && (
            <span
              title="Score de risque IA"
              className="rounded-full border px-1.5 py-0.5 text-[10px] font-black"
              style={{ color: worker.ai.level.color, borderColor: `${worker.ai.level.color}55` }}
            >
              IA {worker.ai.score}
            </span>
          )}
          <LevelBadge level={worker.level} />
        </div>
      </div>
    </button>
  );
}

function DeviceCard({ worker, thresholds }) {
  return (
    <div className={`panel-soft rounded-2xl border p-3 ${LEVEL_META[worker.level].ring}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{worker.name}</p>
          <p className="text-[11px] text-slate-500">{worker.deviceId ?? 'Aucun bracelet'}</p>
        </div>
        <OnlineBadge online={worker.online} />
      </div>
      <div className="grid grid-cols-5 gap-1 text-center">
        <Mini icon={<HeartPulse className="text-rose-400" />} value={fmt(worker.heartRate)} unit="bpm" />
        <Mini icon={<Thermometer className="text-orange-400" />} value={fmt(worker.temperature, 1)} unit="°C" />
        <Mini icon={<Droplets className="text-sky-400" />} value={fmt(worker.humidity)} unit="%" />
        <Mini
          icon={<Radar className={worker.obstacleNow ? 'text-red-400' : 'text-violet-400'} />}
          value={fmt(worker.obstacleDistance)}
          unit="cm"
        />
        <Mini
          icon={<PersonStanding className={motionColor(worker.motion, thresholds)} />}
          value={worker.motion !== null ? Math.round(worker.motion) : '—'}
          unit={motionLabel(worker.motion, thresholds).toLowerCase()}
        />
      </div>
      <p className="mt-2 text-right text-[10px] text-slate-600">
        {worker.lastSeen ? `Dernière mesure ${formatTime(worker.lastSeen)}` : 'Aucune mesure'}
      </p>
      {worker.issues.length > 0 && (
        <p className="mt-1 truncate text-[11px] text-red-300" title={worker.issues.map((i) => i.message).join('\n')}>
          ⚠ {worker.issues.map((i) => ALERT_TYPES[i.type].label).join(' · ')}
        </p>
      )}
    </div>
  );
}

function Mini({ icon, value, unit }) {
  return (
    <div className="rounded-lg bg-black/15 px-1 py-1.5">
      <div className="mx-auto mb-1 flex justify-center [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</div>
      <p className="text-xs font-black text-white">{value}</p>
      <p className="text-[9px] text-slate-500">{unit}</p>
    </div>
  );
}
