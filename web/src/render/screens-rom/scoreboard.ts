// Desenho do placar com a ROM (§6.10, §6.12, §7.5, R7–R10, A15) [MNT §B.10, animacoes-sprites RELATORIO §9].
// Fundo: BG1/BG2 do descritor `$C2:9C17` (`MAP_SOURCES.scoreboard`, T19; a geometria medida aqui é só a reserva),
// mais a placa do título (sem as letras em inglês; o "PLACAR" é nosso, fonte `bigScore`) e as coroas cheias no BG2.
// Cabeças = retratos da ROM (`portraits.ts`); coroa girando = animação `C3:DA94` na base OBJ `$100`, paleta 5.
import type { RomAssets, ObjEntry, PpuFrame } from '../../app/rom-api';
import { sceneGfx, sceneFrame, sceneMaps, newMap, put, fill, obj, PpuCanvas, type SceneGfx, type SceneMaps } from './scene';
import type { SpriteBank } from '../sprite-bank';
import { drawText } from '../text/text';
import { S } from '../text/strings';
import type { MatchSession } from '../../game/match-session';
import { crownsOf } from '../../game/core-api';
import { SCORE, CROWN_SPIN, crownSpinFrame } from '../../game/timeline';
import { scoreboardPortraitTile, withPortraitPalettes } from './portraits';

/** Geometria medida [MNT §B.10]: painel x8–248; 5 linhas y 56/88/120/152/184 (passo 32, `SCORE` da T6); cabeça
 *  x 48–80; sempre 5 casas de coroa, x 80/112/144/176/208. Título: as letras de "SCORE BOARD" ocupam x 66–205,
 *  y 26–48 na captura (placa x 48–223); o "PLACAR" fica centrado na placa (x 136), no mesmo y 26. */
export const SB_GEO = {
  panel: { x0: 8, y0: 10, x1: 248, y1: 218 },
  title: { cx: 136, y: 26 },
  labelX: 16, cellW: 32, cellY: 4, cellH: 24,
} as const;

// ---------------------------------------------------------------------------------------------------------------------
// Reserva por geometria (T13), para quando `MAP_SOURCES` não tiver a cena: palavras `vhopppcc cccccccc` medidas na
// captura `scoreboard`, não um mapa copiado inteiro. O descritor real da T19 (`MAP_SOURCES.scoreboard`) tem
// prioridade. BG3 é 1 ladrilho só (`$006E`, vazio: o céu é o backdrop).

/** BG1 linhas 2–6, casas 2–14: o "VICTORY!" da cena seguinte no quadrante (0, 0) do mapa — fica fora da tela com o
 *  scroll do placar (`SCOREBOARD_SCROLL.bg1`). */
const BG1_TITLE = {
  row0: 2, col0: 2,
  rows: [
    [0x1a00, 0x1a02, 0x1a04, 0x1a06, 0x1a08, 0x1a0a, 0x1a0c, 0x1a0e, 0x1a60, 0x1a62, 0x1a86, 0x1a88, 0x1a8a],
    [0x1a20, 0x1a22, 0x1a24, 0x1a26, 0x1a28, 0x1a2a, 0x1a2c, 0x1a2e, 0x1a80, 0x1a82, 0x1aa4, 0x1aa6, 0x1aa8],
    [0x1a40, 0x1a42, 0x1a44, 0x1a46, 0x1a48, 0x1a4a, 0x1a4c, 0x1a4e, 0x1aa0, 0x1aa2, 0x1a8c, 0x1a8e, 0x1aaa],
    [0x0000, 0x0000, 0x1a64, 0x1a66, 0x0000, 0x1a6a, 0x1a6c, 0x1a6e, 0x1ac0, 0x1ac2, 0x0000, 0x1a68, 0x0000],
    [0x0000, 0x0000, 0x1a84, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000],
  ] as readonly (readonly number[])[],
};

/** BG2 linhas 0–13 (16 casas): céu com nuvens e a grade das 5×5 casas de coroa (as bordas verdes do painel). A
 *  captura tem coroas já ganhas pintadas na grade (`CROWN_BG2`); `scoreboardMaps` as troca pela casa vazia. */
