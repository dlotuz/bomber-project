import { makePix, fillRect, setPx, noise, type Pix } from './pix';

type FloorKind = 'hatch' | 'grass' | 'checker' | 'planks' | 'plates' | 'stars' | 'tiles' | 'sand' | 'carpet';
type SoftKind = 'brick' | 'crate' | 'bush' | 'rock' | 'fabric';

export interface Theme {
  floor: FloorKind; floorA: string; floorB: string;
  hardFace: string; hardLight: string; hardDark: string;
  wallFace: string; wallLight: string; wallDark: string;
  soft: SoftKind; softA: string; softB: string; softDark: string;
  bg: string;           // cor de fundo fora da arena
  hardStyle?: 'bevel' | 'flat';   // pilar com relevo (padrão) ou chapado
  wallStyle?: 'bevel' | 'plate';  // parede com relevo (padrão) ou placa rebitada
  checker?: boolean;              // alterna dois pisos em xadrez (padrão: sim)
}

/** Um tema por fase, na ordem de STAGE_NAMES. */
export const THEMES: readonly Theme[] = [
  { floor: 'hatch', floorA: '#3a9f44', floorB: '#4fb453', hardFace: '#8c8f96', hardLight: '#a6a9b0', hardDark: '#5c5f66', wallFace: '#8f9491', wallLight: '#adb2ae', wallDark: '#5a5f5c', soft: 'brick', softA: '#c6c6be', softB: '#b4b4ac', softDark: '#74746e', bg: '#2e3a2f', hardStyle: 'flat', wallStyle: 'plate', checker: false },
  { floor: 'plates', floorA: '#4a5563', floorB: '#58646f', hardFace: '#6f86a3', hardLight: '#a9bdd6', hardDark: '#3e4e63', wallFace: '#8a5a36', wallLight: '#b98357', wallDark: '#51331d', soft: 'crate', softA: '#c48a45', softB: '#a36d31', softDark: '#6b4520', bg: '#1f242b' },
  { floor: 'stars', floorA: '#141a3a', floorB: '#1d2552', hardFace: '#7a7fa8', hardLight: '#b3b8e0', hardDark: '#44486b', wallFace: '#3a3f6b', wallLight: '#6b72b0', wallDark: '#20233f', soft: 'rock', softA: '#9a7a62', softB: '#7c5f49', softDark: '#4f3a2b', bg: '#070918' },
  { floor: 'grass', floorA: '#2f7d3a', floorB: '#378a43', hardFace: '#8d8a80', hardLight: '#bdbab0', hardDark: '#55534c', wallFace: '#5b4632', wallLight: '#806449', wallDark: '#34271b', soft: 'bush', softA: '#4fbf5f', softB: '#3a9a49', softDark: '#1f5e2a', bg: '#16301a' },
  { floor: 'planks', floorA: '#b88a52', floorB: '#a67943', hardFace: '#c9b48c', hardLight: '#efe0bd', hardDark: '#86734f', wallFace: '#2d5a3d', wallLight: '#4b8a62', wallDark: '#173322', soft: 'brick', softA: '#d86a4a', softB: '#b8523a', softDark: '#7a3322', bg: '#1d2a22' },
  { floor: 'tiles', floorA: '#2f8f6f', floorB: '#287a5f', hardFace: '#b0a47a', hardLight: '#ddd2a8', hardDark: '#716846', wallFace: '#8a7a50', wallLight: '#b5a473', wallDark: '#51472c', soft: 'rock', softA: '#d2a860', softB: '#b08842', softDark: '#72552a', bg: '#1a2b25' },
  { floor: 'sand', floorA: '#a0703a', floorB: '#b07e46', hardFace: '#6b6b5e', hardLight: '#9d9d8d', hardDark: '#3f3f36', wallFace: '#3e6b3a', wallLight: '#5f9a58', wallDark: '#223e20', soft: 'bush', softA: '#35b066', softB: '#27904f', softDark: '#155530', bg: '#1f2a17' },
  { floor: 'checker', floorA: '#ececec', floorB: '#48b878', hardFace: '#e0b030', hardLight: '#fff0a0', hardDark: '#9a7412', wallFace: '#a02b3a', wallLight: '#d04a5a', wallDark: '#5e1420', soft: 'crate', softA: '#e04a4a', softB: '#b83434', softDark: '#6e1d1d', bg: '#2a0d14' },
  { floor: 'sand', floorA: '#d8b56a', floorB: '#e6c57c', hardFace: '#9a6a3a', hardLight: '#c99662', hardDark: '#5c3e1f', wallFace: '#6a8fc8', wallLight: '#9dbcec', wallDark: '#3a5580', soft: 'crate', softA: '#e8c54a', softB: '#c9a334', softDark: '#8a6c1c', bg: '#2d3a55' },
  { floor: 'carpet', floorA: '#7a3a8f', floorB: '#8f4aa6', hardFace: '#8a5a3a', hardLight: '#b98357', hardDark: '#4f311d', wallFace: '#c0b8a8', wallLight: '#ece6d8', wallDark: '#7a7466', soft: 'fabric', softA: '#e86a9a', softB: '#c84a7a', softDark: '#7a2448', bg: '#24122b' },
];

