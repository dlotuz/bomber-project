import { parseConfig } from '../../src/game/config';
import { createSession, updateSession, ROUND_OVER_FRAMES, SCOREBOARD_FRAMES, SKIP_AFTER, type Session } from '../../src/game/session';
import { BTN, INTRO_FRAMES } from '../../src/legacy-core';

const idle = [0, 0, 0, 0, 0];
const run = (s: Session, n: number, pads = idle) => { for (let i = 0; i < n; i++) updateSession(s, pads); };
const tap = (s: Session, slot: number, btn: number) => { const p = [0, 0, 0, 0, 0]; p[slot] = btn; updateSession(s, p); updateSession(s, idle); };
const winRound = (s: Session, winner: number) => {
  if (s.round.phase === 'intro') run(s, INTRO_FRAMES + 1);
  s.round.players.forEach((p, i) => { if (i !== winner) p.alive = false; });
  run(s, 1);
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
  it('meta atingida → vitória → START encerra a partida (a tela que hospeda decide o que vem depois)', () => {
    const s = createSession(parseConfig('?players=2&matches=1'), 1);
    winRound(s, 0); run(s, ROUND_OVER_FRAMES); run(s, SCOREBOARD_FRAMES);
    expect(s.phase).toBe('victory');
    expect(s.champions).toEqual([0]);
    tap(s, 0, BTN.START);
    expect(s.finished).toBe(false);
    run(s, SKIP_AFTER); tap(s, 1, BTN.A);
    expect(s.finished).toBe(true);
    expect(s.aborted).toBe(false);
  });
  it('avisos de fim de rodada e de fim de partida (para áudio e webhook)', () => {
    const s = createSession(parseConfig('?players=2&matches=1'), 1);
    winRound(s, 1); run(s, ROUND_OVER_FRAMES);
    expect(s.notices).toEqual([
      { type: 'round_over', winners: [1], crowns: [0, 1, 0, 0, 0] },
      { type: 'match_over', champions: [1], crowns: [0, 1, 0, 0, 0] },
    ]);
  });
  it('na pausa, B pede confirmação; B de novo cancela; A confirma e sai da partida', () => {
    const s = createSession(parseConfig('?players=2'), 1);
    run(s, 5);
    tap(s, 0, BTN.B);
    expect(s.finished).toBe(false);
    expect(s.confirmQuit).toBe(false);
    tap(s, 0, BTN.START);
    expect(s.paused).toBe(true);
    tap(s, 1, BTN.B);
    expect(s.confirmQuit).toBe(true);
    expect(s.finished).toBe(false);
    expect(s.paused).toBe(true);
    tap(s, 1, BTN.B);
    expect(s.confirmQuit).toBe(false);
    expect(s.paused).toBe(true);
    tap(s, 1, BTN.B);
    expect(s.confirmQuit).toBe(true);
    tap(s, 0, BTN.A);
    expect(s.finished).toBe(true);
    expect(s.aborted).toBe(true);
  });
  it('despausar limpa o pedido de confirmação', () => {
    const s = createSession(parseConfig('?players=2'), 1);
    run(s, 5);
    tap(s, 0, BTN.START);
    tap(s, 0, BTN.B);
    expect(s.confirmQuit).toBe(true);
    tap(s, 1, BTN.START);
    expect(s.paused).toBe(false);
    expect(s.confirmQuit).toBe(false);
  });
  it('sessão sem controle humano: pressedAny pausa e confirma a saída', () => {
    const cfg = parseConfig('?players=2');
    cfg.humans = [false, false, false, false, false];
    const s = createSession(cfg, 1);
    expect(s.anyControl).toBe(true);
    run(s, 5);
    updateSession(s, idle, BTN.START); updateSession(s, idle, 0);
    expect(s.paused).toBe(true);
    updateSession(s, idle, BTN.B); updateSession(s, idle, 0);
    expect(s.confirmQuit).toBe(true);
    updateSession(s, idle, BTN.A); updateSession(s, idle, 0);
    expect(s.finished).toBe(true);
    expect(s.aborted).toBe(true);
  });
  it('sessão com humano: pressedAny sozinho não controla nada (só o próprio pad conta)', () => {
    const s = createSession(parseConfig('?players=2'), 1);
    expect(s.anyControl).toBe(false);
    run(s, 5);
    updateSession(s, idle, BTN.START); updateSession(s, idle, 0);
    expect(s.paused).toBe(false);
  });
  it('vitória sem input humano: encerra sozinha depois de 900 frames quando anyControl', () => {
    const cfg = parseConfig('?players=2&matches=1');
    cfg.humans = [false, false, false, false, false];
    const s = createSession(cfg, 1);
    winRound(s, 0);
    run(s, ROUND_OVER_FRAMES);
    run(s, SCOREBOARD_FRAMES);
    expect(s.phase).toBe('victory');
    run(s, 899);
    expect(s.finished).toBe(false);
    run(s, 2);
    expect(s.finished).toBe(true);
    expect(s.aborted).toBe(false);
  });
  it('slots de CPU não pausam e ignoram o controle: quem joga é a IA', () => {
    const mk = () => {
      const cfg = parseConfig('?players=3&seed=4');
      cfg.humans = [true, true, false, false, false];
      return createSession(cfg, 4);
    };
    const a = mk(), b = mk();
    run(a, INTRO_FRAMES + 1); run(b, INTRO_FRAMES + 1);
    tap(a, 2, BTN.START);
    run(b, 2);
    expect(a.paused).toBe(false);
    const noisy = [0, 0, BTN.A | BTN.DOWN | BTN.RIGHT, 0, 0];
    for (let i = 0; i < 60; i++) { updateSession(a, noisy); updateSession(b, idle); }
    const pos = (s: Session) => [s.round.players[2].x, s.round.players[2].y, s.round.bombs.filter(q => q.owner === 2).length];
    expect(pos(a)).toEqual(pos(b));
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
