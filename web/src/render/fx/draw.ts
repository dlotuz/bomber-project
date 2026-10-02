import { CODE, FLAME_PIECE, FLAME_TICKS, ITEM, isEggCode, isItemCode, itemOfCode, px } from '../../core';
import { SCREEN_H, SCREEN_W } from '../display';
import { ambientFill } from './ambient';
import { FIELD_TOP, cellX, cellY, entX, entY } from './coords';
import { bombColor, bombMask, tintBombsInPlace } from './bomb-tint';
import { heldBombZ } from '../rom/adapt';
import { visualTick } from '../rom/battle';
import { actorMask, drawShadows, type ActorMask } from './shadows';
import { flameLight, halo, puff, rgb } from './sprites';
import { MAX_PARTS, PART, type FxFrame, type FxState } from './state';

/** Orçamento das sombras (média de uma janela de 60 quadros); estourado, elas param por `SHADOW_PAUSE` quadros e
 *  voltam a ser tentadas — um pico (troca de aba, coleta de lixo, máquina ocupada) não as desliga para sempre. */
export const SHADOW_BUDGET_MS = 12, SHADOW_WINDOW = 60, SHADOW_PAUSE = 600;
const LIGHT_R = 22, LIGHT_ALPHA = 0.3, HALO_R = 14;

function itemColor(v: number): number {
  if (isEggCode(v)) return 0xffe08a;
  const id = itemOfCode(v);
  if (id >= 0x20 && id < 0x30) return 0xc77dff;
  if (id === ITEM.FIRE || id === ITEM.FULL_FIRE) return 0xff8a2a;
  if (id === ITEM.BOMB) return 0x4aa0ff;
  if (id === ITEM.SPEED) return 0x5fe07a;
  return 0xffe08a;
}

/** Intensidade da luz pela idade da chama: sobe em 2 ticks e cai até 0 no fim (spec §4.1). */
export function flameIntensity(age: number): number {
  return Math.max(0, Math.min(1, (age + 1) / 2, (FLAME_TICKS - age) / (FLAME_TICKS - 2)));
}

function lights(out: CanvasRenderingContext2D, frame: FxFrame, fade: number): void {
  const r = frame.round;
  out.globalCompositeOperation = 'lighter';
  for (let c = 0; c < r.grid.length; c++) {
    const v = r.grid[c];
    if (v === CODE.FLAME) {
      const k = flameIntensity(r.tick - r.cellT0[c]);
      const rad = r.cellAux[c] === FLAME_PIECE.CENTER ? LIGHT_R * 1.25 : LIGHT_R;
      out.globalAlpha = k * LIGHT_ALPHA * fade;
      out.drawImage(flameLight(), cellX(c) - rad, cellY(c) - rad, rad * 2, rad * 2);
    } else if (isItemCode(v)) {
      out.globalAlpha = (0.375 + 0.125 * Math.sin((r.tick / 60) * Math.PI * 2)) * fade;
      out.drawImage(halo(itemColor(v)), cellX(c) - HALO_R, cellY(c) - HALO_R, HALO_R * 2, HALO_R * 2);
    }
  }
}

function particles(out: CanvasRenderingContext2D, fx: FxState, fade: number): void {
  for (let i = 0; i < MAX_PARTS; i++) {
    if (fx.age[i] >= fx.life[i]) continue;
    const t = 1 - fx.age[i] / fx.life[i], k = fx.kind[i], sz = fx.size[i];
    out.globalAlpha = t * fade;
    if (k === PART.SMOKE) {
      out.globalCompositeOperation = 'source-over';
      out.drawImage(puff(), fx.x[i] - sz, fx.y[i] - sz, sz * 2, sz * 2);
      continue;
    }
    out.globalCompositeOperation = k === PART.SPARK ? 'lighter' : 'source-over';
    out.fillStyle = `rgb(${rgb(fx.color[i])})`;
    out.fillRect(fx.x[i] - sz / 2, fx.y[i] - sz / 2, sz, sz);
  }
}

export { BOMB_COLORS } from './bomb-tint';

/** Centro (px de base) e cor do DONO (quem pôs a bomba) de cada bomba parada, chutada, na mão ou em voo — nunca a de
 *  quem segura, chuta ou arremessa. A parada é tile da casa (`entX/entY`); as outras são objeto 16×16 em (px − 8) na
 *  ROM e em (px − 7) no fallback (corpo da arte em px − 6…px + 5), então o centro é o próprio px. Na mão: acima da cabeça
 *  de quem segura, na altura do levantar (`heldBombZ`, no tick visual da ROM, congelado no TIME UP), no mesmo lugar em
 *  que a ROM (`readScene`), o fallback (`drawHeldBombs`) e a arte HD a desenham. */
