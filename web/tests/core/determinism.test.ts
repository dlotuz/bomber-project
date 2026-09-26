import { createMatch, startRound, finishRound } from '../../src/core/match';
import { step } from '../../src/core/step';
import { hashState } from '../../src/core/hash';
import { rules } from './kit';

/** 20.000 ticks com entradas pseudoaleatórias próprias do teste (não usam o RNG do jogo). */
function play(seed: number): string[] {
  const m = createMatch(rules({ timeIdx: 0 }), 1, seed);
  let s = startRound(m);
  let x = seed >>> 0;
  const next = (): number => { x = (Math.imul(x, 1103515245) + 12345) >>> 0; return x >>> 16; };
  const out: string[] = [];
  for (let t = 1; t <= 20000; t++) {
    step(s, [0, 1, 2, 3, 4].map(() => { const r = next(); return (r & 0x0f) | (r & 0x10 ? 16 : 0) | (r & 0x20 ? 64 : 0); }));
    if (s.phase === 'over') { finishRound(m, s); s = startRound(m); }
    if (t % 1000 === 0) out.push(hashState(s));
  }
  return out;
}

describe('determinismo (20.000 ticks)', () => {
  it('mesma semente e entradas → mesmos hashes', () => {
    expect(play(0x12)).toEqual(play(0x12));
  });
  it('sementes diferentes → hashes diferentes', () => {
    expect(play(0x12)).not.toEqual(play(0x34));
  });
  it('o estado é JSON puro (ida e volta idêntica)', () => {
    const m = createMatch(rules(), 3);
    const s = startRound(m);
    for (let i = 0; i < 300; i++) step(s, [16, 0, 64, 0, 0]);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
