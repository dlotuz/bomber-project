import type { PlayerAct } from '../../core';

/** Bomba parada na grade: palavra do BG2 pelo script do tipo, desde `born`. */
export interface GridBomb { type: number; born: number }
/** OBJ de objeto: bomba em movimento/na mão/voando ou item voando. px de tela; (x, y) = centro no chão; z = altura (≥ 0). */
export interface SceneObj { kind: 'bomb' | 'item'; item: number; x: number; y: number; z: number }
/** Passo da pressão com bloco (Falling do núcleo). */
export interface PressureDrop { cell: number; t0: number; land: number }
export type FlamePieceName = 'center' | 'armU' | 'armR' | 'armD' | 'armL' | 'tipU' | 'tipR' | 'tipD' | 'tipL';
export type BurnKind = 'soft' | 'item';

/** O que o render precisa do núcleo além dos campos da §3.4 (traduzido por adapt.ts). */
export interface RomScene {
  gridBombs: Map<number, GridBomb>;
  objs: SceneObj[];
  drops: PressureDrop[];
  flame(cell: number): FlamePieceName;
  burn(cell: number): BurnKind;
  team: boolean;
}
/** tick: relógio visual (congela no TIME UP); bombTick: congela também na vitória; frame: contador global ($016C). */
export interface RomClock { tick: number; bombTick: number; frame: number }
/** Memória do render por rodada (WeakMap pela RoundState). */
export interface RomMemo { freezeAll: number | null; freezeBombs: number | null; recentDrops: PressureDrop[] }
/** Troca de um tile 8×8 do BG (64 índices). */
export interface TileOverride { tile: number; px: Uint8Array }
export interface PlayerPose { act: PlayerAct; face: number; char: number; moving: boolean }

export const MAP_W = 32;
export const mapIndex = (col: number, lin: number): number => lin * MAP_W + col;
/** Paleta OBJ livre no Battle (GFX §3.3) que recebe a paleta BG 4 para os itens voando (D12). */
export const OBJ_ITEM_PAL = 2;
export function newMemo(): RomMemo { return { freezeAll: null, freezeBombs: null, recentDrops: [] }; }