const BG2_TOP: readonly (readonly number[])[] = [
  [0x190a, 0x190a, 0x190a, 0x16c4, 0x140c, 0x180a, 0x180a, 0x180a, 0x180a, 0x180a, 0x180a, 0x180a, 0x144a, 0x144c, 0x190a, 0x190a],
  [0x54c0, 0x158e, 0x146c, 0x146e, 0x180e, 0x1844, 0x1844, 0x1844, 0x1844, 0x1844, 0x1844, 0x580e, 0x146a, 0x16c6, 0x16ca, 0x16cc],
  [0x584e, 0x18cc, 0x18cc, 0x18cc, 0x18cc, 0x18cc, 0x18cc, 0x18cc, 0x18cc, 0x18cc, 0x18cc, 0x18cc, 0x18cc, 0x18cc, 0x18cc, 0x156e],
  [0x1460, 0x18c2, 0x18c2, 0x18c2, 0x18c2, 0x18c2, 0x18c2, 0x18c2, 0x18c2, 0x18c2, 0x18c2, 0x18c2, 0x18c2, 0x18c2, 0x18c2, 0x15ec],
  [0x1880, 0x08e2, 0x08a6, 0x58ec, 0x18ec, 0x18a8, 0x18aa, 0x18a8, 0x18aa, 0x58ec, 0x18ec, 0x58ec, 0x18ec, 0x58ec, 0x18ec, 0x1882],
  [0x1442, 0x0864, 0x08c6, 0x18ac, 0x18ae, 0x18c8, 0x18ca, 0x18c8, 0x18ca, 0x18ac, 0x18ae, 0x18ac, 0x18ae, 0x18ac, 0x18ae, 0x1882],
  [0x1862, 0x0884, 0x08a6, 0x58ec, 0x18ec, 0x18a8, 0x18aa, 0x58ec, 0x18ec, 0x58ec, 0x18ec, 0x58ec, 0x18ec, 0x58ec, 0x18ec, 0x9448],
  [0x9442, 0x08a4, 0x08c6, 0x18ac, 0x18ae, 0x18c8, 0x18ca, 0x18ac, 0x18ae, 0x18ac, 0x18ae, 0x18ac, 0x18ae, 0x18ac, 0x18ae, 0x1846],
  [0x1880, 0x08c4, 0x08a6, 0x58ec, 0x18ec, 0x58ec, 0x18ec, 0x58ec, 0x18ec, 0x58ec, 0x18ec, 0x58ec, 0x18ec, 0x58ec, 0x18ec, 0x1846],
  [0x1880, 0x08e4, 0x08c6, 0x18ac, 0x18ae, 0x18ac, 0x18ae, 0x18ac, 0x18ae, 0x18ac, 0x18ae, 0x18ac, 0x18ae, 0x18ac, 0x18ae, 0x1448],
  [0x1880, 0x0868, 0x08a6, 0x58ec, 0x18ec, 0x18a8, 0x18aa, 0x18a8, 0x18aa, 0x18a8, 0x18aa, 0x18a8, 0x18aa, 0x58ec, 0x18ec, 0x1882],
  [0x1880, 0x0888, 0x08c6, 0x18ac, 0x18ae, 0x18c8, 0x18ca, 0x18c8, 0x18ca, 0x18c8, 0x18ca, 0x18c8, 0x18ca, 0x18ac, 0x18ae, 0x1882],
  [0x1880, 0x0866, 0x08a6, 0x58ec, 0x18ec, 0x58ec, 0x18ec, 0x58ec, 0x18ec, 0x58ec, 0x18ec, 0x58ec, 0x18ec, 0x58ec, 0x18ec, 0x1882],
  [0x1880, 0x0886, 0x08c6, 0x18ac, 0x18ae, 0x18ac, 0x18ae, 0x18ac, 0x18ae, 0x18ac, 0x18ae, 0x18ac, 0x18ae, 0x18ac, 0x18ae, 0x1882],
];

const BG3_SKY_TILE = 0x006e;   // ladrilho único visto na captura (céu liso atrás da grade/nuvens do BG2)

/** Mapas de BG do placar pela geometria medida — **reserva**: a T19 já achou a origem real na ROM
 *  (`MAP_SOURCES['scoreboard']`, descritor `$C2:9C17`) e `drawScoreboardRom` usa `sceneMaps` para dar
 *  prioridade a ela; esta função só entra se `MAP_SOURCES` ficar sem a cena de novo. Só o que é visível:
 *  BG1 é o quadrante do "VICTORY!"; BG2 é o céu/nuvens/grade; BG3 é o tile vazio (a T19 não decodifica BG3). */
