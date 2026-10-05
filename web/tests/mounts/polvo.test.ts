// Montaria tipo 4 (polvo vermelho, senha 0164): a investida do Y ($C2:4691 → rotina $C2:26E0).
// Números medidos no emulador (aj-polvo, scripts no relatório AJUSTE-POLVO.md):
//  - a investida termina quando a velocidade depois da colisão zera ou quando o teto $58 = $38 (56 ticks) acaba
//    ($C2:2776-2785); no mesmo tick volta à rotina normal ($C2:22F0) e no seguinte o jogador já anda/vira/usa o Y;
//  - a colisão é a do movimento normal ($C2:3287): entrar numa casa com bomba parada ($C900 na grade) ou com bomba
//    deslizando (bit $4000 da ocupação $7F:1000, gravado pelo deslize em $C1:37C4) zera a velocidade;
//  - depois do movimento roda os mesmos ganchos da rotina normal ($C2:4B4E/4C54/4AD8/416F/17A7/16FE); qualquer rotina
//    nova (atordoar, empurrão, desmonte) substitui a investida, e a volta é sempre para a rotina normal.
import { mkRound, placePx, ride, run, flameAt, BTN, cx, cy, X, Y } from './helpers';
import { cellOf } from '../../src/core/mounts/core-api';
import { addBomb } from '../../src/core/bombs';
import { stunPlayer } from '../../src/core/hit';
import { CODE, type RoundState } from '../../src/core/types';
import { REMOUNT_TICKS, type MountRider } from '../../src/core/mounts/types';
import { DASH_TICKS } from '../../src/core/mounts/abilities/type4';
import { st9 } from '../../src/core/stages/stage9';
import { moveStep } from '../../src/core/movement';

const clearSoft = (s: RoundState): void => { for (let i = 0; i < s.grid.length; i++) if (s.grid[i] === CODE.SOFT) s.grid[i] = 0; };
const dashing = (r: MountRider): boolean => !!r.dash;

