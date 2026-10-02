import { mkRound, ride, run, placePx, cx, cy, BTN, X, flameAt, firstTick } from './helpers';
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

describe('golpe P e montarias (emulador: aj-stop/pmount.py, pvict.py, ptiming.py; aj-pmount/pnat.py, pmnt.py, pdis2.py, premount.py, prider.py)', () => {
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
  // ROM: $C2:499F procura o alvo na grade de ocupação ($7F:1000) com a máscara $01F0, que só tem os bits "a pé" (+$90).
  // Montado, o jogador marca a casa com +$92 ($0200 << slot, $C2:33FC); montando ($C2:261E) e desmontando ($C2:105E,
  // $C2:10D5 e $C2:1089 com reserva) a casa fica sem bit ($C2:3419). Então o P não acha alvo montado em fase nenhuma.
  // Emulador (aj-pmount/pnat.py, pmnt.py, pdis2.py, premount.py), ocupação mantida pelo próprio jogo: 13 tipos, dx = 0.
  const TYPES = [0x2, 0x3, 0xa, 0xc, 0xd, 0xe, 0xf, 0x1, 0x4, 0x5, 0x6, 0x9, 0xb];
  it('montado (13 tipos, riding) com P: o Y nunca dá o golpe P e o alvo a pé na frente não sai do lugar (ROM: prider.py)', () => {
    for (const t of TYPES) {
      const { s, q } = scene();
      ride(s, 0, t);
      const ev = [...run(s, 1, { 0: BTN.Y }), ...run(s, 40)];
      expect([ev.some(e => e.type === 'p_punch'), X(q), q.act === 'pushed'], `tipo ${t}`).toEqual([false, cx(6), false]);
    }
  });
  it('alvo montado (13 tipos): não é empurrado nem desmonta; quem dá o golpe avança 16 px mesmo assim (ROM: 95 → 95)', () => {
    for (const t of TYPES) {
      const { s, p, q } = scene();
      ride(s, 1, t);
      const ev = [...run(s, 1, { 0: BTN.Y }), ...run(s, 40)];
      expect([ev.some(e => e.type === 'p_punch'), X(p), X(q), q.act === 'pushed', rider(q)?.phase, rider(q)?.type], `tipo ${t}`)
        .toEqual([true, cx(6), cx(6), false, 'riding', t]);
    }
  });
  it('alvo montando ou desmontando (com ou sem reserva): não é empurrado (ROM: a casa fica sem bit de ocupação)', () => {
    for (const t of TYPES) {
      for (const extra of [{ phase: 'mounting' as const }, { phase: 'dismount' as const }, { phase: 'dismount' as const, remount: true }]) {
        const { s, q } = scene();
        ride(s, 1, t, extra);
        run(s, 1, { 0: BTN.Y });
        expect([X(q), q.push.left, q.act === 'pushed'], `tipo ${t} ${JSON.stringify(extra)}`).toEqual([cx(6), 0, false]);
      }
    }
  });
  it('desmonte pela chama: P em H+52 não empurra; em H+53 (já a pé, invencível) empurra 48 px (ROM: Y no tick 177 × 178)', () => {
    for (const k of [52, 53]) {
      const { s, q } = scene();
      ride(s, 1, 0x2);
      flameAt(s, C(6, 1));
      const h = firstTick(s, 5, () => rider(q)?.phase === 'dismount');
      expect(h, 'atingido').toBeGreaterThan(0);
      run(s, k - 1);                                       // o Y sai no tick H+k
      const inv = q.inv;
      run(s, 1, { 0: BTN.Y }); run(s, 20);
      expect([rider(q), X(q)], `H+${k} (inv ${inv})`).toEqual([null, k === 52 ? cx(6) : cx(9)]);
    }
  });
  it('desmonte com reserva: não é empurrado durante a troca nem depois, já montado de novo (ROM: premount.py)', () => {
    for (const k of [1, 30, 52, 53, 80]) {
      const { s, q } = scene();
      ride(s, 1, 0x2, { reserves: [0x3], trail: [C(6, 1), C(7, 1)] });
      flameAt(s, C(6, 1));
      firstTick(s, 5, () => rider(q)?.phase === 'dismount');
      run(s, k - 1);
      run(s, 1, { 0: BTN.Y }); run(s, 20);
      expect([X(q), rider(q)?.type], `H+${k}`).toEqual([cx(6), 0x3]);
    }
  });
  it('alvo a pé (controle): empurrado 48 px (ROM: 95 → 143)', () => {
    const { s, q } = scene();
    run(s, 1, { 0: BTN.Y }); run(s, 20);
    expect(X(q)).toBe(cx(9));
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
