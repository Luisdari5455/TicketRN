import axios from 'axios';
import { Platform } from 'react-native';
import Config from 'react-native-config';

const DEFAULT_LOCAL = process.env.VITE_APP_API_URL;
const BASE_URL = DEFAULT_LOCAL; 

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 30000,
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
