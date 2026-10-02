import { createRound, defaultRules, makeRng, type Bomb } from '../../src/core';
import { SCREEN_H, SCREEN_W } from '../../src/render/display';
import { chargeShadows, prepareFx, SHADOW_BUDGET_MS, SHADOW_PAUSE, SHADOW_WINDOW } from '../../src/render/fx/draw';
import { createFx, type FxFrame } from '../../src/render/fx/state';

/** Contexto 2D falso com pixels de verdade: o que `prepareFx` usa (limpar, ler, escrever recortes). */
class FakeCtx {
  data = new Uint8ClampedArray(SCREEN_W * SCREEN_H * 4);
  globalAlpha = 1; globalCompositeOperation = 'source-over'; fillStyle = '';
  canvas: { width: number; height: number; getContext: () => FakeCtx };
  constructor() { this.canvas = { width: SCREEN_W, height: SCREEN_H, getContext: () => this }; }
  clearRect() { this.data.fill(0); }
  fillRect() { throw new Error('fade < 1 não usado aqui'); }
  getImageData(_x: number, _y: number, w: number, h: number) { return { data: Uint8ClampedArray.from(this.data), width: w, height: h }; }
  createImageData(w: number, h: number) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; }
  putImageData(img: { data: Uint8ClampedArray; width: number }, dx: number, dy: number, x = 0, y = 0, w = img.width, h = SCREEN_H) {
    for (let r = Math.max(0, y); r < Math.min(SCREEN_H, y + h); r++) for (let c = Math.max(0, x); c < Math.min(SCREEN_W, x + w); c++) {
      const i = ((r + dy) * SCREEN_W + c + dx) * 4;
      this.data.set(img.data.subarray(i, i + 4), i);
    }
  }
}

const FLOOR = [47, 125, 58], BODY = [52, 64, 106], MOUNT = [40, 60, 90];
const paint = (ctx: FakeCtx, x0: number, y0: number, x1: number, y1: number, c: number[]) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) ctx.data.set([...c, 255], (y * SCREEN_W + x) * 4);
};
const at = (ctx: FakeCtx, x: number, y: number) => Array.from(ctx.data.slice((y * SCREEN_W + x) * 4, (y * SCREEN_W + x) * 4 + 4));

/** Rodada com uma bomba do P3 centrada em (64, 80) px de base e um quadro em que a montaria cobre a metade de baixo. */
function scene() {
  const round = createRound(1, defaultRules(), makeRng());
  const b: Bomb = { id: 1, owner: 2, bad: false, cell: 0, x: 63 * 256, y: 79 * 256, fuse: 100, fire: 2, type: 0, state: 'idle', dir: 0,
    step: 0, kickedBy: -1, turn: -1, chainAt: 0, born: 0 };
  round.bombs.push(b);
  const fx = createFx();
  const frame: FxFrame = {
    state: fx, round,
    drawNoActors(ctx, bombs) {
      const c = ctx as unknown as FakeCtx;
      paint(c, 0, 0, SCREEN_W - 1, SCREEN_H - 1, FLOOR);
      if (bombs) paint(c, 60, 76, 68, 84, BODY);
    },
  };
  const base = new FakeCtx();
  paint(base, 0, 0, SCREEN_W - 1, SCREEN_H - 1, FLOOR);
  paint(base, 60, 76, 68, 84, BODY);
  paint(base, 56, 80, 72, 90, MOUNT);   // montaria por cima da metade de baixo
  return { fx, frame, base };
}

describe('fx: cor da bomba fora do orçamento das sombras', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { createElement: () => new FakeCtx().canvas });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('janela acima do orçamento pausa só as sombras, por um tempo; depois elas voltam', () => {
    const { fx } = scene();
    for (let i = 0; i < SHADOW_WINDOW; i++) chargeShadows(fx, SHADOW_BUDGET_MS + 1);
    expect(fx.shadowsPause).toBe(SHADOW_PAUSE);
    const r = createRound(1, defaultRules(), makeRng());   // sem bombas: em pausa, não desenha nada
    const frame: FxFrame = { state: fx, round: r, drawNoActors() { throw new Error('não deveria desenhar'); } };
    const base = new FakeCtx() as unknown as CanvasRenderingContext2D;
    for (let i = 0; i < SHADOW_PAUSE; i++) expect(prepareFx(frame, base, 1).mask).toBeNull();
    expect(fx.shadowsPause).toBe(0);   // volta a tentar
  });

  it('um pico isolado não pausa: só a média da janela conta', () => {
    const { fx } = scene();
    chargeShadows(fx, 300);
    for (let i = 1; i < SHADOW_WINDOW; i++) chargeShadows(fx, 1);
    expect(fx.shadowsPause).toBe(0);
  });

  it('com as sombras em pausa a bomba continua na cor do dono, e só na parte à vista (a montaria fica por cima)', () => {
    const { fx, frame, base } = scene();
    fx.shadowsPause = SHADOW_PAUSE;
    const prep = prepareFx(frame, base as unknown as CanvasRenderingContext2D, 1);
    expect(prep.mask).toBeNull();
    const top = at(base, 64, 78);
    expect(top[0]).toBeGreaterThan(top[1] + 40);            // vermelho do P3, não o azul-marinho da arte
    expect(at(base, 64, 82)).toEqual([...MOUNT, 255]);      // montaria na frente: intacta
    expect(at(base, 58, 85)).toEqual([...MOUNT, 255]);
  });

  it('com as sombras ligadas: mesma cor e a máscara das sombras sai junto', () => {
    const { frame, base } = scene();
    const prep = prepareFx(frame, base as unknown as CanvasRenderingContext2D, 1);
    expect(prep.mask).not.toBeNull();
    expect(at(base, 64, 78)[0]).toBeGreaterThan(at(base, 64, 78)[1] + 40);
    expect(at(base, 64, 82)).toEqual([...MOUNT, 255]);
  });
});
