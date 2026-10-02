import type { App, Screen } from '../app/app';
import type { SpriteBank } from '../render/sprite-bank';
import type { MatchSession } from '../game/match-session';
import { BTN } from '../game/core-api';
import { SCORE, NEXT_ROUND } from '../game/timeline';
import { FADE_OUT_1, shortBlack } from '../app/fade';
import { MUSIC, BANK } from '../app/audio';
import { romState } from '../app/rom-api';
import { battleScreen } from './battle';
import { victoryScreen } from './victory';
import { drawScoreboardRom, crownCellOf, SB_GEO } from '../render/screens-rom/scoreboard';
import type { CrownCell } from '../render/screens-rom/scoreboard';
import { drawText } from '../render/text/text';
import { S } from '../render/text/strings';

export type { CrownCell } from '../render/screens-rom/scoreboard';

/** Placar (§6.10, §6.12, §7.5, R7–R10, A15): 5 casas de coroa por linha ativa (só as coroas ativas dão fileira,
 *  na posição do slot); a coroa nova gira pela animação da ROM (`C3:DA94`) e para de frente, no quadro 0 (tile
 *  `$106`, §6.10 — a revisão final do plano 10 derrubou o "último quadro" do R10).
 *  Normal: pula com A/B/START a partir de `s = 18`, ou sai sozinho em `s = 511`, para a próxima rodada
 *  (`NEXT_ROUND`). Final (`ms.over`): nenhum botão faz nada; música da vitória em `s = 511` e a vitória assume
 *  em `s = 557`, sem fade. */
export function scoreboardScreen(app: App, ms: MatchSession): Screen & {
  readonly s: number; rows(): { slot: number; y: number }[]; crownCell(slot: number, k: number): CrownCell;
} {
  let s = -1;
  return {
    id: 'scoreboard',
    get s() { return s; },
    rows() {
      const out: { slot: number; y: number }[] = [];
      for (let slot = 0; slot < 5; slot++) if (ms.match.rules.active[slot]) out.push({ slot, y: SCORE.rowY0 + SCORE.rowStep * slot });
      return out;
    },
    crownCell(slot, k) { return crownCellOf(ms, s, slot, k); },
    update(inp) {
      s++;
      if (ms.over) {
        if (s === SCORE.victoryMusicAt) app.audio.music(MUSIC.victory);
        else if (s === SCORE.descentAt) app.go(victoryScreen(app, ms, SCORE.descentAt));
        return;
      }
      const skip = (inp.pressedAny & (BTN.A | BTN.B | BTN.START)) !== 0;
      if ((skip && s >= SCORE.skipFrom) || (!skip && s === SCORE.autoAt)) {
        app.transition(() => battleScreen(app, ms), shortBlack({
          out: FADE_OUT_1, black: NEXT_ROUND.afterScore, in: [],
          cues: [
            { at: NEXT_ROUND.bankAt, run: a => a.audio.bank(BANK.battle) },
            { at: NEXT_ROUND.musicAt, run: a => a.audio.music(MUSIC.battle) },
          ],
        }));
      }
    },
    draw(ctx, bank) { drawScoreboard(ctx, bank, ms, s, 0); },
  };
}

const FB_CLOUDS: readonly (readonly [number, number, number, number])[] = [[16, 0, 40, 8], [96, 2, 56, 8], [188, 0, 42, 8]];

/** Desenha o placar (fundo, "PLACAR", "nP", cabeças e as 5 casas de coroa por linha ativa), deslocado `yOffset`
 *  px (a descida da vitória usa; T20). Com ROM usa `drawScoreboardRom`; sem ela, céu/nuvens/painel simples e
 *  `bank.head`/`bank.crown()` — a coroa girando vira uma largura que encolhe e cresce: `24·|cos(π·quadro/8)|`. */
export function drawScoreboard(ctx: CanvasRenderingContext2D, bank: SpriteBank, ms: MatchSession, s: number, yOffset: number): void {
  const a = romState.assets;
  if (a) { drawScoreboardRom(ctx, a, bank, ms, s, yOffset); return; }
  drawScoreboardFallback(ctx, bank, ms, s, yOffset);
}

function drawScoreboardFallback(ctx: CanvasRenderingContext2D, bank: SpriteBank, ms: MatchSession, s: number, yOffset: number): void {
  const Y = (py: number): number => py + yOffset;
  ctx.fillStyle = '#3a72c4'; ctx.fillRect(0, Y(0), 256, 224);
  ctx.fillStyle = '#ffffff';
  for (const [x, cy, w, h] of FB_CLOUDS) ctx.fillRect(x, Y(cy), w, h);
  const p = SB_GEO.panel;
  ctx.fillStyle = '#1e8f4e'; ctx.fillRect(p.x0, Y(p.y0), p.x1 - p.x0, p.y1 - p.y0);
  drawText(ctx, bank, 'bigScore', S.score.title, SB_GEO.title.cx, Y(SB_GEO.title.y), { align: 'center' });
  for (let slot = 0; slot < 5; slot++) {
    if (!ms.match.rules.active[slot]) continue;
    const rowY = SCORE.rowY0 + SCORE.rowStep * slot;
    drawText(ctx, bank, 'ascii8', S.score.tags[slot], SB_GEO.labelX, Y(rowY + 8));
    ctx.drawImage(bank.head(ms.cfg.chars[slot]), SCORE.headX, Y(rowY));
    for (let k = 0; k < 5; k++) {
      const cell = crownCellOf(ms, s, slot, k);
      const cx = SCORE.crownX[k];
      ctx.fillStyle = '#000000';
      ctx.fillRect(cx, Y(rowY + SB_GEO.cellY), SB_GEO.cellW, SB_GEO.cellH);
      if (cell === 'empty') continue;
      const img = bank.crown();
      if (cell === 'full') { ctx.drawImage(img, cx + 4, Y(rowY + 8), 24, 16); continue; }
      const frameN = Number(cell.slice(5));
      const w = 24 * Math.abs(Math.cos((Math.PI * frameN) / 8));
      ctx.drawImage(img, cx + (SB_GEO.cellW - w) / 2, Y(rowY + 8), w, 16);
    }
  }
}
