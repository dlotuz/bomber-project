import { makePix, fillRect, type Pix } from './pix';

export type FlamePart = 'center' | 'h' | 'v' | 'up' | 'down' | 'left' | 'right';

const BANDS = ['#ff3b1a', '#ff9a1a', '#ffe45a', '#ffffff'];
/** Meia-altura de cada faixa (de fora para dentro). */
const HALF = [6, 4, 2, 1];

function transpose(src: Pix): Pix {
  const p = makePix(src.h, src.w);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const si = (y * src.w + x) * 4, di = (x * p.w + y) * 4;
    for (let k = 0; k < 4; k++) p.data[di + k] = src.data[si + k];
  }
  return p;
}

function mirrorX(src: Pix): Pix {
  const p = makePix(src.w, src.h);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const si = (y * src.w + x) * 4, di = (y * src.w + (src.w - 1 - x)) * 4;
    for (let k = 0; k < 4; k++) p.data[di + k] = src.data[si + k];
  }
  return p;
}

/** Braço horizontal; `tip` = termina com ponta arredondada à direita. */
function horizontal(shrink: number, tip: boolean): Pix {
  const p = makePix(16, 16);
  for (let i = shrink; i < BANDS.length; i++) {
    const t = 8 - HALF[i], b = 7 + HALF[i];
    const end = tip ? 11 - i * 2 : 15;
    fillRect(p, 0, t, end + 1, b - t + 1, BANDS[i]);
    if (tip && b - t > 1) fillRect(p, end + 1, t + 1, 2, b - t - 1, BANDS[i]);
  }
  return p;
}

/**
 * Peça de chama 16×16. `shrink` (0..3) afina a chama: use 0 no meio da explosão
 * e valores maiores no começo e no fim, para animar.
 */
export function flamePiece(part: FlamePart, shrink: number): Pix {
  const s = Math.max(0, Math.min(3, shrink));
  switch (part) {
    case 'h': return horizontal(s, false);
    case 'v': return transpose(horizontal(s, false));
    case 'right': return horizontal(s, true);
    case 'left': return mirrorX(horizontal(s, true));
    case 'down': return transpose(horizontal(s, true));
    case 'up': return transpose(mirrorX(horizontal(s, true)));
    case 'center': {
      const p = makePix(16, 16);
      for (let i = s; i < BANDS.length; i++) {
        const t = 8 - HALF[i], len = HALF[i] * 2;
        fillRect(p, 0, t, 16, len, BANDS[i]);
        fillRect(p, t, 0, len, 16, BANDS[i]);
        fillRect(p, t - 1, t - 1, len + 2, len + 2, BANDS[i]);
      }
      return p;
    }
  }
}
