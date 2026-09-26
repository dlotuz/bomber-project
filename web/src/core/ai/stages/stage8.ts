import type { AiStageHints } from '../hints';
import { PADS, REEL_MASK, st8 } from '../../stages/stage8';
import { playerCell, standing } from '../../state';
import { colOf, linOf } from '../../units';

/** Alcance máximo (em casas, Manhattan) para ir atrás do pad (revisão final do plano 8, I1). */
const NEAR = 4;
const manhattan = (a: number, b: number): number => Math.abs(colOf(a) - colOf(b)) + Math.abs(linOf(a) - linOf(b));

/** Pisar no pad para frear o rolo (§9 item 8): pads dos rolos girando, sem freio e não parados — mas só para o CPU
 *  vivo mais próximo de cada pad (empate pelo menor slot), a até `NEAR` casas, e nunca depois que a pressão começa
 *  (`s.pressure.trigger >= 0`, quando a máquina não importa mais). Sem o limite, os 5 CPUs convergiam para a linha
 *  do rolo a cada giro (a `think` de `brain.ts` olha os objetivos da arena antes de soltar bomba) e a máquina ficava
 *  religando ~18× por rodada, dobrando o TIME UP (revisão final do plano 8, I1: 50 % → 26 % na fase 8). */
export const stage8Ai: AiStageHints = {
  goals(s, slot) {
    if (s.pressure.trigger >= 0) return [];
    const a = st8(s);
    if (a.phase !== 'spin') return [];
    const pads = PADS.filter((_, i) => !a.reels[i].braking && !(a.stopped & REEL_MASK[i]));
    if (pads.length === 0) return [];
    const me = s.players[slot];
    if (!me || !standing(me)) return [];
    const here = playerCell(me);
    return pads.filter(pad => {
      const d = manhattan(here, pad);
      if (d > NEAR) return false;
      return !s.players.some(q => {
        if (!standing(q) || q.slot === slot) return false;
        const dq = manhattan(playerCell(q), pad);
        return dq < d || (dq === d && q.slot < slot);
      });
    });
  },
};
