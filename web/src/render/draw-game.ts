import { BURN, CODE, GRID_H, GRID_W, cellOf, isItemCode, itemOfCode, px, invisibleVisible, clockText, CLOCK_FROZEN_FROM, type RoundState } from '../core';
import type { SpriteBank } from './sprite-bank';
import { SCREEN_W, SCREEN_H } from './display';
import { flameShrink, flamePart, walkFrame, dyingVisible, type ViewState } from './view';
import { fallbackLayers, fallbackOverLayers } from './battle-layers';
import './layers-index';

export { SCREEN_W, SCREEN_H };

/** Cores dos cursores/etiquetas de cada jogador (P1..P5). */
export const PLAYER_COLORS = ['#ff5f5f', '#5fa8ff', '#ffd23f', '#5fe07a', '#c77dff'];

/** Cor da etiqueta acima do bomber em modo times (time 0 = vermelho, time 1 = branco). */
const TEAM_TAG_COLORS = ['#ff5f5f', '#ffffff'];

const tileX = (col: number) => 16 * col - 8;
const tileY = (lin: number) => 16 * lin + 24;
const FACE_TO_DIR = [1, 0, 4, 0, 2, 0, 3];      // face 0/2/4/6 → DIR da arte (1 cima, 4 direita, 2 baixo, 3 esquerda)
/** Casas que fazem sombra no chão logo abaixo (arte de fallback). */
const solid = (v: number) => v === CODE.HARD || v === CODE.SOFT || v === CODE.PRESSURE || v === CODE.BURNING;
/** Abaixo desta linha começa o HUD; a etiqueta nunca pode subir até lá. */
const HUD_BOTTOM = 24;
/** Camadas que desenham atores: o quadro "sem atores" (máscara das sombras dos efeitos) as pula. */
const ACTOR_LAYERS = new Set(['mounts', 'costume']);

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
  const clock = bank.plainText(round.clock.sec >= CLOCK_FROZEN_FROM ? '∞' : clockText(round.clock), '#ffffff');
  ctx.drawImage(clock, 24, 1, clock.width * 2, clock.height * 2);
  let x = 82;
  round.players.forEach((p, i) => {
    if (!p.present) return;
    ctx.globalAlpha = p.state === 'alive' ? 1 : 0.35;
    ctx.drawImage(bank.head(chars[i]), x, 5);
    ctx.globalAlpha = 1;
    ctx.drawImage(bank.text(String(crowns[i]), '#ffffff'), x + 17, 6);
    x += 35;
  });
}

/** Desenha a arena inteira de uma rodada pela grade de códigos da ROM: tiles, itens, chamas, bombas, jogadores e HUD. */
export function drawRound(ctx: CanvasRenderingContext2D, round: RoundState, view: ViewState, bank: SpriteBank,
  chars: number[], frame: number, crowns: number[], opts: { actors?: boolean } = {}): void {
  const tiles = bank.tiles(round.stage);
  ctx.fillStyle = tiles.bg;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  for (let lin = 0; lin < GRID_H; lin++) for (let col = 0; col < GRID_W; col++) {
    const c = cellOf(col, lin), v = round.grid[c];
    const x = tileX(col), y = tileY(lin);
    const border = col <= 1 || col >= 15 || lin === 0 || lin === 12;
    const base = border ? tiles.wall : v === CODE.HARD || v === CODE.PRESSURE ? tiles.hard : (col + lin) % 2 ? tiles.floorAlt : tiles.floor;
    ctx.drawImage(base, x, y);
    if (border) continue;
    // sombra no chão logo abaixo de parede, pilar ou bloco
    if (!solid(v) && solid(round.grid[c - GRID_W])) { ctx.fillStyle = 'rgba(0, 0, 0, 0.28)'; ctx.fillRect(x, y, 16, 3); }
    if (v === CODE.SOFT) ctx.drawImage(tiles.soft, x, y);
    else if (v === CODE.BURNING) ctx.drawImage(round.cellAux[c] === BURN.SOFT ? tiles.burning[(frame >> 2) & 1] : tiles.burning[1], x, y);
    else if (isItemCode(v)) ctx.drawImage(bank.item(itemOfCode(v)), x, y);
    else if (v === CODE.FLAME) ctx.drawImage(bank.flame(flamePart(round.cellAux[c]), flameShrink(round.tick - round.cellT0[c])), x, y);
    else if (v === CODE.FALLING) { ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'; ctx.fillRect(x + 2, y + 10, 12, 5); }
  }
  const actors = opts.actors !== false;
  for (const l of fallbackLayers) if (actors || !ACTOR_LAYERS.has(l.id)) l.draw(round, ctx, bank, frame);
  if (actors) drawActors(ctx, round, view, bank, chars, frame);
  drawHud(ctx, round, bank, chars, crowns);
}

function drawActors(ctx: CanvasRenderingContext2D, round: RoundState, view: ViewState, bank: SpriteBank, chars: number[], frame: number): void {
  for (const b of round.bombs) {
    if (b.state === 'idle' || b.state === 'kicked') ctx.drawImage(bank.bomb((frame >> 3) & 1), px(b.x) - 7, px(b.y) - 7);
  }
  for (const f of round.flyers) {
    if (f.kind === 'player') continue;   // o próprio jogador é desenhado com a altura p.z
    const img = f.kind === 'bomb' ? bank.bomb(0) : bank.item(f.ref);
    ctx.drawImage(img, px(f.x) - 7, px(f.y) + f.z - 7);
  }
  const shown = round.players.filter(p => p.present && (p.state === 'alive' || p.state === 'dying')).sort((p, q) => p.y - q.y || p.z - q.z || p.slot - q.slot);
  for (const p of shown) {
    if (p.state === 'dying' && !dyingVisible(round.tick - p.hitT0)) continue;
    if (p.state === 'alive' && (!invisibleVisible(p) || (p.inv & 2) !== 0)) continue;
    const sx = px(p.x) - 7, sy = px(p.y) - 11 - p.z;
    const frameIdx = p.state === 'dying' ? 0 : walkFrame(view.walk[p.slot]);
    ctx.drawImage(bank.bomber(chars[p.slot], FACE_TO_DIR[p.face], frameIdx), sx, sy);
    if (p.carry >= 0) ctx.drawImage(bank.bomb(0), sx, sy - 12);
    // "NP" acima da cabeça: distingue bombers idênticos (mesmo personagem). Some durante a morte.
    if (p.state === 'alive') {
      const color = round.rules.mode === 'team' ? TEAM_TAG_COLORS[p.team] : PLAYER_COLORS[p.slot];
      const tag = bank.text(`${p.slot + 1}P`, color);
      ctx.drawImage(tag, sx + 8 - Math.floor(tag.width / 2), Math.max(HUD_BOTTOM, sy - 9));
    }
  }
  ctx.globalAlpha = 0.7;
  for (const b of round.bad) ctx.drawImage(bank.bomber(chars[b.slot], FACE_TO_DIR[b.face], 0), b.x - 8, b.y - 12);
  ctx.globalAlpha = 1;
  for (const l of fallbackOverLayers) l.draw(round, ctx, bank, frame);   // M4: depois de bombas e jogadores
}
