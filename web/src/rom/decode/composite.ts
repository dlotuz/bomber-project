// Composição do piso sob os tiles [GFX §2.2] ($C4:4C5C). Porte de decomp.composite.

/** Em cada tile de destino `dst + 32n` (n < ntiles), cada pixel de cor 0 recebe o pixel do tile de origem
 *  `src + 32·((n & 1) + 16·((n >> 4) & 1))` (bloco 16×16 no layout de 16 tiles por linha). Altera `buf`. */
export function composite(buf: Uint8Array, src: number, dst: number, ntiles: number): void {
  for (let n = 0; n < ntiles; n++) {
    const d = dst + 32 * n, s = src + 32 * ((n & 1) + 16 * ((n >> 4) & 1));
    for (let r = 0; r < 8; r++) {
      const a = d + 2 * r, b = d + 16 + 2 * r, sa = s + 2 * r, sb = s + 16 + 2 * r;
      const m = ~(buf[a] | buf[a + 1] | buf[b] | buf[b + 1]) & 0xff;
      buf[a] = (buf[a] & ~m) | (buf[sa] & m);
      buf[a + 1] = (buf[a + 1] & ~m) | (buf[sa + 1] & m);
      buf[b] = (buf[b] & ~m) | (buf[sb] & m);
      buf[b + 1] = (buf[b + 1] & ~m) | (buf[sb + 1] & m);
    }
  }
}

/** $C4:4BDD: tiles 768–1023 do buffer de 32 KB sobre o piso 16×16 dos tiles 8/9/24/25. */
export function compositeFloor(buf: Uint8Array): void { composite(buf, 0x0100, 0x6000, 256); }
