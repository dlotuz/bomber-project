// Auditoria de "atravessar bomba": movimento forçado (esteira da fase 6, golpe P) e bomba que cai (caça-níquel da
// fase 8) contra bomba rolando, que fica fora da grade.
import { arena, put, C } from './kit';
import { addBomb } from '../../src/core/bombs';
import { applyPush } from '../../src/core/actions';
import { rollerAt } from '../../src/core/kick';
import { landBomb } from '../../src/core/stages/kit';
import { playerCell } from '../../src/core/state';
import { centerX, centerY } from '../../src/core/units';

function rolling(col: number, lin: number) {
  const s = arena();
  const b = addBomb(s, 1, C(col, lin));
  b.state = 'kicked'; b.dir = 4; b.step = 2; b.y = centerY(lin) + 2 * 256;   // rolando para baixo, ainda na casa
  s.grid[C(col, lin)] = 0;                                                  // rolando: fora da grade
  return { s, b };
}

describe('empurrão contra bomba rolando', () => {
  it('o empurrado para na casa dele, não entra na casa da bomba rolando', () => {
    const { s, b } = rolling(6, 5);
    expect(rollerAt(s, C(6, 5))).toBe(b);
    const p = put(s, 0, 5, 5);
    p.x = centerX(5) + 4 * 256;
    p.push = { vx: 4 * 256, vy: 0, left: 12 };
    for (let i = 0; i < 12; i++) applyPush(s, p, []);
    expect(playerCell(p)).toBe(C(5, 5));
    expect(p.push.left).toBe(0);
  });
  it('com Atravessa Bomba o empurrão segue', () => {
    const { s } = rolling(6, 5);
    const p = put(s, 0, 5, 5);
    p.passBomb = true;
    p.x = centerX(5) + 4 * 256;
    p.push = { vx: 4 * 256, vy: 0, left: 12 };
    for (let i = 0; i < 12; i++) applyPush(s, p, []);
    expect(playerCell(p)).toBeGreaterThan(C(6, 5) - 1);   // passou pela casa da bomba (48 px: 3 casas)
  });
});

describe('bomba que cai (caça-níquel) na casa de uma bomba rolando', () => {
  it('não vira uma segunda bomba parada na mesma casa: quica', () => {
    const { s } = rolling(6, 5);
    landBomb(s, C(6, 5), []);
    expect(s.bombs.filter(x => x.state === 'idle' && x.cell === C(6, 5))).toHaveLength(0);
    expect(s.bombs.some(x => x.state === 'air')).toBe(true);
  });
});
