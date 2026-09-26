import { BTN } from '../game/core-api';
import type { App, Screen } from '../app/app';
import { Repeater, DIRS } from '../input/repeat';
import { SFX } from '../app/audio';
import { FADE_MENU } from '../app/fade';
import { romState, type RomAssets } from '../app/rom-api';
import { obj, PpuCanvas, sceneFrame, sceneGfx, sceneMaps } from '../render/screens-rom/scene';
import { CHARACTERS } from '../render/art/bomber';
import { displayName } from '../game/config';
import { CHARSEL_GRID, CHARSEL_PORTRAIT, CHARSEL_STANDEE, CHARSEL_STANDEE_Y, charselMaps } from '../render/screens-rom/charsel';
import { COLORS, PLAYER_COLORS, drawFallbackFrame, drawFooter, drawStaticBackground, drawText, drawTitleBar } from './ui';
import { rulesScreen } from './rules';
import { stageScreen } from './stage';
import { teamsScreen } from './teams';

const { cols: COLS, rows: ROWS } = CHARSEL_GRID;
/** Moldura do fallback (spec §6.14), medida como as demais telas de menu. */
const FRAME = { x0: 27, y0: 35, x1: 224, y1: 188 };

/**
 * "Escolha um personagem" (§6.6, R13, R32). Cada humano com dispositivo escolhe o próprio, sozinho e ao mesmo
 * tempo; os outros ativos (CPUs e humanos sem dispositivo) entram numa fila que o "controlador" (o 1º humano com
 * dispositivo) decide depois de confirmar o próprio — ou, sem controlador nenhum, qualquer controle decide por
 * todos. B de qualquer controle, a qualquer momento, volta para as regras.
 */
