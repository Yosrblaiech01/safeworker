import { Brain, TrendingDown, TrendingUp, Minus, AlertTriangle } from 'lucide-react';
import { Panel, EmptyState } from './ui';
import { riskLevelOf } from '../utils/aiRisk';
import { formatTime } from '../utils/metrics';

function Gauge({ score }) {
  const level = riskLevelOf(score);
  const radius = 54;
  const arc = Math.PI * radius; // demi-cercle
  const filled = (Math.max(0, Math.min(score, 100)) / 100) * arc;

  return (
    <div className="relative mx-auto h-[100px] w-[150px]">
      <svg viewBox="0 0 130 72" className="h-full w-full">
        <path d="M 11 65 A 54 54 0 0 1 119 65" fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="11" strokeLinecap="round" />
        <path
          d="M 11 65 A 54 54 0 0 1 119 65"
          fill="none"
          stroke={level.color}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${arc}`}
          style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <span className="text-3xl font-black leading-none text-white">{score}</span>
        <span className="text-xs text-slate-500"> /100</span>
      </div>
    </div>
  );
}

const TREND = {
  up: { icon: TrendingUp, text: 'En hausse', cls: 'text-red-400' },
  down: { icon: TrendingDown, text: 'En baisse', cls: 'text-emerald-400' },
  flat: { icon: Minus, text: 'Stable', cls: 'text-slate-400' },
};

export default function RiskPanel({ worker, onOpen }) {
  const ai = worker?.ai;

  return (
    <Panel
      title="Analyse IA du risque"
      subtitle={
        worker
          ? `${worker.name} · ${ai?.stale ? `bracelet hors ligne, dernière mesure ${formatTime(ai.lastSeen)}` : 'mise à jour en temps réel'}`
          : 'Aucun travailleur'
      }
      icon={<Brain />}
    >
      {!ai ? (
        <EmptyState text="Aucune mesure reçue pour l'instant" />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Score actuel */}
          <div className="text-center">
            <Gauge score={ai.score} />
            <p className="mt-2 text-sm font-black uppercase tracking-wide" style={{ color: ai.level.color }}>
              Risque {ai.level.label.toLowerCase()}
            </p>
            {onOpen && (
              <button type="button" onClick={() => onOpen(worker.workerId)} className="mt-1 text-[11px] text-slate-500 underline hover:text-slate-300">
                Voir le suivi de {worker.name}
              </button>
            )}
          </div>

          {/* Facteurs */}
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Pourquoi ce score</p>
            {ai.factors.length === 0 ? (
              <p className="text-sm text-slate-400">Aucun facteur de risque détecté.</p>
            ) : (
              <ul className="space-y-2">
                {ai.factors.slice(0, 4).map((f) => (
                  <li key={f.key}>
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-200">{f.label}</span>
                      <span className="text-slate-500">{f.detail}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/30">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.round(f.f * 100)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Prévision + profil */}
          <div className="space-y-3 text-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Prévision (10 min)</p>
            {ai.forecast ? (
              (() => {
                const T = TREND[ai.forecast.trend];
                const Icon = T.icon;
                return (
                  <div className="panel-soft rounded-xl p-3">
                    <p className={`flex items-center gap-2 font-bold ${T.cls}`}>
                      <Icon className="h-4 w-4" /> {T.text} · prévu {ai.forecast.projected}/100
                    </p>
                    {ai.forecast.minutesToCritical === 0 ? (
                      <p className="mt-1 text-xs text-red-300">Niveau critique atteint.</p>
                    ) : ai.forecast.minutesToCritical ? (
                      <p className="mt-1 text-xs text-amber-300">Niveau critique estimé dans ~{ai.forecast.minutesToCritical} min.</p>
                    ) : (
                      <p className="mt-1 text-xs text-slate-500">Pas de niveau critique prévu.</p>
                    )}
                  </div>
                );
              })()
            ) : (
              <p className="text-xs text-slate-500">Pas assez de mesures (4 min minimum).</p>
            )}

            {ai.fall && (
              <p className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300">
                <AlertTriangle className="h-4 w-4" /> Chute possible détectée
              </p>
            )}
            {ai.anomaly && (
              <p className="rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-300">
                FC anormalement {ai.anomaly.direction}e pour ce travailleur ({ai.anomaly.z > 0 ? '+' : ''}{ai.anomaly.z.toFixed(1)} σ).
              </p>
            )}
            <p className="text-[11px] text-slate-600">
              {ai.baseline.learned
                ? `Profil appris sur ${ai.baseline.samples} mesures · FC repos ≈ ${Math.round(ai.baseline.restHr)} bpm`
                : `Profil en apprentissage (${ai.baseline.samples}/30 mesures) · FC repos par défaut ${Math.round(ai.baseline.restHr)} bpm`}
            </p>
          </div>
        </div>
      )}
    </Panel>
  );
}
