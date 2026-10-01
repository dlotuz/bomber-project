export const GRID_W = 17;
export const GRID_H = 13;
export const CELLS = GRID_W * GRID_H;
export const SUB = 256;

export const cellOf = (col: number, lin: number): number => lin * GRID_W + col;
export const colOf = (cell: number): number => cell % GRID_W;
export const linOf = (cell: number): number => Math.floor(cell / GRID_W);
/** 1/256 px → px (piso, vale para negativos). */
export const px = (v: number): number => Math.floor(v / SUB);
export const centerX = (col: number): number => (16 * col - 1) * SUB;
export const centerY = (lin: number): number => (16 * (lin + 2) - 1) * SUB;
export const colAt = (x: number): number => Math.floor((px(x) + 8) / 16);
export const linAt = (y: number): number => Math.floor((px(y) + 8) / 16) - 2;
export const inGrid = (col: number, lin: number): boolean => col >= 0 && col < GRID_W && lin >= 0 && lin < GRID_H;
export const inField = (col: number, lin: number): boolean => col >= 2 && col <= 14 && lin >= 1 && lin <= 11;
/** Casa do ponto (x, y); -1 fora da grade. */
export function cellAt(x: number, y: number): number {
  const col = colAt(x), lin = linAt(y);
  return inGrid(col, lin) ? cellOf(col, lin) : -1;
}
export const cellCenter = (cell: number): [number, number] => [centerX(colOf(cell)), centerY(linOf(cell))];
/** Offset na grade da ROM $7E:2800 (para comparar com traços): lin·$40 + col·2. */
export const romOff = (col: number, lin: number): number => lin * 0x40 + col * 2;
export const cellFromRomOff = (off: number): number => cellOf((off & 0x3f) >> 1, off >> 6);

/** Casas (col, lin) de P1..P5. */
export const SPAWNS: readonly (readonly [number, number])[] = [[2, 1], [14, 11], [14, 1], [2, 11], [8, 6]];
/** Spawn 1 px fora do centro: (16·col, 16·(lin+2)). */
export const spawnX = (col: number): number => 16 * col * SUB;
export const spawnY = (lin: number): number => 16 * (lin + 2) * SUB;

/** Volta pela borda: 17 colunas (272 px) e 14 linhas (224 px) — a grade da ROM tem uma linha 13 ($EC40 em todas as
 *  arenas) abaixo da parede de baixo, fora da tela; `$C2:3221` lê a linha de (y − 24) mod 224. */
export const WRAP_X = 272 * SUB;
export const WRAP_Y = 224 * SUB;

/** Volta pela borda dos voadores ($C1:6566), em px da ROM com a bomba no centro da casa (16·col): x < −12 → +272,
 *  x ≥ 268 → −272; y < 12 → +224, y ≥ 244 → −224. O núcleo guarda o centro 1 px antes (16·col − 1): limiares
 *  −13/267 e 11/243. As linhas −1 e 13 (fora de `inGrid`) são a linha 13 da ROM: parede. */
export function wrapFlight(x: number, y: number): [number, number] {
  const X = px(x), Y = px(y);
  if (X < -13) x += WRAP_X; else if (X >= 267) x -= WRAP_X;
  if (Y < 11) y += WRAP_Y; else if (Y >= 243) y -= WRAP_Y;
  return [x, y];
}

const FACE_DCOL = [0, 0, 1, 0, 0, 0, -1, 0];
const FACE_DLIN = [-1, 0, 0, 0, 1, 0, 0, 0];
export const faceDcol = (face: number): number => FACE_DCOL[face];
export const faceDlin = (face: number): number => FACE_DLIN[face];
/** Casa vizinha na face (0 cima, 2 direita, 4 baixo, 6 esquerda). */
export const faceStep = (cell: number, face: number): number => cell + FACE_DLIN[face] * GRID_W + FACE_DCOL[face];
/** Face a partir da direção de movimento 0..7 (diagonais ficam no horizontal). */
export const FACE_OF_DIR: readonly (0 | 2 | 4 | 6)[] = [0, 2, 2, 2, 4, 6, 6, 6];
/** Subposição dentro da casa (0..15; centro = 7), como ((X−8) & 15) da ROM. */
export const subX = (x: number): number => (px(x) - 8) & 15;
export const subY = (y: number): number => (px(y) - 8) & 15;
