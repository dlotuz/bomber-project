import type { App, Screen } from '../app/app';
import type { SpriteBank } from '../render/sprite-bank';
import type { MatchSession } from '../game/match-session';
import { closeMatch } from '../game/match-session';
import { BTN } from '../game/core-api';
import { VICTORY, SCORE } from '../game/timeline';
import { FADE_OUT_1, FADE_IN_1, FADE_MENU, fadeSpec } from '../app/fade';
import { VOICE, MUSIC } from '../app/audio';
import { romState, type RomAssets } from '../app/rom-api';
import { drawText, textWidth } from '../render/text/text';
import { S } from '../render/text/strings';
import { drawScoreboard } from './scoreboard';
import { racerScreen } from './racer';
import { stageScreen } from './stage';
import { PpuCanvas, sceneFrame, sceneGfx } from '../render/screens-rom/scene';
import { TROPHY_TOP_Y, TROPHY_X0, championDrawOrder, drawCharAnim, victoryMaps, victoryOam } from '../render/screens-rom/victory';
import { SCOREBOARD_SCROLL } from '../render/screens-rom/scoreboard';
import type { PpuFrame } from '../app/rom-api';

/** `D8:2A81` (corredores, "palmas") e `C3:E7F7` (campeão sobre o troféu, folha `victoryFrame`) [§7.4]. */
const RUN_ANIM = 0xd82a81, CHAMP_ANIM = 0xc3e7f7;
/** Chão da cena (âncora do pé dos corredores) e plataforma do troféu (âncora do campeão), em y local da cena. */
const GROUND_Y = 224, TROPHY_CENTER_X = TROPHY_X0 + 24;
/** Topo do logotipo original "VICTORY!" no BG1 medido em `victory.vram` (linha 2 do mapa × 16 px):
 *  "VITÓRIA!" entra na mesma altura em que o original ficava. */
const TEXT_Y = 32;

const lerp = (from: number, to: number, t0: number, t1: number, now: number): number =>
  Math.round(from + (to - from) * Math.min(1, Math.max(0, (now - t0) / (t1 - t0))));

const activeSlots = (ms: MatchSession): number[] => [0, 1, 2, 3, 4].filter(i => ms.cfg.rules.active[i]);

/** Fallback (R9, §6.14): gramado verde, arquibancada em faixas e o troféu 48×48 no centro. */
function drawFallbackScene(ctx: CanvasRenderingContext2D, bank: SpriteBank): void {
  const bands = ['#26306a', '#333f8a'];
  for (let y = 0; y < 200; y += 16) { ctx.fillStyle = bands[(y / 16) % 2]; ctx.fillRect(0, y, 256, 16); }
  ctx.fillStyle = '#1b6a2a'; ctx.fillRect(0, 200, 256, 24);
  ctx.fillStyle = '#123f1a'; ctx.fillRect(0, 200, 256, 4);
  ctx.drawImage(bank.trophy(), TROPHY_CENTER_X - 24, GROUND_Y - 48, 48, 48);
}

/** Corredor ou campeão: pela ROM usa `anim`+a folha do personagem; sem ROM, `bank.bomber`. */
function drawPerson(ctx: CanvasRenderingContext2D, bank: SpriteBank, a: RomAssets | null, char: number, slot: number,
  anim: number, sheet: (a: RomAssets, c: number) => (g: number) => Uint8Array, x: number, y: number, frame: number,
  dir: number, key: string): void {
  if (a) { drawCharAnim(ctx, a.anim(anim), frame, sheet(a, char), a.character(char).palettes[slot], x, y, key); return; }
  const legFrame = Math.floor(frame / 6) % 3;
  ctx.drawImage(bank.bomber(char, dir, legFrame), x - 16, y - 40, 32, 40);
}

const CONFETTI_COLORS = ['#ff5f5f', '#ffd23f', '#5fe07a'];
/** Confete 2×2 px em 3 cores, determinístico por `s` (A14: sem tabela da ROM catalogada). */
function drawConfetti(ctx: CanvasRenderingContext2D, s: number): void {
  const t = s - VICTORY.confettiFrom;
  for (let i = 0; i < 24; i++) {
    const speed = 1 + (i % 3);
    const x = (i * 37 + 11) % 256;
    const y = ((i * 53) % 224 + t * speed) % 224;
    ctx.fillStyle = CONFETTI_COLORS[i % 3];
    ctx.fillRect(x, y, 2, 2);
  }
}

/** y do mapa de BG2 onde começa a cena da vitória (linha 14; as linhas 0–13 são o placar). Continua o BG2 do
 *  placar (VOFS `SCOREBOARD_SCROLL.bg2[1]` = 7, T20/R1 — correção final): sem a soma, a linha 232 do mapa (onde
 *  começa a faixa azul, logo abaixo do preto do placar) nunca aparecia — as linhas 225–231 saíam repetidas. */
const VICTORY_MAP_Y = 224 + SCOREBOARD_SCROLL.bg2[1];

