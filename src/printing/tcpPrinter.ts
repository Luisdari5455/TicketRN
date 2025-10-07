// src/printing/tcpPrinter.ts
import TcpSocket from 'react-native-tcp-socket';

export type PrintTarget = { host: string; port?: number; timeoutMs?: number };

export class TcpPrinter {
  private host: string;
  private port: number;
  private timeoutMs: number;

  constructor(target: PrintTarget) {
    this.host = target.host;
    this.port = target.port ?? 9100;
    this.timeoutMs = target.timeoutMs ?? 8000;
  }

  async send(raw: Uint8Array): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const socket = TcpSocket.createConnection(
        { host: this.host, port: this.port, tls: false }, 
        () => {
          try {
            socket.setTimeout?.(this.timeoutMs);     
            socket.write(raw);
            socket.end();                               
          } catch (e) {
            try { socket.destroy(); } catch {}
            reject(this.wrapError(e));
          }
        }
      );

      let finished = false;
      const finish = (err?: any) => {
        if (finished) return;
        finished = true;
        try { socket.destroy(); } catch {}
        if (err) reject(this.wrapError(err)); else resolve();
      };

      socket.on('error', (err) => finish(err));
      socket.on('timeout', () =>
        finish(this.error('TIMEOUT', `Printer timeout after ${this.timeoutMs}ms`))
      );

      // En RN no hay 'end'; usa 'close' como señal de cierre
      socket.on('close', () => finish());
    });
  }

  private error(code: string, message: string) {
    const e = new Error(message) as any;
    e.code = code;
    return e;
  }

  private wrapError(err: any) {
    const msg = String(err?.message || err);
    if (/refused|ECONNREFUSED/i.test(msg)) return this.error('CONN_REFUSED', msg);
    if (/timed out|timeout|ETIMEDOUT/i.test(msg)) return this.error('TIMEOUT', msg);
    if (/host not found|ENOTFOUND|EAI_AGAIN/i.test(msg)) return this.error('DNS', msg);
    return this.error('IO', msg);
  }
}
