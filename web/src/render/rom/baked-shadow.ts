// Sombra chapada que a ROM desenha no próprio sprite. Os quadros dos personagens (folhas p24($C2:0730 + 3c)) e das
// montarias (MOUNT_GFX) trazem, na base, uma elipse chapada na cor do contorno (índice 1 nos personagens e na maioria
// das montarias; $B na montaria tipo 3) por baixo dos pés:
// no personagem parado ↓ (char 0, quadro 6/7) são as linhas 24–28 do quadro 32×32, com 9/13/15/13/9 px; na montaria
// tipo 2 as linhas 26–31. Com os efeitos ligados, a camada de efeitos já desenha uma sombra suave no chão (fx/shadows);
// para não haver duas, o desenho do jogador VIVO tira esta (o morrendo, que encolhe a sombra da ROM, e os Bad Bombers
// ficam como na ROM — a camada de efeitos não desenha sombra para eles). Com os efeitos desligados nada muda.
import type { ObjEntry } from '../ppu';

const MIN_PX = 4;          // a última linha da elipse tem 9 px (personagem parado), 4 (arremessando), 6 (montaria)
const ROWS = 6;            // altura máxima da elipse (montaria: 6 linhas)

const cache = [new WeakMap<Uint8Array, Uint8Array>(), new WeakMap<Uint8Array, Uint8Array>()];

/** Quadro `size`×`size` (índices, linha a linha) sem a sombra chapada: na última linha desenhada, o índice mais comum
 *  (o da sombra — preto em todas as paletas medidas) tem de ser ≥ 4 px, a maioria da linha e ocupar ao menos metade
 *  do trecho entre as pontas dele (a ponta dos pés pode encostar: "1111771111") — senão o quadro não tem a elipse
 *  (pés no chão, sentado, no ar) e volta o mesmo objeto. A elipse = os pixels desse índice ligados (8-vizinhos) a essa
 *  linha nas 6 linhas de baixo; deles só ficam os que encostam (4-vizinhos) em outra cor — o contorno dos pés/da
 *  barriga. Pura e em cache por quadro. */
export function stripBakedShadow(px: Uint8Array, size: number): Uint8Array {
  const memo = cache[size === 32 ? 1 : 0];
  let out = memo.get(px);
  if (out) return out;
  out = strip(px, size);
  memo.set(px, out);
  return out;
}

function strip(px: Uint8Array, size: number): Uint8Array {
  let low = -1;
  for (let y = size - 1; y >= 0 && low < 0; y--) for (let x = 0; x < size; x++) if (px[y * size + x]) { low = y; break; }
  if (low < 0) return px;
  const count = new Uint16Array(16);
  for (let x = 0; x < size; x++) count[px[low * size + x] & 15]++;
  let shadow = 1;
  for (let v = 1; v < 16; v++) if (count[v] > count[shadow]) shadow = v;
  let x0 = -1, x1 = -1, all = 0;
  for (let x = 0; x < size; x++) {
    const v = px[low * size + x];
    if (!v) continue;
    all++;
    if (v !== shadow) continue;
    if (x0 < 0) x0 = x;
    x1 = x;
  }
  const n = count[shadow];
  // pés no chão (a cor deles domina a última linha), ou só pontas soltas (sentado na montaria: "11.......11")
  if (n < MIN_PX || 2 * n < all || 2 * n < x1 - x0 + 1) return px;
  const top = Math.max(0, low - ROWS + 1);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= size || y >= size ? 0 : px[y * size + x]);
  const seen = new Uint8Array(size * size), stack: number[] = [];
  for (let x = x0; x <= x1; x++) if (px[low * size + x] === shadow) { seen[low * size + x] = 1; stack.push(low * size + x); }
  const res = Uint8Array.from(px);
  let removed = 0;
  while (stack.length) {
    const i = stack.pop()!, x = i % size, y = (i / size) | 0;
    const edge = [at(x, y - 1), at(x, y + 1), at(x - 1, y), at(x + 1, y)].some(v => v !== 0 && v !== shadow);
    if (!edge) { res[i] = 0; removed++; }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (ny < top || ny > low || nx < 0 || nx >= size) continue;
      const j = ny * size + nx;
      if (!seen[j] && px[j] === shadow) { seen[j] = 1; stack.push(j); }
    }
  }
  return removed ? res : px;
}

/** A mesma entrada de OAM com o quadro sem a sombra chapada (só peças de pixels próprios, sem espelho vertical). */
export function withoutBakedShadow(e: ObjEntry): ObjEntry {
  const src = e.src as { px?: Uint8Array };
  if (!src.px || e.vflip) return e;
  const px = stripBakedShadow(src.px, e.size);
  return px === src.px ? e : { ...e, src: { px } };
}
