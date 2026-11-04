// Quem sai da luva de outro jogador: quanto tempo fica parado e se fica invencível. ROM (emulador,
// analise/investigacao/aj-grabinv): largado (B, atordoamento, morte, soneca, golpe P → $C2:4BC4 grava +$C2 |= $10)
// o pego vai de $C2:1AE7 para $C2:1BE1 → $C2:1C35, que só toca a animação $D8:1D44 (42 ticks) e volta à rotina normal
// ($C2:22F0); escapando sozinho (B, $C2:1ABD) vai por $C2:1C09 → $C2:1C35 com a animação $D8:1C4A (8 ticks).
// $C2:1C35 não chama a checagem de chama ($C2:4B4E) nem a de atordoamento ($C2:4C54) e o pego está fora da ocupação
// $7F:1000 (bomba que cai e mira do arremesso não o acham), mas ninguém grava +$96: a chama mata no 1º tick da rotina
// normal. Arremessado: $C2:2026 até o pouso e depois a rotina normal, também sem +$96.
import { arena, put, run, C } from './kit';
import { addBomb } from '../../src/core/bombs';
import { hitPlayer, stunPlayer } from '../../src/core/hit';
import { startPPunch } from '../../src/core/actions';
import { BTN, CODE, type Player, type RoundState } from '../../src/core/types';
import { playerCell } from '../../src/core/state';

const { A, B, RIGHT, DOWN } = BTN;

/** p (luva, slot `ps`) pega q (slot `qs`) em (4,1) e termina o levantar (8 ticks); A segue segurado. */
function grabbed(ps = 0, qs = 1, players = 3) {
  const s = arena({ players });
  for (let k = 0; k < players; k++) if (k !== ps && k !== qs) put(s, k, 12, 11 - 2 * k);
  const p = put(s, ps, 4, 1); p.glove = true; p.face = 2;
  const q = put(s, qs, 4, 1);
  const inp = (pb: number, qb = 0): number[] => { const v = [0, 0, 0, 0, 0]; v[ps] = pb; v[qs] = qb; return v; };
  run(s, 1, inp(A)); run(s, 8, inp(A));
  expect([p.grab, q.heldBy]).toEqual([qs, ps]);
  return { s, p, q, inp };
}

/** Ticks depois de `t0` até q obedecer à direita (andar); q.inv é conferido a cada tick. */
function stillFor(s: RoundState, q: Player, inp: (pb: number, qb?: number) => number[], max = 80): number {
  const x0 = q.x, t0 = s.tick;
  for (let k = 0; k < max; k++) {
    run(s, 1, inp(0, RIGHT));
    expect(q.inv).toBe(0);
    if (q.x !== x0) return s.tick - t0;
  }
  return -1;
}

/** Chama na casa `cell` a cada tick (quem segura fica invencível): ticks depois de `t0` até q morrer. */
function diesAfter(s: RoundState, q: Player, holder: Player, cell: number, inp: (pb: number, qb?: number) => number[], max = 80): number {
  const t0 = s.tick;
  for (let k = 0; k < max; k++) {
    s.grid[cell] = CODE.FLAME; s.cellT0[cell] = s.tick;
    holder.inv = 500;
    run(s, 1, inp(0));
    if (q.state !== 'alive') return s.tick - t0;
  }
  return -1;
}

