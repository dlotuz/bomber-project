import { px, type RoundState } from '../core';
import type { SpriteBank } from './sprite-bank';
import { drawText } from './text/text';
import { S } from './text/strings';

export interface OverlayState {
  paused: boolean; disconnected: number | null;
  hurry: { x: number; y: number } | null; timeUp: { y: number; text: string } | null;
}
/** Por cima da partida (ROM ou fallback): RÁPIDO!!, TEMPO ESGOTADO!, PAUSA! (sem escurecer) e a linha de desconexão. */
export function drawBattleOverlays(ctx: CanvasRenderingContext2D, bank: SpriteBank, st: OverlayState): void {
  if (st.hurry) drawText(ctx, bank, 'banner', S.battle.hurry, st.hurry.x, st.hurry.y, { tone: 'green' });
  if (st.timeUp) drawText(ctx, bank, 'banner', st.timeUp.text, 128, st.timeUp.y, { align: 'center' });
  if (st.paused) drawText(ctx, bank, 'banner', S.battle.pause, 128, 110, { align: 'center' });
  if (st.paused && st.disconnected !== null) drawText(ctx, bank, 'ascii8', S.battle.disconnected(st.disconnected), 128, 130, { align: 'center' });
}

/** Letra da bomba evoluída no chute (extra): D vermelho, S amarelo, H branco — como no vídeo de referência. */
const LEVEL_MARK: readonly (readonly [string, string] | null)[] = [null, ['D', '#e82818'], ['S', '#f8d820'], ['H', '#f8f8f8']];

/** Por cima da partida (ROM ou fallback): a letra de cada bomba evoluída, parada, deslizando, na mão ou no ar. */
export function drawBombLevels(ctx: CanvasRenderingContext2D, bank: SpriteBank, s: RoundState): void {
  const mark = (level: number | undefined, x: number, y: number): void => {
    const m = LEVEL_MARK[level ?? 0];
    if (!m) return;
    const img = bank.text(m[0], m[1]);
    ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2) + 1);
  };
  for (const b of s.bombs) {
    if (!b.level) continue;
    if (b.state === 'idle' || b.state === 'kicked') mark(b.level, px(b.x), px(b.y));
    else if (b.state === 'held') {
      const p = s.players.find(q => q.present && q.carry === b.id);
      if (p) mark(b.level, px(p.x), px(p.y) - 16);
    } else {
      const f = s.flyers.find(x => x.kind === 'bomb' && x.ref === b.id);
      if (f) mark(b.level, px(f.x), px(f.y) + Math.min(0, f.z));
    }
  }
}
