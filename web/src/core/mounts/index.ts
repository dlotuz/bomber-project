import type { MountModule } from '../hooks';

export const NO_MOUNT: MountModule = {
  revealEgg() {}, stepOnEgg() {}, onHit: () => false, onY: () => false, tick() {},
};

/** Módulo de montarias ativo. O plano 9 só ACRESCENTA no fim: `import { eggs } from './eggs'; MOUNTS.current = eggs;`. */
export const MOUNTS: { current: MountModule } = { current: NO_MOUNT };

import { mountModule } from './module';
MOUNTS.current = mountModule;
export * from './types';
export * from './events';
