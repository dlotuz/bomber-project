import { mkRound, placePx, ride, run, flameAt, BTN, cx, cy } from './helpers';
import { rider, mstate } from '../../src/core/mounts/types';
import { activeCount } from '../../src/core/mounts/eggs';
import { cellOf } from '../../src/core/mounts/core-api';
import { mountModule } from '../../src/core/mounts/module';
import type { GameEvent } from '../../src/core/types';
import { stunPlayer } from '../../src/core/hit';
import { addBomb } from '../../src/core/bombs';
import { startLift } from '../../src/core/flyers';

describe('acerto de chama montado ($C2:4B89)', () => {
  it('não morre: 1 + 51 ticks pulando, montaria some, 32 de invencibilidade (mount_battery T6_hit)', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    ride(s, 0, 0x2);
    const x0 = p.x;
    flameAt(s, cellOf(2, 1));
    const ev = run(s, 1);                                    // tick H
    expect(ev).toContainEqual({ type: 'mount', id: 'mount_lost', slot: 0, mount: 0x2, reserve: false, cause: 'hit' });
    expect(p.state).toBe('alive');
    expect(p.act).toBe('dismount');
    for (let i = 1; i <= 51; i++) {                          // H+1..H+51: chama ainda na casa até H+24
      run(s, 1, { 0: BTN.RIGHT });
      expect(p.x, `H+${i}`).toBe(x0);
      expect(p.state).toBe('alive');
    }
    run(s, 1);                                               // H+52
    expect(p.mount).toBeNull();
    expect(p.inv).toBe(32);
    run(s, 2, { 0: BTN.RIGHT });
    expect(p.x).toBeGreaterThan(x0);
  });
  // $C2:105E escolhe a anim uma vez ($C2:6F71) e cai em $C2:1089 (com reserva) ou $C2:10D5 (sem): laços iguais até
  // o fim da anim → remonte = desmonte = 1 + 51 (fixture T4: remount 0xd818ef f0..f49 com a captura já na rotina).
  it('com ovo reserva: 1 + 51, remonta com o tipo do reserva e 32 de invencibilidade', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    const r = ride(s, 0, 0x3, { reserves: [0x2] });
    flameAt(s, cellOf(2, 1));
    const ev = run(s, 1);                                    // H
    expect(ev).toContainEqual({ type: 'mount', id: 'mount_lost', slot: 0, mount: 0x3, reserve: true, cause: 'hit' });
    expect(r.remountFx).toEqual({ t0: s.tick, origin: cellOf(2, 1), x: p.x, y: p.y });   // marcador para o render (I2)
    const x0 = p.x;
    run(s, 51, { 0: BTN.RIGHT });                            // H+1..H+51
    expect(p.x).toBe(x0);
    expect(r.phase).toBe('dismount');
    const ev2 = run(s, 1);                                   // H+52
    expect(p.mount).toBe(r);
    expect(r).toMatchObject({ phase: 'riding', type: 0x2, reserves: [], remount: false, slot: 1 });
    expect(p.inv).toBe(32);
    expect(ev2).toContainEqual({ type: 'mount', id: 'mount_ready', slot: 0, mount: 0x2 });
  });
  it('montando (antes de chocar) é imune à chama (L1)', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    s.grid[cellOf(2, 1)] = 0x0973;
    run(s, 1);
    flameAt(s, cellOf(2, 1));
    run(s, 1);
    expect(p.state).toBe('alive');
    expect(rider(p)!.phase).toBe('mounting');
  });
  it('velocidade montado = nível de patins (nível 4 → 352/256 px por tick)', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    p.speedLv = 4;
    ride(s, 0, 0xe);
    const x0 = p.x;
    run(s, 10, { 0: BTN.RIGHT });
    expect(p.x - x0).toBe(3520);
  });
  it('atordoamento: onStunLoss tira a montaria (e as reservas) só em riding', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    const r = ride(s, 0, 0x3, { reserves: [2] });
    r.phase = 'mounting';
    expect(mountModule.onStunLoss!(s, p, [])).toBe(false);
    r.phase = 'riding';
    const ev: GameEvent[] = [];
    expect(mountModule.onStunLoss!(s, p, ev)).toBe(true);
    expect(p.mount).toBeNull();
    expect(ev).toContainEqual({ type: 'mount', id: 'mount_lost', slot: 0, mount: 0x3, reserve: false, cause: 'stun' });
  });
  it('quem sai de alive perde a montaria no tick', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    ride(s, 0, 0x3, { reserves: [2] });
    p.state = 'out';
    run(s, 1);
    expect(p.mount).toBeNull();
  });
});

