// Desenho do placar com a ROM (§6.10, §6.12, §7.5, R7–R10, A15) [MNT §B.10, animacoes-sprites RELATORIO §9].
// O fundo (BG1/BG2/BG3) vem de `sceneMaps` (T5) com `MAP_SOURCES['scoreboard']` da T19 (descritor `$C2:9C17`,
// achado depois desta tarefa) tendo prioridade; a geometria medida na captura `scoreboard` neste arquivo (como
// `menuMaps` fez na T5) é a reserva para quando `MAP_SOURCES` não tiver a cena. O texto ("PLACAR"/"nP") sai pela
// fonte da ROM via `drawText` (T4); as cabeças e a coroa usam pixels e paleta genuínos da ROM (R10:
// `assets.anim(0xC3DA94)`); as casas do título original em inglês (T18, BG1 paleta 7) são apagadas.
import type { RomAssets, Tiles } from '../../app/rom-api';
import { bgr555ToRgba } from '../../app/rom-api';
import { sceneGfx, sceneFrame, sceneMaps, newMap, put, fill, PpuCanvas, type SceneMaps } from './scene';
import { pixToCanvas } from '../sprite-bank';
import type { Img, SpriteBank } from '../sprite-bank';
import { drawText } from '../text/text';
import { S } from '../text/strings';
import type { MatchSession } from '../../game/match-session';
import { crownsOf } from '../../game/core-api';
import { SCORE, CROWN_SPIN, crownSpinFrame } from '../../game/timeline';

/** Geometria medida [MNT §B.10]: painel x8–248; faixa "SCORE BOARD"/"PLACAR" x≈50–212, y≈20–52; 5 linhas
 *  y 56/88/120/152/184 (passo 32, `SCORE` da T6); cabeça x 48–80; sempre 5 casas de coroa, x 80/112/144/176/208. */
export const SB_GEO = {
  panel: { x0: 8, y0: 10, x1: 248, y1: 218 },
  title: { cx: 131, y: 18 },
  labelX: 16, cellW: 32, cellY: 4, cellH: 24,
} as const;

// ---------------------------------------------------------------------------------------------------------------------
// Fundo (BG1/BG2/BG3) medido na captura `scoreboard` (A14/T19 ainda não achou a origem na ROM: reserva por
// geometria, como `menuMaps` na T5). Palavras `vhopppcc cccccccc` cruas da VRAM da cena, não um mapa copiado
// inteiro: só a moldura arredondada do título (BG1, 5×13 casas) e a grade das 5×5 casas de coroa (BG2, 14×16).
// Fora dessas casas o BG1 é 0 (transparente: aparece o céu do BG3/backdrop). BG3 é 1 ladrilho só (céu liso).

/** BG1 linhas 2–6, casas 2–14: moldura arredondada da faixa do título (o texto em si é nosso, via `drawText`). */
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

/** BG2 linhas 0–13 (16 casas): céu com nuvens e a grade das 5×5 casas de coroa (as bordas verdes do painel). */
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
 *  BG1 é o arco do título; BG2 é o céu/nuvens/grade; BG3 é um fundo liso (a T19 não decodifica BG3). */
