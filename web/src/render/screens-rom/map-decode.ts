// Mapas de BG das telas lidos da ROM em tempo de execução (A14). Só endereços e formatos; nenhum mapa copiado.
import type { RomAssets } from '../../app/rom-api';

type Rom = RomAssets['rom'];

/** Decodificador `$C4:08D3` (mesmo formato dos mapas das arenas [ARN §2.3]): 1 byte ignorado; tokens u16 LE com
 *  `código = t & $3FF` e `repetições extras = t >> 10`; cada código vira a palavra `u16(tabela + 2·código)`. */
export function decodeSceneMap(rom: Rom, stream: number, table: number, n = 1024): Uint16Array {
  const out = new Uint16Array(n);
  let a = stream + 1, k = 0;
  while (k < n) {
    const t = rom.u16(a); a += 2;
    const w = rom.u16(table + 2 * (t & 0x3ff));
    for (let r = 0; r <= t >> 10 && k < n; r++) out[k++] = w;
  }
  return out;
}

/** Descritor de tela lido por `$C1:BF88` (ponteiro em `$70`): `+0` script gráfico de 48 B, `+3/+6` fluxo e tabela do
 *  mapa do BG1 (→ `$7E:5000`), `+9/+C` fluxo e tabela do mapa do BG2 (→ `$7E:2000`). */
export interface SceneDescriptor { script: number; bg1: [number, number]; bg2: [number, number] }
export function readDescriptor(rom: Rom, addr: number): SceneDescriptor {
  return { script: rom.p24(addr), bg1: [rom.p24(addr + 3), rom.p24(addr + 6)], bg2: [rom.p24(addr + 9), rom.p24(addr + 12)] };
}
export function descriptorMap(rom: Rom, addr: number, layer: 'bg1' | 'bg2'): Uint16Array {
  const [stream, table] = readDescriptor(rom, addr)[layer];
  return decodeSceneMap(rom, stream, table);
}

/** Mapa 32×32 cru (1024 palavras LE), como as rotinas da tradução copiam para `$7E:5000` (2048 B, `LDA $bank:addr,X`). */
export function rawMap(rom: Rom, addr: number): Uint16Array {
  const out = new Uint16Array(1024);
  for (let i = 0; i < 1024; i++) out[i] = rom.u16(addr + 2 * i);
  return out;
}

/** Tira o texto original: toda casa cuja paleta não é `keepPal` vira a palavra de fundo (0 = vazio; o BG2 aparece). */
export function keepPalette(m: Uint16Array, keepPal: number): Uint16Array {
  return m.map(w => (((w >> 10) & 7) === keepPal ? w : 0));
}

/** `$C4:680C`: liga a prioridade (bit 13) num bloco `w×h` de casas a partir de (`col`, `lin`). */
export function setPriority(m: Uint16Array, col: number, lin: number, w: number, h: number): Uint16Array {
  const out = m.slice();
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out[(lin + j) * 32 + col + i] |= 0x2000;
  return out;
}
