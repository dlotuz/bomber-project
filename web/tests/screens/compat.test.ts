import * as core from '../../src/game/core-api';
import * as rom from '../../src/app/rom-api';
import { forceWin, forceAllDead, forceClock, runUntil, skipIntro, setCrowns, IDLE } from './core-helpers';

const rules5 = () => ({ ...core.defaultRules(), active: [true, true, true, true, true] });
const rules2 = () => ({ ...core.defaultRules(), active: [true, true, false, false, false] });

describe('porta do núcleo (plano 6)', () => {
  it('exporta tudo o que o plano 10 usa', () => {
    const names = ['BTN', 'startRound', 'step', 'finishRound', 'createAi', 'aiInputs', 'defaultRules', 'rnd', 'newMatch',
      'phaseElapsed', 'crownsOf', 'matchGoal', 'matchRngState', 'isDraw', 'drawReason', 'roundWinnerSlots', 'isMatchOver',
      'championSlots', 'eventType', 'racerPrizeKey', 'RACER_PRIZE_COUNT', 'finishRoundInfo', 'drawRacerPrize'] as const;
    for (const n of names) expect((core as Record<string, unknown>)[n], n).toBeDefined();
  });
  it('BTN tem os 12 botões da §2.6', () => {
    expect(core.BTN).toMatchObject({ UP: 1, DOWN: 2, LEFT: 4, RIGHT: 8, A: 16, B: 32, Y: 64, START: 128, X: 256, L: 512, R: 1024, SELECT: 2048 });
  });
  it('intro: 62 passos (10 + 52); o 62º já põe play (INTRO_TICKS do plano 6); phaseElapsed conta os passos', () => {
    const r = core.startRound(core.newMatch(rules2(), 1, 0x0012, null));
    expect(r.phase).toBe('intro');
    for (let i = 1; i <= 61; i++) {
      core.step(r, IDLE);
      expect(r.phase, `passo ${i}`).toBe('intro');
      expect(core.phaseElapsed(r)).toBe(i);
    }
    core.step(r, IDLE);
    expect(r.phase).toBe('play');
    expect(core.phaseElapsed(r)).toBe(0);
  });
  it('racerPrizeKey segue a tabela $C2:08F4 (decisão 18 do plano 6)', () => {
    expect(Array.from({ length: 17 }, (_, i) => core.racerPrizeKey(i))).toEqual(['bomb+1', 'pierce', 'fire+1', 'fullFire',
      'speed+1', 'remote+glove', 'glove', 'glove', 'kick', 'none', 'none', 'passBomb', 'passSoft', 'speed-1', 'punch', 'heart', 'p']);
  });
  it('finishRoundInfo devolve vencedores, fim de partida e campeões', () => {
    const m = core.newMatch(rules2(), 1, 0x0012, null);
    const r = core.startRound(m);
    runUntil(r, x => x.phase !== 'intro');
    forceWin(r, 0);
    runUntil(r, x => x.phase === 'over');
    expect(core.finishRoundInfo(m, r)).toEqual({ winners: [0], matchOver: false, champions: [] });
  });
  it('newMatch guarda a semente de 16 bits e a partida começa sem coroas', () => {
    const m = core.newMatch(rules5(), 1, 0xbeef, null);
    expect(core.matchRngState(m)).toBe(0xbeef);
    expect(core.crownsOf(m)).toEqual([0, 0, 0, 0, 0]);
    expect(core.matchGoal(m)).toBe(3);
  });
  it('17 prêmios do Racer, cada um com chave conhecida', () => {
    expect(core.RACER_PRIZE_COUNT).toBe(17);
    const keys = new Set(['bomb+1', 'pierce', 'fire+1', 'fullFire', 'speed+1', 'remote+glove', 'glove', 'kick', 'none',
      'passBomb', 'passSoft', 'speed-1', 'punch', 'heart', 'p']);
    for (let i = 0; i < 17; i++) expect(keys.has(core.racerPrizeKey(i)), `prêmio ${i}`).toBe(true);
  });
});

