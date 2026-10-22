import { useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Cpu,
  Download,
  Droplets,
  FileSpreadsheet,
  FileText,
  HeartPulse,
  PersonStanding,
  Printer,
  Radar,
  RefreshCw,
  Save,
  Sparkles,
  Thermometer,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import AppLayout from '../components/AppLayout';
import {
  ActionButton,
  Avatar,
  EmptyState,
  KpiCard,
  LevelBadge,
  Notice,
  OnlineBadge,
  PageHeader,
  Panel,
  PrimaryButton,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useSelectedWorker } from '../context/SelectedWorkerContext';
import { useThresholds } from '../context/ThresholdsContext';
import { useTheme } from '../context/ThemeContext';
import { useDashboard, useLiveClock } from '../hooks/useDashboard';
import { fmt, formatDateTime, isSupervisorRole, isWorkerRole } from '../utils/metrics';

export default function Reports() {
  const { user } = useAuth();
  const { selectedWorkerId, setSelectedWorkerId } = useSelectedWorker();
  const { thresholds } = useThresholds();
  const { isLight } = useTheme();
  const reportRef = useRef(null);

  const [reportWorkerId, setReportWorkerId] = useState(selectedWorkerId || 'all');
  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const canView = isSupervisorRole(user?.role) || isWorkerRole(user?.role);
  const { data, loading, error, refresh } = useDashboard(canView ? user : null, null);
  const now = useLiveClock();
  const { date, time } = formatDateTime(now);
  const { workerStatus, sidebar, site, shift } = data;

  const rows = useMemo(() => {
    const list = reportWorkerId === 'all' ? workerStatus : workerStatus.filter((w) => w.workerId === reportWorkerId);
    return [...list].sort((a, b) => (b.avgHeartRate ?? -1) - (a.avgHeartRate ?? -1));
  }, [workerStatus, reportWorkerId]);

  const totals = useMemo(() => {
    const avg = (key) => {
      const values = rows.map((r) => r[key]).filter((v) => v != null);
      return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
    };
    return {
      workers: rows.length,
      online: rows.filter((r) => r.online).length,
      avgHeartRate: avg('avgHeartRate'),
      maxHeartRate: rows.reduce((m, r) => Math.max(m, r.maxHeartRate ?? 0), 0) || null,
      avgTemperature: avg('avgTemperature'),
      avgHumidity: avg('avgHumidity'),
      obstacles: rows.reduce((s, r) => s + r.obstacleCount, 0),
      motionRate: avg('motionRate'),
      readings: rows.reduce((s, r) => s + r.readingsCount, 0),
      issues: rows.reduce((s, r) => s + r.issues.length, 0),
    };
  }, [rows]);

  const hrChart = useMemo(
    () =>
      rows.slice(0, 12).map((r) => ({
        name: shortName(r.name),
        avg: r.avgHeartRate != null ? Math.round(r.avgHeartRate) : 0,
        max: r.maxHeartRate != null ? Math.round(r.maxHeartRate) : 0,
      })),
    [rows],
  );

  const envChart = useMemo(
    () =>
      rows.slice(0, 12).map((r) => ({
        name: shortName(r.name),
        temperature: r.avgTemperature != null ? Number(r.avgTemperature.toFixed(1)) : 0,
        humidity: r.avgHumidity != null ? Math.round(r.avgHumidity) : 0,
      })),
    [rows],
  );

  const highlights = useMemo(() => {
    const top = (key, dir = 'max') =>
      rows.reduce((best, r) => {
        if (r[key] == null) return best;
        if (!best) return r;
        return dir === 'max' ? (r[key] > best[key] ? r : best) : r[key] < best[key] ? r : best;
      }, null);

    const hr = top('maxHeartRate');
    const hot = top('maxTemperature');
    const obs = top('obstacleCount');
    const brusque = top('maxMotion');

    return [
      { label: 'Rythme cardiaque le plus élevé', worker: hr?.name, value: hr ? `${fmt(hr.maxHeartRate)} bpm` : '—', icon: <HeartPulse />, tone: 'text-rose-300 bg-rose-400/10' },
      { label: 'Environnement le plus chaud', worker: hot?.name, value: hot ? `${fmt(hot.maxTemperature, 1)} °C` : '—', icon: <Thermometer />, tone: 'text-orange-300 bg-orange-400/10' },
      { label: "Plus d'obstacles détectés", worker: obs?.name, value: obs ? `${obs.obstacleCount} détection(s)` : '—', icon: <Radar />, tone: 'text-violet-300 bg-violet-400/10' },
      { label: 'Mouvement le plus brusque', worker: brusque?.name, value: brusque ? `${fmt(brusque.maxMotion)}/100` : '—', icon: <PersonStanding />, tone: 'text-emerald-300 bg-emerald-400/10' },
    ];
  }, [rows]);

  const insights = useMemo(() => {
    const list = [];
    const overHr = rows.filter((r) => r.maxHeartRate != null && r.maxHeartRate > thresholds.heartRateMax);
    if (overHr.length) {
      list.push(
        `${overHr.length} travailleur(s) ont dépassé le seuil cardiaque de ${thresholds.heartRateMax} bpm (${overHr
          .map((r) => r.name)
          .join(', ')}). Prévoir des pauses de récupération.`,
      );
    } else if (totals.avgHeartRate != null) {
      list.push(`Aucun dépassement du seuil cardiaque (${thresholds.heartRateMax} bpm). Moyenne de l'atelier : ${fmt(totals.avgHeartRate)} bpm.`);
    }

    if (totals.avgTemperature != null) {
      list.push(
        totals.avgTemperature > thresholds.temperatureMax
          ? `Température moyenne élevée (${fmt(totals.avgTemperature, 1)} °C). Risque de stress thermique : renforcer la ventilation et l'hydratation.`
          : `Température ambiante moyenne de ${fmt(totals.avgTemperature, 1)} °C, sous le seuil de ${thresholds.temperatureMax} °C.`,
      );
    }

    if (totals.avgHumidity != null && totals.avgHumidity > thresholds.humidityMax) {
      list.push(`Humidité moyenne de ${fmt(totals.avgHumidity)} %, au-dessus du seuil de ${thresholds.humidityMax} %.`);
    }

    if (totals.obstacles > 0) {
      list.push(
        `${totals.obstacles} obstacle(s) détecté(s) à moins de ${thresholds.obstacleDistance} cm pendant le poste. Vérifier le dégagement des allées.`,
      );
    }

    const immobile = rows.filter((r) => r.immobileMinutes >= thresholds.noMotionMinutes);
    if (immobile.length) {
      list.push(`${immobile.map((r) => r.name).join(', ')} : immobile depuis plus de ${thresholds.noMotionMinutes} min. Vérifier la situation.`);
    }

    const abnormal = rows.filter((r) => r.abnormalMotionCount > 0);
    if (abnormal.length) {
      list.push(
        `Mouvements anormaux (> ${thresholds.motionMax}/100) détectés chez ${abnormal
          .map((r) => `${r.name} (${r.abnormalMotionCount})`)
          .join(', ')}. Chute ou choc possible : vérifier ces événements.`,
      );
    }

    return list.length ? list : ['Pas encore assez de mesures pour générer une analyse automatique.'];
  }, [rows, totals, thresholds]);

  function handleWorkerChange(event) {
    const value = event.target.value;
    setReportWorkerId(value);
    if (value !== 'all') setSelectedWorkerId(value);
  }

  function handleSaveNotes() {
    try {
      localStorage.setItem(`iwm-report-notes-${shift?.id || 'current'}`, notes);
    } catch {
      // ignore
    }
    setNotesSaved(true);
    window.setTimeout(() => setNotesSaved(false), 2200);
  }

  function reportFileName() {
    return `${slugify(shift?.name || 'rapport-poste')}-${new Date().toISOString().slice(0, 10)}`;
  }

  function exportCsv() {
    const table = [
      [
        'Travailleur',
        'Matricule',
        'Poste',
        'FC moyenne (bpm)',
        'FC max (bpm)',
        'Température moy. (°C)',
        'Humidité moy. (%)',
        'Distance obstacle min. (cm)',
        'Obstacles détectés',
        'Temps en mouvement (%)',
        'Intensité moyenne (/100)',
        'Intensité max (/100)',
        'Mouvements anormaux',
        'Statut',
        'Connexion',
      ],
      ...rows.map((r) => [
        r.name,
        r.matricule ?? '',
        r.jobTitle ?? '',
        fmt(r.avgHeartRate),
        fmt(r.maxHeartRate),
        fmt(r.avgTemperature, 1),
        fmt(r.avgHumidity),
        fmt(r.minObstacle),
        r.obstacleCount,
        fmt(r.motionRate),
        fmt(r.avgMotion),
        fmt(r.maxMotion),
        r.abnormalMotionCount,
        { ok: 'Normal', warning: 'Attention', critical: 'Critique' }[r.level],
        r.online ? 'En ligne' : 'Hors ligne',
      ]),
    ];

    const csv = table.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(';')).join('\n');
    downloadBlob(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' }), `${reportFileName()}.csv`);
  }

  async function exportPdf() {
    if (!reportRef.current || isExporting) return;
    setIsExporting(true);

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')]);

      const canvas = await html2canvas(reportRef.current, {
        scale: 1.7,
        backgroundColor: isLight ? '#eef1f5' : '#0a0d11',
        useCORS: true,
        logging: false,
        windowWidth: reportRef.current.scrollWidth,
      });

      const imageData = canvas.toDataURL('image/png', 0.95);
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const printableWidth = pageWidth - margin * 2;
      const imageHeight = (canvas.height * printableWidth) / canvas.width;
      const printableHeight = pageHeight - margin * 2;

      let remaining = imageHeight;
      pdf.addImage(imageData, 'PNG', margin, margin, printableWidth, imageHeight, undefined, 'FAST');
      remaining -= printableHeight;

      while (remaining > 0) {
        pdf.addPage();
        pdf.addImage(imageData, 'PNG', margin, margin - (imageHeight - remaining), printableWidth, imageHeight, undefined, 'FAST');
        remaining -= printableHeight;
      }

      pdf.save(`${reportFileName()}.pdf`);
    } catch (exportError) {
      console.error('PDF export failed:', exportError);
      window.alert("L'export PDF a échoué.");
    } finally {
      setIsExporting(false);
    }
  }

  const tooltipStyle = {
    background: isLight ? '#ffffff' : '#12171e',
    border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(245,158,11,0.2)',
    borderRadius: '12px',
    color: isLight ? '#0f172a' : '#e2e8f0',
    fontSize: 12,
  };
  const gridStroke = isLight ? '#e2e8f0' : 'rgba(148,163,184,0.1)';

  return (
    <AppLayout stats={sidebar} loading={loading}>
      <div ref={reportRef}>
        <PageHeader
          eyebrow="Rapport de poste"
          eyebrowIcon={<FileText />}
          title={shift?.name || 'Poste de travail en cours'}
          subtitle={`${site?.name || 'Atelier'} · ${shift?.status === 'finished' ? 'Terminé' : 'Données en direct'} · ${totals.workers} travailleur(s)`}
          actions={
            <>
              <ActionButton onClick={refresh} icon={<RefreshCw />} label="Actualiser" />
              <ActionButton onClick={exportCsv} icon={<FileSpreadsheet />} label="Excel" />
              <ActionButton onClick={() => window.print()} icon={<Printer />} label="Imprimer" />
              <PrimaryButton onClick={exportPdf} disabled={isExporting} icon={<Download />} label={isExporting ? 'Génération…' : 'Export PDF'} />
            </>
          }
        />

        {error && (
          <Notice tone="red" title="Erreur">
            {error}
          </Notice>
        )}

        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3 print:hidden">
          <FilterField label="Atelier">
            <select className="report-select" value={site?.id || 'current'} disabled>
              <option value={site?.id || 'current'}>{site?.name || 'Atelier actuel'}</option>
            </select>
          </FilterField>
          <FilterField label="Poste">
            <select className="report-select" value={shift?.id || 'current'} disabled>
              <option value={shift?.id || 'current'}>{shift?.name || 'Poste actuel'}</option>
            </select>
          </FilterField>
          <FilterField label="Travailleur">
            <select className="report-select" value={reportWorkerId} onChange={handleWorkerChange}>
              <option value="all">Tous les travailleurs</option>
              {workerStatus.map((w) => (
                <option key={w.workerId} value={w.workerId}>
                  {w.name}
                </option>
              ))}
            </select>
          </FilterField>
        </section>

        <section className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard title="Durée" value={formatDuration(shift)} subtitle="Depuis le début du poste" icon={<Calendar />} tone="amber" />
          <KpiCard title="Travailleurs" value={totals.workers} subtitle={`${totals.online} en ligne`} icon={<Users />} tone="amber" />
          <KpiCard
            title="FC moyenne"
            value={fmt(totals.avgHeartRate)}
            unit="bpm"
            subtitle={`Max ${fmt(totals.maxHeartRate)} bpm`}
            icon={<HeartPulse />}
            tone="rose"
            alert={totals.maxHeartRate > thresholds.heartRateMax}
          />
          <KpiCard
            title="Temp. / Humidité"
            value={`${fmt(totals.avgTemperature, 1)}°`}
            unit={`/ ${fmt(totals.avgHumidity)} %`}
            subtitle="Moyenne du poste"
            icon={<Droplets />}
            tone="sky"
          />
          <KpiCard title="Obstacles" value={totals.obstacles} subtitle={`≤ ${thresholds.obstacleDistance} cm`} icon={<Radar />} tone="violet" />
          <KpiCard
            title="Mouvement"
            value={fmt(totals.motionRate)}
            unit="%"
            subtitle={`Temps en mouvement (score > ${thresholds.motionStill})`}
            icon={<PersonStanding />}
            tone="green"
            progress={totals.motionRate}
          />
        </section>

        <Panel className="mb-6" title="Synthèse par travailleur" subtitle="Moyennes et maximums sur le poste" icon={<Users />}>
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[1150px] border-collapse whitespace-nowrap text-left">
              <thead>
                <tr className="border-y border-slate-500/10 bg-black/10 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                  <th className="px-5 py-3">Travailleur</th>
                  <th className="px-4 py-3">FC moy.</th>
                  <th className="px-4 py-3">FC max</th>
                  <th className="px-4 py-3">Temp. moy.</th>
                  <th className="px-4 py-3">Humidité moy.</th>
                  <th className="px-4 py-3">Obstacle min.</th>
                  <th className="px-4 py-3">Obstacles</th>
                  <th className="px-4 py-3">Mouvement</th>
                  <th className="px-4 py-3">Mvt max</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Bracelet</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="px-5 py-12 text-center text-sm text-slate-500">
                      Aucune donnée disponible pour ce poste.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.workerId} className="border-b border-slate-500/10 text-sm transition last:border-0 hover:bg-amber-400/[0.03]">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={r.name} photoUrl={r.photoUrl} size="h-9 w-9" />
                          <div>
                            <p className="font-bold text-white">{r.name}</p>
                            <p className="text-xs text-slate-500">
                              {r.matricule ?? '—'} · {r.jobTitle ?? '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-white">{fmt(r.avgHeartRate)} bpm</td>
                      <td className={`px-4 py-3.5 font-semibold ${r.maxHeartRate > thresholds.heartRateMax ? 'text-red-400' : ''}`}>
                        {fmt(r.maxHeartRate)} bpm
                      </td>
                      <td className={`px-4 py-3.5 ${r.avgTemperature > thresholds.temperatureMax ? 'text-red-400' : ''}`}>
                        {fmt(r.avgTemperature, 1)} °C
                      </td>
                      <td className={`px-4 py-3.5 ${r.avgHumidity > thresholds.humidityMax ? 'text-red-400' : ''}`}>
                        {fmt(r.avgHumidity)} %
                      </td>
                      <td className={`px-4 py-3.5 ${r.minObstacle != null && r.minObstacle <= thresholds.obstacleDistance ? 'text-red-400' : ''}`}>
                        {fmt(r.minObstacle)} cm
                      </td>
                      <td className="px-4 py-3.5">{r.obstacleCount}</td>
                      <td className="px-4 py-3.5">
                        <MotionBar value={r.motionRate} />
                      </td>
                      <td className={`px-4 py-3.5 font-semibold ${r.maxMotion > thresholds.motionMax ? 'text-red-400' : ''}`}>
                        {fmt(r.maxMotion)}/100
                      </td>
                      <td className="px-4 py-3.5">
                        <LevelBadge level={r.level} />
                      </td>
                      <td className="px-4 py-3.5">
                        <OnlineBadge online={r.online} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Panel title="Rythme cardiaque par travailleur" subtitle="Moyenne et maximum (bpm)" icon={<HeartPulse />}>
            <div className="h-72">
              {hrChart.length === 0 ? (
                <EmptyState text="Aucune donnée cardiaque" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hrChart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(245,158,11,0.04)' }} contentStyle={tooltipStyle} />
                    <ReferenceLine y={thresholds.heartRateMax} stroke="#ef4444" strokeDasharray="6 4" />
                    <Bar isAnimationActive={false} dataKey="avg" name="Moyenne" fill="#fb7185" radius={[6, 6, 0, 0]} />
                    <Bar isAnimationActive={false} dataKey="max" name="Maximum" radius={[6, 6, 0, 0]}>
                      {hrChart.map((entry, i) => (
                        <Cell key={i} fill={entry.max > thresholds.heartRateMax ? '#ef4444' : 'rgba(251,113,133,0.45)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Panel>

          <Panel title="Environnement par travailleur" subtitle="Température (°C) et humidité (%) moyennes" icon={<Thermometer />}>
            <div className="h-72">
              {envChart.length === 0 ? (
                <EmptyState text="Aucune donnée environnementale" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={envChart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(245,158,11,0.04)' }} contentStyle={tooltipStyle} />
                    <Bar isAnimationActive={false} dataKey="temperature" name="Température (°C)" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                    <Bar isAnimationActive={false} dataKey="humidity" name="Humidité (%)" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Panel>
        </section>

        <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Panel title="Points d'attention" subtitle="Valeurs extrêmes du poste" icon={<TriangleAlert />}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {highlights.map((h) => (
                <div key={h.label} className="panel-soft rounded-2xl p-4">
                  <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl [&>svg]:h-5 [&>svg]:w-5 ${h.tone}`}>{h.icon}</div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{h.label}</p>
                  <p className="mt-2 font-bold text-white">{h.worker || 'Aucune donnée'}</p>
                  <p className="mt-1 text-sm font-semibold text-amber-400">{h.value}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Analyse automatique" subtitle="Générée à partir des mesures et des seuils" icon={<Sparkles />}>
            <div className="space-y-3">
              {insights.map((text, i) => (
                <div key={i} className="panel-soft flex gap-3 rounded-2xl p-4">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-xs font-black text-amber-300">
                    {i + 1}
                  </div>
                  <p className="text-sm leading-6 text-slate-300">{text}</p>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_.7fr]">
          <Panel title="Notes du superviseur" subtitle="Observations et actions de suivi" icon={<FileText />}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observations sur le poste, conditions de travail, incidents, actions correctives..."
              className="field-input min-h-48 resize-y leading-6"
            />
            <div className="mt-3 flex items-center justify-between print:hidden">
              <p className="text-xs text-slate-600">Notes enregistrées sur cet appareil.</p>
              <ActionButton onClick={handleSaveNotes} icon={<Save />} label={notesSaved ? 'Enregistré ✓' : 'Enregistrer'} />
            </div>
          </Panel>

          <Panel title="Qualité des données" subtitle="Capteurs et intégrité du rapport" icon={<Cpu />}>
            <div className="space-y-3">
              <QualityRow label="Bracelets assignés" value={sidebar.devices} ok={sidebar.devices > 0} />
              <QualityRow label="Bracelets en ligne" value={sidebar.onlineDevices} ok={sidebar.onlineDevices > 0} />
              <QualityRow label="Mesures analysées" value={totals.readings} ok={totals.readings > 0} />
              <QualityRow label="Alertes en cours" value={totals.issues} ok={totals.issues === 0} />
              <QualityRow label="Rapport généré" value={`${date} · ${time}`} ok />
            </div>
          </Panel>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-500/10 px-1 py-5 text-xs text-slate-600">
          <p>
            Safe Worker · {site?.name || 'Atelier'} · {shift?.name || 'Poste actuel'}
          </p>
          <p>
            Généré le {date} à {time}
          </p>
        </footer>
      </div>
    </AppLayout>
  );
}

function FilterField({ label, children }) {
  return (
    <label className="panel rounded-2xl p-4">
      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function MotionBar({ value }) {
  if (value == null) return <span className="text-slate-600">—</span>;
  const v = Math.max(0, Math.min(100, value));
  const color = v < 40 ? 'bg-red-500' : v < 70 ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-black/30">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${v}%` }} />
      </div>
      <span className="text-xs font-bold">{Math.round(v)}%</span>
    </div>
  );
}

function QualityRow({ label, value, ok }) {
  return (
    <div className="panel-soft flex items-center justify-between rounded-xl px-3.5 py-3">
      <span className="text-sm text-slate-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${ok ? 'bg-emerald-400' : 'bg-amber-400'}`} />
        <span className="text-sm font-bold text-white">{value}</span>
      </div>
    </div>
  );
}

function shortName(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name.slice(0, 10);
  return `${parts[0][0]}. ${parts.at(-1)}`.slice(0, 12);
}

function formatDuration(shift) {
  const start = shift?.started_at || shift?.date;
  if (!start) return '—';
  const end = shift.ended_at ? new Date(shift.ended_at) : new Date();
  const minutes = Math.max(0, Math.floor((end - new Date(start)) / 60000));
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function slugify(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
