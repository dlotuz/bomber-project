import type { StageModule } from '../hooks';

/** STAGES[n] = módulo da fase n (1..10); índice 0 sem uso. O plano 8 só ACRESCENTA linhas no fim deste
 *  arquivo, no formato `import { stageN } from './stageN'; STAGES[N] = stageN;`. */
export const STAGES: StageModule[] = [{}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}];
