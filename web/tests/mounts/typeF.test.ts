import { mkRound, placePx, ride, run, firstTick, flameAt, BTN } from './helpers';
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
  it('nota some ao bater em bloco: objeto final em k = 31 (x = 48), por 40 ticks', () => {
    const s = mkRound();
    const p = placePx(s, 0, 32, 47); p.face = 2;
    s.grid[cellOf(4, 1)] = 0xcc80;
    ride(s, 0, 0xf);
    run(s, 1, { 0: BTN.Y });
    const pr = mstate(s).projectiles[0];
    run(s, 30);
    expect(pr.state).toBe('fly');
    run(s, 1);
    expect([pr.state, Math.floor(pr.x / 256)]).toEqual(['cloud', 48]);
    run(s, 39);
    expect(mstate(s).projectiles).toHaveLength(1);
    run(s, 1);
    expect(mstate(s).projectiles).toHaveLength(0);
  });
  it('sem alvo nem bloco: o voo acaba em k = 159 (medido de x = 32 e x = 65)', () => {
    const s = mkRound();
    const p = placePx(s, 0, 32, 47 + 16 * 4); p.face = 2;   // linha 5: (3,5)..(14,5) livres
    ride(s, 0, 0xf);
    run(s, 1, { 0: BTN.Y });
    const pr = mstate(s).projectiles[0];
    run(s, 158);
    expect(pr.state).toBe('fly');
    run(s, 1);
    expect(pr.state).toBe('cloud');
  });
});

/** Y no tick k (k = 0 é o tick do 1º Y); devolve se nasceu uma nota nova nesse tick. */
function refire(setup: (s: ReturnType<typeof mkRound>) => void, face: 0 | 2 | 4 | 6, k: number, y = 47): boolean {
  const s = mkRound({ players: [0, 2] });
  const p = placePx(s, 0, 32, y); p.face = face;
  placePx(s, 2, 14 * 16 - 1, 11 * 16 + 31);
  setup(s);
  ride(s, 0, 0xf);
  run(s, 1, { 0: BTN.Y });
  expect(mstate(s).projectiles).toHaveLength(1);
  run(s, k - 1);
  run(s, 1, { 0: BTN.Y });
  return mstate(s).projectiles.some(pr => pr.born === s.tick);
}

// Ajuste C, item 4: +$C6 ($C2:471E) só zera quando o objeto final da nota some (fim + 40). Medido (refire.py, hitF.py,
// wall.py): de frente para a parede/item, fim em 0 → Y em 39 não lança, em 40 lança; bloco a 2 casas, fim em 31 →
// 70 não, 71 sim; livre, fim em 159 → 198 não, 199 sim; acerto (alvo a 72 px), fim em 78 → 117 não, 118 sim.
describe('ajuste C: Soneca — uma nota por vez até o objeto final sumir', () => {
  it('de frente para a parede: a nota acaba na hora; Y de novo só 40 ticks depois', () => {
    expect(refire(() => {}, 0, 39)).toBe(false);
    expect(refire(() => {}, 0, 40)).toBe(true);
  });
  it('bloco a 2 casas (fim em 31): 70 não, 71 sim', () => {
    const soft = (s: ReturnType<typeof mkRound>) => { s.grid[cellOf(4, 1)] = 0xcc80; };
    expect(refire(soft, 2, 70)).toBe(false);
    expect(refire(soft, 2, 71)).toBe(true);
  });
  it('sem alvo (fim em 159): 198 não, 199 sim', () => {
    expect(refire(() => {}, 2, 198, 47 + 16 * 4)).toBe(false);
    expect(refire(() => {}, 2, 199, 47 + 16 * 4)).toBe(true);
  });
  it('acerto no alvo a 72 px (fim em 78, dança em 79): 117 não, 118 sim', () => {
    const tgt = (s: ReturnType<typeof mkRound>) => { placePx(s, 2, 72, 47); };
    expect(refire(tgt, 2, 117)).toBe(false);
    expect(refire(tgt, 2, 118)).toBe(true);
  });
  it('apertar Y sem parar contra a parede: uma nota a cada 40 ticks, não uma por toque', () => {
    const s = mkRound();
    const p = placePx(s, 0, 32, 47); p.face = 0;
    ride(s, 0, 0xf);
    let shots = 0;
    for (let i = 0; i < 120; i++) {
      run(s, 1, i % 2 === 0 ? { 0: BTN.Y } : {});
      shots += mstate(s).projectiles.filter(pr => pr.born === s.tick).length;
    }
    expect(shots).toBe(3);                                  // ticks 0, 40, 80
  });
});

describe('ajuste C: Soneca — bomba e chama no caminho', () => {
  it('bomba posta no caminho durante o voo: a nota some ao entrar na casa e não acerta quem está atrás', () => {
    const s = mkRound({ players: [0, 2] });
    const p = placePx(s, 0, 32, 47); p.face = 2;
    const q = placePx(s, 2, 96, 47);
    ride(s, 0, 0xf);
    run(s, 1, { 0: BTN.Y });
    run(s, 39);
    s.grid[cellOf(4, 1)] = 0xc900;
    const pr = mstate(s).projectiles[0];
    expect(39 + firstTick(s, 20, () => pr.state === 'cloud')).toBe(46);
    run(s, 120);
    expect(q.act).not.toBe('dance');
  });
  it('chama no caminho: a nota some ao entrar na casa da chama', () => {
    const s = mkRound();
    const p = placePx(s, 0, 32, 47); p.face = 2;
    ride(s, 0, 0xf);
    run(s, 1, { 0: BTN.Y });
    run(s, 60);
    flameAt(s, cellOf(5, 1));                                // a chama dura 25 ticks: acende quando a nota chega
    const pr = mstate(s).projectiles[0];
    expect(60 + firstTick(s, 30, () => pr.state === 'cloud')).toBe(78);
  });
});

describe('ajuste: duração do soneca', () => {
  it('Rules.sleepTicks muda quanto tempo o alvo fica travado', () => {
    const s = mkRound({ players: [0, 2] });
    s.rules.sleepTicks = 60;
    const p = placePx(s, 0, 32, 47); p.face = 2;
    const q = placePx(s, 2, 72, 47);
    ride(s, 0, 0xf);
    run(s, 1, { 0: BTN.Y });
    let hit = -1;
    for (let k = 1; k < 200 && hit < 0; k++) { run(s, 1); if (q.act === 'dance') hit = s.tick; }
    expect(hit).toBeGreaterThan(0);
    run(s, 58);
    expect(q.act).toBe('dance');
    run(s, 2);
    expect(q.act).not.toBe('dance');
  });
});
