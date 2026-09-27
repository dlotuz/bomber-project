/** Tempos de tela do Battle (spec §6; "f" = frames de vídeo) e as decisões R4–R11, R20–R21 e R28 do plano 10. */
export const TITLE = { cursorX: 56, rowsY: [148, 164, 180], blink: 64 } as const;
export const STAGE = {
  repeatFirst: 36, repeatEvery: 21, scrollPx: 8, scrollFrames: 16,
  musicAt: 48, titleHideFrom: 48, titleHideTo: 64, blinkFrom: 65, blinkTo: 207, steadyFrom: 208, steadyTo: 277,
  voiceAt: 208, fadeOutAt: 278, audioFadeAt: 310, bankAt: 511, battleMusicAt: 523, roundAt: 646,
} as const;
/** Preto entre o fim do fade-out (f292) e a criação da rodada (f646). */
export const STAGE_BLACK = STAGE.roundAt - STAGE.fadeOutAt - 15;   // 353
export const INTRO = { black: 10, fade: 15, hold: 37 } as const;
export const BANNER = { hurryTop: 120, hurrySpeed: 2, hurryTicks: 192, timeUpFall: 16, timeUpY0: -16, timeUpY1: 104 } as const;
export const PAUSE = { quitHold: 60 } as const;
export const WIN_END = { black: 48, audioFadeAt: 0, crownAt: 15, bankAt: 16, musicAt: 57 } as const;
/** EMPATEs medidos no emulador (plano 11, M1: analise/investigacao/audio/empates.py): fade-in da tela EMPATE em
 *  FADE+118 nos dois casos (preto de 104 f) e voz $0E em S = 147, quando as letras acabam de crescer. */
export const DRAW_TIME_END = { black: 104, audioFadeAt: 1, crownAt: 15, bankAt: 58, musicAt: 68 } as const;
export const DRAW_DEAD_END = { black: 104, audioFadeAt: 0, crownAt: 15, bankAt: 57, musicAt: 68 } as const;
export const NEXT_ROUND = { afterScore: 288, afterDraw: 385, bankAt: 31, musicAt: 43 } as const;
export const SCORE = {
  spinAt: 4, skipFrom: 18, autoAt: 511, victoryMusicAt: 511, descentAt: 557, descentFrames: 128, descentSpeed: 2,
  rowY0: 56, rowStep: 32, headX: 48, crownX: [80, 112, 144, 176, 208],
} as const;
/** Durações da animação C3:DA94 [spec §6.10]: 1×10, 2×9, 3×4, 4, 5×3, 6, 7, 8, 10, 14. */
export const CROWN_SPIN: readonly number[] = [...Array(10).fill(1), ...Array(9).fill(2), ...Array(4).fill(3), 4, 5, 5, 5, 6, 7, 8, 10, 14];
export const DRAW_SCENE = { skipFrom: 18, growFrom: 34, growTo: 148, colorEvery: 8, voiceAt: 147 } as const;
export const VICTORY = { buttonsFrom: 557, textFrom: 693, textTo: 703, runFrom: 723, runTo: 763, confettiFrom: 763, jumpAt: 783, voiceAt: 795, outBlack: 123 } as const;
export const RACER = { length: 4096, push: 24, maxSpeed: 64, drag: 1, timeout: 900, showPrize: 180 } as const;

export const pressStartVisible = (s: number): boolean => Math.floor(s / TITLE.blink) % 2 === 0;
export const stageScrollOffset = (f: number): number => Math.max(0, Math.min(STAGE.scrollPx * STAGE.scrollFrames, STAGE.scrollPx * f));
export function battleTextVisible(f: number): boolean {
  if (f >= STAGE.blinkFrom && f <= STAGE.blinkTo) return (f - STAGE.blinkFrom) % 2 === 0;
  return f >= STAGE.steadyFrom && f <= STAGE.steadyTo;
}
export function stageTitleDy(f: number): number {
  const d = Math.max(0, Math.min(f, STAGE.titleHideTo) - STAGE.titleHideFrom);
  return d === 0 ? 0 : -2 * d;   // evita -0 nos testes
}
/** Brilho do intro pelos passos já dados (1 = 1º passo). */
export const introBrightness = (steps: number): number => (steps <= INTRO.black ? 0 : Math.min(15, steps - INTRO.black));
export const hurryX = (t: number): number => 256 - BANNER.hurrySpeed * t;
export const hurryVisible = (t: number): boolean => t >= 0 && t < BANNER.hurryTicks;
export function timeUpY(t: number): number {
  const k = Math.max(0, Math.min(t, BANNER.timeUpFall));
  return Math.round(BANNER.timeUpY0 + ((BANNER.timeUpY1 - BANNER.timeUpY0) * k) / BANNER.timeUpFall);
}
/** Quadro da coroa girando `t` frames depois do início do giro (fica no último). */
export function crownSpinFrame(t: number): number {
  let acc = 0;
  for (let i = 0; i < CROWN_SPIN.length; i++) { acc += CROWN_SPIN[i]; if (t < acc) return i; }
  return CROWN_SPIN.length - 1;
}
export function drawScale(s: number): number {
  if (s <= DRAW_SCENE.growFrom) return 0;
  if (s >= DRAW_SCENE.growTo) return 1;
  return (s - DRAW_SCENE.growFrom) / (DRAW_SCENE.growTo - DRAW_SCENE.growFrom);
}
/** 0 vermelho, 1 amarelo, 2 verde; troca a cada 8 f depois do crescimento. */
export const drawColor = (s: number): number => (s < DRAW_SCENE.growTo ? 0 : Math.floor((s - DRAW_SCENE.growTo) / DRAW_SCENE.colorEvery) % 3);
