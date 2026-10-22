import { HardHat } from 'lucide-react';

export default function SetupRequired() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-dark-bg p-6 text-slate-200">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-dark-border bg-dark-card">
        <div className="hazard-stripe h-2 w-full" />
        <div className="p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400 text-[#111827]">
              <HardHat className="h-9 w-9" />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-white">Configuration Supabase requise</h1>
            <p className="mt-2 text-sm text-slate-400">
              L&apos;écran blanc vient du fichier <code className="text-amber-400">.env</code> manquant ou incomplet.
            </p>
          </div>

          <ol className="space-y-4 text-sm text-slate-300">
            <Step n="1">
              Crée un projet sur <strong className="text-white">supabase.com</strong>
            </Step>
            <Step n="2">
              Copie <code className="text-amber-400">.env.example</code> vers <code className="text-amber-400">.env</code> à la racine du projet
            </Step>
            <Step n="3">
              Remplis tes clés depuis <strong className="text-white">Project Settings → API</strong>
            </Step>
            <Step n="4">
              Exécute <code className="text-amber-400">supabase/schema.sql</code> dans le SQL Editor
            </Step>
            <Step n="5">
              Redémarre le serveur : <code className="text-amber-400">npm run dev</code>
            </Step>
          </ol>

          <div className="mt-6 rounded-xl border border-dark-border bg-dark-bg p-4 font-mono text-xs text-slate-400">
            <p className="mb-2 text-slate-500"># .env</p>
            <p>VITE_SUPABASE_URL=https://xxx.supabase.co</p>
            <p>VITE_SUPABASE_ANON_KEY=eyJhbG...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ n, children }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-[#111827]">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}
