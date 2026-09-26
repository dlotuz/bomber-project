import type { RoundState } from '../core';
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
/** `over: true` desenha depois de bombas, flyers e jogadores, em vez de antes (plano 8, M4 da revisão final: as
 *  moitas da arena 7 têm de esconder bombas e jogadores, não só o chão, §4.6). Ausente/false = como sempre, antes
 *  de tudo. Genérico de propósito: o plano 9 vai reusar para desenhar a montaria por cima do cavaleiro. */
export interface FallbackBattleLayer {
  id: string; over?: boolean;
  draw(s: RoundState, ctx: CanvasRenderingContext2D, bank: SpriteBank, frame: number): void;
}

export const romLayers: RomBattleLayer[] = [];
export const fallbackLayers: FallbackBattleLayer[] = [];
/** Camadas de fallback com `over: true` (ver `FallbackBattleLayer`); `drawRound` as desenha por último. */
export const fallbackOverLayers: FallbackBattleLayer[] = [];
export function registerRomLayer(l: RomBattleLayer): void { romLayers.push(l); }
export function registerFallbackLayer(l: FallbackBattleLayer): void { (l.over ? fallbackOverLayers : fallbackLayers).push(l); }
