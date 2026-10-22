import { createContext, useContext, useMemo, useState } from 'react';
import { DEFAULT_THRESHOLDS, loadThresholds, saveThresholds } from '../utils/metrics';

const ThresholdsContext = createContext(null);

export function ThresholdsProvider({ children }) {
  const [thresholds, setThresholdsState] = useState(() => loadThresholds());

  const value = useMemo(
    () => ({
      thresholds,
      setThresholds: (next) => {
        setThresholdsState(next);
        saveThresholds(next);
      },
      resetThresholds: () => {
        setThresholdsState({ ...DEFAULT_THRESHOLDS });
        saveThresholds(DEFAULT_THRESHOLDS);
      },
    }),
    [thresholds],
  );

  return <ThresholdsContext.Provider value={value}>{children}</ThresholdsContext.Provider>;
}

export function useThresholds() {
  const ctx = useContext(ThresholdsContext);
  if (!ctx) throw new Error('useThresholds must be used within ThresholdsProvider');
  return ctx;
}
