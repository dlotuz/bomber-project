import { BTN } from '../core';
import type { App, Screen } from '../app/app';
import { CHARACTERS } from '../render/art/bomber';
import { displayName } from '../game/config';
import { COLORS, PLAYER_COLORS, drawBackground, drawFooter, drawPanel, drawText, drawTitleBar } from './ui';
import { rulesScreen } from './rules';
import { stageScreen } from './stage';

const COLS = 3;
const ROWS = 2;
export const AUTO_ADVANCE_FRAMES = 90;
const GRID_X = 100, GRID_Y = 42, CELL_W = 48, CELL_H = 66;

/** "Escolha um personagem": cada jogador humano move o próprio cursor com o próprio controle. */
export function charactersScreen(app: App): Screen & { readonly locked: readonly boolean[] } {
  const setup = app.settings.setup;
  const human = (i: number) => setup.slots[i] === 'human';
  // CPUs, desligados e humanos sem controle já começam prontos.
  const locked = [0, 1, 2, 3, 4].map(i => !human(i) || app.settings.devices[i] === 'none');
  let readyFrames = 0;

  const moveCursor = (i: number, p: number) => {
    const c = setup.chars[i];
    const col = c % COLS, row = Math.floor(c / COLS);
    if (p & BTN.LEFT) setup.chars[i] = row * COLS + (col + COLS - 1) % COLS;
    if (p & BTN.RIGHT) setup.chars[i] = row * COLS + (col + 1) % COLS;
    if (p & (BTN.UP | BTN.DOWN)) setup.chars[i] = ((row + 1) % ROWS) * COLS + col;
  };

  return {
    id: 'characters',
    get locked() { return locked; },
    update(inp) {
      for (let i = 0; i < 5; i++) {
        if (!human(i)) continue;
        const p = inp.pressed[i];
        if (!locked[i]) {
          moveCursor(i, p);
          if (p & BTN.A) locked[i] = true;
        } else if (p & BTN.B) {
          locked[i] = false;
        }
      }
      // B de qualquer dispositivo serve de saída: um humano pode ter um controle desconectado
      // (device atribuído mas sem sinal), e travar nessa tela sem forma de voltar seria um beco sem saída.
      const noOneLockedIn = [0, 1, 2, 3, 4].every(i => !human(i) || !locked[i] || app.settings.devices[i] === 'none');
      if ((inp.pressedAny & BTN.B) && noOneLockedIn) {
        app.save();
        app.go(rulesScreen(app));
        return;
      }
      if (locked.every(Boolean)) {
        readyFrames++;
        if (readyFrames > AUTO_ADVANCE_FRAMES || (readyFrames > 1 && (inp.pressedAny & (BTN.START | BTN.A)))) {
          app.save();
          app.go(stageScreen(app));
        }
      } else {
        readyFrames = 0;
      }
    },
    draw(ctx, bank, frame) {
      drawBackground(ctx, frame);
      drawTitleBar(ctx, bank, 'ESCOLHA O PERSONAGEM');
      // coluna da esquerda: quem joga e o estado de cada um
      let row = 0;
      for (let i = 0; i < 5; i++) {
        if (setup.slots[i] === 'off') continue;
        const y = GRID_Y - 4 + row * 30;
        row++;
        drawPanel(ctx, 6, y, 88, 28);
        ctx.drawImage(bank.head(setup.chars[i]), 10, y + 7);
        drawText(ctx, bank, displayName(app.settings.names, i), 28, y + 2, PLAYER_COLORS[i]);
        const status = !human(i) ? 'CPU' : locked[i] ? 'PRONTO' : 'ESCOLHENDO';
        drawText(ctx, bank, status, 28, y + 14, !human(i) ? COLORS.value : locked[i] ? COLORS.ok : COLORS.dim);
      }
      // grade de personagens
      drawPanel(ctx, GRID_X - 4, GRID_Y - 4, COLS * CELL_W + 8, ROWS * CELL_H + 8);
      CHARACTERS.forEach((c, k) => {
        const x = GRID_X + (k % COLS) * CELL_W, y = GRID_Y + Math.floor(k / COLS) * CELL_H;
        ctx.drawImage(bank.bomber(k, 2, 0), x + 8, y + 8, 32, 40);
        const name = bank.text(c.name, COLORS.text);
        ctx.drawImage(name, x + Math.floor((CELL_W - name.width) / 2), y + 52);
      });
      // cursores (um por humano), com recuo diferente para não se sobreporem
      for (let i = 0; i < 5; i++) {
        if (!human(i)) continue;
        const k = setup.chars[i];
        const x = GRID_X + (k % COLS) * CELL_W, y = GRID_Y + Math.floor(k / COLS) * CELL_H;
        const inset = i * 2;
        if (!locked[i] && ((frame >> 3) & 1)) continue;
        ctx.strokeStyle = PLAYER_COLORS[i];
        ctx.lineWidth = 1;
        ctx.strokeRect(x + inset + 0.5, y + inset + 0.5, CELL_W - 1 - inset * 2, CELL_H - 1 - inset * 2);
        drawText(ctx, bank, `${i + 1}P`, x + 2 + inset, y + 1 + inset, PLAYER_COLORS[i]);
      }
      drawFooter(ctx, bank, locked.every(Boolean) ? 'TODOS PRONTOS! START PARA SEGUIR' : 'A: ESCOLHER   B: DESFAZER');
    },
  };
}
