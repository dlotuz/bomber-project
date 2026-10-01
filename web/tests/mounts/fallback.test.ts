import { mkRound, placePx, ride, cx, cy } from './helpers';
import { MOUNT_LOOK, mountPix, eggPix, shotPix } from '../../src/render/fallback/mounts/art';
import { fallbackMountSprites } from '../../src/render/fallback/mounts/sprites';
import { mstate } from '../../src/core/mounts/types';
import { cellOf } from '../../src/core/mounts/core-api';
import { DISEASE } from '../../src/core/types';
import { invisibleVisible } from '../../src/core/disease';

const opaque = (p: { data: Uint8ClampedArray }) => { let n = 0; for (let i = 3; i < p.data.length; i += 4) if (p.data[i]) n++; return n; };
const hash = (p: { data: Uint8ClampedArray }) => Array.from(p.data).join(',');
const TYPES = [0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x9, 0xa, 0xb, 0xc, 0xd, 0xe, 0xf];

describe('arte das montarias (fallback)', () => {
  it('13 tipos × 4 direções × 2 passos: 24×20 com corpo', () => {
    expect(Object.keys(MOUNT_LOOK).map(Number).sort((a, b) => a - b)).toEqual(TYPES);
    for (const t of TYPES) for (const f of [0, 2, 4, 6] as const) for (const st of [0, 1]) {
      const p = mountPix(t, f, st);
      expect([p.w, p.h]).toEqual([24, 20]);
      expect(opaque(p)).toBeGreaterThan(120);
    }
  });
  it('tipos diferentes têm desenhos diferentes', () => {
    const set = new Set(TYPES.map(t => hash(mountPix(t, 4, 0))));
    expect(set.size).toBe(TYPES.length);
  });
  it('ovos 16×16 nas duas artes; projéteis e nuvem', () => {
    for (const k of [0, 1] as const) { const e = eggPix(k, 0); expect([e.w, e.h]).toEqual([16, 16]); expect(opaque(e)).toBeGreaterThan(60); }
    expect(hash(eggPix(0, 0))).not.toBe(hash(eggPix(1, 0)));
    expect([shotPix(0xe, 'fly', 0).w, shotPix(0xe, 'fly', 0).h]).toEqual([8, 8]);
    expect([shotPix(0xf, 'fly', 0).w, shotPix(0xf, 'fly', 0).h]).toEqual([8, 12]);
    expect([shotPix(0xe, 'cloud', 0).w, shotPix(0xe, 'cloud', 0).h]).toEqual([16, 12]);
  });
});

