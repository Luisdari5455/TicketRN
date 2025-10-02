import axios from 'axios';
// import { Platform } from 'react-native'; // si no lo usas, quítalo
// import Config from 'react-native-config'; // no lo uses en Expo managed

// Lee SOLO variables públicas de Expo:
const RAW_BASE = process.env.EXPO_PUBLIC_API_URL || '';
const BASE_URL = RAW_BASE.replace(/\/+$/, ''); // sin slashes al final

if (!BASE_URL) {
  console.warn('Falta EXPO_PUBLIC_API_URL en tu .env');
}

const TIMEOUT =
  Number(process.env.EXPO_PUBLIC_API_TIMEOUT) > 0
    ? Number(process.env.EXPO_PUBLIC_API_TIMEOUT)
    : 30000;

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: TIMEOUT,
});

export interface RegisterTicketPayload {
  dpi?: string;
  name: string;
  idService: number;
  locationId?: string;
  sessionId?: string;
  idempotencyKey?: string;
}

export interface TicketCreatedResponse {
  idTicketRegistration: number;
  turnNumber: number;
  correlativo: string;
  prefix: string;
  createdAt: string;
  idTicketStatus: number;
  client?: { idClient: number; name: string; dpi: string | null } | null;
  service?: { idService: number; name: string; prefix: string } | null;
  idCashier?: number | null;
  cashier?: { idCashier: number; name: string } | null;
}

export interface TicketInfoForResult {
  turno: string;
  ventanilla?: string;
}

export const toResultTicketInfo = (t: TicketCreatedResponse): TicketInfoForResult => {
  const turno =
    t.correlativo ||
    (t.prefix && t.turnNumber ? `${t.prefix}-${String(t.turnNumber).padStart(3, '0')}` : '—');

  const ventanilla = t.cashier?.name || (t.idCashier ? `Caja ${t.idCashier}` : undefined);

  return { turno, ventanilla };
};

export const getServices = async () => {
  const { data } = await api.get('/services');
  return data;
};

export const registerTicket = async (
  payload: RegisterTicketPayload
): Promise<TicketCreatedResponse> => {
  const { data } = await api.post<TicketCreatedResponse>('/ticket-registration', payload);
  return data;
};

export interface ClientDTO {
  idClient: number;
  name: string;
  dpi: string | null;
}

/** Busca cliente por DPI; retorna null si no existe */
export const getClientByDpi = async (dpi: string): Promise<ClientDTO | null> => {
  const { data } = await api.get<ClientDTO | null>(`/clients/by-dpi/${dpi}`);
  return data ?? null;
};

// (Opcional) si necesitas WS:
export const WS_URL =
  process.env.EXPO_PUBLIC_WS_URL ||
  (BASE_URL ? BASE_URL.replace(/^http/, 'ws') : '');
