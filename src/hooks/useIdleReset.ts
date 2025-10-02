// hooks/useIdleReset.ts
import { useCallback, useEffect, useRef } from 'react';

type UseIdleResetOptions = {
  timeoutMs?: number;
  onTimeout: () => void;
};

export function useIdleReset({ timeoutMs = 60000, onTimeout }: UseIdleResetOptions) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const clear = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const bump = useCallback(() => {
    clear();
    timerRef.current = setTimeout(onTimeout, timeoutMs);
  }, [onTimeout, timeoutMs]);

  useEffect(() => {
    bump();
    return clear;
  }, [bump]);

  return { bump, clear };
}