describe('sprites da camada fallback', () => {
  it('ovo na grade na posição da casa', () => {
    const s = mkRound();
    s.grid[cellOf(6, 1)] = 0x0972; s.grid[cellOf(6, 3)] = 0x097c;
    const sp = fallbackMountSprites(s, 0);
    expect(sp.find(x => x.key.startsWith('egg:0'))).toMatchObject({ x: 88, y: 40 });
    expect(sp.find(x => x.key.startsWith('egg:1'))).toMatchObject({ x: 88, y: 72 });
  });
  it('montador riding: montaria em (X−12, Y−12)', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1)); p.face = 2;
    ride(s, 0, 0x3);
    const m = fallbackMountSprites(s, 0).find(x => x.key.startsWith('mount:3:'));
    expect(m).toMatchObject({ x: 31 - 12, y: 47 - 12 });
  });
  it('montando: ovo na casa; desmontando sem reserva: nada; com reserva: ovo', () => {
    const s = mkRound();
    placePx(s, 0, cx(2), cy(1));
    const r = ride(s, 0, 0x3, { phase: 'mounting' });
    expect(fallbackMountSprites(s, 0).some(x => x.key.startsWith('egg:'))).toBe(true);
    r.phase = 'dismount'; r.remount = false;
    expect(fallbackMountSprites(s, 0)).toHaveLength(0);
    r.remount = true;
    expect(fallbackMountSprites(s, 0).some(x => x.key.startsWith('egg:'))).toBe(true);
  });
  it('reservas atrás do montador, na trilha', () => {
    const s = mkRound();
    placePx(s, 0, cx(4), cy(1));
    ride(s, 0, 0x3, { reserves: [0x2, 0x3], trail: [cellOf(4, 1), cellOf(3, 1), cellOf(2, 1)] });
    const eggs = fallbackMountSprites(s, 0).filter(x => x.key.startsWith('egg:'));
    expect(eggs.map(e => [e.x, e.y])).toEqual([[40, 40], [24, 40]]);
  });
  it('não escreve em s.mountState (camada de desenho é só leitura)', () => {
    const s = mkRound();
    expect(s.mountState).toBeNull();
    fallbackMountSprites(s, 0);
    expect(s.mountState).toBeNull();
  });
  // Revisão final I4: a montaria é a 2ª anim do objeto do jogador na ROM e some junto com ele (draw-game.ts: invisível
  // pela doença $29 ou piscando com inv & 2). Reservas e projéteis são objetos próprios e continuam visíveis.
  it('I4: montaria e ovo de montar/remontar somem com o jogador (invisível ou piscando); reservas ficam', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(4), cy(1)); p.face = 2;
    const r = ride(s, 0, 0x3, { reserves: [0x2], trail: [cellOf(4, 1), cellOf(3, 1)] });
    const keys = () => fallbackMountSprites(s, 0).map(x => x.key.split(':')[0]);
    expect(keys().sort()).toEqual(['egg', 'mount']);
    p.inv = 2;                                                  // piscando: jogador escondido neste tick
    expect(keys()).toEqual(['egg']);                            // só a reserva
    p.inv = 1;
    expect(keys().sort()).toEqual(['egg', 'mount']);
    p.inv = 0; p.disease = DISEASE.INVISIBLE;
    p.diseaseT = [...Array(256).keys()].find(t => { p.diseaseT = t; return !invisibleVisible(p); })!;
    expect(keys()).toEqual(['egg']);
    r.phase = 'mounting';
    expect(fallbackMountSprites(s, 0)).toHaveLength(0);
    r.phase = 'dismount'; r.remount = true; r.reserves = [];
    expect(fallbackMountSprites(s, 0)).toHaveLength(0);
    p.disease = 0;
    expect(fallbackMountSprites(s, 0).map(x => x.key.split(':')[0])).toEqual(['egg']);
  });
  it('L22: reserva queimada vira um ovo piscando na casa enquanto a explosão existe no core (40 ticks)', () => {
    const s = mkRound();
    s.mountState = { projectiles: [], nextId: 1, bursts: [{ cell: cellOf(6, 1), t0: 0, mount: 2 }] };
    expect(fallbackMountSprites(s, 8)).toEqual([expect.objectContaining({ key: 'egg:0:1', x: 88 + 1, y: 40 })]);
    expect(fallbackMountSprites(s, 0)).toEqual([expect.objectContaining({ key: 'egg:0:0', x: 88, y: 40 })]);
  });
  it('projéteis: E em voo e nuvem, F e D', () => {
    const s = mkRound();
    const ms = mstate(s);
    ms.projectiles.push({ id: 1, kind: 0xe, owner: 0, x: 100 * 256, y: 47 * 256, dir: 2, born: 0, state: 'fly', t: 0, slot: 0 });
    ms.projectiles.push({ id: 2, kind: 0xe, owner: 0, x: 60 * 256, y: 47 * 256, dir: 2, born: 0, state: 'cloud', t: 0, slot: 0 });
    ms.projectiles.push({ id: 3, kind: 0xd, owner: 1, x: 150 * 256, y: 79 * 256, dir: 6, born: 0, state: 'fly', t: 0, slot: 2 });
    const sp = fallbackMountSprites(s, 0);
    expect(sp.find(x => x.key.startsWith('shot:e:fly'))).toMatchObject({ x: 96, y: 43 });
    expect(sp.find(x => x.key.startsWith('shot:e:cloud'))).toMatchObject({ x: 52, y: 41 });
    expect(sp.find(x => x.key.startsWith('mount:13:'))).toMatchObject({ x: 138, y: 67 });
  });
});
