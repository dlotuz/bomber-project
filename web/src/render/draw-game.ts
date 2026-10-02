import { BURN, CODE, GRID_H, GRID_W, cellOf, isEggCode, isItemCode, itemOfCode, px, invisibleVisible, clockText, CLOCK_FROZEN_FROM, type RoundState } from '../core';
import type { SpriteBank } from './sprite-bank';
import { SCREEN_W, SCREEN_H } from './display';
import { flameShrink, flamePart, walkFrame, dyingVisible, type ViewState } from './view';
import { fallbackLayers, fallbackOverLayers } from './battle-layers';
import { hudCrying } from './hud-cry';
import './layers-index';
import { NO_SKIP, type HdSkip } from './hdart/cover';
import { hdBattleSkip } from './hdart/mode';

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
/** Camadas que desenham atores: o quadro "sem atores" (máscara das sombras dos efeitos) as pula, e no quadro com
 *  atores elas saem depois das bombas (sprites por cima da bomba, que na ROM é tile de fundo: a montaria esconde a
 *  bomba que o montado põe, em vez de a bomba passar por cima dela). */
const ACTOR_LAYERS = new Set(['mounts', 'costume']);
/** Camadas que desenham o próprio jogador (traje, frente da montaria): saem junto quando o HD desenha os jogadores. */
const PLAYER_LAYERS = new Set(['costume', 'mounts-front']);

/** Rodada vista pela camada das montarias quando o HD desenha ovos e/ou jogadores: sem os ovos da grade e com quem
 *  está montado "piscando" (a camada não desenha a montaria de jogador escondido; reservas e tiros continuam). */
function mountLayerView(round: RoundState, skip: HdSkip): RoundState {
  const eggs = skip.has('eggs'), players = skip.has('players');
  if (!eggs && !players) return round;
  return {
    ...round,
    grid: eggs ? round.grid.map(v => (isEggCode(v) ? CODE.FLOOR : v)) : round.grid,
    players: players ? round.players.map(p => ({ ...p, inv: p.inv | 2 })) : round.players,
  };
}

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
    // morto: rosto chorando a partir da atualização do HUD que vê a morte, como na ROM (`hudCrying`)
    ctx.drawImage(hudCrying(round, p) ? bank.headCry(chars[i]) : bank.head(chars[i]), x, 5);
    ctx.drawImage(bank.text(String(crowns[i]), '#ffffff'), x + 17, 6);
    x += 35;
  });
}

/** Desenha a arena inteira de uma rodada pela grade de códigos da ROM: tiles, itens, chamas, bombas, jogadores e HUD.
 *  `skip`: categorias que a arte HD desenha neste quadro (a base fica transparente nelas); sem `skip`, o quadro com
 *  atores pergunta ao modo HD (lista vazia sem pacote — saída idêntica à de sempre). */