describe('largado da luva ($C2:1C35): parado e sem invencibilidade', () => {
  it('B: 42 ticks parado a partir do próprio tick, sem +$96 (anda em T+42)', () => {
    const { s, q, inp } = grabbed();
    run(s, 1, inp(A | B));
    expect([q.heldBy, q.act, q.inv]).toEqual([-1, 'dropped', 0]);
    expect(stillFor(s, q, inp)).toBe(42);
  });
  it('B: a chama não pega durante o pulo (até T+41) e mata em T+42, no 1º tick da rotina normal', () => {
    const { s, p, q, inp } = grabbed();
    run(s, 1, inp(A | B));
    expect(diesAfter(s, q, p, C(4, 1), inp)).toBe(42);
  });
  it('B com o pego de slot menor: ele só vê o pedido no tick seguinte — parado até T+42, anda e morre em T+43', () => {
    const a = grabbed(1, 0);
    run(a.s, 1, a.inp(A | B));
    expect(a.q.act).toBe('dropped');
    expect(stillFor(a.s, a.q, a.inp)).toBe(43);
    const b = grabbed(1, 0);
    run(b.s, 1, b.inp(A | B));
    expect(diesAfter(b.s, b.q, b.p, C(4, 1), b.inp)).toBe(43);
  });
  it('soltos por atordoamento, golpe P e morte de quem segura: o mesmo pulo de 42 ticks, sem +$96', () => {
    for (const how of ['stun', 'pvict', 'death'] as const) {
      const { s, p, q, inp } = grabbed();
      if (how === 'stun') stunPlayer(s, p, []);
      if (how === 'pvict') { const o = put(s, 2, 3, 1); o.pItem = true; o.face = 2; startPPunch(s, o, []); }
      if (how === 'death') hitPlayer(s, p, 'flame', []);
      expect([how, q.heldBy, q.act, q.inv]).toEqual([how, -1, 'dropped', 0]);
      // fora do tick (como a bomba que cai em tickFlyers): os 42 ticks do pulo são T+1..T+42
      expect([how, stillFor(s, q, inp)]).toEqual([how, 43]);
    }
  });
  it('quem segura morre na chama: o largado passa o pulo na chama e morre no fim dele (ROM: $C2:10F9 em T+42)', () => {
    const { s, p, q, inp } = grabbed();
    run(s, 1, (st: RoundState) => { st.grid[C(4, 1)] = CODE.FLAME; st.cellT0[C(4, 1)] = st.tick; return inp(A); });
    expect([p.state, q.act]).toEqual(['dying', 'dropped']);
    expect(diesAfter(s, q, p, C(4, 1), inp)).toBe(42);
  });
  it('bomba que cai na casa dele durante o pulo não o acha: pousa e fica, sem atordoar', () => {
    const s = arena({ players: 3 });
    const o = put(s, 2, 9, 1); o.glove = true; o.face = 6;
    const ob = addBomb(s, 2, C(9, 1), { fuse: 150 });
    run(s, 1, [0, 0, A]); run(s, 12, [0, 0, A]);
    expect(o.carry).toBe(ob.id);
    const p = put(s, 0, 4, 1); p.glove = true; p.face = 2;
    const q = put(s, 1, 4, 1);
    run(s, 1, [A, 0, A]); run(s, 8, [A, 0, A]);
    run(s, 1, [A | B, 0, A]);
    expect(q.act).toBe('dropped');
    for (let k = 0; k < 12; k++) run(s, 1, [DOWN, 0, A]);   // quem segurava sai da linha
    expect(playerCell(p)).not.toBe(C(4, 1));
    run(s, 1, [0, 0, 0]);                                    // arremessa 5 casas: pousa em (4,1)
    for (let k = 0; k < 40 && ob.state !== 'idle'; k++) run(s, 1);
    expect([ob.state, ob.cell, q.act === 'stunned']).toEqual(['idle', C(4, 1), false]);
  });
  it('a mira do arremesso não o conta (fora da ocupação): passa por cima e cai na 5ª casa', () => {
    const s = arena({ players: 3 });
    const o = put(s, 2, 8, 1); o.glove = true; o.face = 6;
    const ob = addBomb(s, 2, C(8, 1), { fuse: 150 });
    run(s, 1, [0, 0, A]); run(s, 12, [0, 0, A]);
    const p = put(s, 0, 4, 1); p.glove = true; p.face = 2;
    const q = put(s, 1, 4, 1);
    run(s, 1, [A, 0, A]); run(s, 8, [A, 0, A]);
    run(s, 1, [A | B, 0, A]);
    for (let k = 0; k < 12; k++) run(s, 1, [DOWN, 0, A]);
    run(s, 1, [0, 0, 0]);                                    // q a 4 casas: a mira (2..4) só o veria de pé
    expect(s.flyers.find(f => f.ref === ob.id)?.flight).toBe('throw5');
    for (let k = 0; k < 40 && ob.state !== 'idle'; k++) run(s, 1);
    expect([ob.state, ob.cell, q.act === 'stunned']).toEqual(['idle', C(3, 1), false]);
  });
});

describe('arremessado e escapando: sem invencibilidade', () => {
  // ROM: o voo ($C2:2026) anda de T a T+11, fica parado em T+12 e T+13 e a rotina normal (já sem +$96) começa em T+14,
  // quando a chama do pouso mata. O núcleo dá o 1º passo em T+1 e pousa em T+12: livre e vulnerável 1 tick antes
  // (pendente, fora deste ajuste — mexe no voo e nos quiques).
  it('arremessado: imune só no ar; a chama da casa do pouso mata no 1º tick depois do pouso, sem +$96', () => {
    const { s, p, q, inp } = grabbed();
    run(s, 1, inp(0));                                       // solta o A: arremesso de 5 casas, (4,1) → (9,1)
    expect(q.flying).toBe(true);
    expect(diesAfter(s, q, p, C(9, 1), inp)).toBe(13);
    expect(q.inv).toBe(0);
  });
  it('escapando (B Rules.gloveEscape vezes): pulo de 8 ticks ($D8:1C4A) a partir do tick da soltura, sem +$96', () => {
    const a = grabbed();
    a.s.rules.gloveEscape = 3;
    for (let k = 0; k < 2; k++) { run(a.s, 1, a.inp(A, B)); run(a.s, 1, a.inp(A)); }
    run(a.s, 1, a.inp(A, B));
    expect([a.q.heldBy, a.p.grab, a.q.act, a.q.inv]).toEqual([-1, -1, 'dropped', 0]);
    expect(stillFor(a.s, a.q, a.inp)).toBe(8);
    const b = grabbed();
    b.s.rules.gloveEscape = 1;
    run(b.s, 1, b.inp(A, B));
    expect(b.q.act).toBe('dropped');
    expect(diesAfter(b.s, b.q, b.p, C(4, 1), b.inp)).toBe(8);
  });
});
