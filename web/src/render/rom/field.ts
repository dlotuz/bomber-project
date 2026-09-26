import { CODE, GRID_H, GRID_W, type RoundState } from '../../core';
import type { ArenaAssets } from '../../rom/types';
import { flameWord, itemBurnWord, scriptWord, softBurnWord, type ScriptStep } from '../anim/grid-seq';
import type { RomTables } from './tables';
import { mapIndex, type RomClock, type RomScene } from './scene';

export const WORD_PRESSURE = 0x082e;

export function cellWord(s: RoundState, cell: number, i: number, ar: ArenaAssets, scene: RomScene, tb: RomTables,
  clock: RomClock, script: (type: number) => readonly ScriptStep[]): number {
  const code = s.grid[cell];
  const floor = s.floor[cell] || ar.floor[i];
  switch (code) {
    case CODE.FLOOR:
    case CODE.FALLING:
      return floor;
    case CODE.HARD:   // soft do mapa limpo na carga com lógico de piso duro (arena 4): o ROM grava o piso
      return ar.logicBase[i] === CODE.SOFT ? floor : ar.bg2Base[i];
    case CODE.SOFT:
      return ar.bg2Base[i];
    case CODE.PRESSURE:
      return WORD_PRESSURE;
    case CODE.BOMB: {
      const b = scene.gridBombs.get(cell);
      return b ? scriptWord(script(b.type), clock.bombTick - b.born) : scriptWord(script(0), 0);
    }
    case CODE.FLAME:
      return flameWord(scene.flame(cell), clock.tick - s.cellT0[cell]);
    case CODE.BURNING: {
      const age = clock.tick - s.cellT0[cell];
      return scene.burn(cell) === 'soft' ? softBurnWord(age) : itemBurnWord(age) ?? floor;
    }
  }
  if ((code & 0xffc0) === CODE.ITEM) {
    const id = code - CODE.ITEM;
    return id < 0x30 ? tb.itemWord(id) : floor;   // 0970+t = ovo: plano 9
  }
  if ((code & 0xffc0) === CODE.SKULL) return tb.itemWord(code - CODE.SKULL);
  return ar.bg2Base[i];   // códigos especiais das arenas (D21): o plano 8 sobrescreve
}

/** Mapa 32×32 do BG2: bg2Base com as casas 1..15 × 0..12 vindas da grade. */
export function fieldWords(s: RoundState, ar: ArenaAssets, scene: RomScene, tb: RomTables, clock: RomClock,
  script: (type: number) => readonly ScriptStep[]): Uint16Array {
  const out = Uint16Array.from(ar.bg2Base.subarray(0, 1024));
  for (let lin = 0; lin < GRID_H; lin++) for (let col = 1; col < GRID_W - 1; col++) {
    const i = mapIndex(col, lin);
    out[i] = cellWord(s, lin * GRID_W + col, i, ar, scene, tb, clock, script);
  }
  return out;
}
