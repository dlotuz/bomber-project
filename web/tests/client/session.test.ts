import { parseConfig } from '../../src/game/config';
import { createSession, updateSession, ROUND_OVER_FRAMES, SCOREBOARD_FRAMES, SKIP_AFTER, type Session } from '../../src/game/session';
import { BTN, INTRO_FRAMES } from '../../src/core';

const idle = [0, 0, 0, 0, 0];
const run = (s: Session, n: number, pads = idle) => { for (let i = 0; i < n; i++) updateSession(s, pads); };
const tap = (s: Session, slot: number, btn: number) => { const p = [0, 0, 0, 0, 0]; p[slot] = btn; updateSession(s, p); updateSession(s, idle); };
const winRound = (s: Session, winner: number) => {
  if (s.round.phase === 'intro') run(s, INTRO_FRAMES + 1);
  s.round.players.forEach((p, i) => { if (i !== winner) p.alive = false; });
  run(s, 1);
};

describe('parseConfig', () => {
  it('padrões', () => {
    const c = parseConfig('');
    expect(c.stage).toBe(1);
    expect(c.rules.active).toEqual([true, true, true, true, true]);
    expect([c.rules.matches, c.rules.timeIdx, c.rules.randomSpawns, c.rules.mode]).toEqual([3, 2, true, 'ffa']);
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

describe('sessão', () => {
  it('começa em batalha com a rodada em intro', () => {
    const s = createSession(parseConfig(''), 1);
    expect(s.phase).toBe('battle');
    expect(s.round.phase).toBe('intro');
    run(s, INTRO_FRAMES + 1);
    expect(s.round.phase).toBe('playing');
  });
  it('fim de rodada → placar com coroa → próxima rodada', () => {
    const s = createSession(parseConfig('?players=2&matches=3'), 1);
    winRound(s, 1);
    expect(s.phase).toBe('roundOver');
    run(s, ROUND_OVER_FRAMES);
    expect(s.phase).toBe('scoreboard');
    expect(s.match.crowns[1]).toBe(1);
    expect(s.lastWinners).toEqual([1]);
    run(s, SCOREBOARD_FRAMES);
    expect(s.phase).toBe('battle');
    expect(s.match.roundNo).toBe(2);
  });
  it('placar só pode ser pulado depois de SKIP_AFTER frames', () => {
    const s = createSession(parseConfig('?players=2&matches=3'), 1);
    winRound(s, 0); run(s, ROUND_OVER_FRAMES);
    run(s, 30); tap(s, 0, BTN.START);
    expect(s.phase).toBe('scoreboard');
    run(s, SKIP_AFTER); tap(s, 0, BTN.START);
    expect(s.phase).toBe('battle');
  });
  it('meta atingida → vitória → START começa partida nova zerada', () => {
    const s = createSession(parseConfig('?players=2&matches=1'), 1);
    winRound(s, 0); run(s, ROUND_OVER_FRAMES); run(s, SCOREBOARD_FRAMES);
    expect(s.phase).toBe('victory');
    expect(s.champions).toEqual([0]);
    tap(s, 0, BTN.START);
    expect(s.phase).toBe('victory');
    run(s, SKIP_AFTER); tap(s, 1, BTN.A);
    expect(s.phase).toBe('battle');
    expect(s.matchNo).toBe(2);
    expect(s.match.crowns).toEqual([0, 0, 0, 0, 0]);
  });
  it('START pausa e retoma; slot inativo não pausa', () => {
    const s = createSession(parseConfig('?players=2'), 1);
    run(s, 10);
    tap(s, 4, BTN.START);
    expect(s.paused).toBe(false);
    tap(s, 0, BTN.START);
    expect(s.paused).toBe(true);
    const f = s.round.frame;
    run(s, 20);
    expect(s.round.frame).toBe(f);
    tap(s, 0, BTN.START);
    expect(s.paused).toBe(false);
  });
  it('START já pressionado ao abrir a partida (initialPads) não pausa no primeiro tick', () => {
    const pads = [BTN.START, 0, 0, 0, 0];
    const s = createSession(parseConfig('?players=2'), 1, pads);
    expect(s.prevPads).toEqual(pads);
    updateSession(s, pads);
    expect(s.paused).toBe(false);
  });
  it('modo time: time 0 vence → campeões são todos os slots do time 0', () => {
    const s = createSession(parseConfig('?players=5&mode=team&matches=1'), 1);
    run(s, INTRO_FRAMES + 1);
    s.round.players.forEach(p => { if (p.team !== 0) p.alive = false; });
    run(s, 1);
    expect(s.phase).toBe('roundOver');
    run(s, ROUND_OVER_FRAMES);
    expect(s.phase).toBe('scoreboard');
    expect(s.champions).toEqual([0, 2, 4]);
    run(s, SCOREBOARD_FRAMES);
    expect(s.phase).toBe('victory');
  });
  it('empate por tempo esgotado: sem vencedor, sem coroa, ainda vai a placar', () => {
    const s = createSession(parseConfig('?players=2&matches=3'), 1);
    run(s, INTRO_FRAMES + 1);
    s.round.timeLeft = 1;
    run(s, 1);
    expect(s.phase).toBe('roundOver');
    run(s, ROUND_OVER_FRAMES);
    expect(s.phase).toBe('scoreboard');
    expect(s.lastWinners).toEqual([]);
    expect(s.match.crowns).toEqual([0, 0, 0, 0, 0]);
  });
});
