import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { battleClock, buildBattleFrame, drawRomBattle, romMemo, visualTick } from '../../src/render/rom/battle';
import { newMemo } from '../../src/render/rom/scene';
import { renderPpu } from '../../src/render/ppu';
import type { RomBattleBuilder, RomBattleLayer } from '../../src/render/battle-layers';
import type { RomAssets } from '../../src/rom/types';
import { blankImage, fakeAssets, fakeRound } from './fakes';
import { ASSETS } from './rom-fixture';
import { newRound } from './core-fixture';
import { staticObjects } from '../../src/rom/arena-build';

const VIS = { crowns: [0, 1, 2, 3, 4] };

/** Canvas 2D falso: só o que `drawRomBattle` usa. */
function ctx() {
  const put = vi.fn();
  const create = vi.fn((w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }));
  return { c: { putImageData: put, createImageData: create } as unknown as CanvasRenderingContext2D, put, create };
}

describe('buildBattleFrame (assets falsos)', () => {
  it('faixas: HUD 8×8 (0–23) e campo 16×16 (24–223) (D18)', () => {
    const f = buildBattleFrame(fakeRound(), VIS, fakeAssets(), 0, { layers: [] });
    expect(f.bands).toEqual([
      { y0: 0, y1: 24, bg1Tile16: false, bg1: [8, -33], bg2: [8, -25], main: 0x11, sub: 0, math: 'none' },
      { y0: 24, y1: 224, bg1Tile16: true, bg1: [8, -25], bg2: [8, -25], main: 0x13, sub: 0, math: 'none' },
    ]);
    expect(f.bg1!.tiles).toBe(f.bg2!.tiles);
  });
  it('color math da arena: BG2 na subtela', () => {
    const f = buildBattleFrame(fakeRound(), VIS, fakeAssets({ arena: { colorMath: 'half' } }), 0, { layers: [] });
    expect(f.bands[1]).toMatchObject({ sub: 0x02, math: 'half' });
  });
  it('BG1 = decoração + HUD nas linhas 28–30 (relógio, coroas de vis)', () => {
    const a = fakeAssets({ arena: { bg1: Uint16Array.from({ length: 1024 }, (_, i) => 0x3000 | i) } });
    const s = fakeRound();
    s.clock.sec = 181;
    const m = buildBattleFrame(s, VIS, a, 0, { layers: [] }).bg1!.map;
    expect(m[5 * 32 + 3]).toBe(0x3000 | (5 * 32 + 3));
    expect(m[28 * 32 + 4]).toBe(0x2632);
    expect([m[29 * 32 + 12], m[29 * 32 + 16], m[29 * 32 + 28]]).toEqual([0x2640, 0x2641, 0x2644]);
  });
  it('BG2 da grade; camadas rodam depois e sobrescrevem', () => {
    const s = fakeRound();
    s.grid[1 * 17 + 5] = 0xee80;
    const layer: RomBattleLayer = {
      id: 'teste',
      draw: (_s, b: RomBattleBuilder) => {
        b.setBg2(6, 1, 0xabcd);
        b.cgram(5, 0x1234);
        b.bg1Scroll(0x18);
        b.sprite({ x: 1, y: 2, size: 16, pal: 7, prio: 2, hflip: false, vflip: false, src: { tile: 0x180 } }, 300, 1000);
      },
    };
    const f = buildBattleFrame(s, VIS, fakeAssets(), 0, { layers: [layer], sprites: false });
    expect([f.bg2!.map[1 * 32 + 5], f.bg2!.map[1 * 32 + 6], f.cgram[5]]).toEqual([0x082e, 0xabcd, 0x1234]);
    expect(f.bands[1].bg1).toEqual([0x18, -25]);
    expect(f.oam).toHaveLength(1);
  });
  it('rostos entram nos tiles $201…; hudHeads: false mantém os da ROM', () => {
    const a = fakeAssets();
    const px = buildBattleFrame(fakeRound(), VIS, a, 0, { layers: [] }).bg1!.tiles.px;
    expect([px[0x201 * 64], px[0x203 * 64], px[0x222 * 64]]).toEqual([0x40, 0x48, 0x45]);
    const raw = buildBattleFrame(fakeRound(), VIS, a, 0, { layers: [], hudHeads: false }).bg1!.tiles.px;
    expect(raw[0x201 * 64]).toBe(0x201 & 0xff);
  });
  it('CGRAM: pisca na cor 79 pelo frame; OBJ da arena; OBJ pal 2 = BG pal 4', () => {
    const f0 = buildBattleFrame(fakeRound(), VIS, fakeAssets(), 0, { layers: [], sprites: false });
    const f4 = buildBattleFrame(fakeRound(), VIS, fakeAssets(), 4, { layers: [], sprites: false });
    expect([f0.cgram[79], f4.cgram[79], f0.cgram[130]]).toEqual([0x00bf, 0x7d80, 0x4002]);
    expect(Array.from(f0.cgram.slice(160, 176))).toEqual(Array.from(f0.cgram.slice(64, 80)));
    expect(f0.objTiles!.count).toBe(512);
  });
  it('ciclo de paleta da arena na CGRAM; palAnim: false mantém a da ROM', () => {
    const frames = [Uint16Array.from({ length: 16 }, (_, i) => 0x7000 + i), Uint16Array.from({ length: 16 }, (_, i) => 0x7100 + i)];
    const a = fakeAssets({ arena: { palAnim: [{ first: 80, frames, period: 8 }] } });
    const on = buildBattleFrame(fakeRound({ tick: 9 }), VIS, a, 0, { layers: [], sprites: false }).cgram;
    const off = buildBattleFrame(fakeRound({ tick: 9 }), VIS, a, 0, { layers: [], sprites: false, palAnim: false }).cgram;
    expect([on[80], on[95], off[80], off[95]]).toEqual([0x7100, 0x710f, 80, 95]);
  });
});