export function scoreboardMaps(): SceneMaps {
  const bg1 = newMap(), bg2 = newMap(), bg3 = newMap();
  BG1_TITLE.rows.forEach((row, r) => row.forEach((w, c) => { if (w) put(bg1, BG1_TITLE.col0 + c, BG1_TITLE.row0 + r, w); }));
  const EMPTY: Record<number, number> = { 0x18a8: 0x58ec, 0x18aa: 0x18ec, 0x18c8: 0x18ac, 0x18ca: 0x18ae };
  BG2_TOP.forEach((row, r) => row.forEach((w, c) => put(bg2, c, r, EMPTY[w] ?? w)));
  fill(bg3, 0, 0, 32, 32, BG3_SKY_TILE);
  return { bg1, bg2, bg3 };
}

export type CrownCell = 'empty' | 'full' | `spin:${number}`;

const CROWN_SPIN_TOTAL = CROWN_SPIN.reduce((a, b) => a + b, 0);   // 104 f [spec §6.10]

/** `c = crowns[slot]`. `k ≥ c` → vazia. É nova se `lastWinners` inclui o slot e `k === c − 1`: preta até `s = 4`,
 *  gira pela animação da ROM por `CROWN_SPIN_TOTAL` f e então cheia. As demais preenchidas: sempre cheias. */
export function crownCellOf(ms: MatchSession, s: number, slot: number, k: number): CrownCell {
  const c = crownsOf(ms.match)[slot];
  if (k >= c) return 'empty';
  const isNew = ms.lastWinners.includes(slot) && k === c - 1;
  if (!isNew) return 'full';
  if (s < SCORE.spinAt) return 'empty';
  const t = s - SCORE.spinAt;
  return t < CROWN_SPIN_TOTAL ? `spin:${crownSpinFrame(t)}` : 'full';
}


/** A coroa que acabou de girar (`crownCellOf` = 'full' depois do giro) — a ROM a deixa como OBJ parado no quadro 0. */
function isNewCrown(ms: MatchSession, slot: number, k: number): boolean {
  return ms.lastWinners.includes(slot) && k === crownsOf(ms.match)[slot] - 1;
}

// ---------------------------------------------------------------------------------------------------------------------
// Cena real (revisão final do plano 10, I4/I5/I6). Medidas em pixels contra `scoreboard.png` (os `.ppu` só guardam
// o byte alto dos scrolls): a linha y da tela mostra a linha y + 264 do BG1 (x + 256) e y + 8 do BG2, 100 % dos
// pixels; o BG3 é só o tile vazio `$006E`. Como o PPU soma 1 ao VOFS (hardware), os registradores são 263 e 7.

/** Scrolls [hofs, vofs] (valor de registrador) da cena: BG1 no quadrante (256, 256) do mapa 32×32 de tile16 (o
 *  canto (0, 0) guarda o "VICTORY!" da cena seguinte); BG2 (céu, nuvens e grade) com as linhas da grade em
 *  y = 56 + 32·slot, alinhadas com as cabeças do OAM. */
export const SCOREBOARD_SCROLL = { bg1: [256, 263] as [number, number], bg2: [0, 7] as [number, number], bg3: [0, 7] as [number, number] };

/** Placa do título no BG1 (paleta 7), colunas 19–29, linhas 17–19 do mapa (x 48–223, y 8–55 na tela). A ROM a
 *  escreve fora do descritor `$C2:9C17` (vem do buffer `$7E:5000`, `scoreboard.vmap.json`); palavras medidas na
 *  captura. As colunas 20 e 27 da linha 17 ficam vazias no BG1 porque ali a borda de cima vem do BG2. As linhas
 *  18–19, colunas 20–28, trazem as letras de "SCORE BOARD": `plateMaps` as troca pelo miolo liso (`PLATE_BLANK`). */
export const PLATE = {
  col0: 19, row0: 17,
  rows: [
    [0x1d06, 0x0000, 0x1d08, 0x1d08, 0x1d08, 0x1d08, 0x1d08, 0x1d08, 0x0000, 0x1d0c, 0x1d0e],
    [0x1d00, 0x1d02, 0x1d04, 0x1d20, 0x1d22, 0x1d24, 0x1d26, 0x1d28, 0x1d2a, 0x1d2c, 0x1d2e],
    [0x1c8a, 0x1c8c, 0x1c8e, 0x1d40, 0x1d42, 0x1d44, 0x1d46, 0x1d48, 0x1d4a, 0x1d4c, 0x1d4e],
  ] as readonly (readonly number[])[],
  /** Colunas (do mapa) com letras nas linhas 18–19; as pontas 19 e 29 não têm letra. */
  letters: { c0: 20, c1: 28 },
  /** Borda de cima (tile16 da linha 17), espelhada para fazer a de baixo do miolo liso. */
  topEdge: 0x108,
};
/** Tile16 reescritos (em uma cópia dos tiles de BG da cena) para o miolo liso da placa. São tiles de letra que só a
 *  placa usa: `mid` = preto inteiro (linha 18); `bottom`/`bottomEnd` = preto nas linhas 0–9 e, nas 10–15, a borda de
 *  cima espelhada (`topEdge` `$108` no meio; `$10C`, a ponta direita, na coluna 28). As pontas `caps` (coluna 19) têm
 *  o contorno do "S" encostado na coluna de pixels 15: vira preto onde a coluna 14 já é miolo. */
