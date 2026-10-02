// Cor da bomba na mão com os gráficos da ROM: o quadro completo, o "só bombas" e o "sem bombas" saem da mesma montagem
// que a tela usa (buildBattleFrame + PPU). A bomba na mão fica na cor do DONO — inclusive na mão de outro jogador — e
// a cor nunca pinta a mão, a cabeça ou o corpo de quem segura (pixels em que o jogador passa na frente da bomba).
import { CODE, cellOf, type RoundState } from '../../src/core';
import { placeBombAt } from '../../src/core/mounts/core-api';
import { buildBattleFrame, type BuildOpts } from '../../src/render/rom/battle';
import { renderPpu } from '../../src/render/ppu';
import { BOMB_COLORS, bombMask, isBombBody, tintBombsInPlace } from '../../src/render/fx/bomb-tint';
import { bombSpots } from '../../src/render/fx/draw';
import { ASSETS } from '../mounts/rom-helpers';
import { BTN, mkRound, placePx, run, cx, cy } from '../mounts/helpers';

const W = 256, H = 224;
const [WHITE, , RED] = BOMB_COLORS;
function render(s: RoundState, opts: BuildOpts = {}): Uint8ClampedArray {
  const img = { data: new Uint8ClampedArray(W * H * 4), width: W, height: H } as ImageData;
  renderPpu(buildBattleFrame(s, { crowns: [0, 0, 0, 0, 0] }, ASSETS!, s.tick, opts), img);
  return img.data;
}
const withoutBombs = (s: RoundState): RoundState => ({ ...s, grid: s.grid.map(v => (v === CODE.BOMB ? CODE.FLOOR : v)), bombs: [] });
const same = (a: Uint8ClampedArray, b: Uint8ClampedArray, i: number) => a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2];

/** P1 (branco) segura a bomba do P3 (vermelho) em (8, 5); P2 (preto) a do P1 em (4, 5); P3 a própria em (11, 5). */
function scene(ticks: number) {
  const s = mkRound({ players: [0, 1, 2] });
  const [p1, p2, p3] = [0, 1, 2].map(i => s.players[i]);
  for (const p of [p1, p2, p3]) { p.glove = true; p.bombsFree = 3; }
  placePx(s, 0, cx(4), cy(5)); expect(placeBombAt(s, p1, cellOf(4, 5), [])).toBe(true);
  placePx(s, 2, cx(8), cy(5)); expect(placeBombAt(s, p3, cellOf(8, 5), [])).toBe(true);
  placePx(s, 2, cx(11), cy(5)); expect(placeBombAt(s, p3, cellOf(11, 5), [])).toBe(true);
  placePx(s, 0, cx(8), cy(5)); placePx(s, 1, cx(4), cy(5));
  p1.face = 4; p2.face = 4; p3.face = 4;
  run(s, ticks, { 0: BTN.A, 1: BTN.A, 2: BTN.A });
  expect(s.bombs.map(b => b.state)).toEqual(['held', 'held', 'held']);
  const base = render(s);
  const only = render(s, { sprites: false, layers: [], bombSprites: true });
  const none = render(withoutBombs(s), { sprites: false, layers: [] });
  const vis = new Uint8ClampedArray(W * H * 4);
  bombMask(base, only, none, vis);
  const tinted = Uint8ClampedArray.from(base);
  tintBombsInPlace(tinted, vis, W, bombSpots(s));
  const spot = (slot: number) => {
    const p = s.players[slot];
    return bombSpots(s).find(([x]) => Math.abs(x - (p.x >> 8)) <= 1)!;
  };
  return { s, base, only, none, tinted, spot };
}

/** Pixels da caixa 16×16 em volta de (x, y) que satisfazem `f`. */
function count(x: number, y: number, f: (i: number) => boolean): number {
  let n = 0;
  for (let dy = -8; dy < 8; dy++) for (let dx = -8; dx < 8; dx++) if (f(((y + dy) * W + x + dx) * 4)) n++;
  return n;
}

