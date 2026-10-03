import type { RoundState, Player, GameEvent } from '../types';

export type MountPhase = 'mounting' | 'riding' | 'dismount';

/** Guardado em Player.mount. Espelha +$5C (tipo), +$5D (vaga) e +$52/+$54/+$56 (reservas). */
export interface MountRider {
  type: number;          // 2, 3, $A, $C, $D, $E, $F no Battle
  slot: 0 | 1 | 2;       // vaga de sprite $1ED5/$1ED6; 0 = sem vaga (desmontando sem reserva)
  phase: MountPhase;
  t0: number;            // tick em que a fase começou
  reserves: number[];    // tipos dos ovos reserva; [0] = o que vem logo atrás (máx. 3)
  trail: number[];       // [casa atual, anterior, ...] (máx. 4), para desenhar os reservas 1 casa atrás
  cooldown: number;      // recarga do Y (tipo E), ticks
  remount: boolean;      // desmonte com reserva (1 + 51, REMOUNT_TICKS)
  /** Marcador do último remonte (só leitura para o render): o ovo reserva é objeto próprio da ROM que brilha na casa
   *  `origin`, anda até (x, y) e estoura em t = 31 com $D8:D327 (40 ticks), passando do fim do remonte (t = 52). */
  remountFx: RemountFx | null;
  dash?: boolean;        // tipo 4: investida em curso
  dashLeft?: number;     // tipo 4: ticks que faltam do teto ($58)
  dashT?: number;        // tipo 4: último tick da investida (um tick sem ela = rotina substituída)
}

export interface RemountFx { t0: number; origin: number; x: number; y: number }   // x, y em 1/256 px

export type ProjKind = 0xd | 0xe | 0xf;

export interface MountProjectile {
  id: number;
  kind: ProjKind;
  owner: number;         // slot do montador
  x: number; y: number;  // 1/256 px
  dir: 0 | 2 | 4 | 6;
  born: number;          // tick do Y (k = tick − born)
  state: 'fly' | 'cloud' | 'done';
  t: number;             // tick em que entrou no estado atual
  slot: 0 | 1 | 2;       // D: vaga de sprite da montaria lançada
  target?: number;       // F: slot atingido (a nota acaba no tick k e o alvo dança no k + 1)
}

/** Ovo reserva queimado (L22): estoura na casa por EGG_BURST_TICKS e conta no $1ED4 até o fim ($C2:6680). */
export interface EggBurst { cell: number; t0: number; mount: number }

/** Varredura do tipo 5 (objeto $C1:6A3F): `i` = próxima casa de SWEEP_PATH. */
export interface Sweep { i: number; born: number }

export interface MountState { projectiles: MountProjectile[]; nextId: number; bursts: EggBurst[]; sweeps?: Sweep[] }

export interface MountAbility {
  type: number;
  passes?(p: Player, code: number): boolean;
  bombType?(p: Player): 0 | 1 | 2 | null;
  kicks?(p: Player): boolean;
  fire?(p: Player): number;
  speed?(p: Player): number;
  /** Movimento próprio (tipo 4); true = trava o jogador neste tick. */
  drive?(s: RoundState, p: Player, r: MountRider, ev: GameEvent[]): boolean;
  onY?(s: RoundState, p: Player, r: MountRider, ev: GameEvent[]): boolean;
  /** O handler do Y sai com SEC na ROM e encerra a rotina montada ($C2:141C) antes do chute ($C2:4307): 9 ($C2:4939),
   *  4 ($C2:46AD) e D ($C2:47BF). C, E e F saem com CLC e o chute ainda acontece no mesmo tick. */
  yEndsTick?: boolean;
  tickProjectile?(s: RoundState, pr: MountProjectile, ev: GameEvent[]): void;
}

export const MOUNTING_TICKS = 43;   // $C2:261E
export const DISMOUNT_TICKS = 52;   // 1 ($C2:105E) + 51 ($C2:10D5)
/** Remonte = desmonte: $C2:105E escolhe a anim uma vez ($C2:6F71) e desvia para $C2:1089 (com reserva) ou $C2:10D5
 *  (sem); os dois laços esperam o fim da mesma anim e saem em $C2:22F0. Fixture T4: 0xd818ef de f0 a f49 (captura
 *  já dentro da rotina), montado em f50. O "1 + 44" da spec vinha de um teste artificial (errata §5.2/§11). */
export const REMOUNT_TICKS = DISMOUNT_TICKS;
export const POST_INV = 32;         // +$96
export const MAX_ACTIVE = 2;        // $1ED4
export const MAX_RESERVES = 3;      // +$52/+$54/+$56
export const EGG_BURST_TICKS = 40;  // $D8:D327: 4 quadros × 10 ticks (explosão do ovo; reserva queimada, L22)

/** Ovo de máquina (metálico, gráfico $D8:D2CC), como na ROM (ids ≥ $38): soco (9), chute (A), velocidade (B), linha de
 *  bombas (C), foguete (D), tiro lento (E) e soneca (F). Ovo verde: atravessa bomba (1), atravessa bloco (2), bomba
 *  perfurante (3), investida (4), varredura (5) e fogo total (6). */
export const isMachine = (type: number): boolean => type >= 8;
/** Ovo reserva: só segue quem está numa montaria da mesma classe (máquina × normal). */
export const sameClass = (a: number, b: number): boolean => isMachine(a) === isMachine(b);

export function rider(p: Player): MountRider | null {
  return (p.mount as MountRider | null | undefined) ?? null;
}

export function mstate(s: RoundState): MountState {
  let m = s.mountState as MountState | null | undefined;
  if (!m) { m = { projectiles: [], nextId: 1, bursts: [] }; s.mountState = m; }
  return m;
}
