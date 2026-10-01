import type { Rng16 } from './rng';

export const BTN = {
  UP: 1, DOWN: 2, LEFT: 4, RIGHT: 8, A: 16, B: 32, Y: 64, START: 128, X: 256, L: 512, R: 1024, SELECT: 2048,
} as const;
export const DIR_BTNS = BTN.UP | BTN.DOWN | BTN.LEFT | BTN.RIGHT;

/** Códigos de 16 bits da grade lógica da ROM ($7E:2800), spec §3.1. */
export const CODE = {
  FLOOR: 0x0000, HARD: 0xec40, SOFT: 0xcc80, BOMB: 0xc900, BURNING: 0xedc0, PRESSURE: 0xee80,
  FLAME: 0x1000, ITEM: 0x0940, SKULL: 0x0980, FALLING: 0x0001, ORB: 0x0f41, ARROW: 0x0040,
  PAD: 0x0c00, PAD_FLAME: 0x1c00,
} as const;

/** IDs de item da ROM (tabela $C1:60A0). */
export const ITEM = {
  BOMB: 0x01, PIERCE: 0x02, FIRE: 0x03, FULL_FIRE: 0x04, SPEED: 0x05, REMOTE: 0x06, GLOVE: 0x07, VEST: 0x08,
  HEART: 0x09, PASS_SOFT: 0x0a, PASS_BOMB: 0x0b, CLOCK: 0x0c, PUNCH: 0x0d, KICK: 0x0e, COSTUME: 0x0f,
  STAR: 0x11, P: 0x12, SKULL: 0x21, EGG: 0x30,
} as const;

export const DISEASE = {
  FAST: 0x21, SLOW: 0x22, DIARRHEA: 0x23, CONSTIPATION: 0x24, LOW_FIRE: 0x25, NO_STOP: 0x26,
  SHORT_FUSE: 0x27, LONG_FUSE: 0x28, INVISIBLE: 0x29, REVERSE: 0x2a, LEAK: 0x2b, SWAP: 0x2c,
} as const;

/** Peça da chama guardada em cellAux quando grid = FLAME (o render mapeia para as palavras da §7.1). */
export const FLAME_PIECE = {
  CENTER: 0, ARM_UP: 1, ARM_RIGHT: 2, ARM_DOWN: 3, ARM_LEFT: 4, TIP_UP: 5, TIP_RIGHT: 6, TIP_DOWN: 7, TIP_LEFT: 8,
} as const;

/** Tipo de queima em cellAux quando grid = BURNING. */
export const BURN = { SOFT: 0, ITEM: 1 } as const;

export interface Rules {
  cpuLevel: 0 | 1 | 2;
  matches: number;          // coroas para vencer (1..5)
  timeIdx: number;          // 0..4 → 1:00, 2:00, 3:00, 5:00, ∞
  suddenDeath: boolean;
  badBomber: boolean;
  racer: boolean;
  randomSpawns: boolean;    // extra, não original (§6.13); padrão Não
  gloveEscape: number;      // extra: apertos de B para se soltar da luva de quem te pegou (1..30)
  throwStun: boolean;       // extra: só jogador arremessado sobre outro jogador — atordoa os dois (padrão Não: só quica).
                            // Bomba caindo na cabeça atordoa sempre, independente disto.
  sleepTicks: number;       // extra: duração do soneca (montaria F) em ticks; ROM: 192 ($C0)
  allMounts: boolean;       // senha 0164 ($7F:70BD ≠ 0): ovos sorteados entre os 13 tipos de $C1:5D87
  mode: 'ffa' | 'team';
  teams: number[];          // time de cada slot (0/1)
  active: boolean[];        // slot participa?
}

export function defaultRules(): Rules {
  return {
    cpuLevel: 1, matches: 3, timeIdx: 2, suddenDeath: false, badBomber: false, racer: false,
    randomSpawns: false, gloveEscape: 10, throwStun: false, sleepTicks: 192, allMounts: false, mode: 'ffa', teams: [0, 1, 0, 1, 0], active: [true, true, true, true, true],
  };
}

