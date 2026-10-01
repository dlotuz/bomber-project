import { mkRound, placePx, cx, cy } from './helpers';
import { spawnProjectile, spawnShot, advanceProjectile, hasFlying, shotInPlay, D_SPEC, E_SPEC, F_SPEC, SPEC_OF, SHOT_END_TICKS } from '../../src/core/mounts/projectile';
import { cellOf } from '../../src/core/mounts/core-api';
import type { RoundState } from '../../src/core/types';
import type { MountProjectile, ProjKind } from '../../src/core/mounts/types';

// Todos os números abaixo foram medidos no emulador (quadro f do mount_vs.py = k), montador em (32, 47) olhando →.
// Scripts e tabelas: relatório da T3 do plano 9.

interface Flight { k: number; res: ReturnType<typeof advanceProjectile>; pr: MountProjectile; stop: number }

/** Voa até o 1º resultado ≠ none; `stop` = k em que o D parou (pr.t > born), −1 se não parou. `during(s, k)` roda
 *  antes do avanço de cada tick (para mudar a grade no meio do voo). */
function fly(kind: ProjKind, setup: (s: RoundState) => void = () => {}, ownerX = 32, ownerY = 47, max = 400,
  during: (s: RoundState, k: number) => void = () => {}): Flight {
  const s = mkRound({ players: [0, 2] });
  placePx(s, 2, cx(14), cy(11));                          // alvo fora do caminho, salvo se o setup mover
  const p = placePx(s, 0, ownerX, ownerY); p.face = 2;
  setup(s);
  const pr = spawnProjectile(s, p, kind);
  let stop = -1;
  for (let k = 1; k <= max; k++) {
    s.tick++;
    during(s, k);
    const res = advanceProjectile(s, pr, SPEC_OF[kind]);
    if (stop < 0 && pr.t > pr.born) stop = k;
    if (res.kind !== 'none') return { k, res, pr, stop };
  }
  return { k: 0, res: { kind: 'none' }, pr, stop };
}
const at = (x: number, y = 47) => (s: RoundState) => { placePx(s, 2, x, y); };
const hitK = (kind: ProjKind, x: number, y = 47): number => {
  const f = fly(kind, at(x, y));
  return f.res.kind === 'player' && f.res.slot === 2 ? f.k : -f.k;
};

describe('projéteis das montarias: E (2 px/tick, acerta ao entrar na casa do alvo)', () => {
  it('alvos a 1, 2, 3, 4 casas: k = 3, 11, 19, 27 (mount_e.py)', () => {
    expect([1, 2, 3, 4].map(d => hitK(0xe, 32 + 16 * d))).toEqual([3, 11, 19, 27]);
  });
  it('fora do centro da casa vale a casa: 40/52 → 3; 56/60/64/68 → 11; 72 → 19; 88 → 27; 104 → 35', () => {
    expect([40, 52].map(x => hitK(0xe, x))).toEqual([3, 3]);
    expect([56, 60, 64, 68].map(x => hitK(0xe, x))).toEqual([11, 11, 11, 11]);
    expect([72, 88, 104].map(x => hitK(0xe, x))).toEqual([19, 27, 35]);
  });
  it('transversal por casa: alvo em (63, 55) (linha 1) é atingido em 11; em (63, 56) (linha 2) não', () => {
    expect(hitK(0xe, 63, 55)).toBe(11);
    expect(fly(0xe, at(63, 56)).res.kind).toBe('block');
  });
  it('posição igual à da ROM: X + 2 no tick do Y e + 2 px por tick', () => {
    const f = fly(0xe, at(64));
    expect(f.pr.x).toBe(56 * 256);                          // nuvem da ROM em x = 56 no k = 11
  });
  it('bloco: soft em (6,1) → vira nuvem em k = 23 com x = 80 (sem ajuste ao centro)', () => {
    const f = fly(0xe, s => { s.grid[cellOf(6, 1)] = 0xcc80; });
    expect(f.res).toEqual({ kind: 'block', cell: cellOf(5, 1) });
    expect(f.k).toBe(23);
    expect(f.pr.x).toBe(80 * 256);
  });
  it('sem alvo voa até a parede: k = 95, x = 224 (medido na linha 5)', () => {
    const f = fly(0xe);
    expect(f.res).toEqual({ kind: 'block', cell: cellOf(14, 1) });
    expect(f.k).toBe(95);
    expect(f.pr.x).toBe(224 * 256);
  });
});

