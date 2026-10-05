// Montarias da senha 0164 (1, 4, 5, 6, 9, B). Números medidos em analise/investigacao/montarias-extras/RELATORIO.md.
import { mkRound, placePx, ride, run, bombCells, BTN, cx, cy, X, Y } from './helpers';
import { mountModule } from '../../src/core/mounts/module';
import { cellOf, colOf, linOf, rollEggType, EGG_TYPES_ALL } from '../../src/core/mounts/core-api';
import { addBomb, bombFireOf } from '../../src/core/bombs';
import { CODE } from '../../src/core/types';
import { rangeOf } from '../../src/core/constants';
import { SWEEP_PATH } from '../../src/core/mounts/abilities/type5';
import { DASH_COOLDOWN } from '../../src/core/mounts/abilities/type4';
import { cellFromRomOff } from '../../src/core/units';
import { ROM } from '../rom/helpers';

describe('sorteio com a senha', () => {
  it('EGG_TYPES_ALL = $C1:5D87 & $0F: 13 tipos × 2', () => {
    expect(EGG_TYPES_ALL).toEqual([1, 2, 3, 4, 5, 6, 9, 0xa, 0xb, 0xc, 0xd, 0xe, 0xf, 1, 2, 3, 4, 5, 6, 9, 0xa, 0xb, 0xc, 0xd, 0xe, 0xf]);
  });
  it('sem a senha só saem os 7 tipos; com ela saem os 13', () => {
    const s = mkRound();
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) seen.add(rollEggType(s));
    expect([...seen].sort((a, b) => a - b)).toEqual([2, 3, 0xa, 0xc, 0xd, 0xe, 0xf]);
    s.rules.allMounts = true;
    seen.clear();
    for (let i = 0; i < 800; i++) seen.add(rollEggType(s));
    expect([...seen].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 9, 0xa, 0xb, 0xc, 0xd, 0xe, 0xf]);
  });
});

describe('montaria tipo 1 (atravessa bombas)', () => {
  it('passa pela bomba na (4,1): de x=31 anda 60 px em 60 ticks', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    addBomb(s, 1, cellOf(4, 1));
    ride(s, 0, 0x1);
    run(s, 60, { 0: BTN.RIGHT });
    expect(X(p)).toBe(91);
    expect(bombCells(s)).toEqual([cellOf(4, 1)]);
  });
  it('não chuta nem com o item de chute ($C2:33B6 sai antes do chute)', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    p.kick = true;
    addBomb(s, 1, cellOf(4, 1));
    ride(s, 0, 0x1);
    const ev = run(s, 40, { 0: BTN.RIGHT });
    expect(ev.some(e => e.type === 'bomb_kicked')).toBe(false);
    expect(bombCells(s)).toEqual([cellOf(4, 1)]);
  });
  it('outro tipo para em x=47, diante da bomba', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    addBomb(s, 1, cellOf(4, 1));
    ride(s, 0, 0x2);
    run(s, 60, { 0: BTN.RIGHT });
    expect(X(p)).toBe(47);
  });
});

describe('montaria tipo 4 (investida)', () => {
  function dashRight(setup?: (s: ReturnType<typeof mkRound>) => void) {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    setup?.(s);
    ride(s, 0, 0x4);
    run(s, 2, { 0: BTN.RIGHT });
    expect(X(p)).toBe(33);
    run(s, 1, { 0: BTN.Y });          // tick do Y: entra na investida, ainda sem andar
    expect(X(p)).toBe(33);
    const xs: number[] = [];
    for (let i = 0; i < 60; i++) { run(s, 1); xs.push(X(p)); }
    return { s, p, xs };
  }
  it('4 px por tick na direção da face até a parede: 37…221, 223 (mount t4b)', () => {
    const { xs } = dashRight();
    expect(xs.slice(0, 3)).toEqual([37, 41, 45]);
    expect(xs[46]).toBe(221);
    expect(xs[47]).toBe(223);
    expect(xs[59]).toBe(223);
  });
  it('para diante do bloco macio, sem quebrá-lo: x = 111', () => {
    const { s, xs } = dashRight(s => { s.grid[cellOf(8, 1)] = CODE.SOFT; });
    expect(xs[xs.length - 1]).toBe(111);
    expect(s.grid[cellOf(8, 1)]).toBe(CODE.SOFT);
  });
  it('atravessa jogadores sem efeito', () => {
    const { s, xs } = dashRight(s => { placePx(s, 1, 127, cy(1)); });
    expect(xs[xs.length - 1]).toBe(223);
    expect(X(s.players[1])).toBe(127);
    expect(s.players[1].state).toBe('alive');
  });
  it('para diante da bomba sem empurrá-la: de x=90 para a esquerda, para em 50', () => {
    const s = mkRound();
    addBomb(s, 0, cellOf(2, 1));
    const p = placePx(s, 0, 90, cy(1));
    p.face = 6;
    ride(s, 0, 0x4);
    run(s, 1, { 0: BTN.Y });
    run(s, 20);
    expect(X(p)).toBe(50);
    expect(bombCells(s)).toEqual([cellOf(2, 1)]);
  });
  it('durante a investida não põe bomba nem vira; o Y só repete depois da espera (regra da casa)', () => {
    const { s, p } = (() => {
      const s = mkRound();
      const p = placePx(s, 0, cx(2), cy(1));
      ride(s, 0, 0x4);
      run(s, 2, { 0: BTN.RIGHT });
      run(s, 1, { 0: BTN.Y });
      run(s, 3); run(s, 2, { 0: BTN.A }); run(s, 2, { 0: BTN.UP });
      return { s, p };
    })();
    expect(s.bombs).toHaveLength(0);
    expect(Y(p)).toBe(cy(1));
    run(s, 60);
    expect(X(p)).toBe(223);
    p.face = 6;
    run(s, 1, { 0: BTN.Y }); run(s, 3);
    expect(X(p)).toBe(223);                    // ainda na espera: o Y não faz nada (o original repetia sem recarga)
    run(s, DASH_COOLDOWN);
    run(s, 1, { 0: BTN.Y }); run(s, 3);
    expect(X(p)).toBeLessThan(223);
  });
});