export type Phase = 'intro' | 'play' | 'won' | 'timeUp' | 'over';

export type PlayerAct = 'idle' | 'walk' | 'lift' | 'carryIdle' | 'carryWalk' | 'throw' | 'punch' | 'pPunch'
  | 'detonate' | 'stunned' | 'dying' | 'victory' | 'mounting' | 'dismount' | 'launched' | 'pushed' | 'shocked'
  | 'dance' | 'bad' | 'held' | 'dropped';

export interface Player {
  slot: number; present: boolean; char: number; team: number;
  x: number; y: number;                  // 1/256 px, coordenadas de tela (+$11..$13 / +$15..$17)
  moveDir: number;                       // 0..7, 8 = parado (+$60)
  face: 0 | 2 | 4 | 6;                   // +$62
  lastDir: number;                       // últimos botões de direção apertados (doença $26)
  speedLv: number; bombsCap: number; bombsFree: number; fire: number; fullFire: boolean;
  bombType: 0 | 1 | 2; glove: boolean; punch: boolean; kick: boolean; pItem: boolean;
  passSoft: boolean; passBomb: boolean; heart: boolean;
  costume: number;                       // -1 ou 0..7
  disease: number;                       // 0 ou $21..$2B
  diseaseT: number;                      // contador +$4E (padrão do invisível)
  contactLock: number;                   // bits por slot: contágio travado enquanto dura o contato
  inv: number;                           // invencibilidade em ticks (+$96)
  effect: { kind: 0 | 2 | 0x0a; left: number };   // +$E4/+$E6: 2 = lento (montaria E), $0A = invertido (arena 6)
  act: PlayerAct; actT0: number; actLeft: number; // actLeft > 0 = ação travada
  carry: number;                         // id da bomba na mão (luva) ou -1
  throwQueued: boolean;                  // A solto durante o levantamento
  grab: number;                          // luva: slot do jogador que está na mão ou -1
  heldBy: number;                        // slot de quem me segura com a luva ou -1
  flying: boolean;                       // arremessado por outro jogador (voador kind 'player')
  escape: number;                        // apertos de B para se soltar (conta até Rules.gloveEscape)
  z: number;                             // altura em px acima do chão (só desenho: na mão ou voando)
  push: { vx: number; vy: number; left: number }; // movimento forçado (P, empurrão), 1/256 px por tick
  walkT: number;                         // ticks andando (passo a cada 20)
  state: 'alive' | 'dying' | 'out' | 'bad';
  hitT0: number;                         // tick do acerto fatal (-1)
  prevBtn: number;
  mount: unknown | null;                 // plano 9
}

export interface Bomb {
  id: number; owner: number;             // slot do dono (o Bad Bomber usa o próprio slot)
  bad: boolean;                          // bomba de Bad Bomber (cadência própria)
  cell: number; x: number; y: number;    // casa atual e centro em 1/256 px (anda no chute)
  fuse: number;                          // contador da ROM (126 normal); explode ao ser processada com 0
  fire: number;                          // nível de fogo; alcance = rangeOf(fire)
  type: 0 | 1 | 2;                       // 0 normal, 1 remota, 2 perfurante
  level?: number;                        // extra: evolução no chute (ausente = 0) — 0 comum, 1 D, 2 S, 3 H (explosão por área)
  state: 'idle' | 'kicked' | 'held' | 'air';
  dir: 0 | 2 | 4 | 6; step: number; kickedBy: number;   // chute
  turn: number;                          // chute: nova face ao chegar na próxima casa (-1 = nenhuma; arena 7)
  chainAt: number;                       // tick marcado para explodir (0 = não)
  born: number;                          // tick de criação
}

export type FlightId = 'punch' | 'bounce' | 'throw2' | 'throw3' | 'throw4' | 'throw5' | 'item';

