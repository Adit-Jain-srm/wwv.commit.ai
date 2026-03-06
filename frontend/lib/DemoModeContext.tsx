"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type DemoModeContextValue = {
  enabled: boolean;
  startedAt: number | null;
  start: () => void;
  stop: () => void;
};

const DemoModeContext = createContext<DemoModeContextValue | null>(null);

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const stop = useCallback(() => {
    setEnabled(false);
    setStartedAt(null);
  }, []);

  const start = useCallback(() => {
    setEnabled(true);
    setStartedAt(Date.now());
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const t = window.setTimeout(() => stop(), 12_000);
    return () => window.clearTimeout(t);
  }, [enabled, stop]);

  const value = useMemo(
    () => ({
      enabled,
      startedAt,
      start,
      stop,
    }),
    [enabled, startedAt, start, stop]
  );

  return (
    <DemoModeContext.Provider value={value}>
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  const ctx = useContext(DemoModeContext);
  if (!ctx) {
    throw new Error("useDemoMode must be used within DemoModeProvider");
  }
  return ctx;
}

