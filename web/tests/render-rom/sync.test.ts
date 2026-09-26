import { renderPpu } from '../../src/render/ppu';
import { drawRomBattle } from '../../src/render/rom/battle';
import { romLayers, romPlayerHooks } from '../../src/render/battle-layers';
import { CODE, FLAME_PIECE, BURN, GRID_W, GRID_H, invisibleVisible } from '../../src/core';
import { newRound, toPlay } from './core-fixture';
import { ASSETS } from './rom-fixture';

describe('sincronização com os planos 5 e 6', () => {
  it('exporta o que o plano 7 usa', () => {
    expect(typeof renderPpu).toBe('function');
    expect(typeof drawRomBattle).toBe('function');
    expect(Array.isArray(romLayers)).toBe(true);
    expect(Array.isArray(romPlayerHooks)).toBe(true);
    expect(typeof invisibleVisible).toBe('function');
    expect([GRID_W, GRID_H]).toEqual([17, 13]);
    expect([CODE.FLAME, CODE.BURNING, CODE.FALLING]).toEqual([0x1000, 0xedc0, 0x0001]);
    expect(FLAME_PIECE).toEqual({ CENTER: 0, ARM_UP: 1, ARM_RIGHT: 2, ARM_DOWN: 3, ARM_LEFT: 4, TIP_UP: 5, TIP_RIGHT: 6, TIP_DOWN: 7, TIP_LEFT: 8 });
    expect(BURN).toEqual({ SOFT: 0, ITEM: 1 });
  });
  it('rodada nova: 5 presentes nos spawns (1 px fora do centro) e chega em play', () => {
    const s = newRound(1);
    expect(s.players.map(p => [p.present, p.x >> 8, p.y >> 8])).toEqual([
      [true, 32, 48], [true, 224, 208], [true, 224, 48], [true, 32, 208], [true, 128, 128]]);
    expect(s.floor.every(w => w === 0)).toBe(true);
    toPlay(s);
    expect(s.tick).toBe(62);
  });
  it.skipIf(!ASSETS)('RomAssets da ROM: arena 1 com 1024 tiles e HUD de 96 palavras', () => {
    const ar = ASSETS!.arena(1);
    expect(ar.bgTiles.count).toBe(1024);
    expect(ar.hudMap.length).toBeGreaterThanOrEqual(96);
    expect(Array.from(ar.hudMap.slice(0, 8))).toEqual([0x6600, 0x2600, 0x260c, 0x260d, 0x260b, 0x263a, 0x260b, 0x260b]);
    expect(ASSETS!.character(0).hudHead(0).count).toBe(6);
  });
});
