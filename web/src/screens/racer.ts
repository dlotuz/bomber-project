import type { App, Screen } from '../app/app';
import { carry, type MatchSession } from '../game/match-session';
import { BTN, drawRacerPrize, racerPrizeKey, type Rng16, type RacerPrizeKey } from '../game/core-api';
import { RACER } from '../game/timeline';
import { FADE_MENU } from '../app/fade';
import { stageScreen } from './stage';
import { S, RACER_PRIZE_NAMES } from '../render/text/strings';
import { drawText } from '../render/text/text';
import { romState } from '../app/rom-api';
import { racerChampionImg } from '../render/screens-rom/racer';
import { SCREEN_W, SCREEN_H } from '../render/draw-game';
import { hexToRgb } from '../render/art/pix';

/** "APERTE B!" pisca 32 f visível / 32 f apagado (§3.14; sem constante própria no T6, fixado aqui). */
const PRESS_BLINK = 32;
/** Faixa vertical da pista (gradiente de faixas horizontais) e o corredor onde o campeão anda. */
const TRACK_Y0 = 92, TRACK_Y1 = 172, STRIPE_H = 8;
const TRACK_X0 = 12, TRACK_X1 = SCREEN_W - 12 - 32;
const TRACK_TOP = '#1b2a5c', TRACK_BOTTOM = '#0a1230';

/** Mapa chave do prêmio (R20/A2) → item da ROM ($C1:60A0, `render/art/items.ts`) só para o ícone (`bank.item`).
 *  Cada chave usa o item cujo efeito é igual ao da própria corrida (`core/racer.ts` `applyRacerPrize` vs.
 *  `core/items.ts` `applyItem`); "nada" e "patins −1" não têm item de campo equivalente (ícone genérico/reaproveitado). */
const PRIZE_ITEM: Record<RacerPrizeKey, number> = {
  'bomb+1': 0x01, pierce: 0x02, 'fire+1': 0x03, fullFire: 0x04, 'speed+1': 0x05, 'remote+glove': 0x06,
  glove: 0x07, kick: 0x0e, none: 0x00, passBomb: 0x0b, passSoft: 0x0a, 'speed-1': 0x05, punch: 0x0d,
  heart: 0x09, p: 0x12,
};

function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a), [br, bg, bb] = hexToRgb(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${m(ar, br)},${m(ag, bg)},${m(ab, bb)})`;
}

/** Pista sem gráficos da ROM catalogados: faixas horizontais em gradiente (§3.14). */
function drawTrack(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#04060f';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  const rows = Math.ceil((TRACK_Y1 - TRACK_Y0) / STRIPE_H);
  for (let i = 0; i < rows; i++) {
    const y = TRACK_Y0 + i * STRIPE_H;
    ctx.fillStyle = lerpColor(TRACK_TOP, TRACK_BOTTOM, i / Math.max(1, rows - 1));
    ctx.fillRect(0, y, SCREEN_W, Math.min(STRIPE_H, TRACK_Y1 - y));
  }
}

/** Corrida Bônus (§3.14, §6.12, R20), provisória (A2): empurrão de B, atrito, prêmio pelo RNG do jogo. */
export function racerScreen(app: App, ms: MatchSession): Screen & {
  readonly pos: number; readonly speed: number; readonly finished: boolean; readonly prize: number | null;
} {
  const champion = ms.champions[0] ?? 0;
  const charIndex = ms.cfg.chars[champion] ?? 0;
  let pos = 0, speed = 0, t = 0, finished = false, prize: number | null = null, afterFinish = 0, leaving = false;

  function finish(): void {
    finished = true;
    const r: Rng16 = { seed: carry.seed ?? 0x0012 };
    prize = drawRacerPrize(r);
    carry.seed = r.seed;
    carry.racerPrize = { slot: champion, prize };
  }

  return {
    id: 'racer',
    get pos() { return pos; }, get speed() { return speed; }, get finished() { return finished; }, get prize() { return prize; },
    update(inp) {
      if (leaving) return;
      if (!finished) {
        t++;
        if (inp.pressedAny & BTN.B) speed = Math.min(RACER.maxSpeed, speed + RACER.push);
        pos += speed / 8;
        speed = Math.max(0, speed - RACER.drag);
        if (pos >= RACER.length || t >= RACER.timeout) finish();
        return;
      }
      afterFinish++;
      if (afterFinish >= RACER.showPrize || (inp.pressedAny & (BTN.A | BTN.B | BTN.START))) {
        leaving = true;
        app.transition(() => stageScreen(app), FADE_MENU);
      }
    },
    draw(ctx, bank, frame) {
      drawTrack(ctx);
      const a = romState.assets;
      const x = TRACK_X0 + Math.round((Math.min(pos, RACER.length) / RACER.length) * (TRACK_X1 - TRACK_X0));
      const y = TRACK_Y1 - 36;
      const g = speed > 0 ? 1 + ((frame >> 3) & 1) : 0;
      if (a) ctx.drawImage(racerChampionImg(a, charIndex, champion, g), x, y);
      else ctx.drawImage(bank.bomber(charIndex, 4, g), x, y);

      if (!finished) {
        if (frame % (2 * PRESS_BLINK) < PRESS_BLINK) drawText(ctx, bank, 'banner', S.racer.press, 128, 16, { align: 'center' });
        return;
      }
      drawText(ctx, bank, 'ascii8', S.racer.prize, 128, 44, { align: 'center' });
      if (prize !== null) {
        const key = racerPrizeKey(prize);
        drawText(ctx, bank, 'ascii8', RACER_PRIZE_NAMES[key], 128, 60, { align: 'center' });
        ctx.drawImage(bank.item(PRIZE_ITEM[key]), 120, 76);
      }
    },
  };
}