export function scoreboardMaps(): SceneMaps {
  const bg1 = newMap(), bg2 = newMap(), bg3 = newMap();
  BG1_TITLE.rows.forEach((row, r) => row.forEach((w, c) => { if (w) put(bg1, BG1_TITLE.col0 + c, BG1_TITLE.row0 + r, w); }));
  BG2_TOP.forEach((row, r) => row.forEach((w, c) => put(bg2, c, r, w)));
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

const CROWN_ANIM_ADDR = 0xc3da94;
/** R10 (decisão do plano 10): o quadro final é o último da própria animação da ROM, não o tile que a MNT/spec citam. */
const REST_FRAME = CROWN_SPIN.length - 1;

/** Mesmo endereçamento de `render/ppu/render.ts` `objLine` (tile 16×16 "grande" = blocos da folha OBJ). */
function tilePixel(tiles: Tiles, n: number, sx: number, sy: number): number {
  const t = (n & 0x100) | ((((n >> 4) + (sy >> 3)) & 0xf) << 4) | ((n + (sx >> 3)) & 0xf);
  return t < tiles.count ? tiles.px[t * 64 + (sy & 7) * 8 + (sx & 7)] : 0;
}

const headCache = new WeakMap<RomAssets, Map<string, Img>>();
/** Cabeça 32×32 na linha `slot` (0..4). A forma ainda vem do quadro g6 do personagem: §7.5, sem a tabela de
 *  ponteiros das cabeças por personagem (`$D3:E82B`, `$CB:B000`, `$CC:5900`), cuja busca ficou fora do
 *  orçamento desta tarefa. A **cor**, porém, é a paleta OBJ fixa da linha: o OAM da captura `scoreboard`
 *  mostra `attr $30/$32/$34/$36/$38` → paletas OBJ 0..4 exatamente nas linhas 1P..5P (mesmo com os 5
 *  personagens padrão nos slots 0..4 dessa captura, a paleta é por posição, não por personagem escolhido —
 *  os 5 tiles de cabeça diferentes por linha [`$080/$084/$088/$0C4/$0C8`] são a peça que a ROM troca por
 *  personagem, não a cor), então usa `cgram[128 + slot·16 + v]` da própria cena em vez de `character(c)`. */
export function headCanvas(a: RomAssets, char: number, slot: number): Img {
  let m = headCache.get(a);
  if (!m) { m = new Map(); headCache.set(a, m); }
  const key = `${char}:${slot}`;
  let img = m.get(key);
  if (!img) {
    const src = a.character(char).frame(6);
    const cgram = sceneGfx(a, 'scoreboard').cgram;
    const data = new Uint8ClampedArray(32 * 32 * 4);
    for (let i = 0; i < 32 * 32; i++) {
      const v = src[i];
      if (!v) continue;
      const [r, g, b] = bgr555ToRgba(cgram[128 + slot * 16 + v] ?? 0);
      data.set([r, g, b, 255], i * 4);
    }
    img = pixToCanvas({ w: 32, h: 32, data });
    m.set(key, img);
  }
  return img;
}

const crownCache = new WeakMap<RomAssets, Map<number, { img: Img; w: number; h: number }>>();
/** Um quadro da coroa girando (R10, `C3:DA94`): peças 32×32 do OBJ da cena `scoreboard`, na paleta e no
 *  espelhamento da própria animação. A caixa devolvida é o retângulo das peças, para centralizar na casa. */
export function crownFrameCanvas(a: RomAssets, frameIdx: number): { img: Img; w: number; h: number } | null {
  let m = crownCache.get(a);
  if (!m) { m = new Map(); crownCache.set(a, m); }
  const hit = m.get(frameIdx);
  if (hit) return hit;
  const frame = a.anim(CROWN_ANIM_ADDR)[frameIdx];
  if (!frame || frame.pieces.length === 0) return null;
  const g = sceneGfx(a, 'scoreboard');
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of frame.pieces) {
    const size = p.big ? 32 : 16;
    minX = Math.min(minX, p.dx); minY = Math.min(minY, p.dy);
    maxX = Math.max(maxX, p.dx + size); maxY = Math.max(maxY, p.dy + size);
  }
  const w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);
  const data = new Uint8ClampedArray(w * h * 4);
  for (const p of frame.pieces) {
    const size = p.big ? 32 : 16;
    for (let sy = 0; sy < size; sy++) for (let sx = 0; sx < size; sx++) {
      const SY = p.vflip ? size - 1 - sy : sy, SX = p.hflip ? size - 1 - sx : sx;
      const v = tilePixel(g.objTiles, p.tile, SX, SY);
      if (!v) continue;
      const color = g.cgram[128 + p.palAdd * 16 + v] ?? 0;
      const [r, gg, b] = bgr555ToRgba(color);
      const dx = p.dx - minX + sx, dy = p.dy - minY + sy;
      data.set([r, gg, b, 255], (dy * w + dx) * 4);
    }
  }
  const out = { img: pixToCanvas({ w, h, data }), w, h };
  m.set(frameIdx, out);
  return out;
}

