// hooks/useIdleReset.ts
import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

type IdleOpts = {
  timeoutMs: number;
  onTimeout: () => void;
  autoStart?: boolean; // arranca el timer automáticamente
};

export function useIdleReset({ timeoutMs, onTimeout, autoStart = true }: IdleOpts) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

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

  // Llamar en cualquier interacción del usuario
  const bump = useCallback(() => {
    start();
  }, [start]);

  // Arranca automáticamente si se pide
  useEffect(() => {
    if (autoStart) start();
    return clear;
  }, [autoStart, start, clear]);

  // Opcional: si la app pasa a background, dispara timeout inmediato
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      // si sale del foreground, ejecuta onTimeout (o podrías pausar)
      if (prev === 'active' && next.match(/inactive|background/)) {
        clear(); // evitamos doble llamada
        onTimeout();
      }
    });
    return () => sub.remove();
  }, [onTimeout, clear]);

  return { bump, clear, start };
}
