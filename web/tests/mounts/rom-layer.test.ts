import { createHash } from 'node:crypto';
import fx from '../fixtures/rom/mount-render.json';
import { ASSETS } from './rom-helpers';
import { mkRound, placePx, ride, cx, cy } from './helpers';
import { riderHook } from '../../src/render/rom/mounts/rider';
import { mountRomSprites } from '../../src/render/rom/mounts/sprites';
import type { ObjEntry } from '../../src/render/ppu';

const sha1 = (b: Uint8Array) => createHash('sha1').update(b).digest('hex');
const DIRS = ['up', 'right', 'down', 'left'] as const;
const FACE = { up: 0, right: 2, down: 4, left: 6 } as const;
type FxPiece = { dx: number; dy: number; size: number; hflip: boolean; vflip: boolean; pxSha1: string };
const norm = (ps: FxPiece[]) => ps.map(p => `${p.dx},${p.dy},${p.size},${+p.hflip},${+p.vflip},${p.pxSha1}`).sort();
function facts(es: ObjEntry[], X: number, Y: number) {
  return norm(es.map(e => ({ dx: e.x - X, dy: e.y - Y, size: e.size, hflip: e.hflip, vflip: e.vflip, pxSha1: sha1((e.src as { px: Uint8Array }).px) })));
}

describe.skipIf(!ASSETS)('camada ROM das montarias × emulador', () => {
  for (const t of ['2', '3', 'a', 'c', 'd', 'e', 'f']) for (const d of DIRS) {
    it(`montado tipo ${t} parado olhando ${d} = OAM medida`, () => {
      const s = mkRound();
      const p = placePx(s, 0, cx(7), cy(5));
      p.face = FACE[d]; p.act = 'idle'; p.actT0 = s.tick; p.moveDir = 8;
      ride(s, 0, parseInt(t, 16));
      const exp = (fx.riders as Record<string, Record<string, { idle: { pieces: FxPiece[] }[] }>>)[t][d].idle.at(-1)!.pieces;
      const got = riderHook(s, p, ASSETS!, s.tick)!;
      expect(got).not.toBeNull();
      expect(facts(got, cx(7), cy(5))).toEqual(norm(exp));
    });
  }
  it('andando: a sequência de quadros distintos bate com a medida (tipo 3, direita)', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(7), cy(5));
    p.face = 2; p.act = 'walk'; p.actT0 = s.tick; p.moveDir = 2;
    ride(s, 0, 0x3);
    const seq: string[] = [];
    for (let i = 0; i < 24; i++) { const k = facts(riderHook(s, p, ASSETS!, s.tick)!, cx(7), cy(5)).join('|'); if (seq.at(-1) !== k) seq.push(k); s.tick++; }
    const exp: string[] = [];
    for (const smp of fx.riders['3'].right.walk) { const k = norm(smp.pieces as FxPiece[]).join('|'); if (exp.at(-1) !== k) exp.push(k); }
    expect(seq).toEqual(exp);
  });
  it('ovo no chão: peças medidas em st_ride_pre', () => {
    const g = fx.eggs[0];
    const s = mkRound();
    s.grid[5 * 17 + 7] = 0x0970 | (g.id & 0xf);
    const got = mountRomSprites(s, ASSETS!, s.tick).map(x => x.e);
    expect(facts(got, 16 * 7, 16 * (5 + 2))).toEqual(norm(g.samples[0].pieces as FxPiece[]));
  });
  it('sem montaria, sem traje: o gancho não troca o jogador', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(7), cy(5));
    expect(riderHook(s, p, ASSETS!, s.tick)).toBeNull();
  });
});
