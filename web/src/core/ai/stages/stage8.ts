import type { AiStageHints } from '../hints';
import { PADS, REEL_MASK, st8 } from '../../stages/stage8';

/** Pisar no pad para frear o rolo (§9 item 8): pads dos rolos girando, sem freio e não parados. */
export const stage8Ai: AiStageHints = {
  goals(s) {
    const a = st8(s);
    if (a.phase !== 'spin') return [];
    return PADS.filter((_, i) => !a.reels[i].braking && !(a.stopped & REEL_MASK[i]));
  },
};
