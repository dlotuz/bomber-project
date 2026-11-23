import { CODE, FLAME_PIECE, px, type RoundState } from '../core';
import { cellX, cellY } from './fx/coords';
import type { SpriteBank } from './sprite-bank';
import { drawText } from './text/text';
import { S } from './text/strings';
import { hdOverlay, hdOverlayEnd, hdPanel } from './hd-menu';

export interface OverlayState {
  paused: boolean; disconnected: number | null;
  hurry: { x: number; y: number } | null; timeUp: { y: number; text: string } | null;
  /** Menu da pausa (extra, não original): itens, linha do cursor e o nome do mapa da próxima rodada (TROCAR MAPA). */
  pauseMenu?: { items: readonly string[]; cursor: number; note: string | null; pending?: boolean } | null;
}
/** Caixa do menu da pausa (px da base 256×224): 10 linhas de 14 px, letra 12. */
export const PAUSE_MENU = { x: 36, w: 184, y: 36, rowH: 14, pad: 5, item: 12, hand: 1.3 } as const;
/** Por cima da partida (ROM ou fallback): RÁPIDO!!, TEMPO ESGOTADO!, PAUSA! (sem escurecer) e a linha de desconexão. */
export function drawBattleOverlays(ctx: CanvasRenderingContext2D, bank: SpriteBank, st: OverlayState): void {
  if (st.hurry) drawText(ctx, bank, 'banner', S.battle.hurry, st.hurry.x, st.hurry.y, { tone: 'green' });
  if (st.timeUp) drawText(ctx, bank, 'banner', st.timeUp.text, 128, st.timeUp.y, { align: 'center' });
  const pm = st.paused ? st.pauseMenu : null;
  if (!pm) {
    if (st.paused) drawText(ctx, bank, 'banner', S.battle.pause, 128, 110, { align: 'center' });
    if (st.paused && st.disconnected !== null) drawText(ctx, bank, 'ascii8', S.battle.disconnected(st.disconnected), 128, 130, { align: 'center' });
    return;
  }
  // Visual dos menus HD (quadros arredondados, fonte HD, mão), por cima da partida escurecida.
  const M = PAUSE_MENU, h = M.pad * 2 + pm.items.length * M.rowH;
  hdOverlay([M.x + 8, M.y + M.pad + pm.cursor * M.rowH + 1], { item: M.item, hand: M.hand });
  hdPanel({ x: -8, y: -8, w: 272, h: 240, fill: 'rgba(4,10,40,0.55)', stroke: 'rgba(0,0,0,0)' });   // escurece a partida (cantos fora da tela)
  drawText(ctx, bank, 'menuTitle', S.battle.pauseTitle, 128, M.y - 24, { align: 'center' });
  hdPanel({ x: M.x, y: M.y, w: M.w, h, fill: 'rgba(10,30,90,0.85)', stroke: '#8fd8ff' });
  hdPanel({ x: M.x + 6, y: M.y + M.pad + pm.cursor * M.rowH, w: M.w - 12, h: M.rowH, fill: 'rgba(16,40,112,0.92)', stroke: '#ffe46b', glow: 'rgba(255,220,90,0.9)' });
  pm.items.forEach((label, i) => {
    drawText(ctx, bank, 'menuItem', label, M.x + 26, M.y + M.pad + i * M.rowH + 1, { tone: i === pm.cursor ? 'yellow' : 'white' });
  });
  let y = M.y + h + 5;
  if (pm.note) {
    drawText(ctx, bank, 'ascii8', S.battle.nextStage, 128, y, { align: 'center', tone: 'white' });
    drawText(ctx, bank, 'ascii8', pm.note, 128, y + 10, { align: 'center', tone: 'yellow' });
    y += 21;
  }
  if (pm.pending) { drawText(ctx, bank, 'ascii8', S.battle.nextRules, 128, y, { align: 'center', tone: 'yellow' }); y += 11; }
  if (st.disconnected !== null) drawText(ctx, bank, 'ascii8', S.battle.disconnected(st.disconnected), 128, y, { align: 'center', tone: 'red' });
  hdOverlayEnd();
}

