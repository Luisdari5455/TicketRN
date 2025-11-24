// services/bluetoothPrinter.ts
// Bluetooth Classic ESC/POS printing for Android receipt printers like RPT006W.
// Requires: react-native-bluetooth-escpos-printer and a custom dev client (Expo) or bare RN.

import { Platform, PermissionsAndroid } from 'react-native';
import type { TicketCreatedResponse } from './ticketService';

type BluetoothManagerType = any;
type BluetoothPrinterType = any;

function loadModule(): { BluetoothManager?: BluetoothManagerType; BluetoothEscposPrinter?: BluetoothPrinterType } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-bluetooth-escpos-printer');
    return mod || {};
  } catch {
    return {};
  }
}

async function ensurePermissions() {
  if (Platform.OS !== 'android') return;
  const sdk = Number(Platform.Version);
  const needs = [
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
  ];
  if (sdk < 31) {
    needs.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  }
  for (const perm of needs) {
    const granted = await PermissionsAndroid.request(perm as any);
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new Error(`Permiso denegado: ${perm}`);
    }
  }
}

export async function connectAndPrint(
  address: string,
  ticket: TicketCreatedResponse
): Promise<void> {
  const { BluetoothManager, BluetoothEscposPrinter } = loadModule();
  if (!BluetoothManager || !BluetoothEscposPrinter) {
    throw new Error('Módulo Bluetooth no instalado. Instala react-native-bluetooth-escpos-printer y crea un dev client.');
  }

  await ensurePermissions();

  // No imprimir si falta correlativo oficial
  if (!ticket?.correlativo) {
    throw new Error('No se recibió correlativo del backend. No se puede imprimir.');
  }

  // Conectar
  await BluetoothManager.connect(address);

  try {
    // Config de impresión básica
    await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
    await BluetoothEscposPrinter.setBlob(0);
    await BluetoothEscposPrinter.setFont(0);
    await BluetoothEscposPrinter.printText('EMERGENCIAS Y EMERGENCIAS MUNICIPALIDAD\n', {
      encoding: 'CP437',
      codepage: 0,
      widthtimes: 1,
      heigthtimes: 1,
      fonttype: 0,
    });

    await BluetoothEscposPrinter.printText('--------------------------------\n', {});

    // Turno/Correlativo: usar SOLO lo que viene del backend, sin inventar
    await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.LEFT);
    if (ticket.correlativo) {
      await BluetoothEscposPrinter.printText(`Turno: ${ticket.correlativo}\n`, {});
    }
    if (ticket.service?.name) await BluetoothEscposPrinter.printText(`Servicio: ${ticket.service.name}\n`, {});
    if (ticket.client?.name) await BluetoothEscposPrinter.printText(`Cliente: ${ticket.client.name}\n`, {});
    if (ticket.cashier?.name) await BluetoothEscposPrinter.printText(`Ventanilla: ${ticket.cashier.name}\n`, {});
    await BluetoothEscposPrinter.printText(`Fecha: ${new Date(ticket.createdAt).toLocaleString()}\n`, {});

    await BluetoothEscposPrinter.printText('--------------------------------\n\n', {});
    await BluetoothEscposPrinter.printText('Gracias por su visita\n\n\n', {});

    // Corte (si la impresora lo soporta)
    try {
      await (BluetoothEscposPrinter as any).cutPaper && (BluetoothEscposPrinter as any).cutPaper();
    } catch {}
  } finally {
    try { await BluetoothManager.disconnect(); } catch {}
  }
}

// Imprime un comprobante provisional cuando no hay red
export async function printOfflineSlip(
  address: string,
  data: { provisionalId: string; serviceName?: string; clientName?: string; note?: string }
): Promise<void> {
  const { BluetoothManager, BluetoothEscposPrinter } = loadModule();
  if (!BluetoothManager || !BluetoothEscposPrinter) {
    throw new Error('Módulo Bluetooth no instalado.');
  }

  await ensurePermissions();
  await BluetoothManager.connect(address);

  try {
    await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
    await BluetoothEscposPrinter.setBlob(0);
    await BluetoothEscposPrinter.setFont(0);
    await BluetoothEscposPrinter.printText('COMPROBANTE PROVISIONAL\n', { widthtimes: 1, heigthtimes: 1 });
    await BluetoothEscposPrinter.printText('------------------------------\n', {});
    await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.LEFT);
    await BluetoothEscposPrinter.printText(`ID: ${data.provisionalId}\n`, {});
    if (data.serviceName) await BluetoothEscposPrinter.printText(`Servicio: ${data.serviceName}\n`, {});
    if (data.clientName) await BluetoothEscposPrinter.printText(`Cliente: ${data.clientName}\n`, {});
    await BluetoothEscposPrinter.printText(`Fecha: ${new Date().toLocaleString()}\n`, {});
    if (data.note) await BluetoothEscposPrinter.printText(`${data.note}\n`, {});
    await BluetoothEscposPrinter.printText('\nPresentar en ventanilla al ser llamado.\n\n\n', {});
  } finally {
    try { await BluetoothManager.disconnect(); } catch {}
  }
}

export async function listPaired(): Promise<Array<{ name: string; address: string }>> {
  const { BluetoothManager } = loadModule();
  if (!BluetoothManager) throw new Error('Módulo Bluetooth no instalado.');
  await ensurePermissions();
  const devices = await BluetoothManager.enableBluetooth();
  // devices viene como array de strings "name\naddress" o objetos según versión
  const parsed: Array<{ name: string; address: string }> = [];
  for (const d of devices || []) {
    if (typeof d === 'string') {
      const [name, address] = d.split('\n');
      if (address) parsed.push({ name, address });
    } else if (d?.address) {
      parsed.push({ name: d.name, address: d.address });
    }
  }
  return parsed;
}
