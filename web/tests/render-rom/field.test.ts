import { FLAME_PHASE, flameWord, itemBurnWord, scriptWord, softBurnWord } from '../../src/render/anim/grid-seq';
import { WORD_PRESSURE, fieldWords } from '../../src/render/rom/field';
import { romTables } from '../../src/render/rom/tables';
import type { FlamePieceName, RomClock, RomScene } from '../../src/render/rom/scene';
import { NORMAL_BOMB, REMOTE_BOMB, fakeAssets, fakeRound } from './fakes';

/** Corridas [valor, repetições] de f(0..n−1). */
function runs<T>(f: (t: number) => T, n: number): [T, number][] {
  const out: [T, number][] = [];
  for (let t = 0; t < n; t++) {
    const v = f(t);
    if (out.length && out[out.length - 1][0] === v) out[out.length - 1][1]++;
    else out.push([v, 1]);
  }
  return out;
}

describe('sequências da grade', () => {
  it('bomba normal: 0B00/02/04/06 por 18, 12, 16, 16, 20, 12, 16 (1º quadro 2 ticks mais curto)', () => {
    expect(runs(a => scriptWord(NORMAL_BOMB, a), 110)).toEqual([
      [0x0b00, 18], [0x0b02, 12], [0x0b04, 16], [0x0b06, 16], [0x0b00, 20], [0x0b02, 12], [0x0b04, 16]]);
  });
  it('bomba remota: 0B08…0E, 16 cada (1º 14)', () => {
    expect(runs(a => scriptWord(REMOTE_BOMB, a), 62)).toEqual([[0x0b08, 14], [0x0b0a, 16], [0x0b0c, 16], [0x0b0e, 16]]);
  });
  it('chama: A2 B2 C2 B2 C2 B2 C2 B2 C2 B2 C2 B2 A1 = 25 ticks', () => {
    expect(FLAME_PHASE).toHaveLength(25);
    expect(runs(a => flameWord('center', a), 25)).toEqual([
      [0x0f6c, 2], [0x0f8c, 2], [0x0fac, 2], [0x0f8c, 2], [0x0fac, 2], [0x0f8c, 2], [0x0fac, 2],
      [0x0f8c, 2], [0x0fac, 2], [0x0f8c, 2], [0x0fac, 2], [0x0f8c, 2], [0x0f6c, 1]]);
  });
  it('peças da chama com flips; fases +$00/+$20/+$40', () => {
    const P: [FlamePieceName, number][] = [['center', 0x0f6c], ['armR', 0x0f6a], ['armL', 0x4f6a], ['tipR', 0x0f66], ['tipL', 0x4f66],
      ['armU', 0x0f68], ['armD', 0x8f68], ['tipU', 0x0f60], ['tipD', 0x8f60]];
    for (const [p, w] of P) expect([flameWord(p, 0), flameWord(p, 2), flameWord(p, 4)]).toEqual([w, w + 0x20, w + 0x40]);
  });
  it('soft queimando: 0C20…0C2A, 4 ticks cada', () => {
    expect(runs(softBurnWord, 24)).toEqual([0x0c20, 0x0c22, 0x0c24, 0x0c26, 0x0c28, 0x0c2a].map(w => [w, 4]));
  });
  it('item atingido: 0F2E…0FAE, 4 ticks cada, depois nada', () => {
    expect(runs(itemBurnWord, 24)).toEqual([[0x0f2e, 4], [0x0f4e, 4], [0x0f6e, 4], [0x0f8e, 4], [0x0fae, 4], [null, 4]]);
  });
});