/** Letra da bomba evoluída no chute (extra): D vermelho, S amarelo, H branco — como no vídeo de referência. */
const LEVEL_MARK: readonly (readonly [string, string] | null)[] = [null, ['D', '#e82818'], ['S', '#f8d820'], ['H', '#f8f8f8']];

/** Por cima da partida (ROM ou fallback): a letra de cada bomba evoluída, parada, deslizando, na mão ou no ar. */
export function drawBombLevels(ctx: CanvasRenderingContext2D, bank: SpriteBank, s: RoundState): void {
  const mark = (level: number | undefined, x: number, y: number): void => {
    const m = LEVEL_MARK[level ?? 0];
    if (!m) return;
    const img = bank.text(m[0], m[1]);
    ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2) + 1);
  };
  for (const b of s.bombs) {
    if (!b.level) continue;
    if (b.state === 'idle' || b.state === 'kicked') mark(b.level, px(b.x), px(b.y));
    else if (b.state === 'held') {
      const p = s.players.find(q => q.present && q.carry === b.id);
      if (p) mark(b.level, px(p.x), px(p.y) - 16);
    } else {
      const f = s.flyers.find(x => x.kind === 'bomb' && x.ref === b.id);
      if (f) mark(b.level, px(f.x), px(f.y) + Math.min(0, f.z));
    }
  }
}

/** Teste (?crono): segundos desde que cada bomba foi colocada, em cima dela, e o tempo da última que explodiu. */
export interface FuseClock { born: Map<number, number>; last: number | null; flames: Map<number, number>; lastFlame: number | null }
export const createFuseClock = (): FuseClock => ({ born: new Map(), last: null, flames: new Map(), lastFlame: null });
export function drawFuseClock(ctx: CanvasRenderingContext2D, s: RoundState, clk: FuseClock): void {
  const live = new Set(s.bombs.map(b => b.id));
  for (const [id, born] of clk.born) if (!live.has(id)) { clk.last = (s.tick - born) / 60; clk.born.delete(id); }
  for (const b of s.bombs) if (!clk.born.has(b.id)) clk.born.set(b.id, b.born);
  // Fogo: a casa mata enquanto é FLAME (FLAME_TICKS); a duração vale quando ela apaga (ou reacende com outra explosão).
  for (const [c, t0] of clk.flames) {
    if (s.grid[c] === CODE.FLAME && s.cellT0[c] === t0) continue;
    clk.lastFlame = (s.tick - t0) / 60; clk.flames.delete(c);
  }
  s.grid.forEach((v, c) => { if (v === CODE.FLAME && !clk.flames.has(c)) clk.flames.set(c, s.cellT0[c]); });
  const label = (t: string, x: number, y: number): void => {
    ctx.strokeText(t, x, y);
    ctx.fillText(t, x, y);
  };
  ctx.save();
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#000';
  ctx.fillStyle = '#ffe14d';
  for (const b of s.bombs) {
    if (b.state !== 'idle' && b.state !== 'kicked') continue;
    label(((s.tick - b.born) / 60).toFixed(2), px(b.x) + 1, px(b.y) - 8);
  }
  ctx.fillStyle = '#ff9a3c';
  for (const [c, t0] of clk.flames) {
    if (s.cellAux[c] !== FLAME_PIECE.CENTER) continue;
    label(((s.tick - t0) / 60).toFixed(2), cellX(c), cellY(c) - 9);
  }
  ctx.textAlign = 'left';
  if (clk.last !== null) {
    ctx.fillStyle = '#7dff7d';
    label(`pavio: ${clk.last.toFixed(2)}s`, 4, 212);
  }
  if (clk.lastFlame !== null) {
    ctx.fillStyle = '#ff9a3c';
    label(`fogo (mata): ${clk.lastFlame.toFixed(2)}s`, 4, 222);
  }
  ctx.restore();
}
