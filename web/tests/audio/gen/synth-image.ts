/**
 * Imagem de áudio SINTÉTICA com o mesmo formato das tabelas da ROM [AUD §1.2] e conteúdo nosso,
 * para testar o host sem a ROM. Módulo folha (sem imports).
 * Blocos: $31 driver (2 segmentos), $2E, $2F, $30 (bancos), $14 (sequência), $29 (voz $10), $1F (voz $06).
 * Música $14 = (bloco $14, set $13, comando $01). Set $13: lista IPL de 1 segmento + 2 samples em $7C00.
 */
const C0_START = 0xc00190, C0_LEN = 0x7eb - 0x190, DATA_START = 0xd90000, DATA_LEN = 0xde9c95 - 0xd90000;

export interface SynthImage {
  slices: { c0: Uint8Array; data: Uint8Array };
  /** o que cada bloco deve deixar na RAM do APU: [dest, bytes][] */
  blocks: Record<number, [number, Uint8Array][]>;
  /** samples do set $13, na ordem, a partir de $7C00 */
  set13: { list: [number, Uint8Array][]; samples: Uint8Array[] };
}

function bytes(seed: number, n: number): Uint8Array {
  const b = new Uint8Array(n); let s = seed;
  for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) >>> 0; b[i] = s >>> 24; }
  return b;
}

export function synthImage(): SynthImage {
  const c0 = new Uint8Array(C0_LEN), data = new Uint8Array(DATA_LEN);
  const put8 = (a: number, v: number) => { if (a >= DATA_START) data[a - DATA_START] = v; else c0[a - C0_START] = v; };
  const put16 = (a: number, v: number) => { put8(a, v & 0xff); put8(a + 1, v >> 8); };
  const put24 = (a: number, v: number) => { put16(a, v & 0xffff); put8(a + 2, v >> 16); };
  const putBytes = (a: number, b: Uint8Array) => b.forEach((v, i) => put8(a + i, v));
  let cursor = 0xd90000;
  const blocks: Record<number, [number, Uint8Array][]> = {};
  /** grava um bloco IPL [len][dest][dados]… 0,0 + palavra final e aponta a entrada `id` da tabela $C0:0190 */
  const block = (id: number, segs: [number, Uint8Array][], jump = 0x0800) => {
    put24(0xc00190 + 3 * id, cursor);
    for (const [dest, b] of segs) { put16(cursor, b.length); put16(cursor + 2, dest); putBytes(cursor + 4, b); cursor += 4 + b.length; }
    put16(cursor, 0); put16(cursor + 2, jump); cursor += 4;
    blocks[id] = segs;
  };
  block(0x31, [[0x0800, bytes(1, 40)], [0xff00, bytes(2, 12)]]);
  block(0x2e, [[0x5300, bytes(3, 16)], [0x5500, bytes(4, 30)]]);
  block(0x2f, [[0x3100, bytes(5, 50)]]);
  block(0x30, [[0x3100, bytes(6, 33)]]);
  block(0x14, [[0x4300, bytes(7, 64)]]);
  block(0x29, [[0x53fc, bytes(8, 4)], [0x54fc, bytes(9, 4)], [0x6a00, bytes(10, 301)]]);   // voz $10: 301 bytes de stream
  block(0x1f, [[0x53fc, bytes(11, 4)], [0x54fc, bytes(12, 4)], [0x6a00, bytes(13, 90)]]);  // voz $06
  // música $14 → (bloco $14, set $13, comando $01)
  put8(0xc00739 + 3 * 0x14, 0x14); put8(0xc0073a + 3 * 0x14, 0x13); put8(0xc0073b + 3 * 0x14, 0x01);
  // SFX: comando $32 + id
  for (let id = 1; id < 50; id++) put8(0xc00787 + id, 0x32 + id);
  // vozes: (bloco $19 + id, comando $63 + id)
  for (let id = 1; id <= 0x14; id++) { put8(0xc007b9 + 2 * id, 0x19 + id); put8(0xc007ba + 2 * id, 0x63 + id); }
  // set de samples $13 (descritor no banco $DA)
  const listAddr = 0xda1900, descAddr = 0xda1a00;
  put16(0xda17d2 + 2 * 0x13, descAddr & 0xffff);
  const list: [number, Uint8Array][] = [[0x5378, bytes(14, 20)]];
  put16(listAddr, 20); put16(listAddr + 2, 0x5378); putBytes(listAddr + 4, list[0][1]); put16(listAddr + 24, 0);
  put16(descAddr, listAddr & 0xffff); put16(descAddr + 2, 0x7c00); put8(descAddr + 4, 0x05); put8(descAddr + 5, 0x09); put8(descAddr + 6, 0xff);
  const samples = [bytes(15, 45), bytes(16, 27)];
  [0x05, 0x09].forEach((s, i) => {
    const at = 0xdb0000 + i * 0x100;
    put24(0xda2118 + 3 * s, at); put16(0xda2238 + 2 * s, samples[i].length); putBytes(at, samples[i]);
  });
  return { slices: { c0, data }, blocks, set13: { list, samples } };
}