describe('montaria tipo 5 (varredura)', () => {
  it('SWEEP_PATH: espiral de $C1:724E, 143 casas, de (2,1) para a direita até (9,6)', () => {
    expect(SWEEP_PATH).toHaveLength(143);
    expect(new Set(SWEEP_PATH).size).toBe(143);
    expect(SWEEP_PATH.slice(0, 2)).toEqual([cellOf(2, 1), cellOf(3, 1)]);
    expect(SWEEP_PATH[12]).toBe(cellOf(14, 1));
    expect(SWEEP_PATH[13]).toBe(cellOf(14, 2));
    expect(SWEEP_PATH[22]).toBe(cellOf(14, 11));
    expect(SWEEP_PATH[34]).toBe(cellOf(2, 11));
    expect(SWEEP_PATH[43]).toBe(cellOf(2, 2));
    expect(SWEEP_PATH[142]).toBe(cellOf(9, 6));
  });
  it.skipIf(!ROM)('SWEEP_PATH = a tabela $C1:724E da ROM (deltas a partir de $44; $7000 pula, $8000 fim)', () => {
    const R = ROM!;
    const cells: number[] = [];
    for (let o = 0x1724e, pos = 0x44; ; o += 2) {
      const v = R[o] | R[o + 1] << 8;
      if (v === 0x8000) break;
      if (v === 0x7000) continue;
      pos = (pos + v) & 0xffff; cells.push(cellFromRomOff(pos));
    }
    expect(SWEEP_PATH).toEqual(cells);
  });
  it('Y queima todo bloco macio do caminho, 1 casa por tick a partir do tick seguinte', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    for (const c of [cellOf(3, 1), cellOf(14, 2), cellOf(9, 6)]) s.grid[c] = CODE.SOFT;
    ride(s, 0, 0x5);
    run(s, 1, { 0: BTN.Y });
    expect(s.grid[cellOf(3, 1)]).toBe(CODE.SOFT);
    run(s, 1);
    expect(s.grid[cellOf(3, 1)]).toBe(CODE.SOFT);   // tick 1: casa 0 = (2,1)
    run(s, 1);
    expect(s.grid[cellOf(3, 1)]).toBe(CODE.BURNING);
    run(s, 12);
    expect(s.grid[cellOf(14, 2)]).toBe(CODE.BURNING);
    run(s, 200);
    expect(s.grid.filter(v => v === CODE.SOFT)).toHaveLength(0);
    expect(X(p)).toBe(cx(2));
  });
  it('sem bloco macio na arena ($90 = 0) o Y não faz nada', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    ride(s, 0, 0x5);
    expect(mountModule.onY(s, p, [])).toBe(false);
  });
});

describe('montaria tipo 6 (fogo total)', () => {
  it('bomba com fogo MAX_CAPS.fire − 1 = 7 (alcance 9)', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    expect(bombFireOf(p)).toBe(0);
    ride(s, 0, 0x6);
    expect(bombFireOf(p)).toBe(7);
    expect(rangeOf(bombFireOf(p))).toBe(9);
    run(s, 1, { 0: BTN.A });
    expect(s.bombs[0].fire).toBe(7);
  });
});

describe('montaria tipo 9 (soco)', () => {
  it('Y soca a bomba da frente sem o item e sem a pose de soco', () => {
    const s = mkRound();
    addBomb(s, 0, cellOf(3, 1));
    const p = placePx(s, 0, cx(4), cy(1));
    p.face = 6;
    ride(s, 0, 0x9);
    const ev = run(s, 1, { 0: BTN.Y });
    expect(ev.some(e => e.type === 'punch')).toBe(true);
    expect(p.act).not.toBe('punch');
    expect(s.bombs[0].state).not.toBe('idle');
  });
  it('Y sem bomba na frente é consumido e não faz nada', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(4), cy(1));
    ride(s, 0, 0x9);
    expect(mountModule.onY(s, p, [])).toBe(true);
    expect(p.act).not.toBe('punch');
  });
});

describe('montaria tipo B (velocidade)', () => {
  it('anda no nível MAX_CAPS.speed = 6: 2 px por tick', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    ride(s, 0, 0xb);
    run(s, 20, { 0: BTN.RIGHT });
    expect(X(p)).toBe(cx(2) + 40);
  });
});

it('classes dos ovos novos: 1, 4, 5, 6 normais; 9 e B de máquina', async () => {
  const { isMachine } = await import('../../src/core/mounts/types');
  expect([1, 4, 5, 6, 9, 0xb].map(isMachine)).toEqual([false, false, false, false, true, true]);
  expect(colOf(cellOf(3, 4))).toBe(3); expect(linOf(cellOf(3, 4))).toBe(4);
});