describe('investida do polvo (tipo 4)', () => {
  it('teto: $C2:4697 grava $58 = $38', () => {
    expect(DASH_TICKS).toBe(0x38);
  });

  it('bomba chutada à frente: para atrás dela (x = 52) e ela segue deslizando (ocupação $4000)', () => {
    // ROM: P1 montado com chute, bomba própria em (3,1), empurra 6 ticks para a direita (chuta no 1º) e dá Y no 7º.
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    p.kick = true; p.face = 6;
    addBomb(s, 0, cellOf(3, 1));
    const r = ride(s, 0, 0x4);
    const xs: number[] = [], bx: number[] = [];
    for (let f = 0; f < 30; f++) {
      run(s, 1, f < 6 ? { 0: BTN.RIGHT } : f === 6 ? { 0: BTN.Y } : {});
      xs.push(X(p)); bx.push(s.bombs[0].x / 256);
      if (f === 11) expect(dashing(r)).toBe(false);
    }
    expect(xs.slice(0, 12)).toEqual([31, 32, 33, 34, 35, 36, 36, 40, 44, 48, 52, 52]);
    expect(xs[29]).toBe(52);
    // a bomba (1 px à esquerda/acima da ROM no nosso centro) continua: 50 → 108 na ROM
    expect(bx[0]).toBe(49);
    expect(bx[29]).toBe(107);
    expect(s.bombs[0].state).toBe('kicked');
  });

  it('andando, também não entra na casa de uma bomba que desliza (sem ela, entraria)', () => {
    const mk = (withBomb: boolean) => {
      const s = mkRound();
      const p = placePx(s, 0, 55, cy(1));                     // casa (3,1); o próximo px já é a casa (4,1)
      p.x += 128;
      if (withBomb) {
        addBomb(s, 1, cellOf(4, 1));
        const b = s.bombs[0];                                   // descendo pela coluna 4, já fora da grade
        b.state = 'kicked'; b.dir = 4; b.step = 2; b.kickedBy = 1; b.turn = -1; b.y += 2 * 256;
        s.grid[cellOf(4, 1)] = CODE.FLOOR;
      }
      moveStep(s, p, BTN.RIGHT, 0);
      return Math.floor(X(p));
    };
    expect(mk(false)).toBe(56);
    expect(mk(true)).toBe(55);
  });

  it('bomba parada: para em x = 50, o tick seguinte é o da parada e no outro já anda', () => {
    const s = mkRound();
    addBomb(s, 0, cellOf(2, 1));
    const p = placePx(s, 0, 94, cy(1));
    p.face = 6;
    const r = ride(s, 0, 0x4);
    const xs: number[] = [];
    for (let f = 0; f < 16; f++) { run(s, 1, f === 0 ? { 0: BTN.Y } : f >= 8 ? { 0: BTN.RIGHT } : {}); xs.push(X(p)); }
    // ROM: 94 | 90 … 50 (f11) | 50 (f12, parada) | 51, 52 … andando
    expect(xs.slice(0, 16)).toEqual([94, 90, 86, 82, 78, 74, 70, 66, 62, 58, 54, 50, 50, 51, 52, 53]);
    expect(dashing(r)).toBe(false);
  });

  it('bloco macio: para diante dele (x = 111) sem quebrar', () => {
    const s = mkRound();
    s.grid[cellOf(8, 1)] = CODE.SOFT;
    const p = placePx(s, 0, cx(2), cy(1));
    const r = ride(s, 0, 0x4);
    run(s, 2, { 0: BTN.RIGHT });
    run(s, 1, { 0: BTN.Y });
    run(s, 30);
    expect(X(p)).toBe(111);
    expect(s.grid[cellOf(8, 1)]).toBe(CODE.SOFT);
    expect(dashing(r)).toBe(false);
  });

  it('parede: sem atraso para andar — f49 é a parada, em f50 já desce; Y em f49 se perde, Y em f50 cai na espera', () => {
    const go = (script: (f: number) => number) => {
      const s = mkRound();
      const p = placePx(s, 0, cx(2), cy(1));
      const r = ride(s, 0, 0x4);
      run(s, 2, { 0: BTN.RIGHT });
      const log: { x: number; y: number; dash: boolean }[] = [];
      for (let f = 0; f < 56; f++) { run(s, 1, { 0: script(f) }); log.push({ x: X(p), y: Y(p), dash: dashing(r) }); }
      return log;
    };
    const down = go(f => (f === 0 ? BTN.Y : f >= 40 ? BTN.DOWN : 0));
    expect(down[48]).toEqual({ x: 223, y: 47, dash: true });
    expect(down[49]).toEqual({ x: 223, y: 47, dash: false });
    expect(down[50]).toEqual({ x: 223, y: 48, dash: false });
    const lost = go(f => (f === 0 || f === 49 ? BTN.Y : 0));
    expect(lost[50].dash).toBe(false);
    const again = go(f => (f === 0 || f === 50 ? BTN.Y : 0));
    // ROM: f50 já voltava à $C2:26E0. Regra da casa: depois de uma investida há DASH_COOLDOWN ticks de espera.
    expect(again[50].dash).toBe(false);
    expect(again[51].dash).toBe(false);
  });

  it('fim do teto: 56 ticks andando; no último ainda anda e já sai, e no seguinte obedece ao direcional', () => {
    // ROM (teleporte de −64 px quando x ≥ 160 para caber na arena): f56 x=129 sai; f57 (129,48); f58 (128,49).
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    const r = ride(s, 0, 0x4);
    run(s, 2, { 0: BTN.RIGHT });
    const log: [number, number][] = [];
    for (let f = 0; f < 59; f++) {
      run(s, 1, { 0: f === 0 ? BTN.Y : f >= 50 ? BTN.DOWN : 0 });
      log.push([X(p), Y(p)]);
      if (f === 55) expect(dashing(r)).toBe(true);
      if (f === 56) expect(dashing(r)).toBe(false);
      if (X(p) >= 160) p.x -= 64 * 256;
    }
    expect(log[55]).toEqual([125, 47]);
    expect(log[56]).toEqual([129, 47]);
    expect(log[57]).toEqual([129, 48]);
    expect(log[58]).toEqual([128, 49]);
  });

  it('perder a montaria no meio (com ovo reserva tipo 4): o remonte não recomeça a investida sozinho', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    const r = ride(s, 0, 0x4, { reserves: [0x4] });
    run(s, 2, { 0: BTN.RIGHT });
    run(s, 1, { 0: BTN.Y });
    run(s, 4);
    flameAt(s, cellOf(3, 1));
    run(s, 1);
    expect(r.phase).toBe('dismount');
    s.grid[cellOf(3, 1)] = 0;
    run(s, REMOUNT_TICKS + 1);
    expect(r.phase).toBe('riding');
    const x = X(p);
    run(s, 20);
    expect(X(p)).toBe(x);
    expect(dashing(r)).toBe(false);
  });

  it('travado no meio (atordoado): ao fim da trava volta à rotina normal, sem investida', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    const r = ride(s, 0, 0x4);
    run(s, 2, { 0: BTN.RIGHT });
    run(s, 1, { 0: BTN.Y });
    run(s, 5);
    stunPlayer(s, p, []);
    expect(p.act).toBe('stunned');
    run(s, 80);
    const x = X(p);
    run(s, 10);
    expect(X(p)).toBe(x);
    expect(x).toBeLessThan(80);
    expect(dashing(r)).toBe(false);
  });

  it('arena 9: entrar de cima na ponta alta vira a gangorra (f6 transição, f8 virada) e a investida segue', () => {
    // ROM (st_arena09, polvo em (6,1) olhando para baixo, Y): y 48 → 52 … f6 y=72 entra em (6,3), a ponta alta da
    // gangorra (4–6,3) no estado 0 (palavras 08EC 48E2 48E0); f6–7 transição (08E6 08E8 08EA), f8 estado 1; segue até a
    // parede de baixo.
    const s = mkRound({ stage: 9 });
    clearSoft(s);
    const p = placePx(s, 0, cx(6), 48);
    p.face = 4;
    const r = ride(s, 0, 0x4);
    const saw = st9(s).saws.find(w => w.b === cellOf(6, 3))!;
    expect(saw.state).toBe(0);
    const ys: number[] = [];
    for (let f = 0; f < 40; f++) {
      run(s, 1, f === 0 ? { 0: BTN.Y } : {});
      ys.push(Y(p));
      if (f === 5) expect(saw.state).toBe(0);
      if (f === 6) expect(saw.state).toBe(1);
    }
    expect(ys[6]).toBe(72);
    expect(ys[39]).toBe(204);
    expect(dashing(r)).toBe(true);
  });
});
