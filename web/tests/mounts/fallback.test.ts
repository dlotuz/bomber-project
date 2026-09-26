import { mkRound, placePx, ride, cx, cy } from './helpers';
import { MOUNT_LOOK, mountPix, eggPix, shotPix } from '../../src/render/fallback/mounts/art';
import { fallbackMountSprites } from '../../src/render/fallback/mounts/sprites';
import { mstate } from '../../src/core/mounts/types';
import { cellOf } from '../../src/core/mounts/core-api';

const opaque = (p: { data: Uint8ClampedArray }) => { let n = 0; for (let i = 3; i < p.data.length; i += 4) if (p.data[i]) n++; return n; };
const hash = (p: { data: Uint8ClampedArray }) => Array.from(p.data).join(',');
const TYPES = [0x2, 0x3, 0xa, 0xc, 0xd, 0xe, 0xf];

describe('arte das montarias (fallback)', () => {
  it('7 tipos × 4 direções × 2 passos: 24×20 com corpo', () => {
    expect(Object.keys(MOUNT_LOOK).map(Number).sort((a, b) => a - b)).toEqual(TYPES);
    for (const t of TYPES) for (const f of [0, 2, 4, 6] as const) for (const st of [0, 1]) {
      const p = mountPix(t, f, st);
      expect([p.w, p.h]).toEqual([24, 20]);
      expect(opaque(p)).toBeGreaterThan(120);
    }
  });
  it('tipos diferentes têm desenhos diferentes', () => {
    const set = new Set(TYPES.map(t => hash(mountPix(t, 4, 0))));
    expect(set.size).toBe(7);
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
