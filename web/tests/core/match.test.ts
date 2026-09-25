import { createMatch, startRound, finishRound, hashState, step, defaultRules, makeRng, randInt } from '../../src/core';

const rules = (o = {}) => ({ ...defaultRules(), ...o });

describe('partida', () => {
  it('coroas acumulam e a partida acaba na meta', () => {
    const m = createMatch(rules({ matches: 2 }), 1, 123);
    let r = startRound(m); r.winners = [0];
    expect(finishRound(m, r)).toEqual({ winners: [0], matchOver: false, champions: [] });
    r = startRound(m); r.winners = [0];
    expect(finishRound(m, r)).toEqual({ winners: [0], matchOver: true, champions: [0] });
    expect(m.crowns).toEqual([2, 0, 0, 0, 0]);
  });
  it('empate não dá coroa', () => {
    const m = createMatch(rules(), 1, 1);
    const r = startRound(m); r.winners = [];
    finishRound(m, r);
    expect(m.crowns).toEqual([0, 0, 0, 0, 0]);
  });
  it('cada rodada tem seed diferente (spawns variam)', () => {
    const m = createMatch(rules({ randomSpawns: true }), 1, 7);
    const pos = new Set<string>();
    for (let i = 0; i < 6; i++) pos.add(startRound(m).players.map(p => p.x + ',' + p.y).join('|'));
    expect(pos.size).toBeGreaterThan(1);
  });
});

describe('determinismo', () => {
  const play = (seed: number) => {
    const m = createMatch(rules(), 1, seed);
    const r = startRound(m);
    const inRng = makeRng(seed * 31 + 1);
    for (let f = 0; f < 20000 && r.phase !== 'result'; f++) {
      step(r, [0, 1, 2, 3, 4].map(() => randInt(inRng, 128)));
    }
    return hashState(r);
  };
  it('mesma seed e mesmos inputs → mesmo hash', () => {
    expect(play(5)).toBe(play(5));
  });
  it('seeds diferentes → hashes diferentes', () => {
    expect(play(5)).not.toBe(play(6));
  });
});
