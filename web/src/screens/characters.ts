import { BTN } from '../game/core-api';
import type { App, Screen } from '../app/app';
import { SFX } from '../app/audio';
import { FADE_MENU } from '../app/fade';
import { romState, type RomAssets } from '../app/rom-api';
import { obj, PpuCanvas, sceneFrame, sceneGfx, sceneMaps } from '../render/screens-rom/scene';
import { CHARACTERS } from '../render/art/bomber';
import { CHARSEL_GRID, CHARSEL_PORTRAIT, CHARSEL_STANDEE, CHARSEL_STANDEE_Y, charselMaps, drawCharselTitle } from '../render/screens-rom/charsel';
import { drawText } from '../render/text/text';
import { S } from '../render/text/strings';
import { SCREEN_H } from '../render/display';
import { COLORS, PLAYER_COLORS, drawFallbackFrame, drawStaticBackground } from './ui';
import { createPickScheme } from './pick-scheme';
import { rulesScreen } from './rules';
import { stageScreen } from './stage';
import { teamsScreen } from './teams';

const { cols: COLS, rows: ROWS } = CHARSEL_GRID;
/** Moldura do fallback (spec §6.14), medida como as demais telas de menu. */
const FRAME = { x0: 27, y0: 35, x1: 224, y1: 188 };

/** Cursor "[ ]": 4 cantos preenchidos (`fillRect`, 2 por canto), na cor do jogador — nunca uma única moldura
 *  (brief "Fallback", §6.6). `arm`/`t` = comprimento/espessura de cada canto, em px. */
function drawCornerCursor(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, arm = 6, t = 2): void {
  ctx.fillStyle = color;
  const right = x + w - t, bottom = y + h - t;
  ctx.fillRect(x, y, arm, t);                      // topo-esquerda
  ctx.fillRect(x, y, t, arm);
  ctx.fillRect(right - arm + t, y, arm, t);         // topo-direita
  ctx.fillRect(right, y, t, arm);
  ctx.fillRect(x, bottom, arm, t);                  // baixo-esquerda
  ctx.fillRect(x, bottom - arm + t, t, arm);
  ctx.fillRect(right - arm + t, bottom, arm, t);    // baixo-direita
  ctx.fillRect(right, bottom - arm + t, t, arm);
}

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
  const scheme = createPickScheme(app);
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

  const finishIfDone = (): void => {
    if (!scheme.activeIdx.every(i => scheme.confirmed[i])) return;
    app.save();
    if (setup.mode === 'team') app.transition(() => teamsScreen(app), FADE_MENU);
    else app.transition(() => stageScreen(app), FADE_MENU);
  };

  const confirm = (i: number): void => {
    scheme.confirmed[i] = true;
    app.audio.sfx(SFX.confirm);
    finishIfDone();
  };

  return {
    id: 'characters',
    charOf: (i: number) => setup.chars[i],
    get confirmed() { return scheme.confirmed.slice(); },
    get controlling() { return scheme.controllingSlot(); },
    get controller() { return scheme.controller; },
    update(inp) {
      if (scheme.handle(inp, moveCursor, confirm)) {
        app.audio.sfx(SFX.back);
        app.transition(() => rulesScreen(app), FADE_MENU);
      }
    },
    draw(ctx, bank, frame) {
      const a: RomAssets | null = romState.assets;
      if (a) {
        // Cena real (§6.6): corda + quebra-cabeça vêm do BG (`charselMaps`/`MAP_SOURCES.charsel`, T5/T19) e os 6
        // bonecos parados na grade são OBJ com o tile/paleta medidos em `charsel.oam` (`CHARSEL_STANDEE`) — só o
        // título (no vão medido, `drawCharselTitle`), os retratos e os cursores (conteúdo dinâmico, não existem
        // assim na ROM) vão por cima, depois do PPU.
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
      drawCharselTitle(ctx, bank, S.chars.title, COLORS.title);
      const ctrl = scheme.controllingSlot();
      // Coluna da esquerda: o retrato de cada jogador ativo (conteúdo nosso, por cima da cena). Sem rótulo de
      // nome/estado (T22): no original essa coluna só tem retratos, e o texto colidia com o título de 2 linhas e a
      // grade; quem ainda escolhe já aparece pelo cursor "[ ]" com a etiqueta nP.
      for (const i of scheme.activeIdx) {
        const y = CHARSEL_PORTRAIT.y0 + CHARSEL_PORTRAIT.dy * i;
        ctx.drawImage(bank.head(setup.chars[i]), CHARSEL_PORTRAIT.x, y, CHARSEL_PORTRAIT.w, CHARSEL_PORTRAIT.w);
      }
      // Cursores "[ ]" (4 cantos, fillRect) com a etiqueta nP na cor de quem está escolhendo cada vaga ainda aberta.
      for (const i of scheme.activeIdx) {
        if (scheme.confirmed[i]) continue;
        const driver = scheme.selfPicking(i) ? i : i === ctrl ? scheme.controller : null;
        if (driver === null) continue;
        const k = setup.chars[i];
        const x = CHARSEL_GRID.x[k % COLS], y = CHARSEL_GRID.y[Math.floor(k / COLS)];
        const color = PLAYER_COLORS[driver];
        drawCornerCursor(ctx, x - 2, y - 2, CHARSEL_GRID.cellW - 12, CHARSEL_GRID.cellH - 4, color);
        drawText(ctx, bank, 'ascii8', S.chars.tags[driver], x - 3, y - 10, { color });
      }
      drawText(ctx, bank, 'ascii8', scheme.activeIdx.every(i => scheme.confirmed[i]) ? S.chars.allReady : S.chars.help,
        128, SCREEN_H - 16, { align: 'center', tone: 'gray' });
    },
  };
}
