import { invincibleHidden, pressureSprite, skullBlack } from '../../src/render/anim/effects';
import { FrameBuilder } from '../../src/render/rom/builder';
import { PLAYER_OBJ_PAL, drawSprites, tile16Px } from '../../src/render/rom/sprites';
import { romTables } from '../../src/render/rom/tables';
import { newMemo, type RomScene } from '../../src/render/rom/scene';
import { romPlayerHooks } from '../../src/render/battle-layers';
import { invisibleVisible, type RoundState } from '../../src/core';
import type { ObjEntry } from '../../src/render/ppu';
import { fakeAssets, fakeRound, fakeTiles } from './fakes';

function run(s: RoundState, o: { tick?: number; frame?: number; scene?: Partial<RomScene> } = {}) {
  const a = fakeAssets();
  const b = new FrameBuilder(new Uint16Array(1024), new Uint16Array(1024), new Uint16Array(256));
  const tick = o.tick ?? s.tick;
  const scene: RomScene = { gridBombs: new Map(), objs: [], drops: [], flame: () => 'center', burn: () => 'soft', team: false, ...o.scene };
  drawSprites(b, { s, a, tb: romTables(a), scene, clock: { tick, bombTick: tick, frame: o.frame ?? 0 }, memo: newMemo(), tiles: a.arena(1).bgTiles });
  return { a, b, oam: b.oam() };
}
const ofSlot = (oam: ObjEntry[], slot: number) => oam.filter(e => e.size === 32 && e.pal === PLAYER_OBJ_PAL[slot]);
const gOf = (a: ReturnType<typeof fakeAssets>, e: ObjEntry, char: number) => {
  const px = (e.src as { px: Uint8Array }).px;
  for (let g = 0; g < 256; g++) if (a.character(char).frame(g) === px) return g;
  return -1;
};
const only = (s: RoundState, slot: number) => s.players.forEach((p, i) => { p.present = i === slot; });

describe('efeitos', () => {
  it('caveira: preto quando frame & 4 (4/4)', () => {
    expect([0, 3, 4, 7, 8].map(skullBlack)).toEqual([false, false, true, true, false]);
  });
  it('invencível: some quando inv & 2', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(invincibleHidden)).toEqual([false, false, true, true, false, false, true]);
  });
  it('pressão lin 1, t0 100, pouso 138 (D11)', () => {
    const at = (t: number) => pressureSprite({ t0: 100, land: 138 }, 1, t);
    expect(at(99)).toEqual({ shadow: false, blockY: null });
    expect(at(100)).toEqual({ shadow: true, blockY: null });
    expect(at(132)).toEqual({ shadow: true, blockY: null });
    expect([133, 134, 135, 136, 137, 138, 139].map(t => at(t).blockY)).toEqual([0, 8, 16, 24, 32, 40, 40]);
    expect(at(140)).toEqual({ shadow: false, blockY: null });
  });
  it('pressão lin 11: bloco 8 px acima da casa no tick anterior ao pouso', () => {
    expect(pressureSprite({ t0: 0, land: 58 }, 11, 57).blockY).toBe(192);
    expect(pressureSprite({ t0: 0, land: 58 }, 11, 58).blockY).toBe(200);
  });
});