/** T18: a faixa "SCORE BOARD" original é BG1 na paleta 7 (visto na captura em (19..29, 17..19), tiles
 *  `$1d00..$1d4e`) — fora da janela de 14 linhas que a T5/T19 comparam com a captura (por isso não pesou no
 *  teste de fundo × captura), mas ainda assim entraria no `PpuFrame` se alguém desenhar com outro `vofs`.
 *  Como o nosso "PLACAR" (`drawText`) já fica por cima, tira essas casas do BG1 antes de montar o quadro. */
const TITLE_TEXT_PAL = 7;
export function dropTitleTextPalette(m: Uint16Array): Uint16Array {
  return m.map(w => (((w >> 10) & 7) === TITLE_TEXT_PAL ? 0 : w));
}

/** Mapas finais do placar: BG1/BG2 de `sceneMaps` (a T19 tem prioridade; nossa geometria medida é a reserva),
 *  sem as casas do título original em inglês (T18), e BG3 sempre da nossa geometria (a T19 não decodifica BG3). */
export function scoreboardSceneMaps(a: RomAssets): SceneMaps {
  const maps = sceneMaps(a, 'scoreboard', scoreboardMaps);
  return { ...maps, bg1: maps.bg1 && dropTitleTextPalette(maps.bg1), bg3: maps.bg3 ?? scoreboardMaps().bg3 };
}

const ppuCanvas = new PpuCanvas();

/** Desenha a cena inteira: fundo real (BG1/BG2/BG3 da cena `scoreboard`, T5 `sceneGfx`/`sceneFrame`/`PpuCanvas`)
 *  mais texto, cabeças e coroa genuínos da ROM, deslocada `yOffset` px (a descida da vitória usa; T20). */
export function drawScoreboardRom(ctx: CanvasRenderingContext2D, a: RomAssets, bank: SpriteBank, ms: MatchSession, s: number, yOffset: number): void {
  const Y = (py: number): number => py + yOffset;
  const g = sceneGfx(a, 'scoreboard');
  const frame = sceneFrame(g, scoreboardSceneMaps(a));
  ppuCanvas.draw(ctx, frame, yOffset);
  drawText(ctx, bank, 'bigScore', S.score.title, SB_GEO.title.cx, Y(SB_GEO.title.y), { align: 'center' });
  const rules = ms.match.rules;
  for (let slot = 0; slot < 5; slot++) {
    if (!rules.active[slot]) continue;
    const rowY = SCORE.rowY0 + SCORE.rowStep * slot;
    drawText(ctx, bank, 'ascii8', S.score.tags[slot], SB_GEO.labelX, Y(rowY + 8));
    ctx.drawImage(headCanvas(a, ms.cfg.chars[slot], slot), SCORE.headX, Y(rowY));
    for (let k = 0; k < 5; k++) {
      // A casa (preta com borda verde) já vem do fundo (BG2 medido acima); só falta a coroa em cima.
      const cell = crownCellOf(ms, s, slot, k);
      if (cell === 'empty') continue;
      const cx = SCORE.crownX[k];
      const frameIdx = cell === 'full' ? REST_FRAME : Number(cell.slice(5));
      const cr = crownFrameCanvas(a, frameIdx);
      if (!cr) continue;
      ctx.drawImage(cr.img, cx + Math.round((SB_GEO.cellW - cr.w) / 2), Y(rowY + 16 - Math.round(cr.h / 2)));
    }
  }
}