export function charactersScreen(app: App): Screen & {
  charOf(i: number): number;
  readonly confirmed: readonly boolean[];
  readonly controlling: number | null;
  readonly controller: number | null;
} {
  const setup = app.settings.setup;
  const active = (i: number): boolean => setup.slots[i] !== 'off';
  const human = (i: number): boolean => setup.slots[i] === 'human';
  const selfPicking = (i: number): boolean => human(i) && app.settings.devices[i] !== 'none';

  const activeIdx = [0, 1, 2, 3, 4].filter(active);
  const controller = activeIdx.find(selfPicking) ?? null;
  const queue = activeIdx.filter(i => !selfPicking(i));
  const confirmed = [0, 1, 2, 3, 4].map(i => !active(i));

  const reps = new Map<number, Repeater>();
  for (const i of activeIdx) if (selfPicking(i)) reps.set(i, new Repeater(20, 5));
  const anyRep = new Repeater(20, 5);
  const ppu = new PpuCanvas();

  /** ←/→ dão a volta nas 3 colunas; ↑/↓ trocam a linha (spec §6.6). */
  const moveCursor = (i: number, p: number): void => {
    if (!p) return;
    const c = setup.chars[i];
    const col = c % COLS, row = Math.floor(c / COLS);
    if (p & BTN.LEFT) setup.chars[i] = row * COLS + (col + COLS - 1) % COLS;
    if (p & BTN.RIGHT) setup.chars[i] = row * COLS + (col + 1) % COLS;
    if (p & (BTN.UP | BTN.DOWN)) setup.chars[i] = ((row + 1) % ROWS) * COLS + col;
    app.audio.sfx(SFX.move);
  };

  /** Sem controlador confirmado ainda: ninguém decide pela fila. Com ele confirmado (ou sem controlador
   *  nenhum): o 1º da fila ainda sem confirmar. */
  const controllingSlot = (): number | null => {
    if (controller !== null && !confirmed[controller]) return null;
    return queue.find(i => !confirmed[i]) ?? null;
  };

  const finishIfDone = (): void => {
    if (!activeIdx.every(i => confirmed[i])) return;
    app.save();
    if (setup.mode === 'team') app.transition(() => teamsScreen(app), FADE_MENU);
    else app.transition(() => stageScreen(app), FADE_MENU);
  };

  const confirm = (i: number): void => {
    confirmed[i] = true;
    app.audio.sfx(SFX.confirm);
    finishIfDone();
  };

  return {
    id: 'characters',
    charOf: (i: number) => setup.chars[i],
    get confirmed() { return confirmed.slice(); },
    get controlling() { return controllingSlot(); },
    get controller() { return controller; },
    update(inp) {
      if (inp.pressedAny & BTN.B) {
        app.audio.sfx(SFX.back);
        app.transition(() => rulesScreen(app), FADE_MENU);
        return;
      }
      for (const i of activeIdx) {
        if (!selfPicking(i)) continue;
        const pulse = reps.get(i)!.step(inp.pads[i] & DIRS);
        if (confirmed[i]) {
          // Só o controlador continua tendo o que fazer depois de confirmar: o próprio dispositivo passa a
          // mover/confirmar quem está na vez da fila. Os outros humanos confirmados não afetam mais nada.
          if (i === controller) {
            const c = controllingSlot();
            if (c !== null) {
              moveCursor(c, pulse);
              if (inp.pressed[i] & (BTN.A | BTN.START)) confirm(c);
            }
          }
          continue;
        }
        moveCursor(i, pulse);
        if (inp.pressed[i] & (BTN.A | BTN.START)) confirm(i);
      }
      // Sem controlador (nenhum humano com dispositivo): qualquer controle decide por todos, um de cada vez.
      if (controller === null) {
        const c = controllingSlot();
        if (c !== null) {
          const pulse = anyRep.step(inp.any & DIRS);
          moveCursor(c, pulse);
          if (inp.pressedAny & (BTN.A | BTN.START)) confirm(c);
        }
      }
    },
    draw(ctx, bank, frame) {
      const a: RomAssets | null = romState.assets;
      if (a) {
        // Cena real (§6.6): corda + quebra-cabeça vêm do BG (`charselMaps`, T5/T19) e os 6 bonecos parados na
        // grade são OBJ com o tile/paleta medidos em `charsel.oam` (`CHARSEL_STANDEE`) — só o título, os
        // retratos e os cursores (conteúdo dinâmico, não existem assim na ROM) vão por cima, depois do PPU.
        const g = sceneGfx(a, 'charsel');
        const maps = sceneMaps(a, 'charsel', charselMaps);
        const oam = CHARSEL_STANDEE.map((s, k) =>
          obj(CHARSEL_GRID.x[k % COLS], CHARSEL_STANDEE_Y[Math.floor(k / COLS)], s.tile, s.pal, { big: true, prio: 3 }));
        ppu.draw(ctx, sceneFrame(g, maps, { oam }));
      } else {
        drawStaticBackground(ctx);
        drawFallbackFrame(ctx, FRAME);
        // Grade 3×2 dos personagens (sem ROM: nossa própria arte).
        CHARACTERS.forEach((ch, k) => {
          const x = CHARSEL_GRID.x[k % COLS], y = CHARSEL_GRID.y[Math.floor(k / COLS)];
          ctx.drawImage(bank.bomber(k, 2, 0), x, y, 32, 40);
        });
      }
      drawTitleBar(ctx, bank, 'ESCOLHA O PERSONAGEM');
      const ctrl = controllingSlot();
      // Coluna da esquerda: retrato + nome/estado de cada jogador ativo (conteúdo nosso, por cima da cena).
      for (const i of activeIdx) {
        const y = CHARSEL_PORTRAIT.y0 + CHARSEL_PORTRAIT.dy * i;
        ctx.drawImage(bank.head(setup.chars[i]), CHARSEL_PORTRAIT.x, y, CHARSEL_PORTRAIT.w, CHARSEL_PORTRAIT.w);
        const label = human(i) ? displayName(app.settings.names, i) : 'CPU';
        drawText(ctx, bank, label, CHARSEL_PORTRAIT.x + CHARSEL_PORTRAIT.w + 4, y + 2, PLAYER_COLORS[i]);
        const st = confirmed[i] ? 'PRONTO' : (selfPicking(i) || i === ctrl) ? 'ESCOLHENDO' : 'AGUARDA';
        drawText(ctx, bank, st, CHARSEL_PORTRAIT.x + CHARSEL_PORTRAIT.w + 4, y + 16, confirmed[i] ? COLORS.ok : COLORS.dim);
      }
      // Cursores "[ ]" com a etiqueta nP na cor de quem está escolhendo cada vaga ainda aberta.
      for (const i of activeIdx) {
        if (confirmed[i]) continue;
        const driver = selfPicking(i) ? i : i === ctrl ? controller : null;
        if (driver === null) continue;
        const k = setup.chars[i];
        const x = CHARSEL_GRID.x[k % COLS], y = CHARSEL_GRID.y[Math.floor(k / COLS)];
        const color = PLAYER_COLORS[driver];
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 2.5, y - 2.5, CHARSEL_GRID.cellW - 12, CHARSEL_GRID.cellH - 4);
        drawText(ctx, bank, `${driver + 1}P`, x - 3, y - 10, color);
      }
      drawFooter(ctx, bank, activeIdx.every(i => confirmed[i]) ? 'TUDO PRONTO' : 'A: ESCOLHER   B: VOLTAR');
    },
  };
}