export interface Flyer {
  id: number; kind: 'bomb' | 'item' | 'player';
  ref: number;                           // id da bomba, id do item/caveira ou slot do jogador arremessado
  x: number; y: number;                  // chão, 1/256 px
  z: number;                             // altura em px (≤ 0 = acima do chão); o render desenha em (x, y + z·256)
  dir: 0 | 1 | 2 | 3;                    // 0 cima, 1 direita, 2 baixo, 3 esquerda (índice dos scripts)
  flight: FlightId; script: number;      // script = índice em ITEM_FLIGHT quando flight = 'item'
  i: number;                             // passo atual do script
  born: number;
  glove?: boolean;                       // arremessada com a luva e ainda sem quicar (vale o reflect)
  hit?: boolean;                         // jogador arremessado que bateu em outro (Rules.throwStun): atordoa ao pousar
}

export interface Falling { cell: number; t0: number; land: number }

export interface PressureState {
  trigger: number;                       // tick T do gatilho (-1 = ainda não)
  next: number;                          // próximo índice da espiral
  total: number;                         // 80 ou 143 passos
  falling: Falling[];
}

export interface BadBomberState {
  slot: number; x: number; y: number;    // px inteiros na moldura (X ∈ {15, 239}, Y ∈ {32, 224})
  phase: 'enter' | 'patrol';
  face: 0 | 2 | 4 | 6;
  live: number;                          // id da bomba arremessada ainda viva (-1)
  readyAt: number;                       // tick a partir do qual pode pegar outra bomba
  born: number;                          // tick em que virou Bad Bomber (só anda a partir do seguinte)
}

export interface RoundResult { kind: 'win' | 'draw'; winner: number | null; reason: 'last' | 'dead' | 'time' }

export interface RoundState {
  tick: number; phase: Phase; phaseT0: number;
  stage: number; rules: Rules; rng: Rng16;
  clock: { sec: number; sub: number };
  grid: number[]; cellT0: number[]; cellAux: number[];
  floor: number[];                       // palavra de BG do piso por casa; 0 = a da ROM (arena 6 repinta)
  hidden: [number, number][];            // (cell, item), consumida ao revelar
  players: Player[];                     // 5 slots; present = false para Nenhum
  bombs: Bomb[]; flyers: Flyer[];
  pressure: PressureState; bad: BadBomberState[];
  stageState: unknown; mountState: unknown;
  diseaseOnce24: boolean;                // $1EE4
  result: RoundResult | null;
  nextId: number;
  lastHit: number;                       // tick do último acerto fatal
  endAt: number;                         // tick em que a vitória é decidida (0 = ainda não)
  celebT0: number;                       // início dos 128 ticks de comemoração (-1)
  counted: boolean;                      // finishRound já contou a coroa
}

export type GameEvent =
  | { type: 'bomb_placed'; slot: number; cell: number }
  | { type: 'explosion'; cell: number; owner: number }
  | { type: 'item_picked'; slot: number; item: number }
  | { type: 'disease_passed'; from: number; to: number }
  | { type: 'footstep'; slot: number }
  | { type: 'bomb_kicked'; slot: number }
  | { type: 'punch'; slot: number }
  | { type: 'p_punch'; slot: number }
  | { type: 'throw'; slot: number }
  | { type: 'bomb_bounce'; cell: number }
  | { type: 'bomb_landed'; cell: number }
  | { type: 'player_hit'; slot: number }
  | { type: 'stunned'; slot: number }
  | { type: 'hurry' }
  | { type: 'pressure_step'; cell: number }
  | { type: 'victory_sfx'; slot: number }
  | { type: 'time_up' }
  | { type: 'round_over'; result: RoundResult }
  | { type: 'stage'; id: string; slot?: number; cell?: number }   // eventos das arenas (plano 8)
  | { type: 'mount'; id: string; slot?: number; cell?: number };  // eventos das montarias (plano 9)
