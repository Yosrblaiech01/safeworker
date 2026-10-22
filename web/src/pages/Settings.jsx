import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Cpu, Plus, RefreshCw, Search, Settings as SettingsIcon, Unplug, UserRound, Wifi } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { ActionButton, Avatar, Notice, PageHeader, PrimaryButton } from '../components/ui';
import { supabase } from '../lib/supabase';
import { ONLINE_WINDOW_MS } from '../utils/metrics';

export default function Settings() {
  const [workers, setWorkers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingWorkerId, setSavingWorkerId] = useState(null);
  const [newDeviceId, setNewDeviceId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [workersResult, devicesResult] = await Promise.all([
        supabase.from('workers').select('id, name, matricule, job_title, photo_url, status, sites(name)').order('name'),
        supabase.from('devices').select('device_id, worker_id, status, last_seen_at, firmware_version').order('device_id'),
      ]);

      if (workersResult.error) throw workersResult.error;
      if (devicesResult.error) throw devicesResult.error;

      setWorkers(workersResult.data ?? []);
      setDevices(devicesResult.data ?? []);
    } catch (loadError) {
      console.error(loadError);
      setError(loadError.message || 'Impossible de charger les travailleurs et les bracelets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const deviceByWorker = useMemo(() => new Map(devices.filter((d) => d.worker_id).map((d) => [d.worker_id, d])), [devices]);
  const workerById = useMemo(() => new Map(workers.map((w) => [w.id, w])), [workers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter(
      (w) =>
        w.name?.toLowerCase().includes(q) ||
        w.matricule?.toLowerCase().includes(q) ||
        w.job_title?.toLowerCase().includes(q) ||
        w.id?.toLowerCase().includes(q),
    );
  }, [workers, search]);

  function isOnline(lastSeenAt) {
    return lastSeenAt ? Date.now() - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_MS : false;
  }

  async function assignDevice(workerId, deviceId) {
    setSavingWorkerId(workerId);
    setError('');
    setMessage('');

    try {
      // 1. Retirer l'ancien bracelet de ce travailleur
      const { error: clearWorkerError } = await supabase.from('devices').update({ worker_id: null }).eq('worker_id', workerId);
      if (clearWorkerError) throw clearWorkerError;

      if (!deviceId) {
        setMessage('Bracelet retiré du travailleur.');
        await loadData();
        return;
      }

      // 2. Un bracelet n'appartient qu'à un seul travailleur
      const { error: assignError } = await supabase
        .from('devices')
        .upsert({ device_id: deviceId, worker_id: workerId, status: 'active' }, { onConflict: 'device_id' });
      if (assignError) throw assignError;

      setMessage(`Le bracelet ${deviceId} a été associé à ${workerById.get(workerId)?.name ?? 'ce travailleur'}.`);
      await loadData();
    } catch (assignError) {
      console.error(assignError);
      setError(assignError.message || "Impossible de modifier l'association du bracelet.");
    } finally {
      setSavingWorkerId(null);
    }
  }

  async function addDevice(event) {
    event.preventDefault();
    const id = newDeviceId.trim().toUpperCase();
    if (!id) return;

    const { error: insertError } = await supabase.from('devices').upsert({ device_id: id, status: 'active' }, { onConflict: 'device_id' });

    if (insertError) {
      setError(insertError.message);
      return;
    }
    setNewDeviceId('');
    setMessage(`Bracelet ${id} ajouté. Tu peux maintenant l'associer à un travailleur.`);
    await loadData();
  }

  return (
    <AppLayout>
      <PageHeader
        eyebrow="Bracelets connectés"
        eyebrowIcon={<Cpu />}
        title="Gestion des capteurs"
        subtitle="Associez chaque bracelet ESP à un travailleur. Aucun changement n'est nécessaire dans le code Arduino."
        actions={<ActionButton onClick={loadData} disabled={loading} icon={<RefreshCw className={loading ? 'animate-spin' : ''} />} label="Actualiser" />}
      />

      <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_1fr_1.4fr]">
        <StatCard label="Travailleurs" value={workers.length} icon={<UserRound />} />
        <StatCard label="Bracelets" value={devices.length} icon={<Cpu />} />
        <StatCard label="Associés" value={devices.filter((d) => d.worker_id).length} icon={<CheckCircle2 />} />

        <form onSubmit={addDevice} className="panel flex flex-col justify-center gap-2 rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Ajouter un bracelet</p>
          <div className="flex gap-2">
            <input
              value={newDeviceId}
              onChange={(e) => setNewDeviceId(e.target.value)}
              placeholder="Ex : ESP-W06"
              className="field-input"
            />
            <PrimaryButton onClick={addDevice} icon={<Plus />} label="Ajouter" />
          </div>
        </form>
      </section>

      {error && (
        <Notice tone="red" title="Erreur">
          {error}
        </Notice>
      )}
      {message && <Notice tone="green">{message}</Notice>}

      <div className="panel mb-5 flex items-center gap-3 rounded-xl px-4 py-3">
        <Search className="h-5 w-5 text-amber-500" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un travailleur, un matricule, un poste..."
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
        />
      </div>

      <section className="panel overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[minmax(200px,1.2fr)_minmax(220px,1.2fr)_minmax(260px,1fr)] gap-4 border-b border-slate-500/10 bg-amber-400/[0.05] px-5 py-4 text-xs font-bold uppercase tracking-wider text-amber-300">
              <div>Travailleur</div>
              <div>Identifiant (workers.id)</div>
              <div>Bracelet associé</div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-slate-500">Aucun travailleur trouvé</div>
            ) : (
              <div className="divide-y divide-slate-500/10">
                {filtered.map((worker) => {
                  const device = deviceByWorker.get(worker.id);
                  const saving = savingWorkerId === worker.id;
                  const online = isOnline(device?.last_seen_at);

                  return (
                    <div
                      key={worker.id}
                      className="grid grid-cols-[minmax(200px,1.2fr)_minmax(220px,1.2fr)_minmax(260px,1fr)] items-center gap-4 px-5 py-4 transition-colors hover:bg-amber-400/[0.03]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={worker.name} photoUrl={worker.photo_url} size="h-11 w-11" />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">{worker.name}</p>
                          <p className="text-xs text-slate-500">
                            {worker.matricule || 'Sans matricule'} · {worker.job_title || 'Poste non défini'}
                          </p>
                        </div>
                      </div>

                      <div>
                        <code className="panel-soft inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-lg px-3 py-2 text-xs text-amber-200">
                          {worker.id}
                        </code>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                          <select
                            value={device?.device_id ?? ''}
                            disabled={saving}
                            onChange={(e) => assignDevice(worker.id, e.target.value)}
                            className="field-input appearance-none pr-10 disabled:opacity-50"
                          >
                            <option value="">Aucun bracelet</option>
                            {devices.map((d) => {
                              const owner = d.worker_id && d.worker_id !== worker.id ? workerById.get(d.worker_id) : null;
                              return (
                                <option key={d.device_id} value={d.device_id}>
                                  {d.device_id}
                                  {owner ? ` — ${owner.name}` : ''}
                                </option>
                              );
                            })}
                          </select>
                          <SettingsIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-500" />
                        </div>

                        {device ? (
                          <div
                            title={online ? 'Bracelet connecté' : 'Bracelet hors ligne'}
                            className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                              online ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400' : 'border-slate-600 bg-slate-500/10 text-slate-500'
                            }`}
                          >
                            <Wifi className="h-4 w-4" />
                          </div>
                        ) : (
                          <div
                            title="Aucun bracelet"
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 text-slate-600"
                          >
                            <Unplug className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </AppLayout>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="panel rounded-2xl p-4">
      <div className="mb-3 text-amber-400 [&>svg]:h-5 [&>svg]:w-5">{icon}</div>
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}
