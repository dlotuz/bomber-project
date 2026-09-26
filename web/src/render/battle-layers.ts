import type { Player, RoundState } from '../core';
import type { RomAssets } from '../rom/types';
import type { ObjEntry } from './ppu';
import type { SpriteBank } from './sprite-bank';

/** Mantido por compatibilidade com quem já importou o nome do plano 6. */
export type BattleObj = ObjEntry;

/** Implementado pelo plano 7 (render/rom/builder.ts). */
export interface RomBattleBuilder {
  setBg2(col: number, lin: number, word: number): void;
  setBg1(col: number, lin: number, word: number): void;
  sprite(e: ObjEntry, sortY: number, order: number): void;   // ordem de desenho de [ANI §1.4]
  cgram(index: number, bgr555: number): void;
  bg1Scroll(hofs: number): void;
}

/** `visualTick` (M5, D6): tick visual já congelado no TIME UP/vitória — o mesmo valor das camadas base. */
export interface RomBattleLayer { id: string; draw(s: RoundState, b: RomBattleBuilder, a: RomAssets, frame: number, visualTick: number): void }
export interface FallbackBattleLayer { id: string; draw(s: RoundState, ctx: CanvasRenderingContext2D, bank: SpriteBank, frame: number): void }

/** Plano 9 (L17): troca o sprite do jogador (montado, traje). `null` = desenho padrão do plano 7. */
export type RomPlayerHook = (s: RoundState, p: Player, a: RomAssets, frame: number, visualTick: number) => ObjEntry[] | null;

export const romLayers: RomBattleLayer[] = [];
export const fallbackLayers: FallbackBattleLayer[] = [];
export const romPlayerHooks: RomPlayerHook[] = [];
export function registerRomLayer(l: RomBattleLayer): void { romLayers.push(l); }
export function registerFallbackLayer(l: FallbackBattleLayer): void { fallbackLayers.push(l); }
