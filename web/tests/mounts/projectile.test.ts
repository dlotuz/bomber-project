import { mkRound, placePx, cx, cy } from './helpers';
import { spawnProjectile, advanceProjectile, hasFlying, D_SPEC, E_SPEC, F_SPEC, type ProjSpec } from '../../src/core/mounts/projectile';
import { cellOf } from '../../src/core/mounts/core-api';
import type { ProjKind } from '../../src/core/mounts/types';

function firstHit(spec: ProjSpec, kind: ProjKind, targetPx: number, max = 300): number {
  const s = mkRound({ players: [0, 2] });
  const p = placePx(s, 0, 32, 47); p.face = 2;
  placePx(s, 2, targetPx, 47);
  const pr = spawnProjectile(s, p, kind);
  for (let k = 1; k <= max; k++) {
    s.tick++;
    const r = advanceProjectile(s, pr, spec);
    if (r.kind === 'player') { expect(r.slot).toBe(2); return k; }
    if (r.kind === 'block') return -k;
  }
  return 0;
}

describe('projéteis das montarias (calibrados no emulador)', () => {
  it('E (2 px/tick): acerta alvos a 1, 2, 3, 4 casas em k = 1, 11, 19, 27', () => {
    expect([1, 2, 3, 4].map(d => firstHit(E_SPEC, 0xe, 32 + 16 * d))).toEqual([1, 11, 19, 27]);
  });
  it('D (2 px/tick): alvo a 5 casas é atingido em k = 34', () => {
    expect(firstHit(D_SPEC, 0xd, 32 + 80)).toBe(34);
  });
  it('F (0,5 px/tick): alvo a 40 px é atingido em k = 79', () => {
    expect(firstHit(F_SPEC, 0xf, 72)).toBe(79);
  });
  it('F: alvo a 56 px é atingido em k = 111 (conferido no emulador: mount_vs.py F Y 88)', () => {
    expect(firstHit(F_SPEC, 0xf, 88)).toBe(111);
  });
  it('bloqueio: da col 2 para a direita, soft em (5,1) → para no centro da (4,1) em k = 16', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1)); p.face = 2;
    s.grid[cellOf(5, 1)] = 0xcc80;
    const pr = spawnProjectile(s, p, 0xd);
    let res = null as ReturnType<typeof advanceProjectile> | null, k = 0;
    while (k < 100) { k++; s.tick++; res = advanceProjectile(s, pr, D_SPEC); if (res.kind !== 'none') break; }
    expect(res).toEqual({ kind: 'block', cell: cellOf(4, 1) });
    expect(k).toBe(16);
    expect(pr.x).toBe(63 * 256);
  });
  it('item e chama não bloqueiam (bit 15 = 0)', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1)); p.face = 2;
    s.grid[cellOf(4, 1)] = 0x0941; s.grid[cellOf(5, 1)] = 0x1000;
    const pr = spawnProjectile(s, p, 0xd);
    for (let k = 1; k <= 40; k++) { s.tick++; expect(advanceProjectile(s, pr, D_SPEC).kind).toBe('none'); }
  });
  it('fora da faixa (outra linha) não acerta; o dono não é atingido; morrendo não é atingido', () => {
    const s = mkRound({ players: [0, 1, 2] });
    const p = placePx(s, 0, 32, 47); p.face = 2;
    placePx(s, 1, 64, 47 + 16);
    const q = placePx(s, 2, 80, 47); q.state = 'dying';
    const pr = spawnProjectile(s, p, 0xe);
    for (let k = 1; k <= 28; k++) { s.tick++; expect(advanceProjectile(s, pr, E_SPEC).kind).not.toBe('player'); }
  });
  it('para cima diminui Y', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(9)); p.face = 0;
    const pr = spawnProjectile(s, p, 0xe);
    s.tick++; advanceProjectile(s, pr, E_SPEC);
    expect(pr.y).toBe(p.y - 512);
    expect(pr.x).toBe(p.x);
  });
  it('hasFlying: só projéteis em voo do dono e do tipo', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1)); p.face = 2;
    const pr = spawnProjectile(s, p, 0xf);
    expect(hasFlying(s, 0, 0xf)).toBe(true);
    expect(hasFlying(s, 0, 0xe)).toBe(false);
    pr.state = 'cloud';
    expect(hasFlying(s, 0, 0xf)).toBe(false);
  });
});