describe('relógio visual (D6)', () => {
  it('TIME UP congela tudo em phaseT0, também no over seguinte', () => {
    const s = fakeRound({ tick: 560, phase: 'timeUp', phaseT0: 500 });
    const m = newMemo();
    expect(battleClock(s, m, 9)).toEqual({ tick: 500, bombTick: 500, frame: 9 });
    Object.assign(s, { phase: 'over', phaseT0: 660, tick: 700 });
    expect(battleClock(s, m, 9).tick).toBe(500);
  });
  it('vitória congela só as bombas', () => {
    expect(battleClock(fakeRound({ tick: 560, phase: 'won', phaseT0: 500 }), newMemo(), 0)).toEqual({ tick: 560, bombTick: 500, frame: 0 });
  });
  it('em jogo tudo segue o tick', () => {
    expect(battleClock(fakeRound({ tick: 42 }), newMemo(), 3)).toEqual({ tick: 42, bombTick: 42, frame: 3 });
  });
  it('a bomba congela na vitória e a chama segue', () => {
    const s = fakeRound({ tick: 560, phase: 'won', phaseT0: 500 });
    s.grid[1 * 17 + 2] = 0xc900;
    s.bombs.push({ id: 1, owner: 0, bad: false, cell: 19, x: 0, y: 0, fuse: 0, fire: 0, type: 0, state: 'idle',
      dir: 0, step: 0, kickedBy: -1, chainAt: 0, born: 480, turn: -1 });
    s.grid[1 * 17 + 3] = 0x1000;
    s.cellT0[1 * 17 + 3] = 558;
    const m = buildBattleFrame(s, VIS, fakeAssets(), 0, { layers: [], sprites: false }).bg2!.map;
    expect([m[1 * 32 + 2], m[1 * 32 + 3]]).toEqual([0x0b02, 0x0f8c]);
  });
  it('memória por rodada', () => {
    const s = fakeRound();
    expect(romMemo(s)).toBe(romMemo(s));
    expect(romMemo(fakeRound())).not.toBe(romMemo(s));
  });
});

describe('drawRomBattle', () => {
  it('desenha 256×224 com putImageData e reaproveita o ImageData', () => {
    const { c, put, create } = ctx();
    expect(drawRomBattle(c, fakeRound(), VIS, fakeAssets(), 0)).toBe(true);
    expect(drawRomBattle(c, fakeRound(), VIS, fakeAssets(), 1)).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledTimes(2);
    expect(put.mock.calls[0][0].width).toBe(256);
    expect(put.mock.calls[0][0].height).toBe(224);
  });
  it('devolve false se os assets falham (a tela usa o fallback); avisa uma vez por ROM', () => {
    const { c, put } = ctx();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bad = fakeAssets({ arenaThrows: true });
    expect(drawRomBattle(c, fakeRound(), VIS, bad, 0)).toBe(false);
    expect(drawRomBattle(c, fakeRound(), VIS, bad, 1)).toBe(false);
    expect(put).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);                                        // mesma ROM: 1 aviso só
    expect(drawRomBattle(c, fakeRound(), VIS, fakeAssets({ arenaThrows: true }), 0)).toBe(false);
    expect(warn).toHaveBeenCalledTimes(2);                                        // ROM trocada: avisa de novo (M1)
    warn.mockRestore();
  });
});

