import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { TABLE, TIME_CANDIDATES, timeCol, rowTime } from '../config/sensors';

const PAGE = 1000; // limite Supabase par requête
const MAX_ROWS = 12000; // ~6 h à une mesure toutes les 2 s
const SAMPLE_MS = 2000; // fréquence d'envoi de l'ESP32

// ---- Détection (une seule fois) de la colonne d'heure et d'une colonne d'ordre ----
let schemaPromise = null;
const schema = { orderCol: null };

const looksLikeTime = (v) =>
  v !== null && v !== undefined && v !== '' && Number.isFinite(new Date(typeof v === 'number' ? v : String(v)).getTime());

function detectSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const { data, error } = await supabase.from(TABLE).select('*').limit(1);
      if (error) throw error;
      const row = data?.[0] ?? {};
      const keys = Object.keys(row);
      if (!timeCol.name) {
        timeCol.name =
          TIME_CANDIDATES.find((k) => k in row) ??
          keys.find((k) => /(time|date|_at)$/i.test(k) && looksLikeTime(row[k])) ??
          null;
      }
      schema.orderCol = timeCol.name ?? (keys.includes('id') ? 'id' : null);
      console.log(`[SAFE WORKER] Colonnes de ${TABLE} :`, keys.join(', '),
        `→ heure = ${timeCol.name ?? 'aucune'} · tri = ${schema.orderCol ?? 'aucun'}`);
      return schema;
    })().catch((e) => {
      schemaPromise = null; // on retentera
      throw e;
    });
  }
  return schemaPromise;
}

// Charge les mesures des `minutes` dernières minutes puis écoute les nouvelles en temps réel.
export function useReadings(minutes) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const windowRef = useRef(minutes);
  windowRef.current = minutes;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { orderCol } = await detectSchema();
      let all = [];

      if (timeCol.name) {
        // Cas normal : filtre sur la colonne d'heure
        const since = new Date(Date.now() - minutes * 60000).toISOString();
        for (let from = 0; from < MAX_ROWS; from += PAGE) {
          const { data, error: e } = await supabase
            .from(TABLE).select('*')
            .gte(timeCol.name, since)
            .order(timeCol.name, { ascending: false })
            .range(from, from + PAGE - 1);
          if (e) throw e;
          all = all.concat(data ?? []);
          if (!data || data.length < PAGE) break;
        }
      } else {
        // Pas de colonne d'heure : on prend les N dernières lignes (par id)
        // et on estime l'heure (une mesure toutes les 2 s).
        const want = Math.min(MAX_ROWS, Math.ceil((minutes * 60000) / SAMPLE_MS));
        for (let from = 0; from < want; from += PAGE) {
          let q = supabase.from(TABLE).select('*');
          if (orderCol) q = q.order(orderCol, { ascending: false });
          const { data, error: e } = await q.range(from, Math.min(from + PAGE, want) - 1);
          if (e) throw e;
          all = all.concat(data ?? []);
          if (!data || data.length < PAGE) break;
        }
        const now = Date.now();
        all.forEach((r, i) => { r.__receivedAt = now - i * SAMPLE_MS; });
      }

      all.reverse(); // ordre chronologique
      setRows(all);
    } catch (e) {
      setError(e.message ?? 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [minutes]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`readings-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: TABLE }, (payload) => {
        const r = { ...payload.new, __receivedAt: Date.now() };
        setRows((prev) => {
          const cutoff = Date.now() - windowRef.current * 60000;
          const next = prev.concat(r);
          let i = 0;
          while (i < next.length && rowTime(next[i]) < cutoff) i++;
          return i ? next.slice(i) : next;
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { rows, loading, error, reload: load };
}
