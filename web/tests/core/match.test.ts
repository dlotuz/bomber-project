import { createMatch, startRound, finishRound, setRacerPrize, clearRacerPrize } from '../../src/core/match';
import { rules } from './kit';
import type { RoundState } from '../../src/core/types';

const over = (s: RoundState, winner: number | null): RoundState => {
  s.phase = 'over';
  s.result = winner === null ? { kind: 'draw', winner: null, reason: 'time' } : { kind: 'win', winner, reason: 'last' };
  return s;
};

describe('partida', () => {
  it('semente de boot por padrão; RNG passa de rodada para rodada', () => {
    const m = createMatch(rules(), 1);
    expect(m.rng.seed).toBe(0x12);
    const s = startRound(m);
    expect(s.rng).not.toBe(m.rng);
    s.rng.seed = 0x4321;
    finishRound(m, over(s, 0));
    expect(m.rng.seed).toBe(0x4321);
    expect(startRound(m).players.length).toBe(5);
    expect(m.roundNo).toBe(2);
  });
  it('coroas acumulam; a partida acaba na meta; empate não dá coroa; conta uma vez', () => {
    const m = createMatch(rules({ matches: 2 }), 1);
    expect(finishRound(m, over(startRound(m), 2))).toEqual({ winners: [2], matchOver: false, champions: [] });
    const s = over(startRound(m), 2);
    expect(finishRound(m, s)).toEqual({ winners: [2], matchOver: true, champions: [2] });
    expect(finishRound(m, s).winners).toEqual([]);
    expect(m.crowns).toEqual([0, 0, 2, 0, 0]);
    const m2 = createMatch(rules(), 1);
    finishRound(m2, over(startRound(m2), null));
    expect(m2.crowns).toEqual([0, 0, 0, 0, 0]);
  });
  it('rodada que não acabou não conta', () => {
    const m = createMatch(rules(), 1);
    expect(finishRound(m, startRound(m)).winners).toEqual([]);
  });
  it('Em Equipes: +1 para todos os presentes do time do vencedor', () => {
    const m = createMatch(rules({ mode: 'team', teams: [0, 1, 0, 1, 0], active: [true, true, true, true, false] }), 1);
    finishRound(m, over(startRound(m), 2));
    expect(m.crowns).toEqual([1, 0, 1, 0, 0]);
  });
  it('regras copiadas; prêmio do Racer guardado na partida (aplicação na rodada: T16)', () => {
    const r = rules({ racer: true });
    const m = createMatch(r, 1);
    r.active[0] = false;
    expect(m.rules.active[0]).toBe(true);
    setRacerPrize(m, 1, 0);
    expect(m.racerPrize).toEqual({ slot: 1, prize: 0 });
    clearRacerPrize(m);
    expect(m.racerPrize).toBeNull();
  });
  it('spawns aleatórios usam o RNG separado e não mudam a semente do jogo', () => {
    const a = createMatch(rules({ randomSpawns: true }), 8, 0x12);
    const b = createMatch(rules(), 8, 0x12);
    expect(startRound(a).rng.seed).toBe(startRound(b).rng.seed);
  });
});
