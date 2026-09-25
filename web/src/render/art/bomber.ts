import { fromRows, flipH, makePix, blit, type Pix, type Palette } from './pix';

/** Os 6 personagens originais do Crown Blast (só cosméticos). */
export interface CharacterDef { id: string; name: string; helmet: string; helmetShade: string; body: string; gloves: string; accent: string }

export const CHARACTERS: readonly CharacterDef[] = [
  { id: 'blanco', name: 'BLANCO', helmet: '#f4f4f4', helmetShade: '#b8c0d0', body: '#2e5bd8', gloves: '#e8403a', accent: '#ff5fa2' },
  { id: 'gear', name: 'GEAR', helmet: '#9aa3ad', helmetShade: '#5d6670', body: '#3a3f46', gloves: '#f2b632', accent: '#39d98a' },
  { id: 'tigra', name: 'TIGRA', helmet: '#ff9a2e', helmetShade: '#c8641a', body: '#1f8a4c', gloves: '#fff1c9', accent: '#ffd23f' },
  { id: 'aero', name: 'AERO', helmet: '#dfe7ff', helmetShade: '#8ea0d0', body: '#3348a8', gloves: '#ffd23f', accent: '#6ad0ff' },
  { id: 'verdi', name: 'VERDI', helmet: '#46b35a', helmetShade: '#2a7a3a', body: '#1d3b2a', gloves: '#e9e3c8', accent: '#c8ff5a' },
  { id: 'rubi', name: 'RUBI', helmet: '#d8344a', helmetShade: '#8f1f33', body: '#5a2a8f', gloves: '#1b1b22', accent: '#ffb13b' },
];

const FRONT = [
  '......kppk......', '.....kppppk.....', '......kppk......', '.......kk.......',
  '....kkkkkkkk....', '...khhhhhhhhk...', '..khhhhhhhhhhk..', '.khhkkkkkkkkhhk.',
  '.khksssssssskhk.', '.khksksssskskhk.', '.khksksssskskhk.', '.khksssssssskhk.',
  '..khkkkkkkkkhk..', '...kkHHHHHHkk...', '..kgkbbbbbbkgk..', '..kgkbbbbbbkgk..',
  '...kkbbbbbbkk...',
];
const BACK = [
  '......kppk......', '.....kppppk.....', '......kppk......', '.......kk.......',
  '....kkkkkkkk....', '...khhhhhhhhk...', '..khhhhhhhhhhk..', '.khhhhhhhhhhhhk.',
  '.khhhhhhhhhhhhk.', '.khhhhhhhhhhhhk.', '.khHhhhhhhhhHhk.', '.kHHhhhhhhhhHHk.',
  '..kHHHHHHHHHHk..', '...kkkkkkkkkk...', '..kgkbbbbbbkgk..', '..kgkbbbbbbkgk..',
  '...kkbbbbbbkk...',
];
const SIDE = [ // olhando para a direita
  '......kpk.......', '.....kppk.......', '......kpk.......', '.......kk.......',
  '.....kkkkkk.....', '....khhhhhhk....', '...khhhhhhhhk...', '..khhhhhkkkkhk..',
  '..khhhhksssskk..', '..khhhhkssksk...', '..khhhhkssksk...', '..kHhhhksssskk..',
  '...kHhhhkkkkk...', '....kkHHHHkk....', '.....kbbbbk.....', '.....kbbgkk.....',
  '.....kbbggk.....',
];
const LEGS_FRONT = [
  ['....kbbkkbbk....', '...kgggkkgggk...', '...kkkkkkkkkk...'],
  ['...kgggkkbbk....', '...kkkkkkgggk...', '.........kkkk...'],
  ['....kbbkkgggk...', '...kgggkkkkkk...', '...kkkk.........'],
];
const LEGS_SIDE = [
  ['......kbbk......', '.....kgggk......', '.....kkkkk......'],
  ['.....kbkkbk.....', '....kggkkggk....', '....kkk..kkk....'],
  ['......kbbk......', '......kggk......', '......kkkk......'],
];
/** Topo da cabeça (linhas 0–5) de cada personagem: frente/costas e perfil. */
const TOP: Record<string, string[] | null> = {
  blanco: null,
  gear: ['......kppk......', '......kppk......', '.......kk.......', '.......kk.......', '....kkkkkkkk....', '...khhhhhhhhk...'],
  tigra: ['................', '................', '...kk......kk...', '...kpk....kpk...', '...kpkkkkkkpk...', '...khhhhhhhhk...'],
  aero: ['....k......k....', '...kpk....kpk...', '...kppk..kppk...', '....kppkkppk....', '....kkkkkkkk....', '...khhhhhhhhk...'],
  verdi: ['.......pp.......', '......kppk......', '......kppk......', '......kppk......', '....kkkppkkk....', '...khhhhhhhhk...'],
  rubi: ['................', '..kk........kk..', '..kpk......kpk..', '...kpk....kpk...', '....kpkkkkpk....', '...khhhhhhhhk...'],
};
const SIDE_TOP: Record<string, string[] | null> = {
  blanco: null,
  gear: ['......kppk......', '......kppk......', '.......kk.......', '.......kk.......', '.....kkkkkk.....', '....khhhhhhk....'],
  tigra: ['................', '................', '....kk...kk.....', '....kpk..kpk....', '.....kpkkkpk....', '....khhhhhhk....'],
  aero: ['................', '..kk............', '..kppk..........', '...kppkk........', '....kppkkkk.....', '....khhhhhhk....'],
  verdi: ['................', '.....kpppk......', '....kppppk......', '.....kpppk......', '.....kkkkkk.....', '....khhhhhhk....'],
  rubi: ['................', '...kk.....kk....', '...kpk...kpk....', '....kpk.kpk.....', '.....kkkkkk.....', '....khhhhhhk....'],
};
/** Monóculo do Gear (só de frente). */
const MONOCLE: [number, number][] = [[8, 9], [8, 10], [8, 11], [9, 9], [9, 11], [10, 9], [10, 11], [11, 9], [11, 10], [11, 11]];

