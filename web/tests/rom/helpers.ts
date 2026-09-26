// Infra dos testes que usam a ROM (spec §10.1). Sem SB4_ROM, ROM = null e os describe.skipIf(!ROM) pulam.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateRom } from '../../src/rom/validate';

async function loadAndValidate(path: string): Promise<Uint8Array> {
  const r = await validateRom(new Uint8Array(readFileSync(path)));
  if (!r.ok) throw new Error(`SB4_ROM não é a ROM suportada (${r.motivo}): ${path}`);
  return r.rom;
}
/** ROM validada (4 MiB, sem cabeçalho de copiadora) ou null sem SB4_ROM. */
export const ROM: Uint8Array | null = process.env.SB4_ROM ? await loadAndValidate(process.env.SB4_ROM) : null;

export function sha1Hex(b: Uint8Array | string): string { return createHash('sha1').update(b).digest('hex'); }
export function u16le(a: Uint16Array): Uint8Array { const o = new Uint8Array(a.length * 2); a.forEach((v, i) => { o[2 * i] = v & 0xff; o[2 * i + 1] = v >> 8; }); return o; }
const FIX = fileURLToPath(new URL('../fixtures/rom/', import.meta.url));
export function fixture<T>(name: string): T { return JSON.parse(readFileSync(FIX + name, 'utf8')) as T; }

/** `hudMap` (spec §2.3, `assets-arena.ts` `hudMap()`) com o relógio montado em 3:00, como o HUD real na carga
 *  de uma partida: dígitos do relógio (linha `r`, colunas 4–7) e os 5 slots de jogador (ícone + rosto). */
export function hudWithStart(hud: Uint16Array): Uint16Array {
  const h = hud.slice();
  const put = (r: number, c: number, t: number) => { h[r * 32 + c] = (h[r * 32 + c] & 0xfc00) | (0x200 + t); };
  for (let r = 0; r < 3; r++) {
    put(r, 4, 0x32 + 0x10 * r); put(r, 5, 0x3a + 0x10 * r); put(r, 6, 0x39 + 0x10 * r); put(r, 7, 0x39 + 0x10 * r);
    for (let k = 0; k < 5; k++) { put(r, 10 + 4 * k, 0x01 + 2 * k + 0x10 * r); put(r, 11 + 4 * k, 0x02 + 2 * k + 0x10 * r); }
  }
  for (let k = 0; k < 5; k++) put(1, 12 + 4 * k, 0x4f);
  return h;
}