/** Quadro de BG2/OAM da cena de vitória em `yTop` (`= 224 − cameraY()`, T20): exportado para os testes de pixel
 *  da emenda placar → vitória (R1). Com `yTop ≥ 0` (antes do fim da descida) o VOFS fica fixo em
 *  `VICTORY_MAP_Y`; só depois que a câmera passa dos 224 px (`yTop < 0`) o BG2 volta a rolar, dando o
 *  "acabamento" extra da vitória parada (T20). */
export function victorySceneFrame(a: RomAssets, yTop: number): PpuFrame {
  const vofs = VICTORY_MAP_Y + Math.max(0, -yTop);
  return sceneFrame(sceneGfx(a, 'victory'), victoryMaps(a), {
    oam: victoryOam().map(o => ({ ...o, y: o.y + Math.min(0, yTop) })), bg2: [0, vofs],
  });
}

/** Placar final (descida) e VITÓRIA [§6.12, §7.4, §7.5, R9]. */
export function victoryScreen(app: App, ms: MatchSession, startS: number): Screen & {
  readonly s: number; cameraY(): number; textX(): number | null; runnerX(k: number): number | null;
  championOnTrophy(): boolean; confetti(): boolean;
} {
  let s = startS - 1;
  const active = activeSlots(ms);
  const champions = ms.champions;
  const ppu = new PpuCanvas();

  const cameraY = (): number => SCORE.descentSpeed * Math.min(SCORE.descentFrames, Math.max(0, s - SCORE.descentAt));
  const textX = (): number | null => {
    if (s < VICTORY.textFrom) return null;
    const target = 128 - Math.floor(textWidth('bigVictory', S.victory.title) / 2);
    return lerp(256, target, VICTORY.textFrom, VICTORY.textTo, s);
  };
  const runnerX = (k: number): number | null => {
    if (s < VICTORY.runFrom) return null;
    return lerp(256 + 24 * k, 40 + 48 * k, VICTORY.runFrom, VICTORY.runTo, s);
  };
  const championOnTrophy = (): boolean => s >= VICTORY.jumpAt;
  const confetti = (): boolean => s >= VICTORY.confettiFrom;

  return {
    id: 'victory',
    get s() { return s; },
    cameraY, textX, runnerX, championOnTrophy, confetti,
    update(inp) {
      s++;
      if (s === VICTORY.voiceAt) app.audio.voice(VOICE.victory);
      if (s >= VICTORY.buttonsFrom && (inp.pressedAny & (BTN.A | BTN.B | BTN.START))) {
        closeMatch(ms);
        if (ms.cfg.rules.racer && ms.cfg.rules.mode === 'ffa') {
          app.transition(() => racerScreen(app, ms), FADE_MENU);
        } else {
          const black = 15 + VICTORY.outBlack;
          app.transition(() => stageScreen(app), fadeSpec(FADE_OUT_1, FADE_IN_1,
            [{ at: black, run: a => a.audio.ensureMenus(MUSIC.menus) }], black));
        }
      }
    },
    draw(ctx, bank, frame) {
      const camY = cameraY(), yTop = 224 - camY;
      drawScoreboard(ctx, bank, ms, s, -camY);
      const a = romState.assets;
      if (a) {
        // T22: placar e vitória são um só mapa de BG2 (32×32 casas de 16 px): o placar nas linhas 0–13 e a vitória
        // (torcida, faixa das bombas, chão) a partir da linha 14 (y = 224). A cena local começa em y = 224 do mapa;
        // quando ela passa do topo da tela (descida de 256 px), o scroll continua pelo próprio mapa.
        ppu.draw(ctx, victorySceneFrame(a, yTop), Math.max(0, yTop));
      }
      ctx.save();
      ctx.translate(0, yTop);
      if (!a) drawFallbackScene(ctx, bank);
      const tx = textX();
      if (tx !== null) drawText(ctx, bank, 'bigVictory', S.victory.title, tx, TEXT_Y, { tone: 'orange' });
      const jumped = championOnTrophy();
      active.forEach((slot, k) => {
        if (jumped && champions.includes(slot)) return;
        const x = runnerX(k);
        if (x === null) return;
        drawPerson(ctx, bank, a, ms.cfg.chars[slot], slot, RUN_ANIM, (as, c) => g => as.character(c).frame(g),
          x, GROUND_Y, frame, 3, `r${slot}`);
      });
      if (jumped) {
        const n = champions.length;
        // champions[0] fica por cima (Em Equipes, todos sobem no troféu): desenha por último = campeões em
        // ordem inversa (championDrawOrder), mas o deslocamento em x usa a posição original `i` em `champions`.
        championDrawOrder(champions).forEach(slot => {
          const i = champions.indexOf(slot);
          const x = TROPHY_CENTER_X + (i - (n - 1) / 2) * 14;
          drawPerson(ctx, bank, a, ms.cfg.chars[slot], slot, CHAMP_ANIM, (as, c) => g => as.character(c).victoryFrame(g),
            x, TROPHY_TOP_Y, frame, 2, `c${slot}`);
        });
      }
      if (confetti()) drawConfetti(ctx, s);
      ctx.restore();
    },
  };
}