describe('jogadores', () => {
  it('5 jogadores em (X−16, Y−24), 32×32, prioridade 2, ordenados por Y; paletas nas OBJ 0,1,4,5,6', () => {
    const { a, b, oam } = run(fakeRound());
    expect(oam.map(e => PLAYER_OBJ_PAL.indexOf(e.pal as 0))).toEqual([1, 3, 4, 0, 2]);
    const p1 = ofSlot(oam, 0)[0];
    expect([p1.x, p1.y, p1.size, p1.prio]).toEqual([16, 24, 32, 2]);
    expect(gOf(a, p1, 0)).toBe(12);                        // parado ↓ = índice 12 (anim falsa: g = índice)
    for (let slot = 0; slot < 5; slot++) expect(b.cg[128 + 16 * PLAYER_OBJ_PAL[slot] + 3]).toBe((slot << 12) | (slot << 8) | 3);
  });
  it('ausente e out não desenham', () => {
    const s = fakeRound();
    s.players[1].present = false;
    s.players[2].state = 'out';
    const { oam } = run(s);
    expect([ofSlot(oam, 1).length, ofSlot(oam, 2).length]).toEqual([0, 0]);
  });
  it('andar →: g4:12 g3:8 g5:12 g3:8 a partir do actT0', () => {
    const s = fakeRound();
    only(s, 0);
    Object.assign(s.players[0], { act: 'walk', face: 2, actT0: 50, moveDir: 2 });
    const g = (t: number) => { const r = run(s, { tick: t }); return gOf(r.a, r.oam[0], 0); };
    expect([50, 61, 62, 69, 70, 82, 89, 90].map(g)).toEqual([4, 4, 3, 3, 5, 3, 3, 4]);
  });
  it('morte: g24…g27 e some depois de 22 ticks (D15)', () => {
    const s = fakeRound();
    only(s, 0);
    Object.assign(s.players[0], { act: 'dying', state: 'dying', actT0: 100 });
    const g = (t: number) => { const r = run(s, { tick: t }); return r.oam.length ? gOf(r.a, r.oam[0], 0) : null; };
    expect([100, 105, 110, 116, 121, 122].map(g)).toEqual([24, 25, 26, 27, 27, null]);
  });
  it('invencível pisca 2/2; invisível segue o núcleo', () => {
    const s = fakeRound();
    only(s, 0);
    s.players[0].inv = 2;
    expect(run(s).oam).toHaveLength(0);
    s.players[0].inv = 4;
    expect(run(s).oam).toHaveLength(1);
    s.players[0].inv = 0;
    s.players[0].disease = 0x29;
    for (const t of [1, 2, 130, 500]) {
      s.players[0].diseaseT = t;
      expect(run(s).oam.length).toBe(invisibleVisible(s.players[0]) ? 1 : 0);
    }
  });
  it('caveira: paleta preta com frame & 4; $29 não escurece; time usa $C2:7B9D', () => {
    const s = fakeRound();
    only(s, 0);
    s.players[0].disease = 0x21;
    expect(Array.from(run(s, { frame: 4 }).b.cg.slice(128, 144)).every(c => c === 0)).toBe(true);
    expect(run(s, { frame: 0 }).b.cg[128 + 3]).toBe(3);
    s.players[0].disease = 0x29;
    s.players[0].diseaseT = 2;
    expect(run(s, { frame: 4 }).b.cg[128 + 3]).toBe(3);
    s.players[0].disease = 0;
    expect(run(s, { scene: { team: true } }).b.cg[128 + 3]).toBe(0x0103);
  });
  it('gancho do plano 9 substitui o desenho padrão', () => {
    const s = fakeRound();
    only(s, 0);
    const mark: ObjEntry = { x: 7, y: 7, size: 16, pal: 0, prio: 2, hflip: false, vflip: false, src: { tile: 1 } };
    romPlayerHooks.push(() => [mark]);
    try { expect(run(s).oam).toEqual([mark]); } finally { romPlayerHooks.pop(); }
  });
  it('Bad Bomber: desenhado de s.bad com a folha do slot, andando (D20)', () => {
    const s = fakeRound();
    only(s, 3);
    s.players[3].state = 'bad';
    s.bad.push({ slot: 3, x: 15, y: 120, phase: 'patrol', face: 2, live: -1, readyAt: 0, born: 0 });
    const { a, oam } = run(s, { tick: 0 });
    expect(oam).toHaveLength(1);
    expect([oam[0].x, oam[0].y, oam[0].pal]).toEqual([-1, 96, 5]);
    expect(gOf(a, oam[0], 3)).toBe(4);
  });
});

describe('objetos e pressão', () => {
  it('bomba em movimento: tile $180, paleta 7, 16×16, sortY = y − z', () => {
    const s = fakeRound();
    only(s, 0);
    s.players[0].y = 75 * 256;
    const bomb = { kind: 'bomb' as const, item: 0, x: 100, y: 80, z: 6 };
    const { oam } = run(s, { scene: { objs: [bomb] } });
    expect(oam[1]).toEqual({ x: 92, y: 66, size: 16, pal: 7, prio: 2, hflip: false, vflip: false, src: { tile: 0x180 } });
    s.players[0].y = 73 * 256;
    expect(run(s, { scene: { objs: [bomb] } }).oam[0].src).toEqual({ tile: 0x180 });
  });
  it('item voando: paleta OBJ 2 e pixels do tile de BG do item (D12)', () => {
    const s = fakeRound();
    only(s, -1);
    const { a, oam } = run(s, { scene: { objs: [{ kind: 'item', item: 1, x: 50, y: 60, z: 0 }] } });
    expect([oam[0].x, oam[0].y, oam[0].pal]).toEqual([42, 52, 2]);
    expect((oam[0].src as { px: Uint8Array }).px).toEqual(tile16Px(a.arena(1).bgTiles, 0x1280));
  });
  it('tile16Px: tiles n, n+1, n+16, n+17 e flips', () => {
    const t = fakeTiles(1024, i => i & 0xff);
    const p = tile16Px(t, 0x1280);
    expect([p[0], p[8], p[128], p[255]]).toEqual([0x80, 0x81, 0x90, 0x91]);
    expect(tile16Px(t, 0x5280)[0]).toBe(0x81);
    expect(tile16Px(t, 0x9280)[0]).toBe(0x90);
  });
  it('pressão: sombra na casa; bloco cai na frente dela', () => {
    const s = fakeRound();
    only(s, -1);
    const drops = [{ cell: 19, t0: 100, land: 138 }];
    const at = (t: number) => run(s, { tick: t, scene: { drops } }).oam.map(e => [e.x, e.y, (e.src as { tile: number }).tile, e.pal]);
    expect(at(100)).toEqual([[24, 40, 0x4e, 7]]);
    expect(at(133)).toEqual([[24, 0, 0x4c, 7], [24, 40, 0x4e, 7]]);
    expect(at(140)).toEqual([]);
  });
});
