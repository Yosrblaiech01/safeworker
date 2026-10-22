/**
 * Illustration industrielle (usine + engrenage + bandes de sécurité)
 * utilisée sur la page d'accueil et les pages de connexion.
 */
export function FactorySilhouette({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 1200 360" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <defs>
        <linearGradient id="factoryFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1f2937" />
          <stop offset="100%" stopColor="#0b0f14" />
        </linearGradient>
        <linearGradient id="smoke" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#94a3b8" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Fumée */}
      <ellipse cx="190" cy="60" rx="40" ry="60" fill="url(#smoke)" />
      <ellipse cx="930" cy="40" rx="50" ry="70" fill="url(#smoke)" />

      {/* Cheminées */}
      <rect x="170" y="90" width="38" height="200" fill="url(#factoryFill)" />
      <rect x="170" y="110" width="38" height="8" fill="#f59e0b" opacity="0.8" />
      <rect x="910" y="70" width="44" height="220" fill="url(#factoryFill)" />
      <rect x="910" y="92" width="44" height="8" fill="#f59e0b" opacity="0.8" />

      {/* Bâtiment principal à toit en dents de scie */}
      <path
        d="M0 360 V230 L80 190 V230 L160 190 V230 L240 190 V230 L320 190 V230 L400 190 V230 L480 190 V360 Z"
        fill="url(#factoryFill)"
      />
      <path d="M480 360 V160 H760 V360 Z" fill="url(#factoryFill)" />
      <path
        d="M760 360 V240 L840 200 V240 L920 200 V240 L1000 200 V240 L1080 200 V240 L1200 190 V360 Z"
        fill="url(#factoryFill)"
      />

      {/* Fenêtres éclairées */}
      {Array.from({ length: 9 }).map((_, i) => (
        <rect key={`w1-${i}`} x={505 + i * 28} y="190" width="16" height="22" rx="2" fill="#fbbf24" opacity={i % 3 === 0 ? 0.65 : 0.25} />
      ))}
      {Array.from({ length: 9 }).map((_, i) => (
        <rect key={`w2-${i}`} x={505 + i * 28} y="230" width="16" height="22" rx="2" fill="#fbbf24" opacity={i % 2 === 0 ? 0.45 : 0.18} />
      ))}
      {Array.from({ length: 6 }).map((_, i) => (
        <rect key={`w3-${i}`} x={30 + i * 75} y="260" width="40" height="14" rx="2" fill="#38bdf8" opacity="0.18" />
      ))}
      {Array.from({ length: 5 }).map((_, i) => (
        <rect key={`w4-${i}`} x={800 + i * 80} y="270" width="44" height="14" rx="2" fill="#38bdf8" opacity="0.18" />
      ))}

      {/* Engrenage */}
      <g transform="translate(620 110)" opacity="0.9">
        <g>
          <circle r="34" fill="none" stroke="#f59e0b" strokeWidth="10" strokeDasharray="12 9" />
          <circle r="20" fill="none" stroke="#f59e0b" strokeWidth="5" />
          <circle r="6" fill="#f59e0b" />
          <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="18s" repeatCount="indefinite" />
        </g>
      </g>

      {/* Sol */}
      <rect x="0" y="330" width="1200" height="30" fill="#0b0f14" />
    </svg>
  );
}

export default function IndustrialBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1206] via-[#0d1117] to-[#07090c]" />
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(245,158,11,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.8) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="absolute left-1/2 top-0 h-64 w-[28rem] -translate-x-1/2 rounded-full bg-amber-500/15 blur-3xl" />
      <FactorySilhouette className="absolute bottom-0 left-0 h-[36%] w-full opacity-80" />
      <div className="hazard-stripe absolute bottom-0 left-0 h-3 w-full" />
      <div className="hazard-stripe absolute left-0 top-0 h-2 w-full opacity-70" />
    </div>
  );
}