function palette(c: CharacterDef): Palette {
  return { '.': null, k: '#141018', h: c.helmet, H: c.helmetShade, s: '#ffe7c7', b: c.body, g: c.gloves, p: c.accent, w: '#ffffff' };
}

function assemble(base: string[], top: string[] | null, legs: string[], monocle: boolean): string[] {
  const rows = [...(top ?? base.slice(0, 6)), ...base.slice(6), ...legs].map(r => r.split(''));
  if (monocle) for (const [r, c] of MONOCLE) rows[r][c] = 'p';
  return rows.map(r => r.join(''));
}

/** dir: 1 cima, 2 baixo, 3 esquerda, 4 direita (igual ao DIR do core). frame: 0 parado, 1 e 2 caminhando. Sprite 16×20. */
export function bomberFrame(charIndex: number, dir: number, frame: number): Pix {
  const c = CHARACTERS[charIndex];
  const pal = palette(c);
  if (dir === 1) return fromRows(assemble(BACK, TOP[c.id], LEGS_FRONT[frame], false), pal);
  if (dir === 3 || dir === 4) {
    const p = fromRows(assemble(SIDE, SIDE_TOP[c.id], LEGS_SIDE[frame], false), pal);
    return dir === 3 ? flipH(p) : p;
  }
  return fromRows(assemble(FRONT, TOP[c.id], LEGS_FRONT[frame], c.id === 'gear'), pal);
}

/** Ícone de cabeça 16×14 para HUD e placar. */
export function headIcon(charIndex: number): Pix {
  const full = bomberFrame(charIndex, 2, 0);
  const p = makePix(16, 14);
  blit(p, full, 0, 0);
  return p;
}
