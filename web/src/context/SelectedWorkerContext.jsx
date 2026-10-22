import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';

const SelectedWorkerContext = createContext(null);

function buildStorageKey(userId) {
  return `selected-worker-id:${userId ?? 'anon'}`;
}

export function SelectedWorkerProvider({ children }) {
  const { user } = useAuth();
  const [selectedWorkerId, setSelectedWorkerId] = useState(null);

  useEffect(() => {
    try {
      setSelectedWorkerId(localStorage.getItem(buildStorageKey(user?.id)) || null);
    } catch {
      setSelectedWorkerId(null);
    }
  }, [user?.id]);

  useEffect(() => {
    try {
      const key = buildStorageKey(user?.id);
      if (selectedWorkerId) localStorage.setItem(key, selectedWorkerId);
      else localStorage.removeItem(key);
    } catch {
      // stockage indisponible
    }
  }, [selectedWorkerId, user?.id]);

  const value = useMemo(
    () => ({
      selectedWorkerId,
      setSelectedWorkerId,
      clearSelectedWorker: () => setSelectedWorkerId(null),
    }),
    [selectedWorkerId],
  );

  return <SelectedWorkerContext.Provider value={value}>{children}</SelectedWorkerContext.Provider>;
}

export function useSelectedWorker() {
  const ctx = useContext(SelectedWorkerContext);
  if (!ctx) throw new Error('useSelectedWorker must be used within SelectedWorkerProvider');
  return ctx;
}
