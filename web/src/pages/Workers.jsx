import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Filter, Plus, Search, Trash2, UserPlus, Users, X, XCircle } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { ActionButton, Avatar, Chip, Notice, PageHeader, PrimaryButton } from '../components/ui';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useSelectedWorker } from '../context/SelectedWorkerContext';
import { WORKER_STATUS, isSupervisorRole } from '../utils/metrics';

const EMPTY_FORM = { name: '', matricule: '', jobTitle: '', siteId: '', newSite: '', status: 'active' };

export default function Workers() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { selectedWorkerId, setSelectedWorkerId, clearSelectedWorker } = useSelectedWorker();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workers, setWorkers] = useState([]);
  const [sites, setSites] = useState([]);
  const [devices, setDevices] = useState([]);
  const [search, setSearch] = useState('');
  const [jobFilter, setJobFilter] = useState('all');
  const [siteFilter, setSiteFilter] = useState('all');
  const [deletingId, setDeletingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const isSupervisor = isSupervisorRole(user?.role);

  const loadWorkers = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError('');

    const [workersResult, sitesResult, devicesResult] = await Promise.all([
      supabase.from('workers').select('*, sites(name)').order('name'),
      supabase.from('sites').select('id, name').order('name'),
      supabase.from('devices').select('device_id, worker_id'),
    ]);

    if (workersResult.error) {
      setError("Impossible de charger les travailleurs. Vérifie que supabase/schema.sql a été exécuté.");
      setLoading(false);
      return;
    }

    setWorkers(workersResult.data ?? []);
    setSites(sitesResult.data ?? []);
    setDevices(devicesResult.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadWorkers();
  }, [loadWorkers]);

  const deviceByWorker = useMemo(
    () => new Map(devices.filter((d) => d.worker_id).map((d) => [d.worker_id, d.device_id])),
    [devices],
  );

  const rows = useMemo(
    () =>
      workers.map((w) => ({
        id: w.id,
        name: w.name,
        matricule: w.matricule ?? '—',
        jobTitle: w.job_title || 'Non défini',
        siteName: w.sites?.name ?? 'Sans atelier',
        status: w.status ?? 'active',
        photoUrl: w.photo_url ?? '',
        deviceId: deviceByWorker.get(w.id) ?? null,
        hasAccount: Boolean(w.user_id),
      })),
    [workers, deviceByWorker],
  );

  const jobTitles = useMemo(() => [...new Set(rows.map((r) => r.jobTitle))].sort((a, b) => a.localeCompare(b)), [rows]);
  const siteNames = useMemo(() => [...new Set(rows.map((r) => r.siteName))].sort((a, b) => a.localeCompare(b)), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.matricule.toLowerCase().includes(q) ||
        r.jobTitle.toLowerCase().includes(q) ||
        r.siteName.toLowerCase().includes(q);
      return (
        matchesSearch &&
        (jobFilter === 'all' || r.jobTitle === jobFilter) &&
        (siteFilter === 'all' || r.siteName === siteFilter)
      );
    });
  }, [rows, search, jobFilter, siteFilter]);

  function handleSelect(worker) {
    setSelectedWorkerId(worker.id);
    navigate('/dashboard');
  }

  async function handleDelete(worker) {
    if (!isSupervisor) return;
    const ok = window.confirm(`Supprimer ${worker.name} ? Ses mesures seront aussi supprimées.`);
    if (!ok) return;

    setDeletingId(worker.id);
    const { error: deleteError } = await supabase.from('workers').delete().eq('id', worker.id);
    setDeletingId(null);

    if (deleteError) {
      setError(deleteError.message || 'Suppression impossible.');
      return;
    }
    if (selectedWorkerId === worker.id) clearSelectedWorker();
    await loadWorkers();
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError('');

    try {
      let siteId = form.siteId || null;

      if (form.siteId === '__new__') {
        const { data: createdSite, error: siteError } = await supabase
          .from('sites')
          .insert({ name: form.newSite.trim() || 'Nouvel atelier', supervisor_id: user.id })
          .select('id')
          .single();
        if (siteError) throw siteError;
        siteId = createdSite.id;
      }

      const { error: insertError } = await supabase.from('workers').insert({
        name: form.name.trim(),
        matricule: form.matricule.trim() || null,
        job_title: form.jobTitle.trim() || null,
        site_id: siteId,
        status: form.status,
      });
      if (insertError) throw insertError;

      setForm(EMPTY_FORM);
      setShowForm(false);
      await loadWorkers();
    } catch (createError) {
      setError(createError.message || "Impossible d'ajouter le travailleur.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout>
      <PageHeader
        eyebrow="Équipe de production"
        eyebrowIcon={<Users />}
        title="Travailleurs"
        subtitle="Sélectionnez un travailleur pour afficher son suivi en temps réel."
        actions={
          <>
            <Chip text={`${filtered.length} travailleur(s)`} tone="amber" />
            {selectedWorkerId && <Chip text="Travailleur sélectionné" tone="green" />}
            {isSupervisor && (
              <PrimaryButton onClick={() => setShowForm(true)} icon={<UserPlus />} label="Ajouter" />
            )}
          </>
        }
      />

      <div className="panel mb-6 rounded-2xl p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un nom, matricule, poste..."
              className="field-input pl-9"
            />
          </label>

          <label className="relative">
            <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <select value={jobFilter} onChange={(e) => setJobFilter(e.target.value)} className="field-input appearance-none pl-9">
              <option value="all">Tous les postes</option>
              {jobTitles.map((job) => (
                <option key={job} value={job}>
                  {job}
                </option>
              ))}
            </select>
          </label>

          <label className="relative">
            <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)} className="field-input appearance-none pl-9">
              <option value="all">Tous les ateliers</option>
              {siteNames.map((siteName) => (
                <option key={siteName} value={siteName}>
                  {siteName}
                </option>
              ))}
            </select>
          </label>
        </div>

        {(search || jobFilter !== 'all' || siteFilter !== 'all') && (
          <div className="mt-3 flex justify-end">
            <ActionButton
              onClick={() => {
                setSearch('');
                setJobFilter('all');
                setSiteFilter('all');
              }}
              icon={<X />}
              label="Réinitialiser"
            />
          </div>
        )}
      </div>

      {error && (
        <Notice tone="red" title="Erreur">
          {error}
        </Notice>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="panel h-52 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((worker) => {
            const isSelected = selectedWorkerId === worker.id;
            const status = WORKER_STATUS[worker.status] ?? WORKER_STATUS.active;

            return (
              <div
                key={worker.id}
                className={`panel group relative rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5 ${
                  isSelected ? 'ring-1 ring-amber-400/60' : ''
                }`}
              >
                <button type="button" onClick={() => handleSelect(worker)} className="w-full text-left">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={worker.name} photoUrl={worker.photoUrl} size="h-12 w-12" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">{worker.name}</p>
                        <p className="truncate text-xs text-slate-400">{worker.siteName}</p>
                      </div>
                    </div>
                    {isSelected && <CheckCircle2 className="h-6 w-6 shrink-0 text-amber-400" />}
                  </div>

                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Chip text={worker.matricule} tone="amber" />
                    <Chip text={worker.jobTitle} tone="violet" />
                    <Chip text={status.label} tone={status.tone} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <Stat label="Matricule" value={worker.matricule} />
                    <Stat label="Poste" value={worker.jobTitle} />
                    <Stat label="Atelier" value={worker.siteName} />
                    <Stat label="Bracelet" value={worker.deviceId ?? 'Aucun'} />
                  </div>
                </button>

                {isSupervisor && (
                  <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(worker);
                      }}
                      disabled={deletingId === worker.id}
                      className="rounded-xl border border-red-500/30 bg-red-500/10 p-2 text-red-400 transition-colors hover:bg-red-500/20"
                      title="Supprimer le travailleur"
                    >
                      {deletingId === worker.id ? <XCircle className="h-4 w-4 animate-pulse" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="panel rounded-2xl py-16 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-slate-500" />
          <p className="font-medium text-slate-300">Aucun travailleur trouvé</p>
          <p className="mt-1 text-sm text-slate-500">Ajoute un travailleur ou modifie ta recherche.</p>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <form onSubmit={handleCreate} className="panel w-full max-w-lg overflow-hidden rounded-2xl">
            <div className="hazard-stripe h-1.5 w-full" />
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-[#111827]">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Nouveau travailleur</h3>
                  <p className="text-xs text-slate-500">Le bracelet s'assigne ensuite dans « Capteurs »</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="btn-ghost rounded-xl p-2">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 px-5 pb-5">
              <FormField label="Nom complet *">
                <input
                  required
                  className="field-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex : Ahmed Ben Ali"
                />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Matricule">
                  <input
                    className="field-input"
                    value={form.matricule}
                    onChange={(e) => setForm({ ...form, matricule: e.target.value })}
                    placeholder="MAT-1006"
                  />
                </FormField>
                <FormField label="Poste">
                  <input
                    className="field-input"
                    value={form.jobTitle}
                    onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                    placeholder="Soudeur"
                  />
                </FormField>
              </div>
              <FormField label="Atelier">
                <select className="field-input" value={form.siteId} onChange={(e) => setForm({ ...form, siteId: e.target.value })}>
                  <option value="">— Aucun —</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                  <option value="__new__">+ Nouvel atelier…</option>
                </select>
              </FormField>
              {form.siteId === '__new__' && (
                <FormField label="Nom du nouvel atelier">
                  <input
                    className="field-input"
                    value={form.newSite}
                    onChange={(e) => setForm({ ...form, newSite: e.target.value })}
                    placeholder="Atelier Soudure B"
                  />
                </FormField>
              )}
              <FormField label="Statut">
                <select className="field-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {Object.entries(WORKER_STATUS).map(([key, meta]) => (
                    <option key={key} value={key}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </FormField>

              <div className="flex justify-end gap-2 pt-2">
                <ActionButton onClick={() => setShowForm(false)} label="Annuler" />
                <button type="submit" disabled={saving} className="btn-primary rounded-xl px-4 py-2.5 text-sm font-black disabled:opacity-60">
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </AppLayout>
  );
}

function Stat({ label, value }) {
  return (
    <div className="panel-soft rounded-lg px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="truncate text-sm text-slate-200">{value}</p>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-400">{label}</span>
      {children}
    </label>
  );
}
