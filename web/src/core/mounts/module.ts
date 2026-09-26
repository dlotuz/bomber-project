import type { MountModule } from '../hooks';
import { mountAiHints } from '../ai/mounts';
export const mountModule: MountModule = {
  revealEgg() {}, stepOnEgg() {}, onHit: () => false, onY: () => false, onStunLoss: () => false, tick() {}, ai: mountAiHints,
};
