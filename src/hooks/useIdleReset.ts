// hooks/useIdleReset.ts
import { useCallback, useEffect, useRef } from 'react';

type IdleOpts = {
  timeoutMs: number;
  onTimeout: () => void;
  autoStart?: boolean;
};

export function useIdleReset({ timeoutMs, onTimeout, autoStart = true }: IdleOpts) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    clear();
    timerRef.current = setTimeout(() => {
      onTimeout();
    }, timeoutMs);
  }, [timeoutMs, onTimeout, clear]);

  // Arranca automáticamente si se pide
  useEffect(() => {
    if (autoStart) start();
    return clear;
  }, [autoStart, start, clear]);

  return { clear, start };
}
