import { CELL, ITEM, T, GRID_W, GRID_H, idx, type RoundState } from '../core';
import type { SpriteBank } from './sprite-bank';
import { SCREEN_W, SCREEN_H } from './display';
import { flameCells, flameShrink, walkFrame, dyingVisible, formatClock, type ViewState } from './view';

export { SCREEN_W, SCREEN_H };

/** Cores dos cursores/etiquetas de cada jogador (P1..P5). */
export const PLAYER_COLORS = ['#ff5f5f', '#5fa8ff', '#ffd23f', '#5fe07a', '#c77dff'];

/** Cor da etiqueta acima do bomber em modo times (time 0 = vermelho, time 1 = branco). */
const TEAM_TAG_COLORS = ['#ff5f5f', '#ffffff'];

const tileX = (gx: number) => 16 * gx + 8;
const tileY = (gy: number) => 16 * gy + 24;
const toPx = (sub: number) => Math.floor(sub / 8);
/** Abaixo desta linha começa o HUD; a etiqueta nunca pode subir até lá. */
const HUD_BOTTOM = 24;

export function drawTextCentered(ctx: CanvasRenderingContext2D, bank: SpriteBank, text: string, color: string, y: number, scale: number): void {
  const img = bank.text(text, color);
  const w = img.width * scale;
  ctx.drawImage(img, Math.floor((SCREEN_W - w) / 2), y, w, img.height * scale);
}

export function drawHud(ctx: CanvasRenderingContext2D, round: RoundState, bank: SpriteBank, chars: number[], crowns: number[]): void {
  // barra verde com moldura dourada
  ctx.fillStyle = '#0b3d16';
  ctx.fillRect(0, 0, SCREEN_W, 24);
  ctx.fillStyle = '#e8a800';
  ctx.fillRect(1, 1, SCREEN_W - 2, 22);
  ctx.fillStyle = '#0b3d16';
  ctx.fillRect(2, 2, SCREEN_W - 4, 20);
  ctx.fillStyle = '#1b6a2a';
  ctx.fillRect(3, 3, SCREEN_W - 6, 18);
  ctx.drawImage(bank.clock(), 6, 4);
  const clock = bank.plainText(formatClock(round.timeLeft), '#ffffff');
  ctx.drawImage(clock, 24, 1, clock.width * 2, clock.height * 2);
  let x = 82;
  round.players.forEach((p, i) => {
    if (!p.active) return;
    ctx.globalAlpha = p.alive ? 1 : 0.35;
    ctx.drawImage(bank.head(chars[i]), x, 5);
    ctx.globalAlpha = 1;
    ctx.drawImage(bank.text(String(crowns[i]), '#ffffff'), x + 17, 6);
    x += 35;
  });
}

/** Desenha a arena inteira de uma rodada: tiles, itens, bombas, chamas, jogadores e HUD. */
export function drawRound(ctx: CanvasRenderingContext2D, round: RoundState, view: ViewState, bank: SpriteBank,
  chars: number[], frame: number, crowns: number[]): void {
  const tiles = bank.tiles(round.stage);
  const a = round.arena;
  ctx.fillStyle = tiles.bg;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  for (let gy = 0; gy < GRID_H; gy++) for (let gx = 0; gx < GRID_W; gx++) {
    const i = idx(gx, gy);
    const x = tileX(gx), y = tileY(gy);
    const border = gx === 0 || gy === 0 || gx === GRID_W - 1 || gy === GRID_H - 1;
    const base = border ? tiles.wall : a.cells[i] === CELL.HARD ? tiles.hard : (gx + gy) % 2 ? tiles.floorAlt : tiles.floor;
    ctx.drawImage(base, x, y);
    if (border) continue;
    // sombra no chão logo abaixo de parede, pilar ou bloco
    if (a.cells[i] !== CELL.HARD) {
      const above = gy - 1 === 0 || a.cells[idx(gx, gy - 1)] !== CELL.EMPTY;
      if (above) { ctx.fillStyle = 'rgba(0, 0, 0, 0.28)'; ctx.fillRect(x, y, 16, 3); }
    }
    if (a.cells[i] === CELL.SOFT) ctx.drawImage(a.burning[i] > 0 ? tiles.burning[(frame >> 2) & 1] : tiles.soft, x, y);
    else if (a.items[i] !== ITEM.NONE) ctx.drawImage(bank.item(a.items[i]), x, y);
  }

  for (const b of round.bombs) {
    if (b.carried) continue;
    let by = toPx(b.y) - 8;
    if (b.flight) by -= Math.round(10 * Math.sin((Math.PI * b.flight.progress) / T));
    ctx.drawImage(bank.bomb((frame >> 3) & 1), toPx(b.x) - 8, by);
  }

  for (const e of view.explosions) {
    const shrink = flameShrink(e.age);
    for (const c of flameCells(e)) {
      if (a.cells[idx(c.gx, c.gy)] !== CELL.EMPTY) continue;
      ctx.drawImage(bank.flame(c.part, shrink), tileX(c.gx), tileY(c.gy));
    }
  }

  const players = round.players.filter(p => p.active && p.alive).sort((p, q) => p.y - q.y || p.slot - q.slot);
  for (const p of players) {
    if (!dyingVisible(p.dying)) continue;
    const sx = toPx(p.x) - 8, sy = toPx(p.y) - 12;
    const frameIdx = p.dying > 0 ? 0 : walkFrame(view.walk[p.slot]);
    ctx.drawImage(bank.bomber(chars[p.slot], p.facing, frameIdx), sx, sy);
    if (p.carrying >= 0) ctx.drawImage(bank.bomb(0), sx, sy - 12);
    // "NP" acima da cabeça: distingue bombers idênticos (mesmo personagem). Some durante a morte.
    if (p.dying <= 0) {
      const color = round.rules.mode === 'team' ? TEAM_TAG_COLORS[p.team] : PLAYER_COLORS[p.slot];
      const tag = bank.text(`${p.slot + 1}P`, color);
      const tagX = sx + 8 - Math.floor(tag.width / 2);
      const tagY = Math.max(HUD_BOTTOM, sy - 9);
      ctx.drawImage(tag, tagX, tagY);
    }
  }

  drawHud(ctx, round, bank, chars, crowns);
}