describe('projéteis das montarias: F (0,5 px/tick, testa depois de andar, como a ROM)', () => {
  // A nota acaba quando o centro entra na casa do alvo (objeto final $C1:30FC no k = 78 para o alvo a 72 px); o
  // alvo só dança no k + 1 (79, vs_F_Y_*): o typeF aplica a dança um tick depois do resultado.
  it('alvos em 72, 76, 80 (col 5) → k = 78; 64 → 46; 88 → 110 (dança em 79/47/111, vs_F_Y_*)', () => {
    expect([72, 76, 80].map(x => hitK(0xf, x))).toEqual([78, 78, 78]);
    expect(hitK(0xf, 64)).toBe(46);
    expect(hitK(0xf, 88)).toBe(110);
  });
  it('transversal por casa: (63, 55) → 46; (63, 56) não acerta', () => {
    expect(hitK(0xf, 63, 55)).toBe(46);
    expect(fly(0xf, at(63, 56)).res.kind).toBe('block');
  });
  it('posição igual à da ROM: 33, 33, 34, 34 px nos k = 0..3; no acerto a 72 fica em 72', () => {
    const s = mkRound();
    const p = placePx(s, 0, 32, 47); p.face = 2;
    const pr = spawnProjectile(s, p, 0xf);
    const xs = [Math.floor(pr.x / 256)];
    for (let k = 1; k <= 3; k++) { s.tick++; advanceProjectile(s, pr, F_SPEC); xs.push(Math.floor(pr.x / 256)); }
    expect(xs).toEqual([33, 33, 34, 34]);
    expect(Math.floor(fly(0xf, at(72)).pr.x / 256)).toBe(72);
  });
  it('bloco: soft em (4,1) → k = 31 (x = 48); soft em (6,1) → k = 95 (x = 80)', () => {
    const a = fly(0xf, s => { s.grid[cellOf(4, 1)] = 0xcc80; });
    expect([a.res.kind, a.k, Math.floor(a.pr.x / 256)]).toEqual(['block', 31, 48]);
    const b = fly(0xf, s => { s.grid[cellOf(6, 1)] = 0xcc80; });
    expect([b.res.kind, b.k, Math.floor(b.pr.x / 256)]).toEqual(['block', 95, 80]);
  });
});

describe('projéteis das montarias: D (2 px/tick, para antes do adversário ou do bloco e explode no tick seguinte)', () => {
  it('alvo nas cols 5..9: para em 15/23/31/31/39/47 e explode em 16/24/32/32/40/48, no centro da casa anterior', () => {
    const got = [80, 96, 104, 112, 128, 144].map(x => { const f = fly(0xd, at(x)); return [f.stop, f.k, f.res.kind, f.pr.x / 256]; });
    expect(got).toEqual([
      [15, 16, 'player', 63], [23, 24, 'player', 79], [31, 32, 'player', 95],
      [31, 32, 'player', 95], [39, 40, 'player', 111], [47, 48, 'player', 127],
    ]);
  });
  it('montador em x = 49: alvos em 96/112/128 explodem em 16/24/32', () => {
    expect([96, 112, 128].map(x => fly(0xd, at(x), 49).k)).toEqual([16, 24, 32]);
  });
  it('transversal por casa: (95, 55) explode em 24 como acerto; (95, 56) passa', () => {
    const a = fly(0xd, at(95, 55));
    expect([a.k, a.res]).toEqual([24, { kind: 'player', slot: 2 }]);
    expect(fly(0xd, at(95, 56)).res.kind).toBe('block');
  });
  it('bloco: soft em (6,1) → para no centro da (5,1) em k = 23 e explode em k = 24', () => {
    const f = fly(0xd, s => { s.grid[cellOf(6, 1)] = 0xcc80; });
    expect([f.stop, f.k, f.res, f.pr.x]).toEqual([23, 24, { kind: 'block', cell: cellOf(5, 1) }, 79 * 256]);
  });
  it('sem alvo: para no centro da (14,1) em k = 95 e explode em k = 96 (medido na linha 5)', () => {
    const f = fly(0xd);
    expect([f.stop, f.k, f.res]).toEqual([95, 96, { kind: 'block', cell: cellOf(14, 1) }]);
  });
  it('depois de parar explode mesmo que o alvo saia da frente', () => {
    const s = mkRound({ players: [0, 2] });
    const p = placePx(s, 0, 32, 47); p.face = 2;
    const q = placePx(s, 2, 96, 47);
    const pr = spawnProjectile(s, p, 0xd);
    for (let k = 1; k <= 23; k++) { s.tick++; expect(advanceProjectile(s, pr, D_SPEC).kind).toBe('none'); }
    placePx(s, 2, cx(14), cy(11)); expect(q.x).toBe(cx(14) * 256);
    s.tick++;
    expect(advanceProjectile(s, pr, D_SPEC)).toEqual({ kind: 'block', cell: cellOf(5, 1) });
  });
});

