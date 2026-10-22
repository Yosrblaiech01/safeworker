// Composants d'interface partagés par toutes les pages

const TONES = {
  amber: {
    icon: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
    line: 'from-amber-400',
    text: 'text-amber-300',
    chip: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  },
  rose: {
    icon: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
    line: 'from-rose-400',
    text: 'text-rose-300',
    chip: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
  },
  orange: {
    icon: 'border-orange-400/20 bg-orange-400/10 text-orange-300',
    line: 'from-orange-400',
    text: 'text-orange-300',
    chip: 'border-orange-400/30 bg-orange-400/10 text-orange-300',
  },
  sky: {
    icon: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
    line: 'from-sky-400',
    text: 'text-sky-300',
    chip: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
  },
  violet: {
    icon: 'border-violet-400/20 bg-violet-400/10 text-violet-300',
    line: 'from-violet-400',
    text: 'text-violet-300',
    chip: 'border-violet-400/30 bg-violet-400/10 text-violet-300',
  },
  green: {
    icon: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
    line: 'from-emerald-400',
    text: 'text-emerald-300',
    chip: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  },
  red: {
    icon: 'border-red-400/20 bg-red-400/10 text-red-300',
    line: 'from-red-400',
    text: 'text-red-300',
    chip: 'border-red-400/30 bg-red-400/10 text-red-300',
  },
  slate: {
    icon: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
    line: 'from-slate-400',
    text: 'text-slate-300',
    chip: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
  },
};

export function toneOf(name) {
  return TONES[name] ?? TONES.amber;
}

export function Panel({ title, subtitle, icon, action, children, className = '' }) {
  return (
    <section className={`panel overflow-hidden rounded-2xl ${className}`}>
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-300">
              {icon && <span className="text-amber-400 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
              {title}
            </div>
            {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}

export function KpiCard({ title, value, unit, subtitle, icon, tone = 'amber', progress, alert }) {
  const t = toneOf(tone);
  const safeProgress = progress == null ? null : Math.max(0, Math.min(Number(progress) || 0, 100));

  return (
    <div
      className={`panel group relative min-h-[140px] overflow-hidden rounded-2xl p-4 transition-all duration-300 hover:-translate-y-1 ${
        alert ? 'ring-1 ring-red-400/40' : ''
      }`}
    >
      <div className="relative z-10">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h3 className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">{title}</h3>
            <span className={`mt-2 block h-[2px] w-8 rounded-full bg-gradient-to-r ${t.line} to-transparent`} />
          </div>
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl border [&>svg]:h-5 [&>svg]:w-5 ${t.icon}`}>
            {icon}
          </div>
        </div>

        <div className="flex items-end gap-1">
          <span className="text-[28px] font-black leading-none tracking-tight text-white">{value}</span>
          {unit && <span className="pb-0.5 text-sm font-medium text-slate-500">{unit}</span>}
        </div>

        {safeProgress != null ? (
          <div className="mt-3">
            <div className="mb-2 flex items-center justify-between text-[10px]">
              <span className="text-slate-500">{subtitle}</span>
              <span className={`font-bold ${t.text}`}>{Math.round(safeProgress)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-black/30">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${t.line} to-white/60 transition-all duration-500`}
                style={{ width: `${safeProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <p className={`mt-3 text-[11px] font-medium ${alert ? 'text-red-300' : t.text}`}>{subtitle}</p>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ text, className = '' }) {
  return (
    <div className={`flex h-full w-full items-center justify-center py-6 text-center text-sm text-slate-500 ${className}`}>
      {text}
    </div>
  );
}

export function Chip({ text, tone = 'slate', className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneOf(tone).chip} ${className}`}
    >
      {text}
    </span>
  );
}

export const LEVEL_META = {
  ok: { label: 'Normal', tone: 'green', dot: 'bg-emerald-400', ring: 'border-emerald-400/20' },
  warning: { label: 'Attention', tone: 'amber', dot: 'bg-amber-400', ring: 'border-amber-400/40' },
  critical: { label: 'Critique', tone: 'red', dot: 'bg-red-500', ring: 'border-red-500/60' },
};

export function LevelBadge({ level }) {
  const meta = LEVEL_META[level] ?? LEVEL_META.ok;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${toneOf(meta.tone).chip}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${level === 'critical' ? 'animate-pulse' : ''}`} />
      {meta.label}
    </span>
  );
}

export function OnlineBadge({ online }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
        online ? toneOf('green').chip : toneOf('slate').chip
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-slate-500'}`} />
      {online ? 'En ligne' : 'Hors ligne'}
    </span>
  );
}

// Intensité de mouvement (score 0–100) : immobile / normal / anormal
export function MotionBadge({ motion, thresholds }) {
  if (motion === null || motion === undefined || Number.isNaN(Number(motion))) {
    return <span className="text-slate-600">—</span>;
  }
  const value = Math.round(Number(motion));
  const still = thresholds?.motionStill ?? 5;
  const max = thresholds?.motionMax ?? 70;
  if (value > max) return <Chip text={`${value} · Anormal`} tone="red" />;
  if (value <= still) return <Chip text={`${value} · Immobile`} tone="amber" />;
  return <Chip text={`${value} · Normal`} tone="green" />;
}

export function ActionButton({ onClick, icon, label, disabled, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="btn-ghost inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold disabled:opacity-50 [&>svg]:h-4 [&>svg]:w-4"
    >
      {icon}
      {label}
    </button>
  );
}

export function PrimaryButton({ onClick, icon, label, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black disabled:cursor-wait disabled:opacity-60 [&>svg]:h-4 [&>svg]:w-4"
    >
      {icon}
      {label}
    </button>
  );
}

export function Avatar({ name, photoUrl, size = 'h-10 w-10', className = '' }) {
  if (photoUrl) {
    return <img src={photoUrl} alt={name} className={`${size} rounded-xl object-cover ${className}`} />;
  }
  return (
    <div
      className={`${size} flex shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-sm font-black text-amber-300 ${className}`}
    >
      {name?.charAt(0)?.toUpperCase() ?? '?'}
    </div>
  );
}

export function PageHeader({ eyebrow, eyebrowIcon, title, subtitle, actions, live }) {
  return (
    <header className="panel-header relative z-10 mb-6 overflow-hidden rounded-3xl p-5">
      <div className="hazard-stripe absolute left-0 top-0 h-1 w-full opacity-80" />
      <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
            {live ? (
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
              </span>
            ) : (
              <span className="[&>svg]:h-4 [&>svg]:w-4">{eyebrowIcon}</span>
            )}
            {eyebrow}
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white md:text-3xl">{title}</h2>
          {subtitle && <p className="mt-1.5 text-sm text-slate-400">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2.5 print:hidden">{actions}</div>}
      </div>
    </header>
  );
}

export function Notice({ tone = 'amber', icon, title, children }) {
  const t = toneOf(tone);
  return (
    <div className={`mb-6 flex items-start gap-3 rounded-2xl border p-4 ${t.chip}`}>
      {icon && (
        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border [&>svg]:h-5 [&>svg]:w-5 ${t.icon}`}>
          {icon}
        </div>
      )}
      <div>
        {title && <p className="font-bold">{title}</p>}
        <div className="mt-1 text-sm leading-6 opacity-80">{children}</div>
      </div>
    </div>
  );
}