describe('ajudantes de teste do núcleo', () => {
  it('forceWin → over com vencedor; finishRound dá +1 coroa', () => {
    const m = core.newMatch(rules5(), 1, 0x0012, null);
    const r = core.startRound(m);
    skipIntro(r);
    forceWin(r, 2);
    runUntil(r, x => x.phase === 'over');
    expect(r.result && core.isDraw(r.result)).toBe(false);
    expect(core.roundWinnerSlots(m, r.result!)).toEqual([2]);
    core.finishRound(m, r);
    expect(core.crownsOf(m)[2]).toBe(1);
  });
  it('forceAllDead → EMPATE por mortes', () => {
    const r = core.startRound(core.newMatch(rules5(), 1, 0x0012, null));
    skipIntro(r);
    forceAllDead(r);
    runUntil(r, x => x.phase === 'over');
    expect(core.drawReason(r.result!)).toBe('dead');
  });
  it('forceClock(1) → time_up, 160 ticks de TIME UP e EMPATE por tempo', () => {
    const r = core.startRound(core.newMatch(rules5(), 1, 0x0012, null));
    skipIntro(r);
    forceClock(r, 1);
    const ev = core.step(r, IDLE);
    expect(ev.map(core.eventType)).toContain('time_up');
    const n = runUntil(r, x => x.phase === 'over');
    expect(n).toBeGreaterThanOrEqual(159);
    expect(n).toBeLessThanOrEqual(161);
    expect(core.drawReason(r.result!)).toBe('time');
  });
  it('forceClock(62) → hurry no passo seguinte', () => {
    const r = core.startRound(core.newMatch(rules5(), 1, 0x0012, null));
    skipIntro(r);
    forceClock(r, 62);
    expect(core.step(r, IDLE).map(core.eventType)).toContain('hurry');
  });
  it('setCrowns + vitória na meta → partida acabada, campeão', () => {
    const m = core.newMatch(rules2(), 1, 0x0012, null);
    setCrowns(m, 1, 2);
    const r = core.startRound(m);
    skipIntro(r);
    forceWin(r, 1);
    runUntil(r, x => x.phase === 'over');
    core.finishRound(m, r);
    expect(core.isMatchOver(m)).toBe(true);
    expect(core.championSlots(m)).toEqual([1]);
  });
});

describe('porta do rom/ppu/áudio (plano 5)', () => {
  it('exporta estado, PPU, desenho da partida e sink', () => {
    expect(rom.romState).toHaveProperty('assets');
    for (const f of [rom.onRomChange, rom.openRomDialog, rom.renderPpu, rom.drawRomBattle, rom.sceneVramCgram, rom.tilesFrom,
      rom.readColors, rom.bgr555ToRgba, rom.zteBlock, rom.forgetStoredRom]) expect(typeof f).toBe('function');
    const s = new rom.NoopSink();
    for (const m of ['bank', 'music', 'sfx', 'voice', 'stop', 'fade', 'tick'] as const) expect(typeof s[m]).toBe('function');
  });
  it('BGR555 → RGB com c8 = c<<3 | c>>2', () => {
    expect(rom.bgr555ToRgba(0x7fff)).toEqual([255, 255, 255]);
    expect(rom.bgr555ToRgba(0x001f)).toEqual([255, 0, 0]);
    expect(rom.bgr555ToRgba(0x0400)).toEqual([0, 0, 8]);
  });
  it('tilesFrom decodifica 2bpp planar', () => {
    const b = new Uint8Array(16); b[0] = 0x80; b[1] = 0x80;   // pixel (0,0) = cor 3
    const t = rom.tilesFrom(b, 0, 1, 2);
    expect(t.count).toBe(1);
    expect(t.px[0]).toBe(3);
    expect(t.px[1]).toBe(0);
  });
});
