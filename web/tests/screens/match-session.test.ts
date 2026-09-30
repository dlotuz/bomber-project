import { createMatchSession, beginRound, endRound, closeMatch, carry, resetCarry } from '../../src/game/match-session';
import { parseConfig } from '../../src/game/config';
import { crownsOf, matchRngState } from '../../src/game/core-api';
import { forceWin, runUntil, skipIntro, setCrowns } from './core-helpers';

beforeEach(() => resetCarry());

describe('MatchSession', () => {
  it('semente: ?seed, senão a que veio da partida anterior, senão $0012 (R23)', () => {
    expect(matchRngState(createMatchSession(parseConfig('')).match)).toBe(0x0012);
    carry.seed = 0x4321;
    expect(matchRngState(createMatchSession(parseConfig('')).match)).toBe(0x4321);
    expect(matchRngState(createMatchSession(parseConfig('?seed=7')).match)).toBe(7);
  });
  it('spawns aleatórios: cada partida sorteia a própria ordem, mesmo com a semente $0012 de página nova', () => {
    const orders = new Set<string>();
    for (let i = 0; i < 20; i++) {
      resetCarry();
      const r = beginRound(createMatchSession(parseConfig('?players=2&spawns=1')));
      orders.add(r.players.slice(0, 2).map(p => `${p.x},${p.y}`).join('|'));
    }
    expect(orders.size).toBeGreaterThan(1);
  });
  it('spawns aleatórios com ?seed=: a ordem se repete (partida reproduzível)', () => {
    const at = () => beginRound(createMatchSession(parseConfig('?players=2&spawns=1&seed=7'))).players.map(p => p.x);
    expect(at()).toEqual(at());
  });
  it('beginRound cria a rodada em intro e conta', () => {
    const ms = createMatchSession(parseConfig('?players=2'));
    const r = beginRound(ms);
    expect([r.phase, ms.roundNo, ms.round === r]).toEqual(['intro', 1, true]);
  });
  it('endRound: +1 coroa, vencedores; na meta, partida acabada e campeões', () => {
    const ms = createMatchSession(parseConfig('?players=2&matches=2'));
    let r = beginRound(ms); skipIntro(r); forceWin(r, 1); runUntil(r, x => x.phase === 'over');
    endRound(ms);
    expect([crownsOf(ms.match)[1], ms.lastWinners, ms.over, ms.champions]).toEqual([1, [1], false, []]);
    r = beginRound(ms); skipIntro(r); forceWin(r, 1); runUntil(r, x => x.phase === 'over');
    endRound(ms);
    expect([ms.over, ms.champions]).toEqual([true, [1]]);
  });
  it('closeMatch leva o RNG adiante e zera o prêmio do Racer', () => {
    const ms = createMatchSession(parseConfig('?players=2'));
    const r = beginRound(ms); skipIntro(r); forceWin(r, 0); runUntil(r, x => x.phase === 'over'); endRound(ms);
    carry.racerPrize = { slot: 0, prize: 8 };
    closeMatch(ms);
    expect(carry.seed).toBe(matchRngState(ms.match));
    expect(carry.racerPrize).toBeNull();
  });
  it('o prêmio só entra na partida com Corrida Bônus ligada e Todos contra Todos', () => {
    carry.racerPrize = { slot: 1, prize: 8 };
    expect(createMatchSession(parseConfig('?racer=1')).match.racerPrize).toEqual({ slot: 1, prize: 8 });
    expect(createMatchSession(parseConfig('')).match.racerPrize).toBeNull();
    expect(createMatchSession(parseConfig('?racer=1&mode=team')).match.racerPrize).toBeNull();
  });
  it('setCrowns funciona pela sessão (usado pelos testes das telas)', () => {
    const ms = createMatchSession(parseConfig('?players=2'));
    setCrowns(ms.match, 0, 2);
    expect(crownsOf(ms.match)[0]).toBe(2);
  });
});
