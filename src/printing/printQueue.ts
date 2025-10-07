// src/printing/printQueue.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AckQueue } from './ackQueue';
import { TcpPrinter } from './tcpPrinter';
import {
  concatBytes, init, selectCP858, setAlign, setBold, setSize,
  drawLine, textLine, feed, cutFull
} from './escposHelpers';
import { LOGO_BYTES } from './logo';

export type PrintJob = {
  jobId: string; // <-- lo normalizaremos siempre a string al encolar
  payload: {
    header?: string; subHeader?: string; ticketNumber?: string;
    name?: string; dpi?: string; service?: string; dateTime?: string; footer?: string;
  };
  attempts?: number;
  maxAttempts?: number;
  nextAt?: number;
  createdAt?: number;
};

type Events = {
  onStatus?: (ev: { type: string; jobId?: string; info?: any }) => void;
};

const STORAGE_QUEUE = '@printQueue/v1';
const STORAGE_DONE  = '@printDone/v1';

// ===== Zona horaria Guatemala (forzada) =====
function fmtGTYYYYMMDDHHmm(d = new Date()): string {
  const parts = new Intl.DateTimeFormat('es-GT', {
    timeZone: 'America/Guatemala',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);

  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  const yyyy = get('year');
  const mm   = get('month');
  const dd   = get('day');
  const hh   = get('hour');
  const mi   = get('minute');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

export class PrintQueue {
  private q: PrintJob[] = [];
  private doneIds: string[] = [];
  private busy = false;
  private printer: TcpPrinter;
  private ack: AckQueue;
  private ev?: Events;
  private maxDone = 2000;

  // TTL para evitar reimpresión tras recuperación (ajusta a tu operación)
  private MAX_AGE_MS = 5 * 60 * 1000; // 5 minutos

  constructor(printer: TcpPrinter, ack: AckQueue, ev?: Events) {
    this.printer = printer;
    this.ack = ack;
    this.ev = ev;
  }

  async load() {
    try {
      const [rawQ, rawD] = await Promise.all([
        AsyncStorage.getItem(STORAGE_QUEUE),
        AsyncStorage.getItem(STORAGE_DONE),
      ]);
      this.q = rawQ ? JSON.parse(rawQ) : [];
      this.doneIds = rawD ? JSON.parse(rawD) : [];
      // Sanitiza tipos por si quedaron números
      this.q = this.q.map((j: any) => ({ ...j, jobId: String(j.jobId || '') }));
      this.doneIds = this.doneIds.map((x: any) => String(x));
    } catch {
      // Si algo vino corrupto, re-inicializa sin tumbar la app
      this.q = [];
      this.doneIds = [];
      await AsyncStorage.multiRemove([STORAGE_QUEUE, STORAGE_DONE]);
    }
  }

  private async persist() {
    if (this.doneIds.length > this.maxDone) {
      this.doneIds = this.doneIds.slice(-this.maxDone);
    }
    await Promise.all([
      AsyncStorage.setItem(STORAGE_QUEUE, JSON.stringify(this.q)),
      AsyncStorage.setItem(STORAGE_DONE, JSON.stringify(this.doneIds)),
    ]);
  }

  private emit(type: string, info?: any, jobId?: string) {
    this.ev?.onStatus?.({ type, jobId, info });
  }

  enqueue(job: Omit<PrintJob, 'attempts'|'createdAt'>) {
    if (!job.jobId) throw new Error('jobId requerido');

    // 🔐 normaliza SIEMPRE a string
    const normalizedId = String(job.jobId);

    // evita duplicados (hechos y en cola)
    if (this.doneIds.includes(normalizedId)) {
      this.emit('dedupe_done', { reason: 'already printed' }, normalizedId);
      this.ack.push({ jobId: normalizedId, ok: true, duplicate: true, ts: Date.now() });
      return;
    }
    if (this.q.some(j => j.jobId === normalizedId)) {
      this.emit('dedupe_queue', { reason: 'already enqueued' }, normalizedId);
      return;
    }

    const j: PrintJob = {
      ...job,
      jobId: normalizedId,
      attempts: 0,
      maxAttempts: job.maxAttempts ?? 5,
      createdAt: Date.now(),
    };

    // (Opcional) límite de cola en memoria para evitar crecimiento infinito
    const MAX_QUEUE = 500;
    if (this.q.length >= MAX_QUEUE) {
      // Estrategia: descartar el más viejo (o descarta el nuevo y ACK error)
      const dropped = this.q.shift();
      this.emit('queue_drop_oldest', { droppedId: dropped?.jobId }, normalizedId);
    }

    this.q.push(j);
    // guardamos ya con el id normalizado
    void this.persist();
    void this.process();
  }

  async process() {
    if (this.busy) return;
    this.busy = true;
    try {
      while (true) {
        const now = Date.now();
        const idx = this.q.findIndex(j => !j.nextAt || j.nextAt <= now);
        if (idx === -1) break;

        const job = this.q[idx];

        // ===== TTL: descarta trabajos viejos antes de imprimir =====
        if (job.createdAt && (Date.now() - job.createdAt) > this.MAX_AGE_MS) {
          this.emit('expired', { ageMs: Date.now() - job.createdAt }, job.jobId);
          this.ack.push({ jobId: job.jobId, ok: false, error: 'EXPIRED', ts: Date.now() });
          this.q.splice(idx, 1);
          await this.persist();
          continue;
        }

        this.emit('start', { attempts: job.attempts }, job.jobId);

        try {
          await this.print(job);
          this.doneIds.push(job.jobId);
          this.q.splice(idx, 1);
          await this.persist();

          this.emit('success', undefined, job.jobId);
          this.ack.push({ jobId: job.jobId, ok: true, ts: Date.now() });
        } catch (e: any) {
          job.attempts = (job.attempts ?? 0) + 1;
          const max = job.maxAttempts ?? 5;
          if (job.attempts >= max) {
            this.emit('failed', { error: String(e?.message || e) }, job.jobId);
            this.ack.push({ jobId: job.jobId, ok: false, error: String(e?.message || e), ts: Date.now() });
            this.q.splice(idx, 1);
            await this.persist();
          } else {
            const base = 2000 * Math.pow(2, job.attempts - 1);
            const jitter = Math.floor(Math.random() * 1000);
            job.nextAt = Date.now() + Math.min(60000, base + jitter);
            this.emit('retry_scheduled', { inMs: job.nextAt - Date.now(), error: String(e?.message || e) }, job.jobId);
            await this.persist();
          }
        }
      }
    } finally {
      this.busy = false;
    }
  }

  private buildEscPos(p: PrintJob['payload']): Uint8Array {
    const header    = (p.header ?? 'SISTEMA DE TURNOS').trim();
    const subHeader = (p.subHeader ?? '').trim();
    const ticket    = (p.ticketNumber ?? '---').trim();
    const name      = (p.name ?? '-').trim();
    const dpi       = (p.dpi ?? '-').trim();
    const service   = (p.service ?? '-').trim();

    // ⏰ Preferimos lo que manda backend; si viene vacío o null → hora Guatemala local
    const dateTime  = (p.dateTime && p.dateTime.trim().length > 0)
      ? p.dateTime.trim()
      : fmtGTYYYYMMDDHHmm(new Date());

    const footer    = (p.footer ?? '').trim();

    return concatBytes(
      init(),
      // ⚠️ Mantén el codepage consistente con tu impresora/bridge Node.
      // Si en el bridge Node usas CP858 (recomendado para acentos/ñ), esto ya está OK.
      // Si cambias a CP437, sustituye aquí por selectCP437() y ajusta tu encoder.
      selectCP858(),

      // Logo centrado (ya reducido en LOGO_BYTES)
      setAlign('ct'),
      ...(LOGO_BYTES && LOGO_BYTES.length ? [LOGO_BYTES, feed(1)] : []),

      // Encabezados
      setBold(true), setSize(1,1), textLine(header),
      setBold(false), setSize(0,0),
      textLine(subHeader || ' '),
      drawLine(32),

      // Cuerpo (a la izquierda)
      setAlign('lt'),
      setSize(2,2), textLine(ticket),
      setSize(0,0),
      textLine(`Nombre: ${name}`),
      textLine(`DPI: ${dpi}`),
      textLine(`Servicio: ${service}`),
      textLine(`Fecha/Hora: ${dateTime}`),
      drawLine(32),

      // Pie
      setAlign('ct'),
      ...(footer ? [textLine(footer)] : []),

      feed(2),
      cutFull(),
    );
  }

  private async print(job: PrintJob) {
    const raw = this.buildEscPos(job.payload);
    await this.printer.send(raw);
  }
}