describe.skipIf(!ASSETS)('ROM: cor da bomba na mão', () => {
  for (const ticks of [1, 2, 3, 10]) {
    it(`${ticks} tick(s) de A (levantar → segurando): só pixel de bomba à vista muda; quem segura nunca é pintado`, () => {
      const { base, only, none, tinted, spot } = scene(ticks);
      expect(spot(0)[2]).toBe(RED);     // P1 com a bomba do P3
      expect(spot(1)[2]).toBe(WHITE);   // P2 com a bomba do P1
      expect(spot(2)[2]).toBe(RED);     // P3 com a própria
      for (let i = 0; i < base.length; i += 4) if (!same(tinted, base, i)) expect(same(base, only, i) && !same(only, none, i)).toBe(true);
    });
  }

  it('segurando: todo o corpo à vista sai na cor do dono (P3 vermelho na mão do P1, P1 branco na mão do P2); mão e cabeça por cima ficam intactas', () => {
    const { base, only, none, tinted, spot } = scene(10);
    const vis = new Uint8ClampedArray(W * H * 4);
    bombMask(base, only, none, vis);
    const red = (i: number) => tinted[i] > tinted[i + 2] + 40;
    const white = (i: number) => Math.abs(tinted[i] - tinted[i + 2]) < 12 && Math.abs(tinted[i] - tinted[i + 1]) < 12 && tinted[i] > 60;
    for (const slot of [0, 1, 2]) {
      const [x, y] = spot(slot);
      expect(count(x, y, i => !same(only, none, i))).toBeGreaterThan(40);      // a ROM desenha a bomba ali (objeto)
      const body = (i: number) => vis[i + 3] === 255 && isBombBody(base[i], base[i + 1], base[i + 2]);
      expect(count(x, y, body)).toBeGreaterThan(4);                             // parte do corpo à vista, acima da cabeça
      expect(count(x, y, i => body(i) && !(slot === 1 ? white : red)(i))).toBe(0);   // e toda ela na cor do dono
      // pixels de bomba com o jogador na frente (mão/cabeça): existem e nenhum foi pintado
      const covered = (i: number) => !same(only, none, i) && !same(base, only, i);
      expect(count(x, y, covered)).toBeGreaterThan(20);
      expect(count(x, y, i => covered(i) && !same(tinted, base, i))).toBe(0);
    }
  });

  it('arremessadas (no ar e quicando): cada bomba continua na cor do dono, não na de quem a jogou', () => {
    const { s } = scene(10);
    run(s, 1);   // todos soltam o A: arremesso (P2 joga a do P1; P1 a do P3; P3 a própria)
    expect(s.flyers.filter(f => f.kind === 'bomb')).toHaveLength(3);
    let painted = 0;
    for (let k = 0; k < 60 && s.flyers.some(f => f.kind === 'bomb'); k++) {
      const base = render(s), only = render(s, { sprites: false, layers: [], bombSprites: true }), none = render(withoutBombs(s), { sprites: false, layers: [] });
      const vis = new Uint8ClampedArray(W * H * 4);
      bombMask(base, only, none, vis);
      const tinted = Uint8ClampedArray.from(base);
      const spots = bombSpots(s);
      tintBombsInPlace(tinted, vis, W, spots);
      for (const f of s.flyers) {
        if (f.kind !== 'bomb') continue;
        const b = s.bombs.find(q => q.id === f.ref)!;
        const sp = spots.find(([x, y]) => x === f.x >> 8 && y === (f.y >> 8) + Math.min(0, f.z))!;
        expect(sp[2]).toBe(b.owner === 0 ? WHITE : RED);
        const [x, y] = sp;
        if (x >= 8 && x < 248) painted += count(x, y, i => !same(tinted, base, i));
      }
      for (let i = 0; i < base.length; i += 4) if (!same(tinted, base, i)) expect(same(base, only, i) && !same(only, none, i)).toBe(true);
      run(s, 1);
    }
    expect(painted).toBeGreaterThan(200);
  });
});
