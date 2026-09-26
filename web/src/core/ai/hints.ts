import type { RoundState } from '../types';

/** Dicas de IA por arena (plano 8). Tudo opcional; ausente = regra padrão. */
export interface AiStageHints {
  /** Casas a evitar agora (ex.: arena 6, piso-caveira). */
  avoid?(s: RoundState, slot: number): readonly number[];
  /** Casa onde para uma bomba chutada de `cell` na `face` (arena 7: setas). null = regra padrão. */
  kickEnd?(s: RoundState, cell: number, face: number): number | null;
  /** Casas-alvo com prioridade (arena 8: pad para frear). */
  goals?(s: RoundState, slot: number): readonly number[];
  /** Perigo extra: casa → ticks até ficar mortal (arena 3: rota das bolas). */
  danger?(s: RoundState): ReadonlyMap<number, number>;
}

/** Dicas de IA das montarias (plano 9). */
export interface AiMountHints {
  /** Deve apertar Y agora? */
  useY?(s: RoundState, slot: number): boolean;
  /** Valor de ir buscar o ovo na casa (0 = ignorar). */
  eggValue?(s: RoundState, slot: number, cell: number): number;
}
