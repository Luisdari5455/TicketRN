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
  onStatus?: (s: string, info?: any)=>void;
};

export class BridgeClient {
  private socket!: Socket;
  private agent!: PrintAgent;
  private opts: BridgeOpts;

  constructor(opts: BridgeOpts) {
    this.opts = opts;
  }

  async init() {
    // 1) Socket
    const url = this.opts.backendUrl.replace(/\/+$/,'');
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

    // 2) PrintAgent usando ACK via socket (en lugar de HTTP)
    this.agent = new PrintAgent({
      printerIp: this.opts.printerIp,
      printerPort: this.opts.printerPort ?? 9100,
      onStatus: (ev) => this.opts.onStatus?.(`agent:${ev.type}`, { jobId: ev.jobId, info: ev.info }),
    });

    await this.agent.init();

    // Reemplaza el sender de ACK del agente por socket
    // @ts-ignore acceso interno controlado
    this.agent['ack']['sender'] = makeSocketAckSender(this.socket);

    // 3) Eventos del socket
    this.socket.on('connect', () => {
      this.opts.onStatus?.('socket:connect', { id: this.socket.id });
      this.socket.emit('register-bridge', { locationId: this.opts.locationId });
    });

    this.socket.on('disconnect', (reason) => {
      this.opts.onStatus?.('socket:disconnect', { reason });
    });

    this.socket.on('connect_error', (err) => {
      this.opts.onStatus?.('socket:connect_error', { message: err?.message || String(err) });
    });

    setInterval(() => { try { this.socket.emit('ping-check'); } catch {} }, 30000);

    // 4) Recibir trabajos de impresión remotos
    this.socket.on('print-ticket', (msg: any) => {
      try {
        const jobId = String(msg?.jobId || '');
        const type  = String(msg?.type || 'escpos');
        const payload = msg?.payload || {};

        if (!jobId) return;
        if (type !== 'escpos') {
          this.socket.emit('print-ack', { jobId, ok: false, error: `Tipo no soportado: ${type}` });
          return;
        }

        this.agent.enqueue({
          jobId,
          payload: {
            header: payload.header || 'SISTEMA DE TURNOS',
            subHeader: payload.subHeader || '',
            ticketNumber: payload.ticketNumber || '---',
            name: payload.name || '',
            dpi: payload.dpi || '',
            service: payload.service || '',
            dateTime: payload.dateTime || new Date().toISOString(),
            footer: payload.footer || '',
          },
          maxAttempts: 5,
        });

        this.opts.onStatus?.('enqueue_remote', { jobId, payload });
      } catch (e) {
        this.opts.onStatus?.('enqueue_error', { error: String(e) });
      }
    });
  }

  /** 👇 Impresión local de prueba (sin backend) */
  printTest() {
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
        footer: 'Si lees esto, el canal 9100 está OK',
      },
      maxAttempts: 3,
    });

    this.opts.onStatus?.('enqueue_local', { jobId });
  }
}
