import { CODE, GRID_H, GRID_W, isEggCode, type RoundState } from '../../core';
import type { RomAssets, Tiles } from '../../rom/types';
import { renderPpu, type PpuFrame, type ScanBand } from '../ppu';
import { romLayers, type RomBattleLayer } from '../battle-layers';
import '../layers-index';
import { FrameBuilder } from './builder';
import { romTables } from './tables';
import { readScene } from './adapt';
import { fieldWords } from './field';
import { headOverrides, headTiles, hudWords, infinityOverrides } from './hud';
import { CLOCK_FROZEN_FROM } from '../../core/constants';
import { hudCrying } from '../hud-cry';
import { sceneryCgram, sceneryTiles } from './scenery';
import { drawObjects, drawSprites } from './sprites';
import { MAP_W, newMemo, type RomClock, type RomMemo } from './scene';
import { warnOnce } from './warn';
import { cellCategory, NO_SKIP, type HdSkip } from '../hdart/cover';
import { hdBattleSkip } from '../hdart/mode';

/** D1: o que a tela da partida passa além da rodada. */
export interface RomBattleVis { crowns: readonly number[] }

export interface BuildOpts {
  sprites?: boolean;                               // padrão true
  /** Com `sprites: false`: ainda desenha as bombas que são objeto (chutadas/voando) — o quadro "só bombas" da cor
   *  das bombas (fx); as paradas já vêm no BG2. */
  bombSprites?: boolean;
  hudHeads?: boolean;                              // padrão true; false = tiles de rosto da ROM (golden)
  blink?: boolean;                                 // padrão true; false = cor 79 da ROM (golden)
  layers?: readonly RomBattleLayer[];              // padrão romLayers
  tileCopies?: readonly (readonly [number, number])[];   // quadro de animação fixo (golden)
  palAnim?: boolean;                               // padrão true; false = CGRAM da ROM sem ciclo de paleta (golden)
  /** Categorias que a arte HD desenha (a base fica transparente nelas). `buildBattleFrame`: padrão vazio;
   *  `drawRomBattle`: padrão = o que o modo HD pedir no quadro com sprites (vazio sem pacote). */
  skip?: HdSkip;
  /** Efeitos com a sombra suave ligados: jogadores vivos sem a sombra chapada do sprite (ver rom/baked-shadow.ts). */
  softShadows?: boolean;
  /** Saída (com `softShadows`): vagas em que a elipse da ROM ficou neste quadro. */
  hardShadows?: Set<number>;
}

export const HUD_HOFS = 8;
export const HUD_VOFS = -33;
export const FIELD_HOFS = 8;
export const FIELD_VOFS = -25;
export const HUD_MAP_ROW = 28;
const BG1 = 1, BG2 = 2, OBJ = 16;
/** Linhas do mapa do BG1 com o HUD (28–30); as outras são a decoração do campo. */
const HUD_ROWS = [HUD_MAP_ROW, HUD_MAP_ROW + 3] as const;

/** Palavra de BG 16×16 toda transparente (tiles n, n+1, n+16, n+17 com índice 0); nas 10 arenas é a 0. */
const blanks = new WeakMap<Tiles, number>();
export function blankWord(t: Tiles): number {
  let w = blanks.get(t);
  if (w === undefined) {
    const zero = (n: number) => { for (let i = 0; i < 64; i++) if (t.px[(n & 0x3ff) * 64 + i]) return false; return true; };
    w = 0;
    for (let n = 0; n < Math.min(t.count, 1024); n++) if (zero(n) && zero(n + 1) && zero(n + 16) && zero(n + 17)) { w = n; break; }
    blanks.set(t, w);
  }
  return w;
}

/** Arte HD: tira dos mapas o que o HD desenha. Arena pulada → BG2 e a decoração do BG1 transparentes (ficam só itens,
 *  chamas e bombas que a base ainda desenha); item/chama/bomba pulados → piso (ou transparente, sem arena). */
function skipWords(s: RoundState, ar: { floor: Uint16Array }, bg1: Uint16Array, bg2: Uint16Array, skip: HdSkip, blank: number): void {
  const arena = skip.has('arena');
  const keep = Uint16Array.from(bg2);
  if (arena) {
    bg2.fill(blank);
    bg1.fill(blank, 0, HUD_ROWS[0] * MAP_W);
    bg1.fill(blank, HUD_ROWS[1] * MAP_W);
  }
  for (let lin = 0; lin < GRID_H; lin++) for (let col = 1; col < GRID_W - 1; col++) {
    const cell = lin * GRID_W + col, i = lin * MAP_W + col, code = s.grid[cell];
    const cat = isEggCode(code) ? 'arena' : cellCategory(code);   // o ovo é sprite: na grade da ROM ele é piso
    if (cat === 'arena') continue;
    if (skip.has(cat)) bg2[i] = arena ? blank : (s.floor[cell] || ar.floor[i]);
    else if (arena) bg2[i] = keep[i];
  }
}

