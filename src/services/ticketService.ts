// services/ticketService.ts
import axios from 'axios';
import { Platform } from 'react-native';

/**
 * BACKEND URL:
 * - Android Emulator: http://10.0.2.2:3001
 * - iOS Simulator: http://localhost:3001
 * - Dispositivo físico: usa la IP local de tu PC, ej. http://192.168.1.50:3001 https://ticketapi-ceqz.onrender.com/api/api
 */
const DEFAULT_LOCAL =
  Platform.OS === 'android' ? 'https://ticketapi-ceqz.onrender.com' : 'https://ticketapi-ceqz.onrender.com';

// ⚠️ Si vas a probar en dispositivo físico, reemplaza por tu IP LAN:
const BASE_URL = DEFAULT_LOCAL; // ej. 'http://192.168.1.50:3001'

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 30000,
});

/** Payload de creación (lo que envías) */
export interface RegisterTicketPayload {
  dpi?: string;
  name: string;
  idService: number;
  locationId: string;
}

/** Estructura que devuelve tu endpoint /ticket-registration (según lo que ajustamos en el backend) */
export interface TicketCreatedResponse {
  idTicketRegistration: number;
  turnNumber: number;
  correlativo: string;          // ej. "PAGO-015"
  prefix: string;               // ej. "PAGO"
  createdAt: string;
  idTicketStatus: number;
  client?: { idClient: number; name: string; dpi: string | null } | null;
  service?: { idService: number; name: string; prefix: string } | null;
  idCashier?: number | null;
  cashier?: { idCashier: number; name: string } | null;
}

/** Para tu ResultScreen: lo que espera en route.params.ticketInfo */
export interface TicketInfoForResult {
  turno: string;                // lo mostramos como texto grande
  ventanilla?: string;          // "Caja 1" o nombre de la caja si existe
}

/** Helper: mapea la respuesta del backend al shape que consume ResultScreen */
export const toResultTicketInfo = (t: TicketCreatedResponse): TicketInfoForResult => {
  const turno =
    t.correlativo ||
    (t.prefix && t.turnNumber ? `${t.prefix}-${String(t.turnNumber).padStart(3, '0')}` : '—');

  const ventanilla =
    t.cashier?.name || (t.idCashier ? `Caja ${t.idCashier}` : undefined);

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
