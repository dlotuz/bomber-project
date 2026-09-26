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
