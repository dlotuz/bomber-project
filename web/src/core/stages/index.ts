import type { StageModule } from '../hooks';

/** STAGES[n] = módulo da fase n (1..10); índice 0 sem uso. O plano 8 só ACRESCENTA linhas no fim deste
 *  arquivo, no formato `import { stageN } from './stageN'; STAGES[N] = stageN;`. */
export const STAGES: StageModule[] = [{}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}];
import { stage2 } from './stage2'; STAGES[2] = stage2;
import { stage3 } from './stage3'; STAGES[3] = stage3;
import { stage4 } from './stage4'; STAGES[4] = stage4;
import { stage5 } from './stage5'; STAGES[5] = stage5;
import { stage6 } from './stage6'; STAGES[6] = stage6;
import { stage7 } from './stage7'; STAGES[7] = stage7;
import { stage8 } from './stage8'; STAGES[8] = stage8;
import { stage9 } from './stage9'; STAGES[9] = stage9;
import { stage10 } from './stage10'; STAGES[10] = stage10;