export const PLATE_BLANK = { mid: 0x120, bottom: 0x140, bottomEnd: 0x142, topEnd: 0x10c, caps: [0x100, 0x08a] };
/** Miolo da placa em px da tela onde a ROM tem letras (x 63 = o contorno do "S" dentro da ponta): sai liso, e o
 *  nosso "PLACAR" vai por cima. */
export const PLATE_INNER_PX = { x0: 63, y0: 24, x1: 207, y1: 49 };

/** Coroa cheia no BG2 (paleta 6): a ROM pinta as coroas já ganhas direto na grade (captura: linhas 4+2·slot e
 *  5+2·slot, colunas 5+2k e 6+2k), no lugar da casa vazia `$58EC $18EC / $18AC $18AE`. */
export const CROWN_BG2 = { tl: 0x18a8, tr: 0x18aa, bl: 0x18c8, br: 0x18ca };
const cellCol = (k: number): number => 5 + 2 * k;
const cellRow = (slot: number): number => 4 + 2 * slot;

/** Coroa girando (`C3:DA94`): as peças usam tiles relativos à base `$100` da folha OBJ da cena e a paleta OBJ 5
 *  (captura: OAM `$140`, paleta 5, prio 3 no quadro 6 = peça `$040` espelhada). Origem das peças = centro da casa. */
export const CROWN_ANIM = { addr: 0xc3da94, tileBase: 0x100, pal: 5 } as const;
/** §6.10: a coroa nova para de frente, no quadro 0 (peça `$006` → tile `$106`). */
export const REST_FRAME = 0;

/** OBJ de um quadro da coroa na casa `k` da linha `slot`. */
export function crownObjs(a: RomAssets, frameIdx: number, slot: number, k: number): ObjEntry[] {
  const frame = a.anim(CROWN_ANIM.addr)[frameIdx];
  if (!frame) return [];
  const ox = SCORE.crownX[k] + SB_GEO.cellW / 2, oy = SCORE.rowY0 + SCORE.rowStep * slot + 16;
  return frame.pieces.map(p => obj(ox + p.dx, oy + p.dy, CROWN_ANIM.tileBase + p.tile, CROWN_ANIM.pal + p.palAdd,
    { big: p.big, prio: 3, h: p.hflip, v: p.vflip }));
}

const blankCache = new WeakMap<RomAssets, SceneGfx>();
/** `sceneGfx('scoreboard')` com os tile16 do miolo liso da placa (`PLATE_BLANK`) reescritos a partir dos próprios
 *  tiles da placa: a cor do miolo é o pixel (0, 15) da borda de cima (preto, dentro da placa). */
export function scoreboardGfx(a: RomAssets): SceneGfx {
  let g = blankCache.get(a);
  if (g) return g;
  const base = sceneGfx(a, 'scoreboard');
  const px = base.bgTiles.px.slice();
  const at = (t16: number, x: number, y: number): number => (t16 + (y >> 3) * 16 + (x >> 3)) * 64 + (y & 7) * 8 + (x & 7);
  const black = px[at(PLATE.topEdge, 0, 15)];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      px[at(PLATE_BLANK.mid, x, y)] = black;
      px[at(PLATE_BLANK.bottom, x, y)] = y < 10 ? black : px[at(PLATE.topEdge, x, 23 - y)];
      px[at(PLATE_BLANK.bottomEnd, x, y)] = y < 10 ? black : px[at(PLATE_BLANK.topEnd, x, 23 - y)];
    }
    for (const cap of PLATE_BLANK.caps) if (px[at(cap, 14, y)] === black) px[at(cap, 15, y)] = black;
  }
  g = { ...base, bgTiles: { ...base.bgTiles, px } };
  blankCache.set(a, g);
  return g;
}

