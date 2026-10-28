import { BTN } from '../game/core-api';
import type { App, Screen, Cue } from '../app/app';
import { LAYOUTS } from '../game/core-api';
import { THEMES } from '../render/art/tiles';
import { Repeater } from '../input/repeat';
import { hasPowerKey } from '../input/input';
import { STAGE, STAGE_BLACK, stageScrollOffset, battleTextVisible, stageTitleDy } from '../game/timeline';
import { FADE_OUT_1, FADE_MENU, shortBlack } from '../app/fade';
import { SFX, MUSIC, VOICE, BANK } from '../app/audio';
import { createMatchSession } from '../game/match-session';
import { configFromSetup, canStart } from '../game/config';
import { S } from '../render/text/strings';
import { drawText } from '../render/text/text';
import { romState } from '../app/rom-api';
import { sceneFrame, PpuCanvas } from '../render/screens-rom/scene';
import { stagePreview, STAGE_ICON_HOFS_BASE, STAGE_ICON_ROW } from '../render/screens-rom/stagesel';
import { hdMenu, hdPanel } from '../render/hd-menu';
import { coreStage } from '../game/stages';
import { choiceNumber, isRandomStage, randomPreviewStage, resolveStage, stageChoice, stepChoice } from '../game/stage-choice';
import { battleScreen } from './battle';
import { charactersScreen } from './characters';
import { teamsScreen } from './teams';

/** Faixa das prévias (px da base): topo, altura e recorte horizontal dentro da moldura de corda do menu HD. */
const PREVIEW_Y = 40, PREVIEW_H = 112, CLIP_X0 = 16, CLIP_X1 = 240;
/** Topo das prévias da ROM na tela (linha `STAGE_ICON_ROW` do BG1; a linha y da tela mostra a y+1 do BG). */
const ROM_PREVIEW_Y = STAGE_ICON_ROW * 16 - 1;
/** Casa da miniatura sem ROM (15 casas em 112 px; 13 de altura). */
const MINI_CELL = 112 / 15;

/** "?" da prévia de ALEATÓRIO (5×7, em blocos de `Q_PX` px): desenhado por código, sem arte nova da ROM. */
const Q_GLYPH = ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'], Q_PX = 8;

/** Cues da transição para a partida (§6.7): brilho fixo em $01 até o fade sonoro, banco e música da batalha. */
const fadeAudio = (a: App): void => a.audio.fade();
const bankCue = (id: 0x2f | 0x30) => (a: App): void => a.audio.bank(id);
const musicCue = (id: number) => (a: App): void => a.audio.music(id);

/** Miniatura da arena (15×13 casas de `cell` px) com as cores do tema. Placeholder até a T11 reconstruir as
 *  prévias reais de `$C1:A901` (ver `render/screens-rom/stagesel.ts`, R29). */