describe('palavra do BG2 por casa', () => {
  const a = fakeAssets();
  const ar = a.arena(1);
  const tb = romTables(a);
  const at = (col: number, lin: number) => lin * 32 + col;
  const cell = (col: number, lin: number) => lin * 17 + col;
  const scene = (over: Partial<RomScene> = {}): RomScene =>
    ({ gridBombs: new Map(), objs: [], drops: [], flame: () => 'center', burn: () => 'soft', team: false, ...over });
  const clock = (tick: number, bombTick = tick): RomClock => ({ tick, bombTick, frame: 0 });
  const script = (t: number) => (t === 1 ? REMOTE_BOMB : NORMAL_BOMB);
  const words = (s = fakeRound(), sc = scene(), c = clock(0)) => fieldWords(s, ar, sc, tb, c, script);

  it('piso da ROM, ou floor[] do núcleo quando ≠ 0 (D9)', () => {
    const s = fakeRound();
    s.grid[cell(3, 1)] = 0;
    s.grid[cell(4, 1)] = 0;
    s.floor[cell(4, 1)] = 0x1c0a;
    const w = words(s);
    expect([w[at(3, 1)], w[at(4, 1)]]).toEqual([ar.floor[at(3, 1)], 0x1c0a]);
  });
  it('parede/pilar e soft = bg2Base; pressão = 082E; bloco caindo (0001) = piso', () => {
    const s = fakeRound();
    s.grid[cell(4, 1)] = 0xcc80;
    s.grid[cell(5, 1)] = 0xee80;
    s.grid[cell(6, 1)] = 0x0001;
    const w = words(s);
    expect([w[at(3, 2)], w[at(4, 1)], w[at(5, 1)], w[at(6, 1)]])
      .toEqual([ar.bg2Base[at(3, 2)], ar.bg2Base[at(4, 1)], WORD_PRESSURE, ar.floor[at(6, 1)]]);
  });
  it('bomba parada: script do tipo desde born; bombTick congela (D6)', () => {
    const s = fakeRound();
    s.grid[cell(2, 1)] = 0xc900;
    const sc = scene({ gridBombs: new Map([[cell(2, 1), { type: 1, born: 100 }]]) });
    expect(words(s, sc, clock(100))[at(2, 1)]).toBe(0x0b08);
    expect(words(s, sc, clock(114))[at(2, 1)]).toBe(0x0b0a);
    expect(words(s, sc, clock(200, 114))[at(2, 1)]).toBe(0x0b0a);
  });
  it('chama pela peça e pela idade (cellT0)', () => {
    const s = fakeRound();
    s.grid[cell(7, 3)] = 0x1000;
    s.cellT0[cell(7, 3)] = 50;
    const sc = scene({ flame: () => 'tipD' });
    expect(words(s, sc, clock(52))[at(7, 3)]).toBe(0x8f80);
    expect(words(s, sc, clock(74))[at(7, 3)]).toBe(0x8f60);
  });
  it('queima: soft pelos tiles da fase; item some depois de 20 ticks (D8)', () => {
    const s = fakeRound();
    for (const c of [cell(4, 1), cell(5, 1)]) { s.grid[c] = 0xedc0; s.cellT0[c] = 10; }
    const sc = scene({ burn: c => (c === cell(5, 1) ? 'item' : 'soft') });
    expect(words(s, sc, clock(24))[at(5, 1)]).toBe(0x0f8e);
    const w = words(s, sc, clock(30));
    expect([w[at(4, 1)], w[at(5, 1)]]).toEqual([0x0c2a, ar.floor[at(5, 1)]]);
  });
  it('itens e caveiras pela tabela $C1:5FE0; ovo fica com o plano 9 (piso)', () => {
    const s = fakeRound();
    s.grid[cell(3, 1)] = 0x0941;
    s.grid[cell(4, 1)] = 0x09a1;
    s.grid[cell(5, 1)] = 0x0970;
    const w = words(s);
    expect([w[at(3, 1)], w[at(4, 1)], w[at(5, 1)]]).toEqual([0x1280, 0x128a, ar.floor[at(5, 1)]]);
  });
  it('códigos das arenas especiais = palavra do mapa da ROM (o plano 8 sobrescreve)', () => {
    const s = fakeRound();
    s.grid[cell(3, 3)] = 0x0040;
    s.grid[cell(7, 3)] = 0x0c00;
    s.grid[cell(5, 5)] = 0x0f41;
    const w = words(s);
    expect([w[at(3, 3)], w[at(7, 3)], w[at(5, 5)]]).toEqual([ar.bg2Base[at(3, 3)], ar.bg2Base[at(7, 3)], ar.bg2Base[at(5, 5)]]);
  });
  it('moldura (col 0 e 16) e fora de 17×13 ficam com o bg2Base (D10)', () => {
    const s = fakeRound();
    s.grid[cell(0, 5)] = 0;
    s.grid[cell(16, 5)] = 0;
    const w = words(s);
    for (const i of [at(0, 5), at(16, 5), at(20, 3), at(3, 20)]) expect(w[i]).toBe(ar.bg2Base[i]);
  });
});
