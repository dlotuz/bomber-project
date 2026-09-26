import { mkRound, placePx, ride, run, flameAt, BTN, cx, cy } from './helpers';
import { rider } from '../../src/core/mounts/types';
import { cellOf } from '../../src/core/mounts/core-api';
import { mountModule } from '../../src/core/mounts/module';
import type { GameEvent } from '../../src/core/types';

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
