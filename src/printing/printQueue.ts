// src/printing/printQueue.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AckQueue } from './ackQueue';
import { TcpPrinter } from './tcpPrinter';
import {
  concatBytes, init, selectCP858, setAlign, setBold, setSize,
  drawLine, textLine, feed, cutFull
} from './escposHelpers';

export type PrintJob = {
  jobId: string;           // idempotencia
  payload: {
    header?: string;
    subHeader?: string;
    ticketNumber?: string;
    name?: string;
    dpi?: string;
    service?: string;
    dateTime?: string;
    footer?: string;
  };
  attempts?: number;
  maxAttempts?: number;    // default 5
  nextAt?: number;         // timestamp ms para reintento
  createdAt?: number;
};

type Events = {
  onStatus?: (ev: { type: string; jobId?: string; info?: any }) => void;
};

const STORAGE_QUEUE = '@printQueue/v1';
const STORAGE_DONE  = '@printDone/v1';

export class PrintQueue {
  private q: PrintJob[] = [];
  private doneIds: string[] = [];
  private busy = false;
  private printer: TcpPrinter;
  private ack: AckQueue;
  private ev?: Events;
  private maxDone = 2000;

  constructor(printer: TcpPrinter, ack: AckQueue, ev?: Events) {
    this.printer = printer;
    this.ack = ack;
    this.ev = ev;
  }

  async load() {
    const [rawQ, rawD] = await Promise.all([
      AsyncStorage.getItem(STORAGE_QUEUE),
      AsyncStorage.getItem(STORAGE_DONE),
    ]);
    this.q = rawQ ? JSON.parse(rawQ) : [];
    this.doneIds = rawD ? JSON.parse(rawD) : [];
  }

  private async persist() {
    await AsyncStorage.setItem(STORAGE_QUEUE, JSON.stringify(this.q));
    if (this.doneIds.length > this.maxDone) {
      this.doneIds = this.doneIds.slice(-this.maxDone);
    }
    await AsyncStorage.setItem(STORAGE_DONE, JSON.stringify(this.doneIds));
  }

  private emit(type: string, info?: any, jobId?: string) {
    this.ev?.onStatus?.({ type, jobId, info });
  }

  enqueue(job: Omit<PrintJob, 'attempts'|'createdAt'>) {
    if (!job.jobId) throw new Error('jobId requerido');

    if (this.doneIds.includes(job.jobId)) {
      this.emit('dedupe_done', { reason: 'already printed' }, job.jobId);
      this.ack.push({ jobId: job.jobId, ok: true, duplicate: true, ts: Date.now() });
      return;
    }
    if (this.q.some(j => j.jobId === job.jobId)) {
      this.emit('dedupe_queue', { reason: 'already enqueued' }, job.jobId);
      return;
    }

    const j: PrintJob = {
      ...job,
      attempts: 0,
      maxAttempts: job.maxAttempts ?? 5,
      createdAt: Date.now(),
    };
    this.q.push(j);
    this.persist();
    this.process();
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
        this.emit('start', { attempts: job.attempts }, job.jobId);

        try {
          await this.print(job);
          // éxito
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
            job.nextAt = Date.now() + Math.min(60000, base + jitter); // cap 60s
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
    const dateTime  = (p.dateTime ?? new Date().toISOString()).trim();
    const footer    = (p.footer ?? '').trim();

    return concatBytes(
      init(),
      selectCP858(),
      setAlign('ct'), setBold(true), setSize(1,1), textLine(header),
      setBold(false), setSize(0,0), textLine(subHeader || ' '),
      drawLine(32),

      setSize(2,2), textLine(ticket),
      setSize(0,0), setAlign('lt'),
      textLine(`Nombre: ${name}`),
      textLine(`DPI: ${dpi}`),
      textLine(`Servicio: ${service}`),
      textLine(`Fecha/Hora: ${dateTime}`),
      drawLine(32),

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
