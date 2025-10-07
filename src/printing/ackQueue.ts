// src/printing/ackQueue.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AckItem = {
  jobId: string;
  ok: boolean;
  duplicate?: boolean;
  error?: string;
  ts: number;
};

export type AckSender = (a: AckItem) => Promise<void>;

const STORAGE_KEY = '@ackQueue/v1';

export class AckQueue {
  private sending = false;
  private queue: AckItem[] = [];
  // ⬇️ OJO: la mantenemos pública con getter/setter o vía método setSender
  private _sender: AckSender;
  private maxSize = 2000;

  constructor(sender: AckSender) {
    this._sender = sender;
  }

  setSender(sender: AckSender) {
    this._sender = sender;
  }

  async load() {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    this.queue = raw ? JSON.parse(raw) : [];
  }

  private async persist() {
    if (this.queue.length > this.maxSize) {
      this.queue = this.queue.slice(-this.maxSize);
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
  }

  async push(a: AckItem) {
    this.queue.push(a);
    await this.persist();
    this.process();
  }

  async process() {
    if (this.sending) return;
    this.sending = true;
    try {
      while (this.queue.length) {
        const item = this.queue[0];
        try {
          await this._sender(item);
          this.queue.shift();
          await this.persist();
        } catch {
          // backoff simple
          await new Promise(r => setTimeout(r, 5000));
          break;
        }
      }
    } finally {
      this.sending = false;
    }
  }
}

// Variante HTTP opcional (por si también quieres REST)
export function makeHttpAckSender(opts: { baseUrl: string; token?: string }): AckSender {
  return async (a: AckItem) => {
    const res = await fetch(`${opts.baseUrl.replace(/\/+$/,'')}/api/print/ack`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: JSON.stringify(a),
    });
    if (!res.ok) throw new Error(`ACK HTTP ${res.status}`);
  };
}
