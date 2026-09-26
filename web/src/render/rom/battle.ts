// Contrato da partida desenhada com a ROM (spec §2.5). STUB do plano 5: o plano 7 implementa.
// Devolve false = "não desenhei"; quem chama (plano 10) cai no fallback drawRound(...).
import type { RoundState } from '../../core/types';
import type { ViewState } from '../view';
import type { RomAssets } from '../../rom/types';

export function drawRomBattle(_ctx: CanvasRenderingContext2D, _round: RoundState, _vis: ViewState, _assets: RomAssets, _frame: number): boolean {
  return false;
}