// L22 (revisão final I6): o objeto reserva ($C2:62D7) chama $C2:6645 quando o dono não está invencível (+$96 == 0): casa
// do ovo com o bit $1000 (chama) → sai da fila ($C2:6687, levando as de trás), estoura ($D8:D327, 40 ticks) e só no fim
// DEC $1ED4 ($C2:6680). Emulador (mount_burn): queimar a 2ª deixa a 1ª; queimar a 1ª esvazia a fila; $1ED4 cai 40 depois.
describe('ovo reserva queima na chama (L22)', () => {
  const setup = (reserves: number[]) => {
    const s = mkRound();
    const p = placePx(s, 0, cx(4), cy(1));
    const r = ride(s, 0, 0x3, { reserves, trail: [cellOf(4, 1), cellOf(3, 1), cellOf(2, 1), cellOf(1, 1)] });
    return { s, p, r };
  };
  it('sem invencibilidade: sai da fila, estoura e conta no $1ED4 até o fim da explosão (40 ticks)', () => {
    const { s, r } = setup([0x2]);
    flameAt(s, cellOf(3, 1));
    const ev = run(s, 1);                                    // H
    expect(r.reserves).toEqual([]);
    expect(r.phase).toBe('riding');
    expect(ev).toContainEqual({ type: 'mount', id: 'reserve_burnt', slot: 0, cell: cellOf(3, 1), mount: 0x2 });
    expect(mstate(s).bursts).toEqual([{ cell: cellOf(3, 1), t0: s.tick, mount: 0x2 }]);
    expect(activeCount(s)).toBe(2);
    run(s, 39);                                              // H+1..H+39
    expect(activeCount(s)).toBe(2);
    run(s, 1);                                               // H+40: DEC $1ED4
    expect(activeCount(s)).toBe(1);
    expect(mstate(s).bursts).toEqual([]);
  });
  it('dono invencível (inv > 0): a reserva atravessa a chama', () => {
    const { s, p, r } = setup([0x2]);
    p.inv = 10;
    flameAt(s, cellOf(3, 1));
    const ev = run(s, 1);
    expect(r.reserves).toEqual([0x2]);
    expect(ev.some(e => e.type === 'mount' && e.id === 'reserve_burnt')).toBe(false);
  });
  it('queimar a 1ª tira as de trás da fila ($C2:6687); queimar a 2ª mantém a 1ª', () => {
    const a = setup([0x2, 0x3, 0x2]);
    flameAt(a.s, cellOf(3, 1));
    const ev = run(a.s, 1);
    expect(a.r.reserves).toEqual([]);
    expect(ev.filter(e => e.type === 'mount' && e.id === 'reserve_burnt')).toHaveLength(1);
    expect(mstate(a.s).bursts).toHaveLength(1);
    const b = setup([0x2, 0x3]);
    flameAt(b.s, cellOf(2, 1));
    run(b.s, 1);
    expect(b.r.reserves).toEqual([0x2]);
    expect(mstate(b.s).bursts).toEqual([{ cell: cellOf(2, 1), t0: b.s.tick, mount: 0x3 }]);
  });
  it('queima também durante o remonte (as reservas que sobraram seguem na fila)', () => {
    const { s, r } = setup([0x2, 0x3]);
    r.phase = 'dismount'; r.remount = true; r.t0 = s.tick; r.reserves = [0x3];
    flameAt(s, cellOf(3, 1));
    run(s, 1);
    expect(r.reserves).toEqual([]);
  });
});

describe('ajustes: montado', () => {
  it('atordoado montado: só o atordoamento, não perde a montaria nem itens', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    const r = ride(s, 0, 0x2);
    p.kick = true; p.fire = 3;
    const ev: GameEvent[] = [];
    stunPlayer(s, p, ev);
    expect(p.act).toBe('stunned');
    expect(p.mount).toBe(r);
    expect(r.phase).toBe('riding');
    expect([p.kick, p.fire]).toEqual([true, 3]);
    expect(ev.some(e => e.type === 'mount')).toBe(false);
  });
  it('pisar no ovo segurando bomba: larga a bomba na casa e monta de mãos vazias', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2) - 6, cy(1)); p.glove = true;   // entrou na casa do ovo, ainda fora do centro
    const c = cellOf(2, 1);
    const b = addBomb(s, 0, c);
    startLift(s, p, []);
    expect(p.carry).toBe(b.id);
    s.grid[c] = 0x0972;
    mountModule.stepOnEgg(s, p, c, []);
    expect(rider(p)?.phase).toBe('mounting');
    expect(p.carry).toBe(-1);
    expect([b.state, b.cell, s.grid[c]]).toEqual(['idle', c, 0xc900]);
    expect([p.x, p.y]).toEqual([b.x, b.y]);                       // no centro da casa, junto com a bomba
  });
});
