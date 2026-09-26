import type { Player, RoundState } from '../core';
import type { RomAssets } from '../rom/types';
import type { ObjEntry } from './ppu/types';
import type { SpriteBank } from './sprite-bank';

/** Estruturalmente igual ao ObjEntry da PPU (spec §2.4). Declarado aqui para não depender do plano 5. */
export interface BattleObj {
  x: number; y: number; size: 16 | 32; pal: number; prio: 0 | 1 | 2 | 3;
  hflip: boolean; vflip: boolean; src: { tile: number } | { px: Uint8Array };
}

/** Implementado pelo plano 7. */
export interface RomBattleBuilder {
  setBg2(col: number, lin: number, word: number): void;
  setBg1(col: number, lin: number, word: number): void;
  sprite(e: BattleObj, sortY: number, order: number): void;   // ordem de desenho de [ANI §1.4]
  cgram(index: number, bgr555: number): void;
  bg1Scroll(hofs: number): void;
}

/** `a` é o RomAssets do plano 5 (aqui `object`; a implementação declara `a: RomAssets`). */
export interface RomBattleLayer { id: string; draw(s: RoundState, b: RomBattleBuilder, a: object, frame: number): void }
export interface FallbackBattleLayer { id: string; draw(s: RoundState, ctx: CanvasRenderingContext2D, bank: SpriteBank, frame: number): void }

/** Plano 9 (L17): troca o sprite do jogador (montado, traje). `null` = desenho padrão do plano 7. */
export type RomPlayerHook = (s: RoundState, p: Player, a: RomAssets, frame: number) => ObjEntry[] | null;

export const romLayers: RomBattleLayer[] = [];
export const fallbackLayers: FallbackBattleLayer[] = [];
export const romPlayerHooks: RomPlayerHook[] = [];
export function registerRomLayer(l: RomBattleLayer): void { romLayers.push(l); }
export function registerFallbackLayer(l: FallbackBattleLayer): void { fallbackLayers.push(l); }