/** Rodada vista pela camada das montarias com os ovos da grade a cargo do HD. */
const withoutEggs = (s: RoundState): RoundState => ({ ...s, grid: s.grid.map(v => (isEggCode(v) ? CODE.FLOOR : v)) });

/** Cor de fundo que não está na CGRAM: o que sobrar dela na imagem é "nada desenhado" e vira transparente. */
function freeColor(cg: Uint16Array): number {
  const used = new Set(cg);
  for (let v = 0x7c1f; v >= 0; v--) if (!used.has(v)) return v;
  return 0;
}
const NO_CROWNS: readonly number[] = [0, 0, 0, 0, 0];
/** `drawObjects` pulando os itens voando: só as bombas-objeto. */
const ONLY_BOMBS: HdSkip = new Set(['items']);

const memos = new WeakMap<RoundState, RomMemo>();
export function romMemo(s: RoundState): RomMemo {
  let m = memos.get(s);
  if (!m) { m = newMemo(); memos.set(s, m); }
  return m;
}

/** D6: TIME UP congela tudo (também no `over` seguinte); vitória congela só o script das bombas. */
export function battleClock(s: RoundState, memo: RomMemo, frame: number): RomClock {
  if (s.phase === 'timeUp') memo.freezeAll ??= s.phaseT0;
  else if (s.phase !== 'over') memo.freezeAll = null;
  if (s.phase === 'won') memo.freezeBombs ??= s.phaseT0;
  else if (s.phase !== 'over') memo.freezeBombs = null;
  const tick = memo.freezeAll ?? s.tick;
  return { tick, bombTick: memo.freezeAll ?? memo.freezeBombs ?? s.tick, frame };
}

/**
 * M5 (D6): tick visual já congelado (TIME UP e o `over` seguinte), o mesmo valor que as camadas base já usam.
 * Leitura pura da memória por rodada; só é fiel depois que `battleClock` correu para o quadro atual
 * (é o caso dentro de `buildBattleFrame`, que chama `battleClock` antes das camadas/ganchos dos planos 8/9).
 */
export function visualTick(s: RoundState): number {
  return romMemo(s).freezeAll ?? s.tick;
}

