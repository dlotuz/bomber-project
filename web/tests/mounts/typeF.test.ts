import { mkRound, placePx, ride, run, firstTick, BTN } from './helpers';
import { mstate } from '../../src/core/mounts/types';
import { cellOf } from '../../src/core/mounts/core-api';

describe('montaria tipo F (palhaço): Y = notas', () => {
  it('alvo a 2,5 casas (x=72): dança do tick 79 ao 270 e fica livre no 271 (vs_F_Y_72)', () => {
    const s = mkRound({ players: [0, 2] });
    const p = placePx(s, 0, 32, 47); p.face = 2;
    const q = placePx(s, 2, 72, 47);
    ride(s, 0, 0xf);
    run(s, 1, { 0: BTN.Y });
    expect(firstTick(s, 100, () => q.act === 'dance')).toBe(79);
    const x0 = q.x;
    const free = firstTick(s, 300, () => q.act !== 'dance', { 2: BTN.RIGHT });
    expect(79 + free).toBe(271);
    expect(q.x - x0).toBeLessThanOrEqual(256);                // só o tick 271 pode ter andado
  });
  it('uma nota por vez', () => {
    const s = mkRound();
    const p = placePx(s, 0, 32, 47); p.face = 2;
    ride(s, 0, 0xf);
    run(s, 1, { 0: BTN.Y });
    run(s, 5);
    run(s, 1, { 0: BTN.Y });
    expect(mstate(s).projectiles).toHaveLength(1);
  });
  it('nota some ao bater em bloco', () => {
    const s = mkRound();
    const p = placePx(s, 0, 32, 47); p.face = 2;
    s.grid[cellOf(4, 1)] = 0xcc80;
    ride(s, 0, 0xf);
    run(s, 1, { 0: BTN.Y });
    run(s, 40);                                              // bloqueia em k = 31 com x = 48 (medido)
    expect(mstate(s).projectiles).toHaveLength(0);
  });
  it('sem alvo nem bloco: o voo acaba em k = 159 (medido de x = 32 e x = 65)', () => {
    const s = mkRound();
    const p = placePx(s, 0, 32, 47 + 16 * 4); p.face = 2;   // linha 5: (3,5)..(14,5) livres
    ride(s, 0, 0xf);
    run(s, 1, { 0: BTN.Y });
    run(s, 158);
    expect(mstate(s).projectiles).toHaveLength(1);
    run(s, 1);
    expect(mstate(s).projectiles).toHaveLength(0);
  });
});
