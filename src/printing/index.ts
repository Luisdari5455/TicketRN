// src/printing/index.ts
import { TcpPrinter } from './tcpPrinter';
import { AckQueue, AckSender, makeHttpAckSender } from './ackQueue';
import { PrintQueue } from './printQueue';

export type PrintAgentOptions = {
  printerIp: string;
  printerPort?: number;
  ackBaseUrl?: string;
  ackToken?: string;
  onStatus?: (ev: { type: string; jobId?: string; info?: any }) => void;
};

export class PrintAgent {
  private printer: TcpPrinter;
  private ack: AckQueue;
  private q: PrintQueue;
  private onStatus?: (ev: { type: string; jobId?: string; info?: any }) => void;

  constructor(opts: PrintAgentOptions) {
    this.onStatus = opts.onStatus;
    this.printer = new TcpPrinter({
      host: opts.printerIp,
      port: opts.printerPort ?? 9100,
      timeoutMs: 15000,
    });

    const defaultSender: AckSender = opts.ackBaseUrl
      ? makeHttpAckSender({ baseUrl: opts.ackBaseUrl, token: opts.ackToken })
      : async () => {};

    this.ack = new AckQueue(defaultSender);
    this.q = new PrintQueue(this.printer, this.ack, { onStatus: this.onStatus });
  }

  async init() {
    await Promise.all([this.ack.load(), this.q.load()]);
    this.ack.process();
    this.q.process();
  }

  setAckSender(sender: AckSender) {
    this.ack.setSender(sender);
  }

  enqueue(job: { jobId: string; payload: any; maxAttempts?: number }) {
    this.q.enqueue(job as any);
  }
}