describe('projéteis das montarias: regras comuns', () => {
  it('outra linha não é atingida; o dono não é atingido; morrendo não é atingido', () => {
    const s = mkRound({ players: [0, 1, 2] });
    const p = placePx(s, 0, 32, 47); p.face = 2;
    placePx(s, 1, 64, 47 + 16);
    const q = placePx(s, 2, 80, 47); q.state = 'dying';
    const pr = spawnProjectile(s, p, 0xe);
    for (let k = 1; k <= 40; k++) { s.tick++; expect(advanceProjectile(s, pr, E_SPEC).kind).not.toBe('player'); }
  });
  it('para cima diminui Y (nasce 2 px à frente e anda 2 px)', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(9)); p.face = 0;
    const pr = spawnProjectile(s, p, 0xe);
    expect(pr.y).toBe(p.y - 512);
    s.tick++; advanceProjectile(s, pr, E_SPEC);
    expect(pr.y).toBe(p.y - 1024);
    expect(pr.x).toBe(p.x);
  });
  it('shotInPlay (+$C6): voo e objeto final contam; libera SHOT_END_TICKS = 40 depois do fim', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1)); p.face = 2;
    const pr = spawnProjectile(s, p, 0xf);
    expect(shotInPlay(s, 0, 0xf)).toBe(true);
    expect(shotInPlay(s, 0, 0xe)).toBe(false);
    expect(shotInPlay(s, 1, 0xf)).toBe(false);
    pr.state = 'cloud'; pr.t = s.tick;
    s.tick += SHOT_END_TICKS - 1;
    expect(shotInPlay(s, 0, 0xf)).toBe(true);
    s.tick++;
    expect(shotInPlay(s, 0, 0xf)).toBe(false);
  });
  it('spawnShot: casa da frente do montador bloqueada → objeto final já no tick do Y, na posição do montador', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1)); p.face = 0;                 // parede em (2,0)
    const a = spawnShot(s, p, 0xf);
    expect([a.state, a.t, a.x, a.y]).toEqual(['cloud', s.tick, p.x, p.y]);
    p.face = 2; s.grid[cellOf(3, 1)] = 0x0941;                         // item na frente (medido: também acaba)
    expect(spawnShot(s, p, 0xe).state).toBe('cloud');
    s.grid[cellOf(3, 1)] = 0;
    expect(spawnShot(s, p, 0xe).state).toBe('fly');
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