export function drawMiniArena(ctx: CanvasRenderingContext2D, stage: number, x: number, y: number, cell: number): void {
  const t = THEMES[coreStage(stage) - 1];
  const rows = LAYOUTS[coreStage(stage) - 1];
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

/** Prévia de ALEATÓRIO por cima da miniatura da fase do ciclo (`x`, `y` = canto da prévia, 112 px de largura e `ph` de
 *  altura): véu escuro e um "?" amarelo de contorno escuro no centro. */
export function drawRandomMark(ctx: CanvasRenderingContext2D, x: number, y: number, ph = 112): void {
  ctx.fillStyle = 'rgba(4,10,40,0.55)';
  ctx.fillRect(x, y, 112, ph);
  const w = Q_GLYPH[0].length * Q_PX, h = Q_GLYPH.length * Q_PX;
  const x0 = Math.round(x + (112 - w) / 2), y0 = Math.round(y + (ph - h) / 2);
  for (const [color, grow] of [['#06124a', 3], ['#ffe46b', 0]] as const) {
    ctx.fillStyle = color;
    Q_GLYPH.forEach((row, gy) => [...row].forEach((ch, gx) => {
      if (ch === '#') ctx.fillRect(x0 + gx * Q_PX - grow, y0 + gy * Q_PX - grow, Q_PX + 2 * grow, Q_PX + 2 * grow);
    }));
  }
}

/** "Escolha a fase!" + a sequência "BATALHA!" (§6.7, R11, R12, R29). ←/→ rolam a faixa de miniaturas (repetição
 *  36/21) pelas fases visíveis e, depois da última, ALEATÓRIO (game/stage-choice.ts); A/START tocam a sequência de
 *  646 f até a partida entrar (com ALEATÓRIO, a fase é sorteada no A e aparece no lugar do "?"); B volta para os
 *  personagens (ou as equipes). */
export function stageScreen(app: App): Screen & {
  readonly stage: number; readonly picked: number | null; scroll(): number; readonly seqF: number; battleVisible(): boolean; titleDy(): number;
} {
  const setup = app.settings.setup;
  setup.stage = stageChoice(setup.stage);   // ALEATÓRIO fica; fase salva que ficou oculta (game/stages.ts) → a 1ª visível
  const rep =new Repeater(STAGE.repeatFirst, STAGE.repeatEvery);
  const ppu = new PpuCanvas();
  let dir: -1 | 0 | 1 = 0;   // 0 parado, ±1 rolando
  let scrollT = 0;
  let seqF = -1;         // -1 = sequência "BATALHA!" não iniciada
  let picked: number | null = null;   // fase da partida, fixada no A (com ALEATÓRIO, a sorteada)
  let t = 0;             // quadros na tela (ciclo da prévia de ALEATÓRIO)

  /** `scroll()` da tela: 0 parado, senão −dir · stageScrollOffset(scrollT) (sem −0). Função livre (não método) para
   *  não colidir com o `scroll()` global do DOM ao ser chamada de dentro de `draw`. */
  const currentScroll = (): number => {
    if (dir === 0) return 0;
    const off = stageScrollOffset(scrollT);
    return off === 0 ? 0 : -dir * off;
  };

  const startBattle = (): void => {
    // a fase sorteada vale só para esta partida: `setup.stage` (o que fica salvo) continua ALEATÓRIO
    const cfg = configFromSetup({ ...setup, stage: picked ?? setup.stage }, app.settings.options.randomSpawns, app.settings.devices, null, {
      gloveEscape: app.settings.options.gloveEscape, throwStun: app.settings.options.throwStun,
      sleepTicks: app.settings.options.sleepSec * 60, allMounts: app.settings.options.allMounts,
      powerKey: app.settings.devices.map((d, i) => hasPowerKey(d, app.settings.keymaps[i], app.settings.padmaps[i])),
    });
    const cues: Cue[] = [
      { at: 32, run: fadeAudio }, { at: 233, run: bankCue(BANK.battle) }, { at: 245, run: musicCue(MUSIC.battle) },
    ];
    app.transition(() => battleScreen(app, createMatchSession(cfg)), shortBlack({ out: FADE_OUT_1, black: STAGE_BLACK, in: [], cues }));
  };

  return {
    id: 'stage',
    get stage() { return setup.stage; },
    get picked() { return picked; },
    get seqF() { return seqF; },
    scroll: currentScroll,
    battleVisible() { return battleTextVisible(seqF); },
    titleDy() { return stageTitleDy(seqF); },
    update(inp) {
      const pulse = rep.step(inp.any);
      t++;
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
          setup.stage = stepChoice(setup.stage, dir);
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
        picked = resolveStage(setup.stage);   // ALEATÓRIO: sorteia aqui, uma vez (fora do RNG do núcleo)
        seqF = 0;
        return;
      }
      if (p & BTN.B) {
        app.audio.sfx(SFX.back);
        app.transition(() => (setup.mode === 'team' ? teamsScreen(app) : charactersScreen(app)), FADE_MENU);
      }
    },
    draw(ctx, bank) {
      // Menu HD como os outros (quebra-cabeça com corda, título e textos HD); as prévias ficam na base, por cima.
      hdMenu(ctx, null, { item: 16 }, 'lobby');
      // moldura das prévias e faixas do número e do nome da fase, no padrão das telas do online
      hdPanel({ x: 12, y: PREVIEW_Y - 4, w: 232, h: PREVIEW_H + 8, fill: 'rgba(10,30,90,0.6)', stroke: '#8fd8ff' });
      hdPanel({ x: 14, y: 156, w: 228, h: 22, fill: 'rgba(10,30,90,0.6)', stroke: '#8fd8ff' });
      hdPanel({ x: 14, y: 182, w: 228, h: 22, fill: 'rgba(16,40,112,0.92)', stroke: '#ffe46b', glow: 'rgba(255,220,90,0.9)' });
      const s = currentScroll();
      const rom = romState.assets;
      /** Opção `d` posições depois da atual (a do centro, depois do A, é a fase da partida) e a fase que a prévia mostra
       *  nela (ALEATÓRIO: o ciclo pelas visíveis). */
      const choiceAt = (d: number): number => (d === 0 && picked !== null ? picked : stepChoice(setup.stage, d));
      const shownAt = (d: number): number => { const c = choiceAt(d); return isRandomStage(c) ? randomPreviewStage(t) : c; };
      const slots = dir === 0 ? [-1, 0, 1] : [-1, 0, 1, 2 * dir];
      ctx.save();
      ctx.beginPath();
      ctx.rect(CLIP_X0, PREVIEW_Y, CLIP_X1 - CLIP_X0, PREVIEW_H);
      ctx.clip();
      if (rom) {
        // ROM: as prévias reais (anterior/atual/seguinte e, rolando, a que entra) com mapas e paletas por slot lidos
        // da ROM (`$C1:A8D1`/`$C1:A92B`), com o BG1 rolando (`render/screens-rom/stagesel.ts`); sem o quebra-cabeça
        // da ROM no BG2, o fundo HD aparece entre elas. As vizinhas são as opções da lista (game/stage-choice.ts).
        const { g, maps } = stagePreview(rom, shownAt(0), dir, (_, d) => shownAt(d));
        ppu.drawOver(ctx, sceneFrame(g, { bg1: maps.bg1 }, { bg1: [STAGE_ICON_HOFS_BASE - s, 0] }));
      } else {
        // Sem ROM: fallback com a arena reduzida (T-anterior), nas posições do R29.
        for (const d of slots) drawMiniArena(ctx, shownAt(d), 72 + 128 * d + s, PREVIEW_Y, MINI_CELL);
      }
      for (const d of slots) {
        if (isRandomStage(choiceAt(d))) drawRandomMark(ctx, 72 + 128 * d + s, rom ? ROM_PREVIEW_Y : PREVIEW_Y, rom ? 112 : 13 * MINI_CELL);
      }
      ctx.restore();
      if (battleTextVisible(seqF)) {
        drawText(ctx, bank, 'bigBattle', S.stage.battle, 128, 8, { align: 'center', bare: true });
      } else {
        drawText(ctx, bank, 'menuTitle', S.stage.title, 128, 8 + stageTitleDy(seqF), { align: 'center', bare: true });
      }
      const cur = choiceAt(0), n = choiceNumber(cur);
      drawText(ctx, bank, 'menuItem', n === null ? S.stage.randomStage : S.stage.stage(n), 128, 160, { align: 'center', tone: 'blue' });
      drawText(ctx, bank, 'menuItem', isRandomStage(cur) ? S.stage.random : S.stage.names[cur - 1], 128, 184, { align: 'center' });
    },
  };
}
