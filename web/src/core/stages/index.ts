import type { StageModule } from '../hooks';

/** STAGES[n] = módulo da fase n (1..10); índice 0 sem uso. O plano 8 só ACRESCENTA linhas no fim deste
 *  arquivo, no formato `import { stageN } from './stageN'; def(N, () => stageN);`.
 *
 *  `def` usa um getter em vez de `STAGES[N] = stageN` direto (🟡 correção de fundação, não prevista no
 *  brief): o módulo de uma arena importa `./kit` → `../bombs` → `./stages` (aqui), então quando o PONTO
 *  DE ENTRADA do grafo é o próprio módulo da arena (como nos testes, que importam `core/stages/stageN`
 *  antes de tudo), este arquivo é revisitado em ciclo enquanto `stageN` ainda está em TDZ; uma atribuição
 *  direta capturaria `undefined` para sempre. O getter só lê `stageN` de fato quando alguém pede
 *  `STAGES[N]`, sempre depois que o grafo de módulos termina de carregar. */
export const STAGES: StageModule[] = [{}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}];
function def(n: number, get: () => StageModule): void {
  Object.defineProperty(STAGES, n, {
    get, enumerable: true, configurable: true,
    set(v: StageModule) { Object.defineProperty(STAGES, n, { value: v, writable: true, enumerable: true, configurable: true }); },
  });
}
import { stage2 } from './stage2'; def(2, () => stage2);
import { stage3 } from './stage3'; def(3, () => stage3);
import { stage4 } from './stage4'; def(4, () => stage4);
import { stage5 } from './stage5'; def(5, () => stage5);
import { stage6 } from './stage6'; def(6, () => stage6);
import { stage7 } from './stage7'; def(7, () => stage7);
import { stage8 } from './stage8'; def(8, () => stage8);
import { stage9 } from './stage9'; def(9, () => stage9);
import { stage10 } from './stage10'; def(10, () => stage10);
