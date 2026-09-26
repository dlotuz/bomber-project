// Paletas BGR555 [GFX §2.5].

/** Lê `n` cores BGR555 little-endian a partir do offset `o` de `bytes`. */
export function readBgr555(bytes: Uint8Array, o: number, n: number): Uint16Array {
  const out = new Uint16Array(n);
  for (let i = 0; i < n; i++) out[i] = bytes[o + 2 * i] | (bytes[o + 2 * i + 1] << 8);
  return out;
}

/** Canal de 5 bits → 8 bits: `c8 = c<<3 | c>>2`. */
export function c5to8(c: number): number { return ((c << 3) | (c >> 2)) & 0xff; }

/** Cor BGR555 → [r, g, b, 255]. */
export function bgr555ToRgba(v: number): [number, number, number, number] {
  return [c5to8(v & 31), c5to8((v >> 5) & 31), c5to8((v >> 10) & 31), 255];
}

/** Cor BGR555 → inteiro RGBA empacotado para escrita em Uint32Array little-endian (0xAABBGGRR). */
export function bgr555ToAbgr32(v: number): number {
  return (0xff000000 | (c5to8((v >> 10) & 31) << 16) | (c5to8((v >> 5) & 31) << 8) | c5to8(v & 31)) >>> 0;
}
