// services/ticketService.ts
import axios from 'axios';

// ⚠️ EN DISPOSITIVO FÍSICO: reemplaza por la IP de tu backend en la red
// ej: 'http://192.168.1.50:3001'
const BASE_URL = 'http://localhost:3001';

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 10000,
});

export interface RegisterTicketPayload {
  dpi?: string;
  name: string;
  idService: number;
  locationId: string;   // <-- NUEVO
}

export const getServices = async () => {
  const { data } = await api.get('/services');
  return data;
};

export const registerTicket = async (payload: RegisterTicketPayload) => {
  const { data } = await api.post('/ticket-registration', payload);
  return data;
};





