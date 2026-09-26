// Índice dos módulos de camada: cada import registra as camadas do módulo (efeito colateral).
// Os planos 8 e 9 só ACRESCENTAM linhas `import './rom/stages/stageN';` / `import './fallback/stages/stageN';`.
export {};
import './rom/stages/stage2'; import './rom/stages/stage3'; import './rom/stages/stage7';
import './rom/stages/stage8'; import './rom/stages/stage9'; import './rom/stages/stage10';
import './fallback/stages/stage2'; import './fallback/stages/stage3'; import './fallback/stages/stage5';
import './fallback/stages/stage6'; import './fallback/stages/stage7'; import './fallback/stages/stage8';
import './fallback/stages/stage9';
import './rom/mounts';
import './fallback/mounts';
