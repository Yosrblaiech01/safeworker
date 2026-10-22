import { HardHat } from 'lucide-react';
import IndustrialBackdrop from './IndustrialBackdrop';

export default function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="flex min-h-screen w-full">
      {/* Panneau gauche — identité industrielle */}
      <div className="relative hidden items-center justify-center p-12 lg:flex lg:w-1/2">
        <IndustrialBackdrop />

        <div className="relative z-10 -mt-24 max-w-md text-center">
          <div className="mb-8 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-400 text-[#111827] shadow-[0_0_50px_rgba(245,158,11,0.35)]">
            <HardHat className="h-11 w-11" />
          </div>

          <h1 className="mb-3 text-4xl font-black tracking-wide text-white">
            SAFE WORKER
            <span className="mt-1 block text-2xl font-semibold text-amber-300">INDUSTRIAL MONITOR</span>
          </h1>

          <p className="mb-8 text-lg leading-relaxed text-slate-300">
            Surveillez la santé et la sécurité de vos travailleurs en temps réel, directement depuis l'atelier.
          </p>

          <div className="flex justify-center gap-8 text-center">
            <Stat label="Mesures" value="5" />
            <Stat label="Capteurs" value="ESP" />
            <Stat label="Suivi" value="Live" />
          </div>
        </div>
      </div>

      {/* Panneau droit — formulaire */}
      <div className="flex min-h-screen flex-1 flex-col bg-dark-bg">
        <div className="relative h-48 shrink-0 lg:hidden">
          <IndustrialBackdrop />
          <div className="absolute inset-0 flex items-center justify-center gap-3">
            <div className="rounded-xl bg-amber-400 p-2 text-[#111827]">
              <HardHat className="h-6 w-6" />
            </div>
            <div>
              <p className="font-black tracking-wider text-white">SAFE WORKER</p>
              <p className="text-xs tracking-widest text-amber-300">INDUSTRIAL MONITOR</p>
            </div>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white">{title}</h2>
              <p className="mt-2 text-slate-400">{subtitle}</p>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wider text-amber-200/70">{label}</p>
    </div>
  );
}
