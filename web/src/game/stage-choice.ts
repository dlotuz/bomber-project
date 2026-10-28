// Escolha de fase com ALEATÓRIO: a lista da tela é a das fases visíveis (game/stages.ts) mais ALEATÓRIO no fim. O
// sorteio é da camada do jogo, fora do RNG do núcleo: sem `?seed`, Math.random; com `?seed=N`, um gerador próprio
// semeado por N (a mesma sequência de sorteios a cada abertura). Na sala online, a fase sai da semente da mensagem
// `start`, que é a mesma para todos: cada navegador sorteia sozinho e todos chegam na mesma fase.
import { VISIBLE_STAGES, stageNumber, stepVisible, visibleStage } from './stages';

/** ALEATÓRIO na escolha de fase (salvo em `Setup.stage` e em `Lobby.stage`); nunca chega ao núcleo. */
export const RANDOM_STAGE = 0;
export const isRandomStage = (choice: number): boolean => choice === RANDOM_STAGE;

/** Opções da tela, na ordem: as fases visíveis e, por último, ALEATÓRIO (a padrão continua sendo a 1ª visível). */
export const stageChoices = (): number[] => [...VISIBLE_STAGES, RANDOM_STAGE];

/** `choice` se for ALEATÓRIO ou uma fase visível; senão a 1ª visível (configuração salva com fase que ficou oculta). */
export const stageChoice = (choice: number): number => (isRandomStage(choice) ? RANDOM_STAGE : visibleStage(choice));

/** Opção `d` passos depois de `choice` na lista (fases visíveis + ALEATÓRIO), com volta. */
export function stepChoice(choice: number, d: number): number {
  const list = stageChoices(), n = list.length, i = list.indexOf(stageChoice(choice));
  return list[(((i + d) % n) + n) % n];
}

/** Posição da opção na lista (1, 2, …), para o "Fase N" da tela; ALEATÓRIO não tem número (null). */
export const choiceNumber = (choice: number): number | null => (isRandomStage(choice) ? null : stageNumber(choice));

/** Fase visível para um número de [0, 1) (cada visível com a mesma chance). */
export function pickStage(r: number): number {
  const n = VISIBLE_STAGES.length;
  return VISIBLE_STAGES[Math.min(n - 1, Math.max(0, Math.floor(r * n)))];
}

/** Gerador mulberry32 (32 bits) com saída em [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}
/** Mistura fixa para o sorteio da fase não andar junto com o RNG da partida, que usa a mesma semente. */
const STAGE_SALT = 0x5f3a_c0de;

/** Fonte do sorteio pela URL: com `?seed=N`, um gerador semeado por N (reproduzível); sem ele, `random`. */
export function stageRandom(search: string, random: () => number = Math.random): () => number {
  const q = new URLSearchParams(search);
  if (!q.has('seed')) return random;
  return mulberry32((Number.parseInt(q.get('seed')!, 10) & 0xffff) ^ STAGE_SALT);
}

let source: () => number = Math.random;
/** Troca a fonte do sorteio local (main.ts chama com a URL da página; os testes, com a URL que quiserem). */
export function seedStagePick(search: string, random: () => number = Math.random): void { source = stageRandom(search, random); }
/** Sorteia uma das fases visíveis (próximo número da fonte). */
export const drawStage = (): number => pickStage(source());

/** Fase concreta da escolha: ALEATÓRIO sorteia com `draw`; uma fase fica como está. */
export const resolveStage = (choice: number, draw: () => number = drawStage): number => (isRandomStage(choice) ? draw() : choice);

/** Sala online: fase concreta a partir da semente compartilhada da mensagem `start` (a mesma em todos os navegadores). */
export const resolveOnlineStage = (choice: number, seed: number): number =>
  resolveStage(choice, () => pickStage(mulberry32((seed & 0xffff) ^ STAGE_SALT)()));

/** Fase visível que a prévia de ALEATÓRIO mostra no quadro `t` (um ciclo pelas visíveis, `every` quadros cada). */
export const randomPreviewStage = (t: number, every = 24): number => stepVisible(VISIBLE_STAGES[0], Math.floor(t / every));
