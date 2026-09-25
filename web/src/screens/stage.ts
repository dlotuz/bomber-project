import { BTN, LAYOUTS, STAGE_NAMES } from '../core';
import type { App, Screen } from '../app/app';
import { THEMES } from '../render/art/tiles';
import { SCREEN_W, drawTextCentered } from '../render/draw-game';
import { configFromSetup } from '../game/config';
import { COLORS, drawBackground, drawFooter, drawPanel, drawTitleBar } from './ui';
import { charactersScreen } from './characters';
import { battleScreen } from './battle';

export const START_DELAY_FRAMES = 45;
const STAGES = 10;

/** Miniatura da arena (15×13 casas de `cell` px) com as cores do tema. */
export function drawMiniArena(ctx: CanvasRenderingContext2D, stage: number, x: number, y: number, cell: number): void {
  const t = THEMES[stage - 1];
  const rows = LAYOUTS[stage - 1];
  for (let gy = 0; gy < 13; gy++) for (let gx = 0; gx < 15; gx++) {
    let color: string;
    if (gx === 0 || gy === 0 || gx === 14 || gy === 12) color = t.wallFace;
    else {
      const ch = rows[gy - 1][gx - 1];
      color = ch === '#' ? t.hardFace : ch === 'x' ? t.softA : (gx + gy) % 2 ? t.floorB : t.floorA;
    }
    ctx.fillStyle = color;
    ctx.fillRect(x + gx * cell, y + gy * cell, cell, cell);
  }
}

/** "Escolha uma fase": miniatura no centro, vizinhas nas laterais, "FASE N / nome". */
export function stageScreen(app: App): Screen & { readonly starting: number } {
  const setup = app.settings.setup;
  let starting = 0;
  const shift = (d: number) => { setup.stage = ((setup.stage - 1 + d + STAGES) % STAGES) + 1; app.save(); };
  return {
    id: 'stage',
    get starting() { return starting; },
    update(inp) {
      if (starting > 0) {
        if (--starting === 0) app.go(battleScreen(app, configFromSetup(setup, app.settings.names), inp.pads));
        return;
      }
      const p = inp.pressedAny;
      if (p & BTN.LEFT) shift(-1);
      else if (p & BTN.RIGHT) shift(1);
      else if (p & (BTN.A | BTN.START)) starting = START_DELAY_FRAMES;
      else if (p & BTN.B) app.go(charactersScreen(app));
    },
    draw(ctx, bank, frame) {
      drawBackground(ctx, frame);
      drawTitleBar(ctx, bank, starting > 0 ? 'BATALHA!' : 'ESCOLHA A FASE');
      const prev = ((setup.stage + STAGES - 2) % STAGES) + 1, next = (setup.stage % STAGES) + 1;
      ctx.globalAlpha = 0.55;
      drawMiniArena(ctx, prev, 8, 70, 3);
      drawMiniArena(ctx, next, SCREEN_W - 8 - 45, 70, 3);
      ctx.globalAlpha = 1;
      drawPanel(ctx, 86, 50, 84, 74);
      drawMiniArena(ctx, setup.stage, 91, 55, 5);
      drawTextCentered(ctx, bank, `FASE ${setup.stage}`, COLORS.title, 134, 2);
      drawTextCentered(ctx, bank, STAGE_NAMES[setup.stage - 1], COLORS.text, 164, 1);
      drawFooter(ctx, bank, 'ESQ/DIR: TROCAR   A: JOGAR   B: VOLTAR');
    },
  };
}
