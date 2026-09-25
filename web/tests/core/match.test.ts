import { createMatch, startRound, finishRound, hashState, step, defaultRules, makeRng, randInt, BTN, type RoundState } from '../../src/core';

const rules = (o = {}) => ({ ...defaultRules(), ...o });

describe('partida', () => {
  it('coroas acumulam e a partida acaba na meta', () => {
    const m = createMatch(rules({ matches: 2 }), 1, 123);
    let r = startRound(m); r.phase = 'result'; r.winners = [0];
    expect(finishRound(m, r)).toEqual({ winners: [0], matchOver: false, champions: [] });
    r = startRound(m); r.phase = 'result'; r.winners = [0];
    expect(finishRound(m, r)).toEqual({ winners: [0], matchOver: true, champions: [0] });
    expect(m.crowns).toEqual([2, 0, 0, 0, 0]);
  });
  it('empate não dá coroa', () => {
    const m = createMatch(rules(), 1, 1);
    const r = startRound(m); r.phase = 'result'; r.winners = [];
    finishRound(m, r);
    expect(m.crowns).toEqual([0, 0, 0, 0, 0]);
  });
  it('cada rodada tem seed diferente (spawns variam)', () => {
    const m = createMatch(rules({ randomSpawns: true }), 1, 7);
    const pos = new Set<string>();
    for (let i = 0; i < 6; i++) pos.add(startRound(m).players.map(p => p.x + ',' + p.y).join('|'));
    expect(pos.size).toBeGreaterThan(1);
  });
  it('createMatch guarda uma cópia das regras (mutar o objeto original não afeta a partida)', () => {
    const original = rules({ matches: 3, teams: [0, 1, 0, 1, 0], active: [true, true, true, true, true] });
    const m = createMatch(original, 1, 1);
    original.matches = 99;
    original.teams[0] = 1;
    original.active[0] = false;
    expect(m.rules.matches).toBe(3);
    expect(m.rules.teams[0]).toBe(0);
    expect(m.rules.active[0]).toBe(true);
  });
  it('finishRound: rodada que não terminou não conta coroa', () => {
    const m = createMatch(rules(), 1, 1);
    const r = startRound(m); // ainda em 'intro', não 'result'
    r.winners = [0];
    const champions = [0, 1, 2, 3, 4].filter(i => m.crowns[i] >= m.rules.matches);
    expect(finishRound(m, r)).toEqual({ winners: [], matchOver: m.over, champions });
    expect(m.crowns).toEqual([0, 0, 0, 0, 0]);
  });
  it('finishRound: chamar duas vezes na mesma rodada não conta a coroa de novo', () => {
    const m = createMatch(rules({ matches: 2 }), 1, 1);
    const r = startRound(m); r.phase = 'result'; r.winners = [0];
    const first = finishRound(m, r);
    expect(first.winners).toEqual([0]);
    expect(m.crowns).toEqual([1, 0, 0, 0, 0]);
    const second = finishRound(m, r);
    expect(second).toEqual({ winners: [], matchOver: m.over, champions: [] });
    expect(m.crowns).toEqual([1, 0, 0, 0, 0]);
  });
});

describe('determinismo (partida inteira, 20.000 ticks)', () => {
  // Roda uma partida completa (com reinício da partida ao terminar), com um RNG de inputs
  // separado do RNG do jogo, exercitando movimento, bombas, chute/soco/luva e morte súbita.
  const matchRules = () => rules({ timeIdx: 0, suddenDeath: true, randomSpawns: true, matches: 5 });
  const DIRS = [0, BTN.UP, BTN.DOWN, BTN.LEFT, BTN.RIGHT];
  const TOTAL_TICKS = 20000;

  const arm = (r: RoundState): void => {
    for (const p of r.players) { p.kick = true; p.punch = true; p.glove = true; }
  };

  function play(seed: number): string[] {
    let m = createMatch(matchRules(), 1, seed);
    const inRng = makeRng(seed * 31 + 1);
    const curDir = [0, 0, 0, 0, 0];
    const hashes: string[] = [];
    let r = startRound(m);
    arm(r);
    for (let tick = 1; tick <= TOTAL_TICKS; tick++) {
      if (r.phase === 'result') {
        finishRound(m, r);
        if (m.over) m = createMatch(matchRules(), 1, seed);
        r = startRound(m);
        arm(r);
      }
      const inputs = [0, 1, 2, 3, 4].map(i => {
        if (randInt(inRng, 16) === 0) curDir[i] = DIRS[randInt(inRng, DIRS.length)];
        let btn = curDir[i];
        if (randInt(inRng, 40) === 0) btn |= BTN.A;
        if (randInt(inRng, 80) === 0) btn |= BTN.Y;
        return btn;
      });
      step(r, inputs);
      if (tick % 1000 === 0) hashes.push(hashState(r));
    }
    return hashes;
  }

  it('mesma seed e mesmos inputs → hashes idênticos a cada 1000 ticks', () => {
    expect(play(5)).toEqual(play(5));
  });
  it('seeds diferentes → hashes diferentes', () => {
    expect(play(5)).not.toEqual(play(6));
  });

  // GOLDEN: hash do estado no tick 20000 (última entrada de play(5)), calculado uma vez com este
  // código. Atualizar deliberadamente quando as regras do core mudarem de propósito.
  const GOLDEN = '9426211e';
  it('hash final da seed 5 é estável (golden)', () => {
    const hashes = play(5);
    expect(hashes[hashes.length - 1]).toBe(GOLDEN);
  });
});
