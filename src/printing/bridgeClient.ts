// src/printing/bridgeClient.ts
import { io, Socket } from 'socket.io-client';
import { PrintAgent } from './index';
import { makeSocketAckSender } from './ackSocketSender';

type BridgeOpts = {
  backendUrl: string;
  sioPath?: string;
  locationId: string;
  printerIp: string;
  printerPort?: number;
  token?: string;
  onStatus?: (s: string, info?: any) => void;
};

export class BridgeClient {
  private socket?: Socket;
  private agent?: PrintAgent;
  private opts: BridgeOpts;
  private pingTimer?: ReturnType<typeof setInterval>;
  private boundOnPrintTicket: (msg: any) => void;

  constructor(opts: BridgeOpts) {
    this.opts = opts;
    this.boundOnPrintTicket = this.onPrintTicket.bind(this);
  }

  /** Inicializa socket + agente de impresión */
  async init() {
    // --- Socket.IO
    const url = this.opts.backendUrl.replace(/\/+$/, '');
    this.socket = io(url, {
      path: this.opts.sioPath || '/socket.io',
      transports: ['websocket', 'polling'],
      auth: this.opts.token ? { token: this.opts.token } : undefined,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
    });

    // --- PrintAgent (TCP 9100)
    this.agent = new PrintAgent({
      printerIp: this.opts.printerIp,
      printerPort: this.opts.printerPort ?? 9100,
      onStatus: (ev) =>
        this.opts.onStatus?.(`agent:${ev.type}`, { jobId: ev.jobId, info: ev.info }),
    });

    await this.agent.init();

    // ACKs por socket (sin tocar propiedades internas)
    this.agent.setAckSender(makeSocketAckSender(this.socket));

    // Handlers de socket
    this.socket.on('connect', () => {
      this.opts.onStatus?.('socket:connect', { id: this.socket?.id });
      this.socket?.emit('register-bridge', { locationId: this.opts.locationId });
    });

    this.socket.on('disconnect', (reason) => {
      this.opts.onStatus?.('socket:disconnect', { reason });
    });

    this.socket.on('connect_error', (err) => {
      this.opts.onStatus?.('socket:connect_error', { message: err?.message || String(err) });
    });

    // Mantener vivo
    this.pingTimer = setInterval(() => {
      try { this.socket?.emit('ping-check'); } catch {}
    }, 30000);

    // Trabajo de impresión entrante
    this.socket.on('print-ticket', this.boundOnPrintTicket);
  }

  /** Detiene socket/agent y limpia timers/handlers */
  stop() {
    try { if (this.pingTimer) clearInterval(this.pingTimer); } catch {}
    this.pingTimer = undefined;

    try { this.socket?.off('print-ticket', this.boundOnPrintTicket); } catch {}
    try { this.socket?.disconnect(); } catch {}
    this.socket = undefined;

    // No hace falta "cerrar" el agente; se recrea al reconfigurar
    this.agent = undefined;
  }

  /** Reconfigura al vuelo (sin rebuild) */
  async reconfigure(patch: Partial<BridgeOpts>) {
    this.stop();
    this.opts = { ...this.opts, ...patch };
    await this.init();
  }

  /** (Opcional) Impresión local de prueba */
  printTest() {
    if (!this.agent) return;
    const jobId = `local-${Date.now()}`;
    this.opts.onStatus?.('agent:start', { jobId });

    this.agent.enqueue({
      jobId,
      payload: {
        header: 'PRUEBA DE IMPRESIÓN',
        subHeader: '3nStar / ESC/POS',
        ticketNumber: 'TEST-01',
        name: 'Prueba',
        dpi: '0000000000000',
        service: 'Self Test',
        dateTime: new Date().toISOString(),
        footer: 'Si lees esto, 9100 está OK',
      },
      maxAttempts: 3,
    });

    this.opts.onStatus?.('enqueue_local', { jobId });
  }

  // ----- Interno: normalización robusta de payload (como en tu bridge Node) -----
  private onPrintTicket(msg: any) {
    try {
      const jobId = String(msg?.jobId || '');
      let type  = String(msg?.type || 'escpos');
      let payload = msg?.payload;

      // Acepta payload como string JSON o anidado { type, payload }
      if (typeof payload === 'string') {
        try {
          const obj = JSON.parse(payload);
          if (obj?.type && !msg?.type) type = obj.type;
          payload = (obj && typeof obj.payload === 'object') ? obj.payload : obj;
        } catch {
          payload = null;
        }
      } else if (payload && typeof payload === 'object') {
        if (payload.payload && typeof payload.payload === 'object') {
          if (!msg?.type && payload.type) type = payload.type;
          payload = payload.payload;
        }
      }

      if (!jobId) return;
      if (type !== 'escpos') {
        this.socket?.emit('print-ack', { jobId, ok: false, error: `Tipo no soportado: ${type}` });
        return;
      }
      if (!payload || typeof payload !== 'object') {
        this.socket?.emit('print-ack', { jobId, ok: false, error: 'Payload inválido o vacío' });
        return;
      }

      this.agent?.enqueue({
        jobId,
        payload: {
          header: String(payload.header ?? 'SISTEMA DE TURNOS'),
          subHeader: String(payload.subHeader ?? ''),
          ticketNumber: String(payload.ticketNumber ?? '---'),
          name: String(payload.name ?? ''),
          dpi: String(payload.dpi ?? ''),
          service: String(payload.service ?? ''),
          // Si viene vacío, RN calculará hora de Guatemala localmente
          dateTime: String(payload.dateTime ?? ''),
          footer: String(payload.footer ?? ''),
        },
        maxAttempts: 5,
      });

      this.opts.onStatus?.('enqueue_remote', { jobId, payload });
    } catch (e) {
      this.opts.onStatus?.('enqueue_error', { error: String(e) });
    }
  }
}
