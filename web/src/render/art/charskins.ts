// Skins: variações dos 6 personagens originais, escolhidas como se fossem personagens (6, 7, 8…). Não mudam o jogo —
// só o desenho: uma forma (`shape`: cartola, gordão, pequeno…; `charshape.ts`) sobre o quadro do personagem-base e,
// se quiser, uma troca de cor (`tint`, rotação de matiz da paleta; o contorno e a cor transparente — índices 0 e 1
// das paletas da ROM — ficam como estão). A ROM continua sendo a fonte dos quadros e o resto do jogo trata a skin
// como o personagem-base (`baseChar`). Sem `tint` a skin usa as cores originais e não gasta linha de paleta.

import type { SkinShape } from './charshape';

/** Quantos personagens originais existem (0..5). */
export const BASE_CHARS = 6;

export interface SkinDef {
  /** Personagem original em que a skin se baseia (0..5). */
  base: number;
  /** Nome curto (cabe na lista da sala). */
  name: string;
  /** Forma extra desenhada sobre o quadro do personagem-base (ausente = o desenho original). */
  shape?: SkinShape | readonly SkinShape[];
  /** Troca de cor (ausente = as cores originais): rotação do matiz (graus), multiplicador de saturação e brilho somado (−1..1). */
  tint?: { hue: number; sat: number; light: number };
}

/** Todas partem do Blanco, com as cores originais; mudam só uma característica. Mais skins = mais linhas aqui
 *  (e, para uma forma nova, uma função em `charshape.ts`). */
export const SKINS: readonly SkinDef[] = [
  { base: 0, name: 'CARTOLA', shape: ['suit', 'hat'] },
  { base: 0, name: 'PEQUENO', shape: 'small' },
  { base: 0, name: 'GORDAO', shape: 'fat' },
];

/** Paleta do boneco com a skin: cores giradas se a skin tem `tint`; senão a própria paleta. */
export function skinPalette(pal: Uint16Array, skin: SkinDef): Uint16Array {
  return recolorBgr555(pal, skin);
}

/** Total de personagens escolhíveis (originais + skins). */
export const CHAR_COUNT = BASE_CHARS + SKINS.length;

export const isSkin = (c: number): boolean => c >= BASE_CHARS && c < CHAR_COUNT;
export const skinOf = (c: number): SkinDef | null => (isSkin(c) ? SKINS[c - BASE_CHARS] : null);
/** O personagem original de que `c` vem (ele mesmo, se não for skin). */
export const baseChar = (c: number): number => skinOf(c)?.base ?? c;

type Rgb = [number, number, number];

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m];
}

/** Cor (0..1 por canal) da skin: gira o matiz, ajusta a saturação e o brilho. Cinzas e pele (pouca saturação) mudam pouco. */
export function recolorRgb(c: Rgb, skin: SkinDef): Rgb {
  const tint = skin.tint;
  if (!tint) return c;
  const [h, s, l] = rgbToHsl(c);
  if (l > 0.82) return c;   // brancos e pele clara ficam como estão
  const strength = Math.min(1, s * 2);   // quase-cinza não ganha matiz novo
  const hue = (h + tint.hue * strength + 360) % 360;
  const sat = Math.min(1, s * tint.sat);
  const light = Math.max(0, Math.min(1, l + tint.light * (1 - Math.abs(2 * l - 1))));
  return hslToRgb(hue, sat, light);
}

/** Paleta BGR555 (16 cores, índice 0 = transparente, 1 = contorno) pintada com a skin. */
export function recolorBgr555(pal: Uint16Array, skin: SkinDef, keep = 2): Uint16Array {
  if (!skin.tint) return pal.slice();
  return pal.map((v, i) => {
    if (i < keep) return v;
    const r = (v & 31) / 31, g = ((v >> 5) & 31) / 31, b = ((v >> 10) & 31) / 31;
    const [R, G, B] = recolorRgb([r, g, b], skin);
    const q = (x: number): number => Math.max(0, Math.min(31, Math.round(x * 31)));
    return q(R) | (q(G) << 5) | (q(B) << 10);
  });
}

/** Cor "#rrggbb" da skin (arte própria, sem ROM). */
export function recolorHex(hex: string, skin: SkinDef): string {
  const n = parseInt(hex.slice(1), 16);
  const [R, G, B] = recolorRgb([(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255], skin);
  const q = (x: number): string => Math.max(0, Math.min(255, Math.round(x * 255))).toString(16).padStart(2, '0');
  return `#${q(R)}${q(G)}${q(B)}`;
}
