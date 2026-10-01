import { BTN } from '../game/core-api';
import type { App, Screen } from '../app/app';
import { SFX } from '../app/audio';
import { FADE_MENU } from '../app/fade';
import { romState, type RomAssets } from '../app/rom-api';
import { PpuCanvas } from '../render/screens-rom/scene';
import { CHARSEL_BG1_SHIFT, charselSprites, drawCharselTitle } from '../render/screens-rom/charsel';
import { hdMenu } from '../render/hd-menu';
import { TEAMSEL_MARKER_X, TEAMSEL_PORTRAIT, TEAMSEL_VS } from '../render/screens-rom/teams';
import { COLORS, PLAYER_COLORS } from './ui';
import { drawText } from '../render/text/text';
import { S } from '../render/text/strings';
import { SCREEN_H } from '../render/display';
import { createPickScheme } from './pick-scheme';
import { charactersScreen } from './characters';
import { stageScreen } from './stage';

/** Moldura do fallback (spec §6.14), a mesma da tela de personagens. */
/** Cor do marcador por equipe (0 = vermelha, 1 = branca) — não existe mais em `players.ts` (T9): o time é só
 *  desta tela desde a Task 10 (comentário de `playersScreen`). */
const TEAM_COLOR: readonly [string, string] = ['#ff5f5f', '#ffffff'];

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
  const scheme = createPickScheme(app);
  const ppu = new PpuCanvas();

  const moveSide = (i: number, p: number): void => {
    if (p & BTN.LEFT) { setup.teams[i] = 0; app.audio.sfx(SFX.move); }
    else if (p & BTN.RIGHT) { setup.teams[i] = 1; app.audio.sfx(SFX.move); }
  };

  /** Confirma a vaga `i`, a não ser que seja a última ainda aberta e deixaria uma das equipes vazia (R14):
   *  nesse caso só toca a recusa ($03) e a vaga continua sem confirmar. */
  const confirm = (i: number): void => {
    const remaining = scheme.activeIdx.filter(k => !scheme.confirmed[k]);
    if (remaining.length === 1) {
      const sides = scheme.activeIdx.map(k => setup.teams[k]);
      if (!(sides.includes(0) && sides.includes(1))) { app.audio.sfx(SFX.back); return; }
    }
    scheme.confirmed[i] = true;
    app.audio.sfx(SFX.confirm);
    if (scheme.activeIdx.every(k => scheme.confirmed[k])) {
      app.save();
      app.transition(() => stageScreen(app), FADE_MENU);
    }
  };

  return {
    id: 'teams',
    sideOf: (i: number) => setup.teams[i] as 0 | 1,
    get confirmed() { return scheme.confirmed.slice(); },
    get controlling() { return scheme.controllingSlot(); },
    update(inp) {
      if (scheme.handle(inp, moveSide, confirm)) {
        app.audio.sfx(SFX.back);
        app.transition(() => charactersScreen(app), FADE_MENU);
      }
    },
    draw(ctx, bank, frame) {
      // A1 (brief T10): equipes não tem captura própria — reaproveita a mesma cena `charsel` (corda, quebra-cabeça e
      // a coluna de retratos da ROM no BG1, com o HOFS −8), sem grade nem bonecos parados; o marcador de lado e o
      // "VS" são conteúdo nosso por cima.
      const a: RomAssets | null = romState.assets;
      hdMenu(ctx, null, { title: 15 });
      if (a) {
        ppu.drawOver(ctx, charselSprites(a, [0, 1, 2, 3, 4].map(i => (setup.slots[i] !== 'off' ? setup.chars[i] : null))));
        drawCharselTitle(ctx, bank, S.teams.title, COLORS.title);
      } else {
        drawCharselTitle(ctx, bank, S.teams.title, COLORS.title);
      }
      // Com ROM a moldura inteira anda +8 em x junto com o BG1 (I8): marcadores e "VS" acompanham.
      const dx = a ? CHARSEL_BG1_SHIFT.x : 0;
      const ctrl = scheme.controllingSlot();
      for (const i of scheme.activeIdx) {
        const y = TEAMSEL_PORTRAIT.y0 + TEAMSEL_PORTRAIT.dy * i;
        if (!a) ctx.drawImage(bank.head(setup.chars[i]), TEAMSEL_PORTRAIT.x, y, TEAMSEL_PORTRAIT.w, TEAMSEL_PORTRAIT.w);
        const side = setup.teams[i];
        const mx = TEAMSEL_MARKER_X[side] + dx;
        const driver = !scheme.confirmed[i] ? (scheme.selfPicking(i) ? i : i === ctrl ? scheme.controller : null) : null;
        ctx.fillStyle = driver !== null ? PLAYER_COLORS[driver] : TEAM_COLOR[side];
        ctx.fillRect(mx, y + 8, 16, 16);
        drawText(ctx, bank, 'ascii8', S.chars.tags[i], mx, y - 4, { color: PLAYER_COLORS[i], bare: true });
      }
      drawText(ctx, bank, 'menuItem', S.teams.vs, TEAMSEL_VS.x + dx, TEAMSEL_VS.y, { align: 'center' });
      // `bare` (M1, revisão final): igual a Opções/Remapeamento — sem o campo opaco do `ascii8`, como na ROM.
      drawText(ctx, bank, 'ascii8', S.teams.help, 128, SCREEN_H - 16, { align: 'center', tone: 'gray', bare: true });
    },
  };
}
