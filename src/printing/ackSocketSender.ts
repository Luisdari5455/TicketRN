// src/printing/ackSocketSender.ts
import type { AckItem } from './ackQueue';
import type { Socket } from 'socket.io-client';

export function makeSocketAckSender(socket: Socket): (a: AckItem)=>Promise<void> {
  return async (a: AckItem) => {
    if (!socket || socket.disconnected) throw new Error('socket disconnected');
    // Tu backend escucha: socket.on('print-ack', { jobId, ok, error })
    socket.emit('print-ack', { jobId: a.jobId, ok: a.ok, error: a.error || null });
  };
}
