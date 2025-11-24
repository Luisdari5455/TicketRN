// src/config/runtimeConfig.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export type RuntimeConfig = {
  backendUrl: string;
  sioPath: string;
  locationId: string;
  printerIp: string;
  printerPort?: number;
  token?: string;
  // 'backend' = imprime en servidor
  // 'bluetooth' = imprime directo por BT
  // 'auto' = intenta backend y si falla imprime por BT con comprobante provisional
  printerMode?: 'backend' | 'bluetooth' | 'auto';
  // Datos del dispositivo Bluetooth (SPP) para impresión directa
  btDeviceName?: string;
  btDeviceAddress?: string; // MAC en Android (ej. AA:BB:CC:DD:EE:FF)
};

const KEY = '@runtimeConfig/v1';

export const defaultConfig: RuntimeConfig = {
  backendUrl: 'http://localhost:3001',
  sioPath: '/socket.io',
  locationId: 'sucursal-central-01',
  printerIp: '192.168.1.200',
  printerPort: 9100,
  token: 'supersecreto123',
  printerMode: 'backend',
  btDeviceName: undefined,
  btDeviceAddress: undefined,
};

export async function loadConfig(): Promise<RuntimeConfig> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return defaultConfig;
    const parsed = JSON.parse(raw);
    return { ...defaultConfig, ...parsed };
  } catch {
    return defaultConfig;
  }
}

export async function saveConfig(patch: Partial<RuntimeConfig>): Promise<RuntimeConfig> {
  const current = await loadConfig();
  const next = { ...current, ...patch };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function resetConfig(): Promise<RuntimeConfig> {
  await AsyncStorage.removeItem(KEY);
  return defaultConfig;
}
