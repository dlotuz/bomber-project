import { ROM } from '../rom/helpers';
import { createRomAssets } from '../../src/rom/assets';   // fábrica real do plano 5
export { ROM };
export const ASSETS = ROM ? createRomAssets(ROM) : null;

/** Amostra medida (fixture de `mount-render.json`) com o mínimo que `stable()` precisa. */
export interface StableSample { anim: number; frame: number; anim2?: number; frame2?: number }

/** Amostras estáveis: mesma animação/quadro que a anterior. Na troca, a VRAM ainda mostra o gráfico anterior por
 *  1 quadro (o DMA do novo quadro chega no quadro seguinte), então a troca não serve para conferir o gráfico.
 *  Compartilhado por `rom-facts.test.ts` e `rom-layer.test.ts`. */
export function stable<T extends StableSample>(ss: T[]): T[] {
  return ss.filter((s, i) => i > 0 &&
    [s.anim, s.frame, s.anim2, s.frame2].join() === [ss[i - 1].anim, ss[i - 1].frame, ss[i - 1].anim2, ss[i - 1].frame2].join());
}
