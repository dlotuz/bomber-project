import type { RoundState } from '../../core';
import type { RomAssets, Tiles } from '../../rom/types';
import type { FrameBuilder } from './builder';
import type { RomTables } from './tables';
import type { RomClock, RomMemo, RomScene } from './scene';

export interface SpriteCtx {
  s: RoundState; a: RomAssets; tb: RomTables; scene: RomScene; clock: RomClock; memo: RomMemo;
  tiles: Tiles;   // tiles de BG do quadro (itens voando, D12)
}

/** Jogadores, Bad Bombers, objetos e pressão (Tarefa 8). */
export function drawSprites(_b: FrameBuilder, _c: SpriteCtx): void {}
