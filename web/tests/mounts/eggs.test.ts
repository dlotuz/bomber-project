import { mkRound, placePx, ride, run, BTN, cx, cy, X } from './helpers';
import { revealEgg, stepOnEgg, activeCount } from '../../src/core/mounts/eggs';
import { eggsInPlay } from '../../src/core/stages/kit';
import { rider, mstate, type MountProjectile } from '../../src/core/mounts/types';
import { cellOf } from '../../src/core/mounts/core-api';
import type { GameEvent } from '../../src/core/types';

const TYPE_ORDER = [0x2, 0x3, 0xa, 0xc, 0xd, 0xe, 0xf];

describe('revelação do ovo ($C1:5DB2)', () => {
  it('sorteia o tipo por rnd(14) na tabela $C1:5DA4: semente $0012 → C (seed $42B9), depois D ($4FAB)', () => {
    const s = mkRound(); s.rng.seed = 0x0012;
    const ev: GameEvent[] = [];
    const c1 = cellOf(6, 1), c2 = cellOf(8, 1);
    revealEgg(s, c1, ev);
    expect(s.grid[c1]).toBe(0x097c);
    expect(s.rng.seed).toBe(0x42b9);
    expect(ev).toContainEqual({ type: 'mount', id: 'egg_revealed', cell: c1, mount: 0xc });
    revealEgg(s, c2, ev);
    expect(s.grid[c2]).toBe(0x097d);
    expect(s.rng.seed).toBe(0x4fab);
  });
  it('7 tipos equiprováveis: 7000 sorteios da semente $0012 dão as contagens exatas do LCG', () => {
    const s = mkRound(); s.rng.seed = 0x0012;
    const count: Record<number, number> = {};
    const c = cellOf(6, 1);
    for (let i = 0; i < 7000; i++) { s.grid[c] = 0; revealEgg(s, c, []); const t = s.grid[c] & 0xf; count[t] = (count[t] ?? 0) + 1; s.grid[c] = 0; }
    expect(count).toEqual({ 0x2: 1001, 0x3: 995, 0xa: 989, 0xc: 1022, 0xd: 1021, 0xe: 997, 0xf: 975 });
    expect(Object.keys(count).map(Number).sort((a, b) => a - b)).toEqual(TYPE_ORDER);
  });
  it('teto de 2: com 2 ovos no chão o bloco não dá nada e não gasta RNG', () => {
    const s = mkRound(); s.rng.seed = 0x0012;
    s.grid[cellOf(4, 1)] = 0x0972; s.grid[cellOf(4, 3)] = 0x097a;
    const c = cellOf(6, 1);
    revealEgg(s, c, []);
    expect(s.grid[c]).toBe(0);
    expect(s.rng.seed).toBe(0x0012);
  });
  it('montaria ativa conta no teto', () => {
    const s = mkRound(); s.rng.seed = 0x0012;
    ride(s, 0, 0x3); s.grid[cellOf(4, 3)] = 0x0972;
    expect(activeCount(s)).toBe(2);
    revealEgg(s, cellOf(6, 1), []);
    expect(s.grid[cellOf(6, 1)]).toBe(0);
  });
  it('ovo reserva conta no teto', () => {
    const s = mkRound();
    ride(s, 0, 0x3, { reserves: [0x2] });
    expect(activeCount(s)).toBe(2);
  });
  it('desmontando sem reserva não conta; com reserva conta 1', () => {
    const s = mkRound({ players: [0, 1] });
    ride(s, 0, 0x3, { phase: 'dismount', remount: false, slot: 0 });
    expect(activeCount(s)).toBe(0);
    ride(s, 1, 0x2, { phase: 'dismount', remount: true });
    expect(activeCount(s)).toBe(1);
  });
  it('míssil D em voo não conta: a ROM já descontou no lançamento ($C2:47BB → $C2:4B89 → $C2:60B9)', () => {
    const s = mkRound();
    const pr: MountProjectile = { id: 1, kind: 0xd, owner: 0, x: 0, y: 0, dir: 2, born: s.tick, state: 'fly', t: s.tick, slot: 1 };
    mstate(s).projectiles.push(pr);
    expect(activeCount(s)).toBe(0);
  });
  it('choco: montando conta ovo + montaria ($C1:64BF +1; $C1:5FD9 −1 no fim da explosão), depois 1', () => {
    // Emulador (st_ride_pre, st_cpu5): $1ED4 sobe 1 no tick em que pisa e desce 41–45 ticks depois (7 casos);
    // o core usa a fase `mounting` inteira (k < 42), o mesmo tempo com erro de ±3.
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    s.grid[cellOf(2, 1)] = 0x0973;
    expect(activeCount(s)).toBe(1);
    run(s, 1);
    expect(rider(p)!.phase).toBe('mounting');
    expect(activeCount(s)).toBe(2);
    run(s, 41);                                              // T+1..T+41
    expect(rider(p)!.phase).toBe('mounting');
    expect(activeCount(s)).toBe(2);
    run(s, 1);                                               // T+42
    expect(rider(p)!.phase).toBe('riding');
    expect(activeCount(s)).toBe(1);
  });
  it('durante o choco com 1 ovo na grade, o bloco não dá ovo (ROM chega a $1ED4 = 3)', () => {
    const s = mkRound(); s.rng.seed = 0x0012;
    ride(s, 0, 0x3, { phase: 'mounting' });
    s.grid[cellOf(4, 3)] = 0x0972;
    expect(activeCount(s)).toBe(3);
    revealEgg(s, cellOf(6, 1), []);
    expect(s.grid[cellOf(6, 1)]).toBe(0);
  });
  it('ovo do caça-níquel voando conta ($C3:19C5 +1 ao soltar)', () => {
    const s = mkRound();
    s.flyers.push({ id: 1, kind: 'item', ref: 0x33, x: 0, y: 0, z: 0, dir: 0, flight: 'item', script: 0, i: 0, born: s.tick } as never);
    expect(activeCount(s)).toBe(1);
  });
  it('eggsInPlay (plano 8) = activeCount + extra: fonte única do $1ED4', () => {
    const s = mkRound({ players: [0, 1] });
    s.grid[cellOf(4, 1)] = 0x0972;
    ride(s, 0, 0x3, { reserves: [0x2] });
    ride(s, 1, 0x2, { phase: 'dismount', remount: false, slot: 0 });   // já descontado no acerto
    mstate(s).projectiles.push({ id: 1, kind: 0xd, owner: 0, x: 0, y: 0, dir: 2, born: s.tick, state: 'fly', t: s.tick, slot: 1 });
    expect(activeCount(s)).toBe(3);
    expect(eggsInPlay(s)).toBe(3);
    expect(eggsInPlay(s, 2)).toBe(5);
  });
  it('ovo queimado (EDC0) sai da conta', () => {
    const s = mkRound();
    s.grid[cellOf(4, 1)] = 0x0972;
    expect(activeCount(s)).toBe(1);
    s.grid[cellOf(4, 1)] = 0xedc0;
    expect(activeCount(s)).toBe(0);
  });
});