/** Palavras da placa sem as letras: linhas 18–19, colunas 20–28, trocadas pelo miolo liso. */
export function plateWords(): { col: number; row: number; w: number }[] {
  const out: { col: number; row: number; w: number }[] = [];
  PLATE.rows.forEach((row, r) => row.forEach((w, c) => {
    const col = PLATE.col0 + c, lin = PLATE.row0 + r;
    const letter = r > 0 && col >= PLATE.letters.c0 && col <= PLATE.letters.c1;
    const end = (PLATE.rows[0][c] & 0x3ff) === PLATE_BLANK.topEnd;
    const blank = (w & 0xfc00) | (r === 1 ? PLATE_BLANK.mid : end ? PLATE_BLANK.bottomEnd : PLATE_BLANK.bottom);
    if (w) out.push({ col, row: lin, w: letter ? blank : w });
  }));
  return out;
}

/** Mapas finais do placar: BG1/BG2 de `sceneMaps` (descritor `$C2:9C17`; nossa geometria é a reserva) + a placa
 *  sem letras no BG1 + as coroas cheias (`full`, menos a nova, que é OBJ) no BG2; BG3 da geometria (tile vazio). */
export function scoreboardSceneMaps(a: RomAssets, ms?: MatchSession, s = 0): SceneMaps {
  const maps = sceneMaps(a, 'scoreboard', scoreboardMaps);
  const bg1 = (maps.bg1 ?? newMap()).slice();
  for (const p of plateWords()) put(bg1, p.col, p.row, p.w);
  const bg2 = maps.bg2?.slice();
  if (bg2 && ms) {
    for (let slot = 0; slot < 5; slot++) {
      if (!ms.match.rules.active[slot]) continue;
      for (let k = 0; k < 5; k++) {
        if (crownCellOf(ms, s, slot, k) !== 'full' || isNewCrown(ms, slot, k)) continue;
        put(bg2, cellCol(k), cellRow(slot), CROWN_BG2.tl); put(bg2, cellCol(k) + 1, cellRow(slot), CROWN_BG2.tr);
        put(bg2, cellCol(k), cellRow(slot) + 1, CROWN_BG2.bl); put(bg2, cellCol(k) + 1, cellRow(slot) + 1, CROWN_BG2.br);
      }
    }
  }
  return { bg1, bg2, bg3: maps.bg3 ?? scoreboardMaps().bg3 };
}

/** Quadro PPU inteiro do placar (sem o texto "PLACAR", que é nosso e vai por cima): fundo, placa lisa, coroas
 *  cheias no BG2, cabeças (retratos `$CD:E585`, OBJ `$80+`, paleta OBJ = slot com as cores de `$C1:B3C3`) e a
 *  coroa girando/parada (OBJ `$100+`, paleta 5). */
export function scoreboardFrame(a: RomAssets, ms: MatchSession, s: number): PpuFrame {
  const g = scoreboardGfx(a);
  const rules = ms.match.rules;
  const oam: ObjEntry[] = [];
  const chars: number[] = [], rows: number[] = [];
  for (let slot = 0; slot < 5; slot++) {
    if (!rules.active[slot]) continue;
    const rowY = SCORE.rowY0 + SCORE.rowStep * slot;
    chars[slot] = ms.cfg.chars[slot]; rows[slot] = 8 + slot;
    oam.push(obj(SCORE.headX, rowY, scoreboardPortraitTile(ms.cfg.chars[slot]), slot, { big: true, prio: 3 }));
    for (let k = 0; k < 5; k++) {
      const cell = crownCellOf(ms, s, slot, k);
      if (cell.startsWith('spin:')) oam.push(...crownObjs(a, Number(cell.slice(5)), slot, k));
      else if (cell === 'full' && isNewCrown(ms, slot, k)) oam.push(...crownObjs(a, REST_FRAME, slot, k));
    }
  }
  const frame = sceneFrame(g, scoreboardSceneMaps(a, ms, s), { ...SCOREBOARD_SCROLL, oam });
  return { ...frame, cgram: withPortraitPalettes(a, g.cgram, chars, rows) };
}

const ppuCanvas = new PpuCanvas();

/** Desenha a cena inteira (`scoreboardFrame`) mais o nosso "PLACAR" no miolo da placa, deslocada `yOffset` px
 *  (a descida da vitória usa; T20). Os rótulos "1P".."5P" já vêm do BG2 da ROM (itálico grande, sem idioma). */
export function drawScoreboardRom(ctx: CanvasRenderingContext2D, a: RomAssets, bank: SpriteBank, ms: MatchSession, s: number, yOffset: number): void {
  ppuCanvas.draw(ctx, scoreboardFrame(a, ms, s), yOffset);
  drawText(ctx, bank, 'bigScore', S.score.title, SB_GEO.title.cx, SB_GEO.title.y + yOffset, { align: 'center' });
}
