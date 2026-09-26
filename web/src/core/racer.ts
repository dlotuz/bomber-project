import type { Player } from './types';
import { rnd, type Rng16 } from './rng';
import { MAX_CAPS } from './tables/misc';

export const RACER_PRIZES = 17;

/** Efeito do prêmio `prize` (índice em $C2:08F4, código lido em $C2:0954..$C2:09EB). */
export function applyRacerPrize(p: Player, prize: number): void {
  switch (prize) {
    case 0: if (p.bombsCap + 1 < MAX_CAPS.bombs) { p.bombsCap++; p.bombsFree++; } break;
    case 1: p.bombType = 2; break;
    case 2: if (p.fire + 1 < MAX_CAPS.fire) p.fire++; break;
    case 3: p.fullFire = true; break;
    case 4: if (p.speedLv + 1 < MAX_CAPS.speed) p.speedLv++; break;
    case 5: p.bombType = 1; p.glove = true; break;
    case 6: case 7: p.glove = true; break;
    case 8: p.kick = true; p.passBomb = false; break;
    case 11: p.passBomb = true; p.kick = false; break;
    case 12: p.passSoft = true; break;
    case 13: if (p.speedLv > 1) p.speedLv--; break;
    case 14: p.punch = true; break;
    case 15: p.heart = true; break;
    case 16: p.pItem = true; break;
    default: break;                        // 9 e 10: nada
  }
}

/** Sorteio provisório da corrida bônus (A2): uniforme nas 17 entradas. */
export function drawRacerPrize(rng: Rng16): number { return rnd(rng, RACER_PRIZES); }
