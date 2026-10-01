import { CODE, FLAME_PIECE, FLAME_TICKS, ITEM, isEggCode, isItemCode, itemOfCode } from '../../core';
import { SCREEN_H, SCREEN_W } from '../display';
import { ambientFill } from './ambient';
import { FIELD_TOP, cellX, cellY, entX, entY } from './coords';
import { tintBomb } from './bomb-tint';
import { actorMask, drawShadows, type ActorMask } from './shadows';
import { flameLight, halo, puff, rgb } from './sprites';
import { MAX_PARTS, PART, type FxFrame, type FxState } from './state';

const SHADOW_BUDGET_MS = 12, SHADOW_WINDOW = 60;
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

/** Cor da bomba por jogador (as cores dos bombers no Battle): P1 branco, P2 preto (cinza-escuro, para o sombreado
 *  aparecer), P3 vermelho, P4 azul, P5 verde. */
export const BOMB_COLORS = [0xf0f0f0, 0x3a3a44, 0xe83030, 0x3070ff, 0x30c040];

let tintCtx: CanvasRenderingContext2D | null = null;

/** Corpo de cada bomba (parada, chutada ou em voo) na cor do dono; contorno, brilho e pavio ficam como na arte. */
function bombColors(out: CanvasRenderingContext2D, frame: FxFrame, m: ActorMask, fade: number): void {
  const r = frame.round, at: [number, number, number][] = [];
  for (const b of r.bombs) if (b.state === 'idle' || b.state === 'kicked') at.push([entX(b.x), entY(b.y), b.owner]);
  for (const f of r.flyers) {
    const b = f.kind === 'bomb' ? r.bombs.find(q => q.id === f.ref) : undefined;
    if (b) at.push([entX(f.x), entY(f.y) + f.z, b.owner]);
  }
  if (!at.length) return;
  if (!tintCtx) { const c = document.createElement('canvas'); c.width = c.height = 16; tintCtx = c.getContext('2d')!; }
  const img = tintCtx.createImageData(16, 16);
  out.globalCompositeOperation = 'source-over';
  out.globalAlpha = fade;
  for (const [x, y, owner] of at) {
    img.data.set(tintBomb(m.base, m.ground, SCREEN_W, x, y, BOMB_COLORS[owner] ?? BOMB_COLORS[0]));
    tintCtx.putImageData(img, 0, 0);
    out.drawImage(tintCtx.canvas, x - 8, y - 8);
  }
}

/** Ordem da spec §4.8: sombras → cor das bombas → clima → luzes/halo → partículas → flash; tudo abaixo do HUD. */
export function drawFx(out: CanvasRenderingContext2D, frame: FxFrame, base: CanvasRenderingContext2D, fade: number): void {
  const fx = frame.state, s = out.getTransform().a;
  if (!fx.shadowsOff) {
    const t0 = performance.now();
    const m = actorMask(frame, base);
    drawShadows(out, frame, m, fade, s);
    bombColors(out, frame, m, fade);
    fx.costSum += performance.now() - t0;
    if (++fx.costN === SHADOW_WINDOW) {
      if (fx.costSum / SHADOW_WINDOW > SHADOW_BUDGET_MS) fx.shadowsOff = true;
      fx.costSum = 0; fx.costN = 0;
    }
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
