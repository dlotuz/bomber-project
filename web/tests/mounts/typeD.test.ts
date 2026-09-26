import { mkRound, placePx, ride, run, BTN, cx, cy } from './helpers';
import { activeCount } from '../../src/core/mounts/eggs';
import { mstate } from '../../src/core/mounts/types';
import { cellOf } from '../../src/core/mounts/core-api';

function launch(targetPx: number | null, extra = {}) {
  const s = mkRound({ players: [0, 2] });
  const p = placePx(s, 0, 32, 47); p.face = 2;
  if (targetPx !== null) placePx(s, 2, targetPx, 47); else placePx(s, 2, cx(14), cy(11));
  const r = ride(s, 0, 0xd, extra);
  const ev0 = run(s, 1, { 0: BTN.Y });                     // k = 0
  return { s, p, r, ev0 };
}

describe('montaria tipo D (alcachofra): Y lança a montaria', () => {
  it('alvo a 5 casas: explode 32 ticks depois do Y na (6,1) e mata o alvo (ROM: parada 31, explosão 32, morte 34)', () => {
    const { s, ev0 } = launch(112);
    expect(ev0).toContainEqual({ type: 'mount', id: 'mount_lost', slot: 0, mount: 0xd, reserve: false, cause: 'launch' });
    let kExp = -1;
    for (let k = 1; k <= 40 && kExp < 0; k++) {
      const ev = run(s, 1);
      const ex = ev.find(e => e.type === 'explosion');
      if (ex) { kExp = k; expect(ex).toMatchObject({ cell: cellOf(6, 1), owner: 0 }); }
    }
    expect(kExp).toBe(32);
    run(s, 3);
    expect(s.players[2].state).not.toBe('alive');
  });
  it('o montador cai: 1 + 51 ticks travado, depois 32 de invencibilidade', () => {
    const { s, p } = launch(null);
    expect(p.act).toBe('dismount');
    const x0 = p.x;
    run(s, 51, { 0: BTN.RIGHT });
    expect(p.x).toBe(x0);
    run(s, 1);
    expect(p.mount).toBeNull();
    expect(p.inv).toBe(32);
  });
  it('bate no bloco: explode na casa antes dele (soft em (6,1) → explosão na (5,1) em k = 24)', () => {
    const s = mkRound();
    const p = placePx(s, 0, 32, 47); p.face = 2;
    s.grid[cellOf(6, 1)] = 0xcc80;
    ride(s, 0, 0xd);
    run(s, 1, { 0: BTN.Y });
    let k = 0, ex: { cell?: number } | undefined;
    while (!ex && k < 60) { k++; ex = run(s, 1).find(e => e.type === 'explosion') as { cell?: number } | undefined; }
    expect(k).toBe(24);
    expect(ex!.cell).toBe(cellOf(5, 1));
    run(s, 1);
    expect(s.grid[cellOf(6, 1)]).not.toBe(0xcc80);
  });
  it('míssil em voo não conta no teto (a ROM desconta no lançamento, $C2:60B9); some depois de explodir', () => {
    const { s } = launch(null);
    expect(activeCount(s)).toBe(0);
    expect(mstate(s).projectiles[0]).toMatchObject({ kind: 0xd, slot: 1, state: 'fly' });
    run(s, 120);
    expect(mstate(s).projectiles).toHaveLength(0);
    expect(activeCount(s)).toBe(0);
  });
  it('com ovo reserva: remonta em 1 + 51 na outra vaga; o míssil fica com a antiga', () => {
    const { s, p, r } = launch(null, { reserves: [0x3] });
    expect(mstate(s).projectiles[0].slot).toBe(1);
    expect(r.slot).toBe(2);
    run(s, 51);                                              // H+1..H+51
    expect(r.phase).toBe('dismount');
    run(s, 1);                                               // H+52
    expect(p.mount).toBe(r);
    expect(r).toMatchObject({ phase: 'riding', type: 0x3 });
  });
});
