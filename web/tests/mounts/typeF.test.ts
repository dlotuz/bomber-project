import { mkRound, placePx, ride, run, firstTick, BTN } from './helpers';
import { mstate } from '../../src/core/mounts/types';
import { cellOf } from '../../src/core/mounts/core-api';

describe('montaria tipo F (palhaço): Y = notas', () => {
  it('alvo a 2,5 casas (x=72): act dance do tick 79 ao 269 (vs_F_Y_72)', () => {
    const s = mkRound({ players: [0, 2] });
    const p = placePx(s, 0, 32, 47); p.face = 2;
    const q = placePx(s, 2, 72, 47);
    ride(s, 0, 0xf);
    run(s, 1, { 0: BTN.Y });
    expect(firstTick(s, 100, () => q.act === 'dance')).toBe(79);
    const x0 = q.x;
    const free = firstTick(s, 300, () => q.act !== 'dance', { 2: BTN.RIGHT });
    // act volta a idle no 270, 1 tick antes do fim da trava: convenção do tickAct do plano 6 (só visual; o mesmo
    // vale para soco/stun). A trava em si acaba no 271 (teste seguinte).
    expect(79 + free).toBe(270);
    expect(q.x - x0).toBeLessThanOrEqual(256);                // só o tick 271 pode ter andado
  });
  it('DANCE_TICKS = 192 ($C0): o alvo fica parado até o 270 e anda no tick 271 (vs_F_Y_72)', () => {
    const s = mkRound({ players: [0, 2] });
    const p = placePx(s, 0, 32, 47); p.face = 2;
    const q = placePx(s, 2, 72, 47);
    ride(s, 0, 0xf);
    run(s, 1, { 0: BTN.Y });
    expect(firstTick(s, 100, () => q.act === 'dance')).toBe(79);
    const x0 = q.x;
    const moved = firstTick(s, 300, () => q.x !== x0, { 2: BTN.RIGHT });
    expect(79 + moved).toBe(271);
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
