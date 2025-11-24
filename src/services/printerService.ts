// services/printerService.ts
import { loadConfig } from '../config/runtimeConfig';
import type { TicketCreatedResponse } from './ticketService';
import { connectAndPrint } from './bluetoothPrinter';

export async function printTicket(ticket: TicketCreatedResponse): Promise<{ method: 'bluetooth' | 'backend-skip' }>{
  const cfg = await loadConfig();

  if (cfg.printerMode === 'bluetooth' && cfg.btDeviceAddress) {
    await connectAndPrint(cfg.btDeviceAddress, ticket);
    return { method: 'bluetooth' };
  }

  // Si se usa backend, no hacemos nada aquí: ya imprimes del lado servidor
  return { method: 'backend-skip' };
}