export function buildBattleFrame(s: RoundState, vis: RomBattleVis, a: RomAssets, frame: number, opts: BuildOpts = {}): PpuFrame {
  const skip = opts.skip ?? NO_SKIP;
  const ar = a.arena(s.stage);
  const tb = romTables(a);
  const memo = romMemo(s);
  const clock = battleClock(s, memo, frame);
  const cry = s.players.map(p => hudCrying(s, p));
  const heads = opts.hudHeads === false ? [] : headOverrides(s.players.map(p => (p.present ? headTiles(a.character(p.char), p.slot, cry[p.slot]) : null)));
  const headKey = opts.hudHeads === false ? 'rom' : s.players.map(p => (p.present ? `${p.char}${cry[p.slot] ? 'c' : ''}` : '-')).join(',');
  const inf = s.clock.sec >= CLOCK_FROZEN_FROM ? infinityOverrides(ar.bgTiles.px, ar.hudMap) : [];
  const tiles = sceneryTiles(ar, clock.tick, [...heads, ...inf], headKey + (inf.length ? '|inf' : ''), opts.tileCopies);
  const cgram = sceneryCgram(opts.palAnim === false ? { ...ar, palAnim: [] } : ar, clock.tick, frame, opts.blink !== false);
  const scene = readScene(s, clock.tick, memo);
  const bg2 = fieldWords(s, ar, scene, tb, clock, t => a.bombScript(t));
  const bg1 = Uint16Array.from(ar.bg1.subarray(0, 1024));
  bg1.set(hudWords(ar.hudMap, s.clock.sec, s.players.map(p => p.present), vis.crowns ?? NO_CROWNS, tb.crownWord), HUD_MAP_ROW * MAP_W);
  if (skip.size) skipWords(s, ar, bg1, bg2, skip, blankWord(tiles));
  const b = new FrameBuilder(bg1, bg2, cgram);
  if (opts.sprites !== false) drawSprites(b, { s, a, tb, scene, clock, memo, tiles, softShadows: opts.softShadows, hardShadows: opts.hardShadows }, skip);
  else if (opts.bombSprites) drawObjects(b, { s, a, tb, scene, clock, memo, tiles }, ONLY_BOMBS);
  // M1: cada camada dos planos 8/9 roda isolada — uma que lance não derruba o quadro nem alterna com o fallback;
  // fica só sem aquela camada, com aviso uma vez por (assets, id da camada).
  for (const l of opts.layers ?? romLayers) {
    try { l.draw(l.id === 'mounts' && skip.has('eggs') ? withoutEggs(s) : s, b, a, frame, clock.tick); }
    catch (e) { warnOnce(a, 'layer:' + l.id, `Crown Blast: camada "${l.id}" falhou nesta partida; ignorando o quadro dela.`, e); }
  }
  const math = skip.has('arena') ? 'none' : ar.colorMath;   // sem a arena, nada para misturar (e o fundo fica puro)
  const bands: ScanBand[] = [
    { y0: 0, y1: 24, bg1Tile16: false, bg1: [HUD_HOFS, HUD_VOFS], bg2: [FIELD_HOFS, FIELD_VOFS], main: skip.has('hud') ? OBJ : BG1 | OBJ, sub: 0, math: 'none' },
    { y0: 24, y1: 224, bg1Tile16: true, bg1: [b.hofs1, FIELD_VOFS], bg2: [FIELD_HOFS, FIELD_VOFS],
      main: BG1 | BG2 | OBJ, sub: math === 'none' ? 0 : BG2, math },
  ];
  const clear = skip.has('hud') || skip.has('arena');
  return {
    ...(clear ? { backdrop: freeColor(b.cg) } : {}),
    cgram: b.cg,
    bg1: { map: b.bg1, mapW: 32, tiles, tile16: true, hofs: b.hofs1, vofs: FIELD_VOFS },
    bg2: { map: b.bg2, mapW: 32, tiles, tile16: true, hofs: FIELD_HOFS, vofs: FIELD_VOFS },
    bands,
    objTiles: ar.objCommon,
    oam: b.oam(),
  };
}

const images = new WeakMap<CanvasRenderingContext2D, ImageData>();

const rgb = (v: number): [number, number, number] => [v & 31, (v >> 5) & 31, (v >> 10) & 31].map(c => (c << 3) | (c >> 2)) as [number, number, number];

/** Pixels com a cor de fundo livre (`back`): transparentes nas faixas que o HD desenha por baixo (HUD 0–23, campo
 *  24–223); nas outras voltam à cor de fundo da ROM (`rom`), como sem o HD. */
function clearBackdrop(img: ImageData, back: number, rom: number, skip: HdSkip): void {
  const [r, g, bl] = rgb(back), [r0, g0, b0] = rgb(rom), d = img.data, W = img.width * 4;
  const y0 = skip.has('hud') ? 0 : 24, y1 = skip.has('arena') ? img.height : 24;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] !== r || d[i + 1] !== g || d[i + 2] !== bl) continue;
    const y = Math.floor(i / W);
    if (y >= y0 && y < y1) d[i + 3] = 0;
    else { d[i] = r0; d[i + 1] = g0; d[i + 2] = b0; }
  }
}

export function drawRomBattle(ctx: CanvasRenderingContext2D, round: RoundState, vis: RomBattleVis, assets: RomAssets, frame: number, opts: BuildOpts = {}): boolean {
  let f: PpuFrame;
  const skip = opts.skip ?? (opts.sprites !== false ? hdBattleSkip(round, vis.crowns ?? NO_CROWNS) : NO_SKIP);
  try {
    f = buildBattleFrame(round, vis, assets, frame, skip.size ? { ...opts, skip } : opts);
  } catch (e) {
    // M1: a chave do aviso vive em `assets`, então uma ROM nova (outro objeto) volta a avisar se falhar de novo.
    warnOnce(assets, 'frame', 'Crown Blast: gráficos da ROM indisponíveis nesta partida; usando a arte própria.', e);
    return false;
  }
  let img = images.get(ctx);
  if (!img) { img = ctx.createImageData(256, 224); images.set(ctx, img); }
  renderPpu(f, img);
  if (f.backdrop !== undefined) clearBackdrop(img, f.backdrop, f.cgram[0], skip);
  ctx.putImageData(img, 0, 0);
  return true;
}
