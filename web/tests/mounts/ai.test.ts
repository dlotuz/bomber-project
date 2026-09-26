import { mkRound, placePx, ride, cx, cy } from './helpers';
import { eggValue, wantMountY, lineCells, escapeAfterLine, mountAiHints, MOUNT_Y_RANGE } from '../../src/core/ai/mounts';
import { cellOf } from '../../src/core/mounts/core-api';
import { mstate } from '../../src/core/mounts/types';
import { hashState } from '../../src/core/hash';

const yes = () => true, no = () => false;

function duel(type: number, dCells: number, opts: { face?: 0 | 2 | 4 | 6; targetDown?: boolean } = {}) {
  const s = mkRound({ players: [0, 2] });
  const p = placePx(s, 0, cx(3), cy(1)); p.face = opts.face ?? 2;
  if (opts.targetDown) placePx(s, 2, cx(3), cy(1 + dCells)); else placePx(s, 2, cx(3 + dCells), cy(1));
  const r = ride(s, 0, type);
  return { s, p, r };
}

describe('eggValue', () => {
  it('só ovos; sem montaria vale 3; montado com ovo 0–7 vale 1; ovo 8–F montado vale 0', () => {
    const { s, p } = duel(0x3, 4);
    s.grid[cellOf(6, 1)] = 0x0941;
    expect(eggValue(s, p, cellOf(6, 1))).toBeNull();
    s.grid[cellOf(6, 1)] = 0x0972;
    expect(eggValue(s, p, cellOf(6, 1))).toBe(1);
    s.grid[cellOf(6, 1)] = 0x097c;
    expect(eggValue(s, p, cellOf(6, 1))).toBe(0);
    p.mount = null;
    expect(eggValue(s, p, cellOf(6, 1))).toBe(3);
  });
  it('com 3 reservas não vale ir', () => {
    const { s, p, r } = duel(0x3, 4);
    r.reserves = [2, 2, 2];
    s.grid[cellOf(6, 1)] = 0x0972;
    expect(eggValue(s, p, cellOf(6, 1))).toBe(0);
  });
});

describe('wantMountY', () => {
  it('alcances: C 4, D 5, E 3, F 3', () => {
    expect(MOUNT_Y_RANGE).toEqual({ 0xc: 4, 0xd: 5, 0xe: 3, 0xf: 3 });
    for (const [t, n] of [[0xc, 4], [0xd, 5], [0xe, 3], [0xf, 3]] as const) {
      const a = duel(t, n); a.p.bombsFree = 3;
      expect(wantMountY(a.s, a.p, yes), `tipo ${t} a ${n}`).toEqual({ dir: 2 });
      const b = duel(t, n + 1); b.p.bombsFree = 3;
      expect(wantMountY(b.s, b.p, yes), `tipo ${t} a ${n + 1}`).toBeNull();
    }
  });
  it('passivas e fora de riding: nunca', () => {
    for (const t of [0x2, 0x3, 0xa]) { const a = duel(t, 1); expect(wantMountY(a.s, a.p, yes)).toBeNull(); }
    const b = duel(0xd, 2); b.r.phase = 'mounting';
    expect(wantMountY(b.s, b.p, yes)).toBeNull();
  });
  it('C: só com rota de fuga, com bombas e sem $24/$25', () => {
    const a = duel(0xc, 3); a.p.bombsFree = 2;
    expect(wantMountY(a.s, a.p, no)).toBeNull();
    expect(wantMountY(a.s, a.p, yes)).toEqual({ dir: 2 });
    a.p.disease = 0x25;
    expect(wantMountY(a.s, a.p, yes)).toBeNull();
    a.p.disease = 0; a.p.bombsFree = 0;
    expect(wantMountY(a.s, a.p, yes)).toBeNull();
  });
  it('C: lineCells = casas que a linha ocuparia', () => {
    const a = duel(0xc, 3); a.p.bombsFree = 3;
    a.s.grid[cellOf(5, 1)] = 0xcc80;
    expect(lineCells(a.s, a.p, 2, 3)).toEqual([cellOf(3, 1), cellOf(4, 1)]);
  });
  it('E com recarga e F com nota em voo: não', () => {
    const e = duel(0xe, 2); e.r.cooldown = 10;
    expect(wantMountY(e.s, e.p, yes)).toBeNull();
    const f = duel(0xf, 2);
    mstate(f.s).projectiles.push({ id: 1, kind: 0xf, owner: 0, x: 0, y: 0, dir: 2, born: 0, state: 'fly', t: 0, slot: 0 });
    expect(wantMountY(f.s, f.p, yes)).toBeNull();
  });
  it('bloco no caminho impede', () => {
    const a = duel(0xd, 4);
    a.s.grid[cellOf(5, 1)] = 0xcc80;
    expect(wantMountY(a.s, a.p, yes)).toBeNull();
  });
  it('alvo em outra direção: devolve a direção para virar', () => {
    const a = duel(0xe, 2, { face: 2, targetDown: true });
    a.s.grid[cellOf(3, 2)] = 0;                              // (3,2) é pilar no layout: abrir para o teste
    expect(wantMountY(a.s, a.p, yes)).toEqual({ dir: 4 });
  });
  it('escapeAfterLine: sai por (2,2); com (2,2) fechada não há fuga', () => {
    const a = duel(0xc, 3); a.p.fire = 0;
    const cells = [cellOf(3, 1), cellOf(4, 1)];
    expect(escapeAfterLine(a.s, a.p, cells)).toBe(true);
    a.s.grid[cellOf(2, 2)] = 0xcc80;
    expect(escapeAfterLine(a.s, a.p, cells)).toBe(false);
  });
  it('mountAiHints (formato do plano 6): useY só virado para o alvo; eggValue 0 fora de ovo', () => {
    const a = duel(0xe, 2);
    expect(mountAiHints.useY!(a.s, 0)).toBe(true);
    a.p.face = 4;
    expect(mountAiHints.useY!(a.s, 0)).toBe(false);
    expect(mountAiHints.eggValue!(a.s, 0, cellOf(8, 1))).toBe(0);
    a.s.grid[cellOf(8, 1)] = 0x0972;
    expect(mountAiHints.eggValue!(a.s, 0, cellOf(8, 1))).toBe(1);
  });
  it('não lê hidden: estados que diferem só em hidden dão a mesma resposta', () => {
    const a = duel(0xd, 3), b = duel(0xd, 3);
    b.s.hidden = [[cellOf(7, 1), 0x30], [cellOf(9, 3), 0x21]];
    expect(wantMountY(b.s, b.p, yes)).toEqual(wantMountY(a.s, a.p, yes));
    expect(eggValue(b.s, b.p, cellOf(7, 1))).toEqual(eggValue(a.s, a.p, cellOf(7, 1)));
  });
});

describe('pureza da IA (revisão final, minor)', () => {
  it('wantMountY com F não cria s.mountState quando ele é null (leitura sem efeito)', () => {
    const { s, p } = duel(0xf, 2);
    expect(s.mountState).toBeNull();
    const h = hashState(s);
    expect(wantMountY(s, p, yes)).toEqual({ dir: 2 });
    expect(s.mountState).toBeNull();
    expect(hashState(s)).toBe(h);
  });
});