function paintFloor(t: Theme, alt: boolean, seed: number): Pix {
  const p = makePix(16, 16);
  const A = alt ? t.floorB : t.floorA, B = alt ? t.floorA : t.floorB;
  fillRect(p, 0, 0, 16, 16, A);
  switch (t.floor) {
    case 'hatch':
      // zigue-zague horizontal repetido a cada 8 px
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const zig = x % 8 < 4 ? x % 8 : 7 - (x % 8);
        if (y % 8 === zig) setPx(p, x, y, B);
      }
      break;
    case 'grass':
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (noise(x, y, seed) < 40) setPx(p, x, y, B);
      break;
    case 'sand':
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (noise(x, y, seed) < 25) setPx(p, x, y, B);
      break;
    case 'checker':
      fillRect(p, 0, 0, 8, 8, B); fillRect(p, 8, 8, 8, 8, B);
      break;
    case 'planks':
      for (let y = 0; y < 16; y += 4) fillRect(p, 0, y + 3, 16, 1, B);
      for (let y = 0; y < 16; y += 4) setPx(p, (y * 5 + seed) % 16, y + 1, B);
      break;
    case 'plates':
      fillRect(p, 0, 15, 16, 1, B); fillRect(p, 15, 0, 1, 16, B);
      setPx(p, 2, 2, B); setPx(p, 12, 2, B); setPx(p, 2, 12, B); setPx(p, 12, 12, B);
      break;
    case 'stars':
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (noise(x, y, seed) < 6) setPx(p, x, y, '#ffffff');
      break;
    case 'tiles':
      fillRect(p, 0, 0, 16, 1, B); fillRect(p, 0, 0, 1, 16, B); fillRect(p, 8, 0, 1, 16, B); fillRect(p, 0, 8, 16, 1, B);
      break;
    case 'carpet':
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + y) % 8 === 0 || (x - y + 16) % 8 === 0) setPx(p, x, y, B);
      break;
  }
  return p;
}

function bevel(face: string, light: string, dark: string): Pix {
  const p = makePix(16, 16);
  fillRect(p, 0, 0, 16, 16, dark);
  fillRect(p, 0, 0, 15, 15, light);
  fillRect(p, 1, 1, 14, 14, dark);
  fillRect(p, 1, 1, 13, 13, face);
  fillRect(p, 2, 2, 11, 1, light);
  fillRect(p, 2, 2, 1, 11, light);
  return p;
}

