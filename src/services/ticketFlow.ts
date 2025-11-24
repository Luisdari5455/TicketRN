// services/ticketFlow.ts
import NetInfo from '@react-native-community/netinfo';
import { loadConfig } from '../config/runtimeConfig';
import { registerTicket, type RegisterTicketPayload, type TicketCreatedResponse } from './ticketService';
import { printTicket } from './printerService';
import { enqueueOfflineTicket, getOfflineTickets, removeOfflineTicket } from './offlineQueue';
import { printOfflineSlip } from './bluetoothPrinter';

function timeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

function makeProvisionalId(payload: RegisterTicketPayload) {
  const ts = Date.now();
  const service = payload.idService ?? 'S';
  return `PROV-${service}-${ts}`;
}

export async function submitAndMaybePrint(payload: RegisterTicketPayload): Promise<{ official?: TicketCreatedResponse; provisionalId?: string }>{
  const cfg = await loadConfig();
  const online = (await NetInfo.fetch()).isConnected;
  const useAuto = cfg.printerMode === 'auto';

  // Try backend fast when online or not in auto
  if (online || !useAuto) {
    try {
      const ticket = await timeout(registerTicket(payload), 7000);
      // Print if BT modes want local printing too
      try { await printTicket(ticket); } catch {}
      return { official: ticket };
    } catch (e) {
      if (!useAuto) throw e;
      // fallthrough to provisional
    }
  }

  // Provisional flow (only in auto)
  if (useAuto) {
    const provisionalId = makeProvisionalId(payload);
    await enqueueOfflineTicket({ id: provisionalId, createdAt: Date.now(), payload });

    // Try print provisional by BT if configured
    try {
      // choose address from config
      if (cfg.btDeviceAddress) {
        await printOfflineSlip(cfg.btDeviceAddress, {
          provisionalId,
          serviceName: String(payload.idService),
          clientName: payload.name,
          note: 'Registro pendiente de sincronización',
        });
      }
    } catch {}
    return { provisionalId };
  }

  // If backend mode and failed, rethrow
  throw new Error('No se pudo registrar el ticket.');
}

export async function flushOfflineQueue(): Promise<number> {
  const list = await getOfflineTickets();
  let success = 0;
  for (const item of list) {
    try {
      const t = await registerTicket(item.payload);
      await removeOfflineTicket(item.id);
      success++;
      // Optional: we could show a toast or print small confirmation
    } catch {
      // keep in queue
    }
  }
  return success;
}
