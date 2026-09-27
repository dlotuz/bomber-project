import { BTN } from '../game/core-api';
import type { App, Screen, Cue } from '../app/app';
import { LAYOUTS } from '../core';
import { THEMES } from '../render/art/tiles';
import { Repeater } from '../input/repeat';
import { STAGE, STAGE_BLACK, stageScrollOffset, battleTextVisible, stageTitleDy } from '../game/timeline';
import { FADE_OUT_1, FADE_MENU } from '../app/fade';
import { SFX, MUSIC, VOICE, BANK } from '../app/audio';
import { createMatchSession } from '../game/match-session';
import { configFromSetup, canStart } from '../game/config';
import { S } from '../render/text/strings';
import { drawText } from '../render/text/text';
import { romState } from '../app/rom-api';
import { sceneFrame, PpuCanvas } from '../render/screens-rom/scene';
import { stagePreview, STAGE_ICON_HOFS_BASE } from '../render/screens-rom/stagesel';
import { drawBackground } from './ui';
import { battleScreen } from './battle';
import { charactersScreen } from './characters';
import { teamsScreen } from './teams';

const STAGES = 10;
/** Volta 1↔10. */
const wrapStage = (n: number): number => ((n - 1 + STAGES) % STAGES) + 1;

/** Cues da transição para a partida (§6.7): brilho fixo em $01 até o fade sonoro, banco e música da batalha. */
const fadeAudio = (a: App): void => a.audio.fade();
const bankCue = (id: 0x2f | 0x30) => (a: App): void => a.audio.bank(id);
const musicCue = (id: number) => (a: App): void => a.audio.music(id);

/** Miniatura da arena (15×13 casas de `cell` px) com as cores do tema. Placeholder até a T11 reconstruir as
 *  prévias reais de `$C1:A901` (ver `render/screens-rom/stagesel.ts`, R29). */
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

/** "Escolha a fase!" + a sequência "BATALHA!" (§6.7, R11, R12, R29). ←/→ rolam a faixa de miniaturas (repetição
 *  36/21); A/START tocam a sequência de 646 f até a partida entrar; B volta para os personagens (ou as equipes). */
export function stageScreen(app: App): Screen & {
  readonly stage: number; scroll(): number; readonly seqF: number; battleVisible(): boolean; titleDy(): number;
} {
  const setup = app.settings.setup;
  const rep = new Repeater(STAGE.repeatFirst, STAGE.repeatEvery);
  const ppu = new PpuCanvas();
  let dir: -1 | 0 | 1 = 0;   // 0 parado, ±1 rolando
  let scrollT = 0;
  let seqF = -1;         // -1 = sequência "BATALHA!" não iniciada

  /** `scroll()` da tela: 0 parado, senão −dir · stageScrollOffset(scrollT) (sem −0). Função livre (não método) para
   *  não colidir com o `scroll()` global do DOM ao ser chamada de dentro de `draw`. */
  const currentScroll = (): number => {
    if (dir === 0) return 0;
    const off = stageScrollOffset(scrollT);
    return off === 0 ? 0 : -dir * off;
  };

  const startBattle = (): void => {
    const cfg = configFromSetup(setup, app.settings.options.randomSpawns, app.settings.devices);
    const cues: Cue[] = [
      { at: 32, run: fadeAudio }, { at: 233, run: bankCue(BANK.battle) }, { at: 245, run: musicCue(MUSIC.battle) },
    ];
    app.transition(() => battleScreen(app, createMatchSession(cfg)), { out: FADE_OUT_1, black: STAGE_BLACK, in: [], cues });
  };

  return {
    id: 'stage',
    get stage() { return setup.stage; },
    get seqF() { return seqF; },
    scroll: currentScroll,
    battleVisible() { return battleTextVisible(seqF); },
    titleDy() { return stageTitleDy(seqF); },
    update(inp) {
      const pulse = rep.step(inp.any);
      if (seqF >= 0) {
        seqF++;
        if (seqF === STAGE.musicAt) app.audio.music(MUSIC.battleStart);
        else if (seqF === STAGE.voiceAt) app.audio.voice(VOICE.battleStart);
        else if (seqF === STAGE.fadeOutAt) startBattle();
        return;
      }
      if (dir !== 0) {
        scrollT++;
        if (scrollT === STAGE.scrollFrames) {
          setup.stage = wrapStage(setup.stage + dir);
          app.save();
          dir = 0; scrollT = 0;
        }
        return;   // pulsos, A e B no meio da rolagem são ignorados
      }
      if (pulse & BTN.LEFT) { dir = -1; scrollT = 0; app.audio.sfx(SFX.move); return; }
      if (pulse & BTN.RIGHT) { dir = 1; scrollT = 0; app.audio.sfx(SFX.move); return; }
      const p = inp.pressedAny;
      if (p & (BTN.A | BTN.START)) {
        if (!canStart(setup.slots)) { app.audio.sfx(SFX.back); return; }   // não deveria acontecer
        app.audio.sfx(SFX.confirm);
        seqF = 0;
        return;
      }
      if (p & BTN.B) {
        app.audio.sfx(SFX.back);
        app.transition(() => (setup.mode === 'team' ? teamsScreen(app) : charactersScreen(app)), FADE_MENU);
      }
    },
    draw(ctx, bank, frame) {
      const s = currentScroll();
      const rom = romState.assets;
      if (rom) {
        // ROM: fundo de quebra-cabeça igual aos outros menus (cena `stagesel`, T5) e as prévias reais
        // (anterior/atual/seguinte e, rolando, a que entra) com mapas e paletas por slot lidos da ROM
        // (`$C1:A8D1`/`$C1:A92B`), com o BG1 rolando por baixo delas (`render/screens-rom/stagesel.ts`).
        const { g, maps } = stagePreview(rom, setup.stage, dir);
        ppu.draw(ctx, sceneFrame(g, maps, { bg1: [STAGE_ICON_HOFS_BASE - s, 0] }));
      } else {
        // Sem ROM: fallback com a arena reduzida (T-anterior), sem alpha, nas posições do R29.
        drawBackground(ctx, frame);
        const cell = 112 / 15;
        const prev = wrapStage(setup.stage - 1), next = wrapStage(setup.stage + 1);
        drawMiniArena(ctx, prev, 72 - 128 + s, 40, cell);
        drawMiniArena(ctx, setup.stage, 72 + s, 40, cell);
        drawMiniArena(ctx, next, 72 + 128 + s, 40, cell);
      }
      if (battleTextVisible(seqF)) {
        drawText(ctx, bank, 'bigBattle', S.stage.battle, 128, 8, { align: 'center' });
      } else {
        drawText(ctx, bank, 'spriteBlue', S.stage.title, 126, 8 + stageTitleDy(seqF), { align: 'center' });
      }
      drawText(ctx, bank, 'spriteBlue', S.stage.stage(setup.stage), 128, 152, { align: 'center' });
      drawText(ctx, bank, 'spriteBlue', S.stage.names[setup.stage - 1], 128, 184, { align: 'center' });
    },
  };
}