describe('pisar no ovo', () => {
  it('monta: 43 ticks travado (mounting), depois anda 1 px/tick no nível 1 (mount_battery x_seq 32..43)', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    const c = cellOf(2, 1);
    s.grid[c] = 0x0973;
    const ev = run(s, 1);                                    // tick T: pisa
    const r = rider(p)!;
    expect(s.grid[c]).toBe(0);
    expect(r).toMatchObject({ type: 0x3, phase: 'mounting', slot: 1 });
    expect(p.act).toBe('mounting');
    expect(ev).toContainEqual({ type: 'mount', id: 'mount_start', slot: 0, mount: 0x3 });
    const x0 = p.x;
    const ready = run(s, 42, { 0: BTN.RIGHT });              // T+1..T+42
    expect(p.x).toBe(x0);
    expect(r.phase).toBe('riding');
    expect(ready).toContainEqual({ type: 'mount', id: 'mount_ready', slot: 0, mount: 0x3 });
    for (let k = 1; k <= 12; k++) { run(s, 1, { 0: BTN.RIGHT }); expect(X(p)).toBe(31 + k); }
  });
  it('a 2ª montaria usa a vaga 2', () => {
    const s = mkRound({ players: [0, 1] });
    ride(s, 1, 0xa);
    placePx(s, 0, cx(2), cy(1));
    s.grid[cellOf(2, 1)] = 0x097c;
    run(s, 1);
    expect(rider(s.players[0])!.slot).toBe(2);
  });
  it('2º ovo de tipo 0–7 vira reserva; de tipo 8–F fica na grade (mount_follow / mount_misc)', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    const r = ride(s, 0, 0x3);
    const c = cellOf(2, 1);
    s.grid[c] = 0x097a;                                      // ovo tipo A
    run(s, 1);
    expect(s.grid[c]).toBe(0x097a);
    expect(r.reserves).toEqual([]);
    s.grid[c] = 0x0972;                                      // ovo tipo 2
    const ev = run(s, 1);
    expect(s.grid[c]).toBe(0);
    expect(r.reserves).toEqual([0x2]);
    expect(r.type).toBe(0x3);
    expect(ev).toContainEqual({ type: 'mount', id: 'egg_reserved', slot: 0, mount: 0x2 });
    expect(p.act).not.toBe('mounting');
  });
  it('no máximo 3 reservas', () => {
    const s = mkRound();
    placePx(s, 0, cx(2), cy(1));
    const r = ride(s, 0, 0x3, { reserves: [2, 2, 3] });
    s.grid[cellOf(2, 1)] = 0x0972;
    run(s, 1);
    expect(r.reserves).toEqual([2, 2, 3]);
    expect(s.grid[cellOf(2, 1)]).toBe(0x0972);
  });
  it('não pega ovo durante a montagem nem durante o desmonte', () => {
    const s = mkRound();
    placePx(s, 0, cx(2), cy(1));
    const r = ride(s, 0, 0x3, { phase: 'mounting' });
    s.grid[cellOf(2, 1)] = 0x0972;
    stepOnEgg(s, s.players[0], cellOf(2, 1), []);
    expect(s.grid[cellOf(2, 1)]).toBe(0x0972);
    r.phase = 'dismount';
    stepOnEgg(s, s.players[0], cellOf(2, 1), []);
    expect(s.grid[cellOf(2, 1)]).toBe(0x0972);
    expect(r.reserves).toEqual([]);
  });
});

