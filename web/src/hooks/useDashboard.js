import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { fetchDashboardData, REALTIME_TABLES } from '../services/dashboardService';
import { buildDashboard } from '../utils/metrics';
import { useThresholds } from '../context/ThresholdsContext';

export function useDashboard(user, selectedWorkerId = null) {
  const { thresholds } = useThresholds();
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [tick, setTick] = useState(0);
  const debounceRef = useRef(null);

  const load = useCallback(
    async (silent = false) => {
      if (!user?.id || !supabase) {
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      setError(null);
      try {
        const result = await fetchDashboardData(user, selectedWorkerId);
        setRaw(result);
        setLastUpdated(new Date());
      } catch (err) {
        console.error(err);
        setError('Impossible de charger les données de surveillance.');
      } finally {
        setLoading(false);
      }
    },
    [user, selectedWorkerId],
  );

  const scheduleReload = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(true), 400);
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user?.id || !supabase) return undefined;

    const channel = supabase.channel(`monitor-${user.id}-${selectedWorkerId ?? 'all'}`);

    for (const table of REALTIME_TABLES) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, scheduleReload);
    }

    channel.subscribe();

    const pollInterval = setInterval(() => load(true), 30000);
    // Recalcule l'état "en ligne / hors ligne" toutes les 15 s
    const tickInterval = setInterval(() => setTick((t) => t + 1), 15000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      clearInterval(pollInterval);
      clearInterval(tickInterval);
      supabase.removeChannel(channel);
    };
  }, [user, load, scheduleReload, selectedWorkerId]);

  const data = useMemo(
    () => buildDashboard(raw, thresholds, selectedWorkerId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [raw, thresholds, selectedWorkerId, tick],
  );

  return { data, loading, error, lastUpdated, refresh: () => load() };
}

export function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}
