// src/printing/escposHelpers.ts
const ESC = 0x1B;
const GS  = 0x1D;

type Align = 'lt' | 'ct' | 'rt';
const alignCode: Record<Align, number> = { lt: 0, ct: 1, rt: 2 };

// Mapa mínimo para CP858 (amplíalo si necesitas más caracteres)
const CP858_MAP: Record<string, number> = {
  'á': 0xA0, 'é': 0x82, 'í': 0xA1, 'ó': 0xA2, 'ú': 0xA3,
  'Á': 0xB5, 'É': 0x90, 'Í': 0xD6, 'Ó': 0xE0, 'Ú': 0xE9,
  'ñ': 0xA4, 'Ñ': 0xA5,
  'ü': 0x81, 'Ü': 0x9A,
  'º': 0xA7, 'ª': 0xA6,
  '¿': 0xAD, '¡': 0xA8,
};

export function encodeCP858(text: string): number[] {
  const out: number[] = [];
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= 0x20 && code <= 0x7E) out.push(code);
    else if (CP858_MAP[ch] !== undefined) out.push(CP858_MAP[ch]);
    else if (ch === '\n') out.push(0x0A);
    else if (ch === '\r') { /* ignore */ }
    else out.push(0x3F); // '?'
  }
  return out;
}

export function init(): number[] { return [ESC, 0x40]; }                       // ESC @
export function setAlign(a: Align): number[] { return [ESC, 0x61, alignCode[a]]; } // ESC a n
export function setBold(on: boolean): number[] { return [ESC, 0x45, on ? 1 : 0]; } // ESC E n
export function setSize(w: 0|1|2, h: 0|1|2): number[] { return [GS, 0x21, (w<<4)|h]; } // GS ! n
export function cutFull(): number[] { return [GS, 0x56, 0x00]; }                // GS V 0
export function feed(n: number): number[] { return [ESC, 0x64, Math.max(0, Math.min(255, n))]; } // ESC d n
export function selectCP858(): number[] { return [ESC, 0x74, 19]; }             // ESC t 19 (típico CP858)
export function textLine(s: string): number[] { return [...encodeCP858(s), 0x0A]; }
export function drawLine(width = 32): number[] { return textLine('-'.repeat(Math.max(10, Math.min(64, width)))); }

export function concatBytes(...chunks: number[][]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}
