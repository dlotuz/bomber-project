import { createRound } from '../../src/core/round';
import { defaultRules, CELL } from '../../src/core/types';
import { idx, centerX, centerY, cellX, cellY } from '../../src/core/grid';
import { LAYOUTS } from '../../src/core/layouts';
import { SPAWNS } from '../../src/core/constants';
import { rollItem, ITEM_WEIGHTS } from '../../src/core/items';
import { makeRng } from '../../src/core/rng';

const rules = (o = {}) => ({ ...defaultRules(), randomSpawns: false, ...o });
const count = (s: ReturnType<typeof createRound>, c: number) => s.arena.cells.filter(v => v === c).length;

describe('grid', () => {
  it('centro de casa em pixels bate com o SB4', () => {
    expect(centerX(1) / 8).toBe(32); expect(centerY(1) / 8).toBe(48);
    expect(centerX(13) / 8).toBe(224); expect(centerY(11) / 8).toBe(208);
    expect(centerX(7) / 8).toBe(128); expect(centerY(6) / 8).toBe(128);
  });
  it('cellX/cellY invertem o centro e arredondam', () => {
    for (let g = 1; g <= 13; g++) expect(cellX(centerX(g))).toBe(g);
    for (let g = 1; g <= 11; g++) expect(cellY(centerY(g))).toBe(g);
    expect(cellX(centerX(2) - 64)).toBe(2);
    expect(cellX(centerX(2) - 65)).toBe(1);
  });
});

describe('arena', () => {
  it('10 layouts de 11 linhas × 13 colunas', () => {
    expect(LAYOUTS).toHaveLength(10);
    for (const l of LAYOUTS) { expect(l).toHaveLength(11); for (const r of l) expect(r).toHaveLength(13); }
  });
  it('contagem de soft blocks igual ao original', () => {
    const exp = [80, 80, 80, 70, 0, 80, 62, 0, 78, 80];
    exp.forEach((n, i) => expect(count(createRound(i + 1, rules(), 1), CELL.SOFT)).toBe(n));
  });
  it('borda é HARD e pilares (par,par) são HARD', () => {
    const s = createRound(1, rules(), 1);
    for (let x = 0; x < 15; x++) { expect(s.arena.cells[idx(x, 0)]).toBe(CELL.HARD); expect(s.arena.cells[idx(x, 12)]).toBe(CELL.HARD); }
    for (let y = 2; y <= 10; y += 2) for (let x = 2; x <= 12; x += 2) expect(s.arena.cells[idx(x, y)]).toBe(CELL.HARD);
  });
  it('casas de spawn são livres em todas as fases', () => {
    for (let st = 1; st <= 10; st++) {
      const s = createRound(st, rules(), 1);
      for (const [gx, gy] of SPAWNS) expect(s.arena.cells[idx(gx, gy)]).toBe(CELL.EMPTY);
    }
  });
  it('itens escondidos só sob soft blocks', () => {
    const s = createRound(1, rules(), 5);
    s.arena.hidden.forEach((it, i) => { if (it) expect(s.arena.cells[i]).toBe(CELL.SOFT); });
    expect(s.arena.hidden.filter(Boolean).length).toBeGreaterThan(10);
  });
});

describe('jogadores', () => {
  it('spawns padrão e status iniciais', () => {
    const s = createRound(1, rules(), 1);
    s.players.forEach((p, i) => {
      expect([cellX(p.x), cellY(p.y)]).toEqual(SPAWNS[i]);
      expect([p.speed, p.maxBombs, p.fire]).toEqual([1, 1, 0]);
    });
  });
  it('fase 5 começa forte', () => {
    const p = createRound(5, rules(), 1).players[0];
    expect([p.maxBombs, p.fire, p.kick, p.punch, p.glove, p.pierce]).toEqual([5, 4, true, true, true, true]);
  });
  it('racer começa com velocidade 4', () => {
    expect(createRound(1, rules({ racer: true }), 1).players[0].speed).toBe(4);
  });
  it('spawns aleatórios são uma permutação dos 5 pontos', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 8; seed++) {
      const s = createRound(1, rules({ randomSpawns: true }), seed);
      const pos = s.players.map(p => `${cellX(p.x)},${cellY(p.y)}`);
      expect(new Set(pos)).toEqual(new Set(SPAWNS.map(([x, y]) => `${x},${y}`)));
      seen.add(pos.join('|'));
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('itens', () => {
  it('pesos somam 100 e rollItem respeita a tabela', () => {
    expect(ITEM_WEIGHTS.reduce((a, [, w]) => a + w, 0)).toBe(100);
    const r = makeRng(1);
    for (let i = 0; i < 500; i++) expect(rollItem(r)).toBeGreaterThanOrEqual(1);
  });
});
