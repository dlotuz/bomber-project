// Cor da bomba × montaria com os gráficos da ROM: o quadro completo, o "só bombas" e o "sem bombas" saem da mesma
// montagem que a tela usa (buildBattleFrame + PPU), e a cor só entra nos pixels de bomba que a ROM deixa à vista.
import { CODE, cellOf, type RoundState } from '../../src/core';
import { placeBombAt } from '../../src/core/mounts/core-api';
import { buildBattleFrame, type BuildOpts } from '../../src/render/rom/battle';
import { renderPpu } from '../../src/render/ppu';
import { bombMask, tintBombsInPlace } from '../../src/render/fx/bomb-tint';
import { bombSpots } from '../../src/render/fx/draw';
import { ASSETS } from '../mounts/rom-helpers';
import { mkRound, placePx, ride, cx, cy } from '../mounts/helpers';

const W = 256, H = 224;
function render(s: RoundState, opts: BuildOpts = {}): Uint8ClampedArray {
  const img = { data: new Uint8ClampedArray(W * H * 4), width: W, height: H } as ImageData;
  renderPpu(buildBattleFrame(s, { crowns: [0, 0, 0, 0, 0] }, ASSETS!, s.tick, opts), img);
  return img.data;
}
const withoutBombs = (s: RoundState): RoundState => ({ ...s, grid: s.grid.map(v => (v === CODE.BOMB ? CODE.FLOOR : v)), bombs: [] });
const same = (a: Uint8ClampedArray, b: Uint8ClampedArray, i: number) => a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2];

/** P1 montado na casa (6, 5) com uma bomba embaixo dele e outra na casa da esquerda (P1 = branco; P3 = vermelho). */
function scene(type: number, phase: 'mounting' | 'riding' | 'dismount') {
  const s = mkRound({ players: [0, 2] });
  const p1 = placePx(s, 0, cx(6), cy(5)), p3 = placePx(s, 2, cx(9), cy(9));
  p1.face = 6; p1.act = 'idle'; p1.actT0 = s.tick;
  p1.bombsFree = p3.bombsFree = 2;
  expect(placeBombAt(s, p3, cellOf(5, 5), [])).toBe(true);   // vizinha à esquerda, do P3
  expect(placeBombAt(s, p3, cellOf(6, 5), [])).toBe(true);   // embaixo do montado
  ride(s, 0, type, { phase, t0: s.tick - 4 });
  s.tick += 4;
  const base = render(s);
  const only = render(s, { sprites: false, layers: [], bombSprites: true });
  const none = render(withoutBombs(s), { sprites: false, layers: [] });
  const vis = new Uint8ClampedArray(W * H * 4);
  bombMask(base, only, none, vis);
  const tinted = Uint8ClampedArray.from(base);
  tintBombsInPlace(tinted, vis, W, bombSpots(s));
  return { s, base, only, none, tinted };
}

/** Pixels da caixa 16×16 da bomba centrada em (x, y) que satisfazem `f`. */
function count(x: number, y: number, f: (i: number) => boolean): number {
  let n = 0;
  for (let dy = -8; dy < 8; dy++) for (let dx = -8; dx < 8; dx++) if (f(((y + dy) * W + x + dx) * 4)) n++;
  return n;
}

describe.skipIf(!ASSETS)('ROM: cor da bomba com montaria', () => {
  for (const type of [0x2, 0x3]) for (const phase of ['mounting', 'riding', 'dismount'] as const) {
    it(`tipo ${type.toString(16)} ${phase}: a bomba vizinha mantém a cor do dono; quem está na frente nunca é pintado`, () => {
      const { s, base, only, none, tinted } = scene(type, phase);
      const [[nx, ny], [ux, uy]] = bombSpots(s).sort((a, b) => a[0] - b[0]);
      // a ROM desenha as duas bombas (BG2): o "só bombas" difere do "sem bombas" nas duas casas
      expect(count(nx, ny, i => !same(only, none, i))).toBeGreaterThan(40);
      expect(count(ux, uy, i => !same(only, none, i))).toBeGreaterThan(40);
      // vizinha (P3, vermelho): o corpo à vista foi repintado
      expect(count(nx, ny, i => !same(tinted, base, i) && tinted[i] > tinted[i + 2] + 40)).toBeGreaterThan(10);
      // em toda a tela, pixel mexido = pixel de bomba à vista (o quadro completo ainda mostra a bomba ali)
      for (let i = 0; i < base.length; i += 4) if (!same(tinted, base, i)) expect(same(base, only, i) && !same(only, none, i)).toBe(true);
    });
  }

  it('montado em cima da própria bomba: a montaria cobre a bomba e continua intacta (sem pontos de cor nela)', () => {
    const { s, base, only, tinted } = scene(0x2, 'riding');
    const [, [ux, uy]] = bombSpots(s).sort((a, b) => a[0] - b[0]);
    const covered = count(ux, uy, i => !same(base, only, i));   // pixels em que um sprite está na frente da bomba
    expect(covered).toBeGreaterThan(100);
    expect(count(ux, uy, i => !same(base, only, i) && !same(tinted, base, i))).toBe(0);
  });
});