export function bombSpots(r: FxFrame['round']): [number, number, number][] {
  const at: [number, number, number][] = [];
  const tick = visualTick(r);
  for (const b of r.bombs) {
    if (b.state === 'idle') at.push([entX(b.x), entY(b.y), bombColor(b.owner)]);
    else if (b.state === 'kicked') at.push([px(b.x), px(b.y), bombColor(b.owner)]);
    else if (b.state === 'held') {
      const p = r.players.find(q => q.present && q.carry === b.id);
      const bb = p ? null : r.bad.find(q => q.slot === b.owner);
      if (p) at.push([px(p.x), px(p.y) - p.z - heldBombZ(p, tick), bombColor(b.owner)]);
      else if (bb) at.push([bb.x, bb.y - 16, bombColor(b.owner)]);
    }
  }
  for (const f of r.flyers) {
    const b = f.kind === 'bomb' ? r.bombs.find(q => q.id === f.ref) : undefined;
    if (b) at.push([px(f.x), px(f.y) + Math.min(0, f.z), bombColor(b.owner)]);
  }
  return at;
}

/** Conta o custo das sombras de um quadro; ao fim de cada janela, média acima do orçamento → pausa. */
export function chargeShadows(fx: FxState, ms: number): void {
  fx.costSum += ms;
  if (++fx.costN < SHADOW_WINDOW) return;
  if (fx.costSum / SHADOW_WINDOW > SHADOW_BUDGET_MS) fx.shadowsPause = SHADOW_PAUSE;
  fx.costSum = 0; fx.costN = 0;
}

/** O que `prepareFx` deixa para `drawFx`: a máscara das sombras (null = sem sombras neste quadro) e o custo já gasto. */
export interface FxPrep { mask: ActorMask | null; ms: number }

let refNone: CanvasRenderingContext2D | null = null, refBombs: CanvasRenderingContext2D | null = null;
let visible: Uint8ClampedArray | null = null;
const refCtx = () => {
  const c = document.createElement('canvas'); c.width = SCREEN_W; c.height = SCREEN_H;
  return c.getContext('2d', { willReadFrequently: true })!;
};
/** Quadro de referência escurecido como a base (o App escurece a base com preto de alfa 1 − brilho/15 = 1 − fade). */
function refFrame(ctx: CanvasRenderingContext2D, frame: FxFrame, bombs: boolean, fade: number): Uint8ClampedArray {
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);
  frame.drawNoActors(ctx, bombs);
  if (fade < 1) { ctx.fillStyle = `rgba(0,0,0,${1 - fade})`; ctx.fillRect(0, 0, SCREEN_W, SCREEN_H); }
  return ctx.getImageData(0, 0, SCREEN_W, SCREEN_H).data;
}

/**
 * Antes da ampliação (spec §4.4/§4.8): pinta o corpo à vista de cada bomba na cor do dono DENTRO da base — assim a
 * ampliação nítida, o filtro suave, a arte HD por cima e o fundo borrado veem a bomba já colorida, e o que está na
 * frente dela (montaria, cavaleiro, moita) continua por cima — e calcula a máscara de chão das sombras. A cor não
 * entra no orçamento: só as sombras pausam.
 */
export function prepareFx(frame: FxFrame, base: CanvasRenderingContext2D, fade: number): FxPrep {
  const fx = frame.state, shadows = fx.shadowsPause === 0;
  if (!shadows) fx.shadowsPause--;
  const spots = bombSpots(frame.round);
  if (!shadows && !spots.length) return { mask: null, ms: 0 };
  const t0 = performance.now();
  const img = base.getImageData(0, 0, SCREEN_W, SCREEN_H);
  const none = refFrame(refNone ??= refCtx(), frame, false, fade);
  const mask = shadows ? actorMask(img.data, none) : null;
  if (spots.length) {
    visible ??= new Uint8ClampedArray(SCREEN_W * SCREEN_H * 4);
    bombMask(img.data, refFrame(refBombs ??= refCtx(), frame, true, fade), none, visible);
    for (const [x, y] of tintBombsInPlace(img.data, visible, SCREEN_W, spots)) base.putImageData(img, 0, 0, x, y, 16, 16);
  }
  return { mask, ms: performance.now() - t0 };
}

/** Ordem da spec §4.8: (cor das bombas já na base, `prepareFx`) sombras → clima → luzes/halo → partículas → flash; tudo abaixo do HUD. */
export function drawFx(out: CanvasRenderingContext2D, frame: FxFrame, prep: FxPrep, fade: number): void {
  const fx = frame.state, s = out.getTransform().a;
  if (prep.mask) {
    const t0 = performance.now();
    drawShadows(out, frame, prep.mask, fade, s);
    chargeShadows(fx, prep.ms + performance.now() - t0);
  }
  out.save();
  out.beginPath();
  out.rect(0, FIELD_TOP, SCREEN_W, SCREEN_H - FIELD_TOP);
  out.clip();
  const amb = ambientFill(frame.round.stage, fade);
  if (amb) {
    out.globalCompositeOperation = 'multiply';
    out.globalAlpha = 1;
    out.fillStyle = amb;
    out.fillRect(0, FIELD_TOP, SCREEN_W, SCREEN_H - FIELD_TOP);
  }
  lights(out, frame, fade);
  particles(out, fx, fade);
  if (fx.flash > 0) {
    out.globalCompositeOperation = 'source-over';
    out.globalAlpha = fx.flash * 0.35 * fade;
    out.fillStyle = '#ffffff';
    out.fillRect(0, FIELD_TOP, SCREEN_W, SCREEN_H - FIELD_TOP);
  }
  out.restore();
}
