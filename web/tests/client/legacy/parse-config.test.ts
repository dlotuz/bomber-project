import { parseConfig } from '../../../src/game/config';
import { updateSession, type Session } from '../../../src/game/session';
import { INTRO_TICKS } from '../../../src/core';

const idle = [0, 0, 0, 0, 0];
const run = (s: Session, n: number, pads = idle) => { for (let i = 0; i < n; i++) updateSession(s, pads); };
const tap = (s: Session, slot: number, btn: number) => { const p = [0, 0, 0, 0, 0]; p[slot] = btn; updateSession(s, p); updateSession(s, idle); };
const winRound = (s: Session, winner: number) => {
  if (s.round.phase === 'intro') run(s, INTRO_TICKS);
  s.round.players.forEach((p, i) => { if (i !== winner && p.present) p.state = 'out'; });
  for (let i = 0; i < 400 && s.phase === 'battle'; i++) updateSession(s, idle);
};

describe('parseConfig', () => {
  it('humans e level definem quem é CPU e o nível', () => {
    const c = parseConfig('?players=4&humans=1&level=2');
    expect(c.humans).toEqual([true, false, false, false, false]);
    expect(c.rules.active).toEqual([true, true, true, true, false]);
    expect(c.rules.cpuLevel).toBe(2);
    expect(parseConfig('').humans).toEqual([true, true, true, true, true]);
    expect(parseConfig('').rules.cpuLevel).toBe(1);
  });
  it('padrões', () => {
    const c = parseConfig('');
    expect(c.stage).toBe(1);
    expect(c.rules.active).toEqual([true, true, true, true, true]);
    expect([c.rules.matches, c.rules.timeIdx, c.rules.randomSpawns, c.rules.mode]).toEqual([3, 2, false, 'ffa']);
    expect(c.chars).toEqual([0, 1, 2, 3, 4]);
    expect(c.seed).toBeNull();
  });
  it('lê e limita os parâmetros', () => {
    const c = parseConfig('?stage=12&players=1&matches=9&time=4&chars=5,5,x&seed=42&mode=team&sd=1&racer=1&spawns=0');
    expect(c.stage).toBe(10);
    expect(c.rules.active).toEqual([true, true, false, false, false]);
    expect([c.rules.matches, c.rules.timeIdx]).toEqual([5, 4]);
    expect(c.chars).toEqual([5, 5, 2, 3, 4]);
    expect(c.seed).toBe(42);
    expect([c.rules.mode, c.rules.suddenDeath, c.rules.racer, c.rules.randomSpawns]).toEqual(['team', true, true, false]);
  });
});
