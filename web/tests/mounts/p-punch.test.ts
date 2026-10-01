import { mkRound, ride, run, placePx, cx, cy, BTN, X } from './helpers';
import { rider } from '../../src/core/mounts/types';
import { C } from '../core/kit';
import { ITEM } from '../../src/core/types';
import { itemCode } from '../../src/core/state';

/** P1 (slot 0) em (5,1) com o P, olhando para a direita; aperta Y no 1º passo (tick H). */
function scene(victim = true) {
  const s = mkRound();
  const p = placePx(s, 0, cx(5), cy(1)); p.pItem = true; p.face = 2;
  const q = victim ? placePx(s, 1, cx(6), cy(1)) : placePx(s, 1, cx(12), cy(9));
  return { s, p, q };
}

describe('golpe P e montarias (emulador: aj-stop/pmount.py, pvict.py, ptiming.py)', () => {
  it('montado (qualquer fase; tipos sem poder de Y): o Y com P não avança nem empurra ($C2:48EA: +$5D ≠ 0 → RTL)', () => {
    for (const t of [0x0, 0x2, 0x3, 0xa]) {
      for (const phase of ['riding', 'mounting', 'dismount'] as const) {
        const { s, p, q } = scene();
        ride(s, 0, t, { phase });
        const ev = [...run(s, 1, { 0: BTN.Y }), ...run(s, 20)];
        expect([ev.some(e => e.type === 'p_punch'), X(p), X(q)], `tipo ${t} ${phase}`).toEqual([false, cx(5), cx(6)]);
      }
    }
  });
  it('alvo montado: é empurrado 48 px como a pé e continua montado (ROM: tipos 2 e A, x 95 → 143, +$5D = 1)', () => {
    for (const t of [0x2, 0xa]) {
      const { s, q } = scene();
      ride(s, 1, t);
      run(s, 1, { 0: BTN.Y }); run(s, 20);
      expect([X(q), rider(q)?.phase, rider(q)?.type], `tipo ${t}`).toEqual([cx(9), 'riding', t]);
    }
  });
  it('vítima empurrada sobre um ovo: monta no centro do ovo e o empurrão acaba ali (ROM: x fica em 111)', () => {
    const { s, q } = scene();
    s.grid[C(7, 1)] = 0x0972;
    run(s, 1, { 0: BTN.Y }); run(s, 30);
    expect([X(q), rider(q)?.type]).toEqual([cx(7), 2]);
  });
  it('quem dá o golpe não pega item nem ovo durante os 35 ticks: pega em H+36, já no centro da casa', () => {
    for (const code of [itemCode(ITEM.FIRE), 0x0972]) {   // ROM: $0943 e o ovo $0972
      const { s, p } = scene(false);
      s.grid[C(6, 1)] = code;
      run(s, 1, { 0: BTN.Y });                             // H
      const ev = run(s, 35);                               // H+35: a rotina volta ao normal, mas ainda não pegou
      expect([s.grid[C(6, 1)], X(p), rider(p), ev.some(e => e.type === 'item_picked')], `código ${code.toString(16)}`)
        .toEqual([code, cx(6), null, false]);
      const ev2 = run(s, 1);                               // H+36
      expect([s.grid[C(6, 1)], X(p)], `código ${code.toString(16)}`).toEqual([0, cx(6)]);
      if (code === 0x0972) expect(rider(p)?.phase).toBe('mounting');
      else expect(ev2).toContainEqual({ type: 'item_picked', slot: 0, item: ITEM.FIRE });
    }
  });
});
