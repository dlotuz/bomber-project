import { hasGlyph, textPix, GLYPH_ADVANCE, LINE_HEIGHT } from '../art/font';
import { makePix, setPx, type Pix } from '../art/pix';

/** Caracteres que a fonte atual não tem (5×7; mesmo avanço de 6 px). */
export const FALLBACK_EXTRA: Record<string, readonly string[]> = {
  '∞': ['.....', '.....', '.#.#.', '#.#.#', '#.#.#', '.#.#.', '.....'],
  '✓': ['.....', '....#', '...#.', '#.#..', '.#...', '.....', '.....'],
  '[': ['.###.', '.#...', '.#...', '.#...', '.#...', '.#...', '.###.'],
  ']': ['.###.', '...#.', '...#.', '...#.', '...#.', '...#.', '.###.'],
};

export function fallbackMissing(text: string): string[] {
  return [...new Set([...text].filter(ch => ch !== ' ' && !hasGlyph(ch.toUpperCase()) && !(ch in FALLBACK_EXTRA)))];
}

/** Igual a `textPix` (contorno de 1 px), aceitando também os caracteres de FALLBACK_EXTRA. */
export function fallbackPix(text: string, color: string, shadow = '#0b0b14'): Pix {
  const up = text.toUpperCase();
  if (![...up].some(ch => ch in FALLBACK_EXTRA)) return textPix(up, color, shadow);
  const p = makePix(Math.max(0, up.length * GLYPH_ADVANCE - 1) + 2, LINE_HEIGHT + 2);
  [...up].forEach((ch, i) => {
    const x0 = i * GLYPH_ADVANCE;
    if (ch in FALLBACK_EXTRA) {
      FALLBACK_EXTRA[ch].forEach((r, y) => [...r].forEach((c, x) => { if (c === '#') setPx(p, x0 + x + 1, y + 3, color); }));
    } else {
      const g = textPix(ch, color, shadow);
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
        const k = (y * g.w + x) * 4;
        if (g.data[k + 3]) p.data.set(g.data.subarray(k, k + 4), ((y) * p.w + x0 + x) * 4);
      }
    }
  });
  return p;
}