describe('isolamento de falhas por camada/gancho (M1)', () => {
  it('uma camada que lança não derruba o quadro nem troca para o fallback', () => {
    const s = fakeRound();
    s.grid[1 * 17 + 5] = 0xee80;
    const bad: RomBattleLayer = { id: 'ruim', draw: () => { throw new Error('camada com defeito'); } };
    const ok: RomBattleLayer = { id: 'ok', draw: (_s, b) => b.setBg2(6, 1, 0xabcd) };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = buildBattleFrame(s, VIS, fakeAssets(), 0, { layers: [bad, ok], sprites: false });
    expect(f.bg2!.map[1 * 32 + 5]).toBe(0x082e);   // a casa da camada boa (col 5, sem a camada ruim) segue normal
    expect(f.bg2!.map[1 * 32 + 6]).toBe(0xabcd);   // a camada boa, depois da ruim na lista, ainda roda
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
  it('avisa uma vez por camada; outra camada com defeito avisa de novo; ROM trocada reabre o aviso', () => {
    const a1 = fakeAssets();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bad1: RomBattleLayer = { id: 'a', draw: () => { throw new Error('a'); } };
    const bad2: RomBattleLayer = { id: 'b', draw: () => { throw new Error('b'); } };
    buildBattleFrame(fakeRound(), VIS, a1, 0, { layers: [bad1], sprites: false });
    buildBattleFrame(fakeRound(), VIS, a1, 1, { layers: [bad1], sprites: false });
    expect(warn).toHaveBeenCalledTimes(1);                       // mesma camada, mesma ROM: 1 só
    buildBattleFrame(fakeRound(), VIS, a1, 2, { layers: [bad2], sprites: false });
    expect(warn).toHaveBeenCalledTimes(2);                       // camada diferente: avisa de novo
    buildBattleFrame(fakeRound(), VIS, fakeAssets(), 3, { layers: [bad1], sprites: false });
    expect(warn).toHaveBeenCalledTimes(3);                       // ROM trocada: volta a avisar
    warn.mockRestore();
  });
  it('o quadro base (campo/HUD/jogadores) falhando ainda cai no fallback como hoje', () => {
    const { c, put } = ctx();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(drawRomBattle(c, fakeRound(), VIS, fakeAssets({ arenaThrows: true }), 0)).toBe(false);
    expect(put).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('tick visual para camadas e ganchos (M5, D6)', () => {
  it('uma camada recebe o tick já congelado depois do TIME UP, igual ao das camadas base', () => {
    const s = fakeRound({ tick: 560, phase: 'timeUp', phaseT0: 500 });
    let seen: number | null | undefined = null;
    const layer: RomBattleLayer = { id: 'tick', draw: (_s, _b, _a, _frame, tick) => { seen = tick; } };
    buildBattleFrame(s, VIS, fakeAssets(), 9, { layers: [layer], sprites: false });
    expect(seen).toBe(500);
    expect(visualTick(s)).toBe(500);
  });
  it('em jogo, o tick visual segue s.tick', () => {
    const s = fakeRound({ tick: 42 });
    let seen: number | null | undefined = null;
    const layer: RomBattleLayer = { id: 'tick', draw: (_s, _b, _a, _frame, tick) => { seen = tick; } };
    buildBattleFrame(s, VIS, fakeAssets(), 0, { layers: [layer], sprites: false });
    expect(seen).toBe(42);
    expect(visualTick(s)).toBe(42);
  });
});

interface GoldenEntry { stage: number; bg1Hofs: number; tileCopies: [number, number][]; sha1: string }
function loadGolden(): GoldenEntry[] {
  const f = fileURLToPath(new URL('../fixtures/rom/gfx-render-bg.json', import.meta.url));
  return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')).arenas as GoldenEntry[]) : [];
}
/** Setas (7), pads (8) e gangorras (9) como o golden do plano 5 (`staticObjects`) — o que as camadas do plano 8 farão. */
function writeStatic(b: RomBattleBuilder, a: RomAssets, stage: number): void {
  for (const o of staticObjects(a.rom, stage)) b.setBg2((o.off >> 1) % 32, (o.off >> 1) >> 5, o.word);
}

describe.skipIf(!ASSETS)('1ª imagem de cada arena, sem sprites = golden do plano 5 (§11, aceite 7)', () => {
  // O golden (plano 5, D7) é paridade com render_rom.py: HUD 3:00, rostos da ROM, coroas 0, cor 79 da ROM, sem OBJ,
  // CGRAM da ROM sem ciclo de paleta (arena 9: o quadro 0 do ciclo difere da cor 92 carregada).
  const golden = loadGolden();
  it('há golden para as 10 arenas (+ arena 2 com HOFS $18)', () => {
    expect(golden).toHaveLength(11);
    expect([...new Set(golden.map(g => g.stage))].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
  for (const g of golden) it(`arena ${g.stage} (HOFS do BG1 ${g.bg1Hofs})`, () => {
    const s = newRound(g.stage);
    s.clock.sec = 180;   // o golden mostra 3:00
    const layers: RomBattleLayer[] = [{
      id: 'golden',
      draw: (_s, b, a) => { b.bg1Scroll(g.bg1Hofs); writeStatic(b, a as RomAssets, g.stage); },
    }];
    const f = buildBattleFrame(s, { crowns: [0, 0, 0, 0, 0] }, ASSETS!, 0,
      { sprites: false, hudHeads: false, blink: false, palAnim: false, layers, tileCopies: g.tileCopies });
    const img = blankImage();
    renderPpu(f, img);
    expect(createHash('sha1').update(img.data).digest('hex')).toBe(g.sha1);
  });
});
