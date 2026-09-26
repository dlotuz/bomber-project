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
  remount: boolean;      // desmonte com reserva (1 + 44)
}

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
}

export interface MountState { projectiles: MountProjectile[]; nextId: number }

export interface MountAbility {
  type: number;
  passes?(p: Player, code: number): boolean;
  bombType?(p: Player): 0 | 1 | 2 | null;
  kicks?(p: Player): boolean;
  onY?(s: RoundState, p: Player, r: MountRider, ev: GameEvent[]): boolean;
  tickProjectile?(s: RoundState, pr: MountProjectile, ev: GameEvent[]): void;
}

export const MOUNTING_TICKS = 43;   // $C2:261E
export const DISMOUNT_TICKS = 52;   // 1 ($C2:105E) + 51 ($C2:10D5)
export const REMOUNT_TICKS = 45;    // 1 + 44 ($C2:1089)
export const POST_INV = 32;         // +$96
export const MAX_ACTIVE = 2;        // $1ED4
export const MAX_RESERVES = 3;      // +$52/+$54/+$56

export function rider(p: Player): MountRider | null {
  return (p.mount as MountRider | null | undefined) ?? null;
}

export function mstate(s: RoundState): MountState {
  let m = s.mountState as MountState | null | undefined;
  if (!m) { m = { projectiles: [], nextId: 1 }; s.mountState = m; }
  return m;
}
