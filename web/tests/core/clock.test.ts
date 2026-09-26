import { initClock, clockText, pressureTriggerSec, tickClock } from '../../src/core/clock';
import type { GameEvent } from '../../src/core/types';
import { emptyRound } from '../../src/core/state';
import { step } from '../../src/core/step';
import { rules, runUntil } from './kit';

describe('relógio (§3.11)', () => {
  it('início minutos·60 + 1, sub 1; ∞ = 30:01', () => {
    expect([0, 1, 2, 3, 4].map(i => initClock(i).sec)).toEqual([61, 121, 181, 301, 1801]);
    expect(initClock(2).sub).toBe(1);
    expect(clockText({ sec: 180 })).toBe('3:00');
    expect(clockText({ sec: 1801 })).toBe('30:01');
    expect([pressureTriggerSec(0), pressureTriggerSec(2)]).toEqual([41, 61]);
  });
  it('intro: 10 ticks levam 3:01/1 a 3:00/51; o 1º segundo jogado dura 51 ticks', () => {
    const s = emptyRound(1, rules());
    for (let i = 0; i < 10; i++) step(s, [0, 0, 0, 0, 0]);
    expect(s.clock).toEqual({ sec: 180, sub: 51 });
    for (let i = 10; i < 62; i++) step(s, [0, 0, 0, 0, 0]);
    expect([s.phase, s.clock.sec, s.clock.sub]).toEqual(['play', 180, 51]);
    expect(runUntil(s, st => st.clock.sec === 179)).toBe(113);
  });
  it('0:00 não fica negativo (o tempo acabou com menos de 2 grupos de pé e a rodada ainda está em play)', () => {
    const s = emptyRound(1, rules());
    s.phase = 'play'; s.clock = { sec: 1, sub: 1 };
    s.players.forEach((p, i) => { if (i > 0) p.state = 'out'; });
    const ev: GameEvent[] = [];
    for (let i = 0; i < 300; i++) { s.tick++; tickClock(s, ev); }
    expect([s.clock, s.phase, clockText(s.clock)]).toEqual([{ sec: 0, sub: 60 }, 'play', '0:00']);
    expect(ev.some(e => e.type === 'time_up')).toBe(false);
  });
  it('∞ não decrementa', () => {
    const s = emptyRound(1, rules({ timeIdx: 4 }));
    for (let i = 0; i < 500; i++) step(s, [0, 0, 0, 0, 0]);
    expect(s.clock).toEqual({ sec: 1801, sub: 1 });
  });
  it('HURRY na virada 1:02 → 1:01 (tick 7193 com 3:00); 0:42 → 0:41 com 1:00 (tick 1193)', () => {
    const s = emptyRound(1, rules());
    expect(runUntil(s, (_s, ev) => ev.some(e => e.type === 'hurry'))).toBe(7193);
    expect([s.clock.sec, s.pressure.trigger]).toEqual([61, 7193]);
    const s1 = emptyRound(1, rules({ timeIdx: 0 }));
    expect(runUntil(s1, (_s, ev) => ev.some(e => e.type === 'hurry'))).toBe(1193);
  });
  it('0:00 com 2 de pé → timeUp no tick 10853, com evento', () => {
    const s = emptyRound(1, rules());
    s.pressure.trigger = 1e9;                      // desliga a pressão (senão, depois da integração, ela mata os jogadores antes do 0:00)
    expect(runUntil(s, (_s, ev) => ev.some(e => e.type === 'time_up'))).toBe(10853);
    expect([s.phase, s.phaseT0, s.clock.sec]).toEqual(['timeUp', 10853, 0]);
  });
});
