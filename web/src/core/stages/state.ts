/** Arena 2: modo global. */
export interface Stage2State { mode: 0 | 1 | 2; left: number; started: boolean; hofs: number }

/** Arena 3: bola (x, y em px de tela, centro da casa = (16·col − 1, 16·(lin+2) − 1)). */
export interface Orb {
  x: number; y: number; cell: number;
  rolling: boolean; dir: 0 | 1 | 2 | 3;      // 0 cima, 1 direita, 2 baixo, 3 esquerda
  stepLeft: number;                          // ticks até a próxima casa (16..1)
  cellsLeft: number; fails: number; turnSet: number;
  softArmed: boolean; alive: boolean;
  flamedAt: number;                          // tick em que a chama pegou a bola parada (-1)
}
export interface Stage3State { orbs: Orb[] }

/** Arena 6. */
export interface Stage6State {
  counter: number;          // $1EAA
  v: number[];              // v da explosão atual por braço (0 = sem explosão)
  center: number;           // casa do centro a repintar depois dos braços (-1)
  snap: number[];           // por slot: coordenada-alvo do empurrão em 1/256 px (-1)
  snapAxis: number[];       // por slot: 0 = x, 1 = y
}

/** Arena 8. */
export interface Reel { pos: number; calls: number; delay: number; delayCnt: number; braking: boolean }
export interface Fall { kind: 'item' | 'bomb'; id: number; x: number; y: number; script: number; i: number; born: number }
export interface PrizeRun {
  routine: number; queue: number[]; next: number; batch: number; wait: number; colIdx: number;
  after: 'idle' | 'bomb'; bombPhase: 0 | 1 | 2; rain: { wave: number; itemIdx: number } | null;
}
export interface Stage8State {
  started: boolean; phase: 'idle' | 'spin' | 'prize';
  reels: Reel[]; turn: number; stopped: number; lastStopped: number; click: boolean;
  jackpotUsed: boolean; prize: PrizeRun | null; falls: Fall[];
  lastRoutine: number;      // rotina do último resultado (0x14F7 = nada), para testes e IA
}

/** Arena 9. */
export interface Seesaw { a: number; b: number; state: 0 | 1; transUntil: number }
export interface Jump { slot: number; t: number; dx: -1 | 0 | 1; baseY: number; born: number; hop: number /* -1 = pulo */ }
export interface Stage9State { saws: Seesaw[]; jumps: Jump[] }