// Ajuste C (medido no emulador, montador em (32, 47) olhando →; scratchpad ajc/exp*.py). Rotinas: F $C1:2F95,
// E $C1:2D73, D $C1:32EA. A cada tick: chama na casa do centro ($1000), bomba rolando ($4000 em $7F:1000) e, só no F,
// bloco/bomba parada/item/caveira na casa do centro. No fim de cada casa andada: bit 15, item ou caveira na frente.
describe('ajuste C: bomba, chama e item no caminho dos tiros', () => {
  const put = (c: number, l: number, v: number, at = 0) => (s: RoundState, k: number) => { if (k === at + 1) s.grid[cellOf(c, l)] = v; };
  const flyMid = (kind: ProjKind, c: number, v: number, at: number) => fly(kind, () => {}, 32, 47, 400, put(c, 1, v, at));
  it('F: chama na casa (4,1) → some em k = 46 (x = 56); na (5,1) → k = 78 (x = 72)', () => {
    const a = flyMid(0xf, 4, 0x1000, 0), b = flyMid(0xf, 5, 0x1000, 0);
    expect([a.res.kind, a.k, Math.floor(a.pr.x / 256)]).toEqual(['block', 46, 56]);
    expect([b.res.kind, b.k, Math.floor(b.pr.x / 256)]).toEqual(['block', 78, 72]);
  });
  it('F: chama que aparece no meio do voo (k = 50) na (5,1) → k = 78', () => {
    expect(flyMid(0xf, 5, 0x1000, 50).k).toBe(78);
  });
  it('F: bomba parada já na (4,1) → k = 31 (frente); na (5,1) → k = 63', () => {
    expect([flyMid(0xf, 4, 0xc900, 0).k, flyMid(0xf, 5, 0xc900, 0).k]).toEqual([31, 63]);
  });
  it('F: bomba posta na frente depois do teste da casa (k = 40 na (4,1), k = 70 na (5,1)) → some ao entrar: 46 / 78', () => {
    expect([flyMid(0xf, 4, 0xc900, 40).k, flyMid(0xf, 5, 0xc900, 70).k]).toEqual([46, 78]);
  });
  it('F: item e caveira na frente → k = 63; item que aparece em k = 70 → 78', () => {
    expect([flyMid(0xf, 5, 0x0941, 0).k, flyMid(0xf, 5, 0x0985, 0).k, flyMid(0xf, 5, 0x0941, 70).k]).toEqual([63, 63, 78]);
  });
  it('E: chama na (5,1) → k = 19 (x = 72); na (6,1) → 27, também se aparecer no meio (k = 20)', () => {
    const a = flyMid(0xe, 5, 0x1000, 0);
    expect([a.res.kind, a.k, a.pr.x / 256]).toEqual(['block', 19, 72]);
    expect([flyMid(0xe, 6, 0x1000, 0).k, flyMid(0xe, 6, 0x1000, 20).k]).toEqual([27, 27]);
  });
  it('E: bomba já na (5,1) → k = 15 (frente); item na (6,1) → 23', () => {
    expect([flyMid(0xe, 5, 0xc900, 10).k, flyMid(0xe, 6, 0x0941, 0).k]).toEqual([15, 23]);
  });
  it('E: bomba posta na casa em que ele já está (k = 10 na (4,1)) não para: o E não testa a grade no centro', () => {
    const f = flyMid(0xe, 4, 0xc900, 10);
    expect(f.res.kind).toBe('block');
    expect(f.k).toBe(95);                                    // segue até a parede (14,1)
  });
  it('bomba rolando (chutada) na (5,1): E some em 15 (frente, $C1:2E56), F em 78 (centro; o F não olha a frente)', () => {
    const roll = (s: RoundState) => {
      s.bombs.push({ id: 900, owner: 1, bad: false, cell: cellOf(5, 1), x: cx(5) * 256, y: cy(1) * 256, fuse: 126, fire: 1,
        type: 0, state: 'kicked', dir: 0, step: 0, kickedBy: 1, turn: -1, chainAt: 0, born: 0, level: 0 });
    };
    expect([fly(0xe, roll).k, fly(0xf, roll).k]).toEqual([15, 78]);
  });
  it('bomba rolando que chega na casa do E (k = 10 na (4,1)) → some em 11 (medido com $4000 em $7F:1000)', () => {
    const late = (s: RoundState, k: number) => {
      if (k !== 11) return;
      s.bombs.push({ id: 901, owner: 1, bad: false, cell: cellOf(4, 1), x: cx(4) * 256, y: cy(1) * 256, fuse: 126, fire: 1,
        type: 0, state: 'kicked', dir: 0, step: 0, kickedBy: 1, turn: -1, chainAt: 0, born: 0, level: 0 });
    };
    expect(fly(0xe, () => {}, 32, 47, 400, late).k).toBe(11);
  });
  it('D: item na (5,1) → para no centro da (4,1) em k = 15 e explode em 16 (antes passava)', () => {
    const f = fly(0xd, s => { s.grid[cellOf(5, 1)] = 0x0941; });
    expect([f.stop, f.k, f.res, f.pr.x / 256]).toEqual([15, 16, { kind: 'block', cell: cellOf(4, 1) }, 63]);
  });
  it('D: chama na (5,1) → para no centro dela em k = 19 (x = 79) e explode em 20', () => {
    const f = fly(0xd, s => { s.grid[cellOf(5, 1)] = 0x1000; });
    expect([f.stop, f.k, f.res, f.pr.x / 256]).toEqual([19, 20, { kind: 'block', cell: cellOf(5, 1) }, 79]);
  });
});
