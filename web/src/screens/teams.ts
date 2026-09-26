import { BTN } from '../game/core-api';
import type { App, Screen } from '../app/app';
import { Repeater, DIRS } from '../input/repeat';
import { SFX } from '../app/audio';
import { FADE_MENU } from '../app/fade';
import { TEAMSEL_MARKER_X, TEAMSEL_PORTRAIT, TEAMSEL_VS } from '../render/screens-rom/teams';
import { COLORS, PLAYER_COLORS, drawFallbackFrame, drawFooter, drawStaticBackground, drawText, drawTitleBar } from './ui';
import { drawTextCentered } from '../render/draw-game';
import { TEAM_COLOR } from './players';
import { charactersScreen } from './characters';
import { stageScreen } from './stage';

/** Moldura do fallback (spec §6.14), a mesma da tela de personagens. */
const FRAME = { x0: 27, y0: 35, x1: 224, y1: 188 };

/**
 * "Escolha as equipes!" (§6.6, R14, A1). Mesmo esquema de escolha da tela de personagens (sozinho/fila/
 * controlador), mas ←/→ escolhem o lado. O último A que deixaria uma equipe vazia é recusado ($03) e não
 * confirma aquela vaga; com as duas ocupadas, grava e segue para a fase. B de qualquer controle volta aos
 * personagens.
 */
export function teamsScreen(app: App): Screen & {
  sideOf(i: number): 0 | 1;
  readonly confirmed: readonly boolean[];
  readonly controlling: number | null;
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

  const moveSide = (i: number, p: number): void => {
    if (p & BTN.LEFT) { setup.teams[i] = 0; app.audio.sfx(SFX.move); }
    else if (p & BTN.RIGHT) { setup.teams[i] = 1; app.audio.sfx(SFX.move); }
  };

  const controllingSlot = (): number | null => {
    if (controller !== null && !confirmed[controller]) return null;
    return queue.find(i => !confirmed[i]) ?? null;
  };

  /** Confirma a vaga `i`, a não ser que seja a última ainda aberta e deixaria uma das equipes vazia (R14):
   *  nesse caso só toca a recusa ($03) e a vaga continua sem confirmar. */
  const confirm = (i: number): void => {
    const remaining = activeIdx.filter(k => !confirmed[k]);
    if (remaining.length === 1) {
      const sides = activeIdx.map(k => setup.teams[k]);
      if (!(sides.includes(0) && sides.includes(1))) { app.audio.sfx(SFX.back); return; }
    }
    confirmed[i] = true;
    app.audio.sfx(SFX.confirm);
    if (activeIdx.every(k => confirmed[k])) {
      app.save();
      app.transition(() => stageScreen(app), FADE_MENU);
    }
  };

  return {
    id: 'teams',
    sideOf: (i: number) => setup.teams[i] as 0 | 1,
    get confirmed() { return confirmed.slice(); },
    get controlling() { return controllingSlot(); },
    update(inp) {
      if (inp.pressedAny & BTN.B) {
        app.audio.sfx(SFX.back);
        app.transition(() => charactersScreen(app), FADE_MENU);
        return;
      }
      for (const i of activeIdx) {
        if (!selfPicking(i)) continue;
        const pulse = reps.get(i)!.step(inp.pads[i] & DIRS);
        if (confirmed[i]) {
          if (i === controller) {
            const c = controllingSlot();
            if (c !== null) {
              moveSide(c, pulse);
              if (inp.pressed[i] & (BTN.A | BTN.START)) confirm(c);
            }
          }
          continue;
        }
        moveSide(i, pulse);
        if (inp.pressed[i] & (BTN.A | BTN.START)) confirm(i);
      }
      if (controller === null) {
        const c = controllingSlot();
        if (c !== null) {
          const pulse = anyRep.step(inp.any & DIRS);
          moveSide(c, pulse);
          if (inp.pressedAny & (BTN.A | BTN.START)) confirm(c);
        }
      }
    },
    draw(ctx, bank, frame) {
      drawStaticBackground(ctx);
      drawFallbackFrame(ctx, FRAME);
      drawTitleBar(ctx, bank, 'Escolha as equipes!');
      const ctrl = controllingSlot();
      for (const i of activeIdx) {
        const y = TEAMSEL_PORTRAIT.y0 + TEAMSEL_PORTRAIT.dy * i;
        ctx.drawImage(bank.head(setup.chars[i]), TEAMSEL_PORTRAIT.x, y, TEAMSEL_PORTRAIT.w, TEAMSEL_PORTRAIT.w);
        const side = setup.teams[i];
        const mx = TEAMSEL_MARKER_X[side];
        const driver = !confirmed[i] ? (selfPicking(i) ? i : i === ctrl ? controller : null) : null;
        ctx.fillStyle = driver !== null ? PLAYER_COLORS[driver] : TEAM_COLOR[side];
        ctx.fillRect(mx, y + 8, 16, 16);
        drawText(ctx, bank, `${i + 1}P`, mx, y - 4, PLAYER_COLORS[i]);
      }
      drawTextCentered(ctx, bank, 'VS', COLORS.title, TEAMSEL_VS.y, 2);
      drawFooter(ctx, bank, 'ESQ/DIR: LADO   A: ESCOLHER   B: VOLTAR');
    },
  };
}