/** Bloco chapado: face lisa, luz em cima/esquerda, sombra embaixo/direita. */
function flat(face: string, light: string, dark: string): Pix {
  const p = makePix(16, 16);
  fillRect(p, 0, 0, 16, 16, face);
  fillRect(p, 0, 0, 16, 1, light); fillRect(p, 0, 0, 1, 16, light);
  fillRect(p, 0, 15, 16, 1, dark); fillRect(p, 15, 0, 1, 16, dark);
  return p;
}

/** Placa de metal com emendas e 4 rebites. */
function plate(face: string, light: string, dark: string): Pix {
  const p = flat(face, light, dark);
  for (const [x, y] of [[3, 3], [12, 3], [3, 12], [12, 12]]) { setPx(p, x, y, light); setPx(p, x + 1, y + 1, dark); }
  return p;
}

function paintSoft(t: Theme, seed: number): Pix {
  const p = makePix(16, 16);
  const { softA: A, softB: B, softDark: D } = t;
  switch (t.soft) {
    case 'brick':
      fillRect(p, 0, 0, 16, 16, D);
      for (let row = 0; row < 4; row++) {
        const off = row % 2 ? 4 : 0;
        for (let bx = -8; bx < 16; bx += 8) fillRect(p, bx + off + 1, row * 4 + 1, 6, 2, row % 2 ? B : A);
      }
      break;
    case 'crate':
      fillRect(p, 0, 0, 16, 16, D); fillRect(p, 1, 1, 14, 14, A);
      fillRect(p, 1, 1, 14, 2, B); fillRect(p, 1, 13, 14, 2, B);
      for (let i = 3; i < 13; i++) { setPx(p, i, i, D); setPx(p, 15 - i, i, D); }
      break;
    case 'bush':
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const dx = x - 7.5, dy = y - 8.5, r = dx * dx + dy * dy;
        if (r < 60) setPx(p, x, y, noise(x, y, seed) < 70 ? B : A);
        else if (r < 72) setPx(p, x, y, D);
      }
      setPx(p, 5, 5, '#ffffff');
      break;
    case 'rock':
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const dx = (x - 7.5) / 7.5, dy = (y - 8.5) / 6.5, r = dx * dx + dy * dy;
        if (r < 0.85) setPx(p, x, y, x + y < 12 ? A : B);
        else if (r < 1.05) setPx(p, x, y, D);
      }
      break;
    case 'fabric':
      fillRect(p, 1, 2, 14, 12, D);
      for (let y = 3; y < 13; y++) fillRect(p, 2, y, 12, 1, y % 3 === 0 ? B : A);
      fillRect(p, 0, 4, 1, 8, D); fillRect(p, 15, 4, 1, 8, D);
      break;
  }
  return p;
}

/** Bloco queimando: o soft block com faíscas por cima (frame 0/1). */
function burning(soft: Pix, frame: number, seed: number): Pix {
  const p = makePix(16, 16);
  p.data.set(soft.data);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const n = noise(x, y, seed + frame * 7);
    if (n < 90) setPx(p, x, y, n < 30 ? '#ffe45a' : n < 60 ? '#ff9a1a' : '#ff3b1a');
  }
  return p;
}

export interface StageTiles { floor: Pix; floorAlt: Pix; hard: Pix; wall: Pix; soft: Pix; burning: [Pix, Pix]; bg: string }

export function stageTiles(stage: number): StageTiles {
  const t = THEMES[stage - 1];
  const soft = paintSoft(t, stage);
  return {
    floor: paintFloor(t, false, stage), floorAlt: t.checker === false ? paintFloor(t, false, stage) : paintFloor(t, true, stage + 50),
    hard: (t.hardStyle === 'flat' ? flat : bevel)(t.hardFace, t.hardLight, t.hardDark),
    wall: (t.wallStyle === 'plate' ? plate : bevel)(t.wallFace, t.wallLight, t.wallDark),
    soft, burning: [burning(soft, 0, stage), burning(soft, 1, stage)], bg: t.bg,
  };
}
