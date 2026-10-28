import { createMatchSession, resetCarry, carry, sessionSeed } from '../../src/game/match-session';
import { parseConfig } from '../../src/game/config';
import { matchRngState } from '../../src/game/core-api';

beforeEach(() => resetCarry());

describe('semente ao abrir a página', () => {
  it('sem ?seed: sorteada (cada abertura, uma 1ª partida diferente)', () => {
    expect(sessionSeed('', () => 0)).toBe(0);
    expect(sessionSeed('', () => 0.5)).toBe(0x8000);
    expect(sessionSeed('', () => 0.999999)).toBe(0xffff);
    const seen = new Set(Array.from({ length: 50 }, () => sessionSeed('')));
    expect(seen.size).toBeGreaterThan(40);
  });

  it('?seed=N fixa a semente (reproduzir partidas)', () => {
    expect(sessionSeed('?seed=4660', () => 0.5)).toBe(4660);
    expect(sessionSeed('?quick&seed=70000', () => 0.5)).toBe(70000 & 0xffff);
  });

  it('a 1ª partida usa a semente da abertura', () => {
    carry.seed = sessionSeed('', () => 0.25);
    expect(matchRngState(createMatchSession(parseConfig('')).match)).toBe(0x4000);
  });
});
