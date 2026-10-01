import type { Bomb, GameEvent, Player, RoundState } from './types';
import type { AiMountHints, AiStageHints } from './ai/hints';

/** Módulo de arena (plano 8). Todos os ganchos são opcionais. */
export interface StageModule {
  /** Depois da remoção de soft e ANTES dos itens (consome RNG na ordem da ROM). */
  init?(s: RoundState): void;
  /** Passo 5 da §3.4. */
  tick?(s: RoundState, ev: GameEvent[]): void;
  /** Arena 2: nível de velocidade efetivo (recebe o nível já com doença). */
  speedLevel?(s: RoundState, p: Player, lv: number): number;
  /** Arena 2: quanto o pavio cai neste tick (0, 1 ou 2). */
  fuseStep?(s: RoundState, b: Bomb): number;
  /** Arenas 3, 6, 8: casa de chama com código especial, ou toda casa de chama (a arena decide). */
  onFlameCell?(s: RoundState, cell: number, armDir: number, ev: GameEvent[]): void;
  /** Arenas 6, 9: o jogador entrou numa casa. */
  onEnterCell?(s: RoundState, p: Player, cell: number, ev: GameEvent[]): void;
  /** Arena 8: jogador de pé na casa (chamado todo tick). */
  onStand?(s: RoundState, p: Player, cell: number, ev: GameEvent[]): void;
  /** Arenas 6, 7: bomba chutada prestes a entrar em `cell`. */
  kickedBombEnter?(s: RoundState, b: Bomb, cell: number): 'go' | 'stop' | { turn: number };
  /** Arena 5 (cerca): chamado a cada tick de movimento forçado. */
  outOfBounds?(s: RoundState, p: Player, ev: GameEvent[]): void;
  ai?: AiStageHints;
}

/** Ovos e montarias (plano 9). */
export interface MountModule {
  init?(s: RoundState): void;
  revealEgg(s: RoundState, cell: number, ev: GameEvent[]): void;          // item $30 revelado
  stepOnEgg(s: RoundState, p: Player, cell: number, ev: GameEvent[]): void;
  onHit(s: RoundState, p: Player, ev: GameEvent[]): boolean;               // true = absorveu o golpe
  onY(s: RoundState, p: Player, ev: GameEvent[]): boolean;                 // true = consumiu o Y
  passes?(p: Player, code: number): boolean;                                // tipo 2 atravessa soft
  bombType?(p: Player): 0 | 1 | 2 | null;                                   // tipo 3: bomba perfurante
  kicks?(p: Player): boolean;                                               // tipo A
  bombFire?(p: Player): number | null;                                      // tipo 6: fogo da bomba
  speedLevel?(p: Player): number | null;                                    // tipo B: nível de velocidade
  drive?(s: RoundState, p: Player, ev: GameEvent[]): boolean;               // tipo 4: investida (true = travado)
  tick(s: RoundState, ev: GameEvent[]): void;                               // projéteis, ovo reserva
  ai?: AiMountHints;
}
