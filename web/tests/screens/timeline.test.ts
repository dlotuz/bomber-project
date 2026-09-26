import * as T from '../../src/game/timeline';

describe('tempos da spec §6 e decisões R4–R11, R20–R21, R28', () => {
  it('fase → partida (§6.7)', () => {
    expect(T.STAGE).toMatchObject({ musicAt: 48, titleHideFrom: 48, titleHideTo: 64, blinkFrom: 65, blinkTo: 207, steadyFrom: 208,
      steadyTo: 277, voiceAt: 208, fadeOutAt: 278, audioFadeAt: 310, bankAt: 511, battleMusicAt: 523, roundAt: 646 });
    expect(T.STAGE.fadeOutAt + 15 + T.STAGE_BLACK).toBe(T.STAGE.roundAt);
  });
  it('rolagem da fase: 8 px/f por 16 f, começando 1 f depois do botão', () => {
    expect([0, 1, 2, 15, 16, 17].map(T.stageScrollOffset)).toEqual([0, 8, 16, 120, 128, 128]);
  });
  it('"BATALHA!": pisca a cada frame de f65 a f207, fixo de f208 a f277', () => {
    expect([64, 65, 66, 67, 207, 208, 277, 278].map(T.battleTextVisible)).toEqual([false, true, false, true, true, true, true, false]);
  });
  it('título da fase sobe 2 px/f de f48 a f64', () => {
    expect([47, 48, 56, 64, 70].map(T.stageTitleDy)).toEqual([0, 0, -16, -32, -32]);
  });
  it('intro: 10 pretos, 15 de fade-in, depois 15', () => {
    expect(Array.from({ length: 27 }, (_, i) => T.introBrightness(i + 1)))
      .toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 15, 15]);
  });
  it('faixas: RÁPIDO!! e TEMPO ESGOTADO!', () => {
    expect([0, 10, 191].map(T.hurryX)).toEqual([256, 236, -126]);
    expect([T.hurryVisible(-1), T.hurryVisible(0), T.hurryVisible(191), T.hurryVisible(192)]).toEqual([false, true, true, false]);
    expect([0, 8, 16, 40].map(T.timeUpY)).toEqual([-16, 44, 104, 104]);
  });
  it('fim de rodada (R4–R6) e próxima rodada (R8)', () => {
    expect(T.WIN_END).toEqual({ black: 48, audioFadeAt: 0, crownAt: 15, bankAt: 16, musicAt: 57 });
    expect(T.DRAW_TIME_END).toEqual({ black: 151, audioFadeAt: 1, crownAt: 15, bankAt: 58, musicAt: 68 });
    expect(T.DRAW_DEAD_END).toEqual({ black: 48, audioFadeAt: 0, crownAt: 15, bankAt: 16, musicAt: 26 });
    expect(T.NEXT_ROUND).toEqual({ afterScore: 288, afterDraw: 385, bankAt: 31, musicAt: 43 });
  });
  it('placar (R7, R9) e giro da coroa: 32 quadros, 104 f', () => {
    expect(T.SCORE).toMatchObject({ spinAt: 4, skipFrom: 18, autoAt: 511, victoryMusicAt: 511, descentAt: 557, descentFrames: 128, descentSpeed: 2 });
    expect(T.CROWN_SPIN).toHaveLength(32);
    expect(T.CROWN_SPIN.reduce((a, b) => a + b, 0)).toBe(104);
    expect([0, 9, 10, 27, 103, 104, 500].map(T.crownSpinFrame)).toEqual([0, 9, 10, 18, 31, 31, 31]);
  });
  it('EMPATE (R21) e VITÓRIA', () => {
    expect(T.DRAW_SCENE).toEqual({ skipFrom: 18, growFrom: 34, growTo: 148, colorEvery: 8, voiceAt: 100 });
    expect([33, 34, 91, 148, 200].map(T.drawScale)).toEqual([0, 0, 0.5, 1, 1]);
    expect([148, 155, 156, 164, 172].map(T.drawColor)).toEqual([0, 0, 1, 2, 0]);
    expect(T.VICTORY).toEqual({ buttonsFrom: 557, textFrom: 693, textTo: 703, runFrom: 723, runTo: 763, confettiFrom: 763, jumpAt: 783, voiceAt: 795, outBlack: 123 });
  });
  it('título pisca 64/64; corrida (R20)', () => {
    expect([0, 63, 64, 127, 128].map(T.pressStartVisible)).toEqual([true, true, false, false, true]);
    expect(T.RACER).toEqual({ length: 4096, push: 24, maxSpeed: 64, drag: 1, timeout: 900, showPrize: 180 });
  });
});