describe('ovo de máquina (A, C, D, E, F) × ovo verde (2, 3)', () => {
  it('montado em máquina: ovo de máquina segue; ovo normal fica na grade', () => {
    const s = mkRound();
    placePx(s, 0, cx(2), cy(1));
    const r = ride(s, 0, 0xd);
    const c = cellOf(2, 1);
    s.grid[c] = 0x0972;                                      // normal (2)
    run(s, 1);
    expect([s.grid[c], r.reserves]).toEqual([0x0972, []]);
    s.grid[c] = 0x097f;                                      // máquina (F)
    run(s, 1);
    expect([s.grid[c], r.reserves]).toEqual([0, [0xf]]);
  });
  it('ovo verde só 2 e 3; C e E são de máquina (montado no 2: o 3 segue, o C fica)', () => {
    const s = mkRound();
    placePx(s, 0, cx(2), cy(1));
    const r = ride(s, 0, 0x2);
    const c = cellOf(2, 1);
    s.grid[c] = 0x097c;
    run(s, 1);
    expect([s.grid[c], r.reserves]).toEqual([0x097c, []]);
    s.grid[c] = 0x0973;
    run(s, 1);
    expect(r.reserves).toEqual([0x3]);
  });
  it('outro jogador a pé pisa no ovo que segue alguém: rouba e monta', () => {
    const s = mkRound({ players: [0, 1] });
    placePx(s, 0, cx(4), cy(1));
    const r = ride(s, 0, 0xd, { reserves: [0xa], trail: [cellOf(4, 1), cellOf(3, 1)] });
    const q = placePx(s, 1, cx(3), cy(1));
    const ev = run(s, 1);
    expect(r.reserves).toEqual([]);
    expect([rider(q)?.type, rider(q)?.phase]).toEqual([0xa, 'mounting']);
    expect(ev).toContainEqual({ type: 'mount', id: 'egg_stolen', slot: 1, from: 0, mount: 0xa });
  });
  it('quem rouba montado na mesma classe fica com ele de reserva; de outra classe, não rouba', () => {
    const s = mkRound({ players: [0, 1] });
    placePx(s, 0, cx(4), cy(1));
    const r = ride(s, 0, 0xd, { reserves: [0xa], trail: [cellOf(4, 1), cellOf(3, 1)] });
    const q = placePx(s, 1, cx(3), cy(1));
    const rq = ride(s, 1, 0x2);
    run(s, 1);
    expect([r.reserves, rq.reserves]).toEqual([[0xa], []]);
    rq.type = 0xf;
    run(s, 1);
    expect([r.reserves, rq.reserves]).toEqual([[], [0xa]]);
    expect(q.mount).toBe(rq);
  });
});
