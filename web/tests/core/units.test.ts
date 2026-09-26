import {
  GRID_W, GRID_H, CELLS, cellOf, colOf, linOf, centerX, centerY, cellAt, romOff, cellFromRomOff,
  SPAWNS, spawnX, spawnY, faceStep, subX, subY, px, inField, FACE_OF_DIR,
} from '../../src/core/units';

describe('unidades e grade', () => {
  it('grade 17×13 e cell = lin·17 + col', () => {
    expect([GRID_W, GRID_H, CELLS]).toEqual([17, 13, 221]);
    expect(cellOf(2, 1)).toBe(19);
    expect([colOf(19), linOf(19)]).toEqual([2, 1]);
  });
  it('centro da casa em 1/256 px (X = 16·col − 1, Y = 16·(lin+2) − 1)', () => {
    expect(px(centerX(2))).toBe(31);
    expect(px(centerY(1))).toBe(47);
    expect(px(centerX(14))).toBe(223);
    expect(px(centerY(11))).toBe(207);
  });
  it('hitbox: col 10 = X 152..167; lin 1 = Y 44..55 (t25)', () => {
    const y = centerY(1);
    expect(cellAt(152 * 256, y)).toBe(cellOf(10, 1));
    expect(cellAt(167 * 256 + 255, y)).toBe(cellOf(10, 1));
    expect(cellAt(168 * 256, y)).toBe(cellOf(11, 1));
    const x = centerX(10);
    expect(cellAt(x, 44 * 256)).toBe(cellOf(10, 1));
    expect(cellAt(x, 55 * 256)).toBe(cellOf(10, 1));
    expect(cellAt(x, 56 * 256)).toBe(cellOf(10, 2));
    // §3.1: lin = ⌊(Y+8)/16⌋ − 2 → lin 1 = Y 40..55 (t25 só mediu Y ≥ 44).
    expect(cellAt(x, 40 * 256)).toBe(cellOf(10, 1));
    expect(cellAt(x, 39 * 256)).toBe(cellOf(10, 0));
  });
  it('romOff e volta: $0044 = (2,1)', () => {
    expect(romOff(2, 1)).toBe(0x44);
    expect(cellFromRomOff(0x44)).toBe(cellOf(2, 1));
    expect(cellFromRomOff(romOff(14, 11))).toBe(cellOf(14, 11));
  });
  it('spawns 1 px fora do centro, na casa certa', () => {
    expect(SPAWNS).toEqual([[2, 1], [14, 11], [14, 1], [2, 11], [8, 6]]);
    for (const [col, lin] of SPAWNS) {
      expect(px(spawnX(col))).toBe(16 * col);
      expect(px(spawnY(lin))).toBe(16 * (lin + 2));
      expect(cellAt(spawnX(col), spawnY(lin))).toBe(cellOf(col, lin));
    }
  });
  it('faces: 0 cima, 2 direita, 4 baixo, 6 esquerda; diagonais ficam no horizontal', () => {
    const c = cellOf(5, 5);
    expect([faceStep(c, 0), faceStep(c, 2), faceStep(c, 4), faceStep(c, 6)]).toEqual([cellOf(5, 4), cellOf(6, 5), cellOf(5, 6), cellOf(4, 5)]);
    expect(FACE_OF_DIR).toEqual([0, 2, 2, 2, 4, 6, 6, 6]);
  });
  it('subposição: centro = (7,7)', () => {
    expect([subX(centerX(4)), subY(centerY(3))]).toEqual([7, 7]);
    expect(subX(centerX(4) - 256)).toBe(6);
  });
  it('campo jogável col 2..14 × lin 1..11', () => {
    expect(inField(2, 1) && inField(14, 11)).toBe(true);
    expect(inField(1, 5) || inField(15, 5) || inField(5, 0) || inField(5, 12)).toBe(false);
  });
});
