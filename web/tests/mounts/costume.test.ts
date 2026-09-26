import { createHash } from 'node:crypto';
import fx from '../fixtures/rom/mount-render.json';
import { ASSETS } from './rom-helpers';
import { mkRound, placePx, ride, cx, cy } from './helpers';
import { costumeHook } from '../../src/render/rom/mounts/costume';
import { costumePix } from '../../src/render/fallback/mounts/costume-art';
import { fallbackCostumeSprites } from '../../src/render/fallback/mounts/costume';
import { DISEASE } from '../../src/core/types';
import { invisibleVisible } from '../../src/core/disease';

const sha1 = (b: Uint8Array) => createHash('sha1').update(b).digest('hex');
const hash = (p: { data: Uint8ClampedArray }) => Array.from(p.data).join(',');

describe('traje (fallback)', () => {
  it('8 trajes distintos, 16×10', () => {
    const set = new Set<string>();
    for (let c = 0; c < 8; c++) { const p = costumePix(c); expect([p.w, p.h]).toEqual([16, 10]); set.add(hash(p)); }
    expect(set.size).toBe(8);
  });
  it('sprite sobre a cabeça só com traje e vivo', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(7), cy(5));
    expect(fallbackCostumeSprites(s)).toHaveLength(0);
    p.costume = 5;
    expect(fallbackCostumeSprites(s)).toEqual([expect.objectContaining({ key: 'costume:5', x: cx(7) - 8, y: cy(5) - 26 })]);
    p.state = 'dying';
    expect(fallbackCostumeSprites(s)).toHaveLength(0);
  });
  it('I4: o chapéu some junto com o jogador (piscando ou invisível pela doença $29)', () => {
    const s = mkRound({ stage: 10 });
    const p = placePx(s, 0, cx(7), cy(5));
    p.costume = 5;
    p.inv = 2;
    expect(fallbackCostumeSprites(s)).toHaveLength(0);
    p.inv = 1;
    expect(fallbackCostumeSprites(s)).toHaveLength(1);
    p.inv = 0; p.disease = DISEASE.INVISIBLE;
    p.diseaseT = [...Array(256).keys()].find(t => { p.diseaseT = t; return !invisibleVisible(p); })!;
    expect(fallbackCostumeSprites(s)).toHaveLength(0);
  });
});

describe.skipIf(!ASSETS)('traje (ROM) × emulador', () => {
  for (let c = 0; c < 8; c++) it(`traje ${c} parado para a direita = OAM medida na fase 10`, () => {
    const s = mkRound({ stage: 10 });
    const p = placePx(s, 0, cx(7), cy(5));
    p.costume = c; p.face = 2; p.act = 'idle'; p.actT0 = s.tick; p.moveDir = 8;
    const got = costumeHook(s, p, ASSETS!, s.tick, s.tick)!;
    const exp = (fx.costumes as Record<string, { right: { idle: { pieces: { dx: number; dy: number; pxSha1: string }[] }[] } }>)[String(c)].right.idle.at(-1)!.pieces;
    expect(got.map(e => `${e.x - cx(7)},${e.y - cy(5)},${sha1((e.src as { px: Uint8Array }).px)}`).sort())
      .toEqual(exp.map(q => `${q.dx},${q.dy},${q.pxSha1}`).sort());
  });
  it('montado: o gancho do traje não interfere', () => {
    const s = mkRound({ stage: 10 });
    const p = placePx(s, 0, cx(7), cy(5));
    p.costume = 2; ride(s, 0, 0x3);
    expect(costumeHook(s, p, ASSETS!, s.tick, s.tick)).toBeNull();
  });
});
