import { NativeModules } from 'react-native';

type TKiosk = {
  stopLockTask: () => Promise<boolean>;
  startLockTask: () => Promise<boolean>;
};

const { KioskMode } = NativeModules as { KioskMode?: TKiosk };

export async function stopKioskIfPossible(): Promise<boolean> {
  if (!KioskMode?.stopLockTask) return false;
  try { await KioskMode.stopLockTask(); return true; }
  catch { return false; }
}

export async function startKioskIfPossible(): Promise<boolean> {
  if (!KioskMode?.startLockTask) return false;
  try { await KioskMode.startLockTask(); return true; }
  catch { return false; }
}