/** `opts.bombs` (só com `actors: false`): o quadro sem atores com as bombas — paradas, chutadas e voando (fx). */
export function drawRound(ctx: CanvasRenderingContext2D, round: RoundState, view: ViewState, bank: SpriteBank,
  chars: number[], frame: number, crowns: number[], opts: { actors?: boolean; bombs?: boolean; skip?: HdSkip } = {}): void {
  const actors = opts.actors !== false;
  const skip = opts.skip ?? (actors ? hdBattleSkip(round, crowns) : NO_SKIP);
  const arena = !skip.has('arena');
  const tiles = bank.tiles(round.stage);
  if (arena) {
    ctx.fillStyle = tiles.bg;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  } else ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);
  for (let lin = 0; lin < GRID_H; lin++) for (let col = 0; col < GRID_W; col++) {
    const c = cellOf(col, lin), v = round.grid[c];
    const x = tileX(col), y = tileY(lin);
    const border = col <= 1 || col >= 15 || lin === 0 || lin === 12;
    const base = border ? tiles.wall : v === CODE.HARD || v === CODE.PRESSURE ? tiles.hard : (col + lin) % 2 ? tiles.floorAlt : tiles.floor;
    if (arena) ctx.drawImage(base, x, y);
    if (border) continue;
    // sombra no chão logo abaixo de parede, pilar ou bloco
    if (arena && !solid(v) && solid(round.grid[c - GRID_W])) { ctx.fillStyle = 'rgba(0, 0, 0, 0.28)'; ctx.fillRect(x, y, 16, 3); }
    if (v === CODE.SOFT) { if (arena) ctx.drawImage(tiles.soft, x, y); }
    else if (v === CODE.BURNING) { if (arena) ctx.drawImage(round.cellAux[c] === BURN.SOFT ? tiles.burning[(frame >> 2) & 1] : tiles.burning[1], x, y); }
    else if (isItemCode(v)) { if (!skip.has(isEggCode(v) ? 'eggs' : 'items')) ctx.drawImage(bank.item(itemOfCode(v)), x, y); }
    else if (v === CODE.FLAME) { if (!skip.has('flames')) ctx.drawImage(bank.flame(flamePart(round.cellAux[c]), flameShrink(round.tick - round.cellT0[c])), x, y); }
    else if (v === CODE.FALLING) { if (arena) { ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'; ctx.fillRect(x + 2, y + 10, 12, 5); } }
  }
  for (const l of fallbackLayers) if (!ACTOR_LAYERS.has(l.id)) l.draw(round, ctx, bank, frame);
  if (actors) drawActors(ctx, round, view, bank, chars, frame, skip);
  else if (opts.bombs) { drawGroundBombs(ctx, round, bank, frame); drawFlyers(ctx, round, bank, skip, true); }
  if (!skip.has('hud')) drawHud(ctx, round, bank, chars, crowns);
  else ctx.clearRect(0, 0, SCREEN_W, HUD_BOTTOM);
}

/** Bombas paradas e chutadas (na ROM, a parada é tile de fundo: por baixo de todo sprite). */
function drawGroundBombs(ctx: CanvasRenderingContext2D, round: RoundState, bank: SpriteBank, frame: number): void {
  for (const b of round.bombs) {
    if (b.state === 'idle' || b.state === 'kicked') ctx.drawImage(bank.bomb((frame >> 3) & 1), px(b.x) - 7, px(b.y) - 7);
  }
}

/** Bombas e itens voando (`onlyBombs`: só as bombas). */
function drawFlyers(ctx: CanvasRenderingContext2D, round: RoundState, bank: SpriteBank, skip: HdSkip, onlyBombs = false): void {
  for (const f of round.flyers) {
    if (f.kind === 'player') continue;   // o próprio jogador é desenhado com a altura p.z
    if (onlyBombs && f.kind !== 'bomb') continue;
    if (skip.has(f.kind === 'bomb' ? 'bombs' : 'items')) continue;
    const img = f.kind === 'bomb' ? bank.bomb(0) : bank.item(f.ref);
    ctx.drawImage(img, px(f.x) - 7, px(f.y) + f.z - 7);
  }
}

function drawActors(ctx: CanvasRenderingContext2D, round: RoundState, view: ViewState, bank: SpriteBank, chars: number[], frame: number,
  skip: HdSkip): void {
  const bombs = !skip.has('bombs');
  if (bombs) drawGroundBombs(ctx, round, bank, frame);
  // montaria (com ovos, reservas e tiros) e traje: por cima das bombas, por baixo do cavaleiro/jogador
  const mountView = mountLayerView(round, skip);
  for (const l of fallbackLayers) {
    if (!ACTOR_LAYERS.has(l.id) || (skip.has('players') && PLAYER_LAYERS.has(l.id))) continue;
    l.draw(l.id === 'mounts' ? mountView : round, ctx, bank, frame);
  }
  drawFlyers(ctx, round, bank, skip);
  if (!skip.has('players')) drawPlayersFb(ctx, round, view, bank, chars, bombs);
  else if (bombs) {   // a bomba na mão continua da base quando só os jogadores são HD
    for (const p of round.players) if (p.present && p.state === 'alive' && p.carry >= 0) ctx.drawImage(bank.bomb(0), px(p.x) - 7, px(p.y) - 23 - p.z);
  }
  for (const l of fallbackOverLayers) if (!(skip.has('players') && PLAYER_LAYERS.has(l.id))) l.draw(round, ctx, bank, frame);   // M4: depois de bombas e jogadores
}

function drawPlayersFb(ctx: CanvasRenderingContext2D, round: RoundState, view: ViewState, bank: SpriteBank, chars: number[], bombs: boolean): void {
  const shown = round.players.filter(p => p.present && (p.state === 'alive' || p.state === 'dying')).sort((p, q) => p.y - q.y || p.z - q.z || p.slot - q.slot);
  for (const p of shown) {
    if (p.state === 'dying' && !dyingVisible(round.tick - p.hitT0)) continue;
    if (p.state === 'alive' && (!invisibleVisible(p) || (p.inv & 2) !== 0)) continue;
    const sx = px(p.x) - 7, sy = px(p.y) - 11 - p.z;
    const frameIdx = p.state === 'dying' ? 0 : walkFrame(view.walk[p.slot]);
    ctx.drawImage(bank.bomber(chars[p.slot], FACE_TO_DIR[p.face], frameIdx), sx, sy);
    if (p.carry >= 0 && bombs) ctx.drawImage(bank.bomb(0), sx, sy - 12);
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
}
