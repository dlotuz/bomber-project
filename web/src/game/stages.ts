// Fases da interface. 1–10 são as do original; 11 em diante são cópias de uma delas só com outras cores (o núcleo
// joga a fase base, e só o desenho troca a paleta da arena: render/stage-skin.ts).

/** Cópias com outra paleta: fase da interface → fase base do núcleo. */
const COPIES: Readonly<Record<number, number>> = { 11: 1, 12: 1, 13: 1 };
/** Maior número de fase da interface. */
export const STAGE_MAX = 13;

/** Fases que aparecem na seleção de fase e na sala online, na ordem da tela. As outras ficam só ocultas: para
 *  mostrá-las de novo, é só pôr o número aqui (por exemplo `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]`). */
export const VISIBLE_STAGES: readonly number[] = [1, 11, 12, 13];

/** Fase que o núcleo joga (1–10). */
export const coreStage = (stage: number): number => COPIES[stage] ?? stage;
/** Paleta da arena: 0 = a original; senão, o número da cópia. */
export const stageSkin = (stage: number): number => (COPIES[stage] ? stage : 0);

/** Fase visível `d` passos depois de `stage` (com volta); uma fase oculta conta como a 1ª visível. */
export function stepVisible(stage: number, d: number): number {
  const n = VISIBLE_STAGES.length, i = Math.max(0, VISIBLE_STAGES.indexOf(stage));
  return VISIBLE_STAGES[(((i + d) % n) + n) % n];
}
/** `stage` se visível; senão a 1ª visível (configuração salva com uma fase que ficou oculta). */
export const visibleStage = (stage: number): number => (VISIBLE_STAGES.includes(stage) ? stage : VISIBLE_STAGES[0]);
/** Posição (1, 2, …) da fase na lista visível, para o "Fase N" da tela. */
export const stageNumber = (stage: number): number => VISIBLE_STAGES.indexOf(visibleStage(stage)) + 1;
