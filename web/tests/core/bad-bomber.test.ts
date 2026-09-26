import { arena, put, C } from './kit';
import { becomeBad, tickBadBombers, clearBadBombers } from '../../src/core/bad-bomber';
import { removeBomb } from '../../src/core/bombs';
import { BTN, type GameEvent, type RoundState } from '../../src/core/types';

function tick(s: RoundState, btn: number, ev: GameEvent[] = [], slot = 1): GameEvent[] {
  s.tick++;
  const inputs = [0, 0, 0, 0, 0]; inputs[slot] = btn;
  tickBadBombers(s, inputs, ev);
  return ev;
}
function badAt(x: number, y: number) {
  const s = arena({ rules: { badBomber: true } });
  const p = put(s, 1, 4, 3);
  becomeBad(s, p);
  const b = s.bad[0];
  b.x = x; b.y = y; b.phase = 'patrol';
  return { s, p, b };
}

describe('Bad Bomber (t79–t82)', () => {
  it('entra pelo lado em que morreu e anda 1 px/tick até a moldura', () => {
    const s = arena({ rules: { badBomber: true } });
    const p = put(s, 1, 4, 3);                       // X = 63 < 128 → esquerda
    becomeBad(s, p);
    expect([p.state, p.act, s.bad[0].x, s.bad[0].y, s.bad[0].phase]).toEqual(['bad', 'bad', -16, 79, 'enter']);
    for (let i = 0; i < 30; i++) tick(s, 0);
    expect(s.bad[0].phase).toBe('enter');
    tick(s, 0);
    expect([s.bad[0].x, s.bad[0].phase]).toEqual([15, 'patrol']);
    const s2 = arena({ rules: { badBomber: true } });
    becomeBad(s2, put(s2, 1, 12, 3));
    expect(s2.bad[0].x).toBe(271);
    for (let i = 0; i < 32; i++) tick(s2, 0);
    expect([s2.bad[0].x, s2.bad[0].phase]).toEqual([239, 'patrol']);
  });
  it('depois do gatilho da pressão, quem morre não vira Bad Bomber', () => {
    const s = arena({ rules: { badBomber: true } });
    s.pressure.trigger = 50;
    const p = put(s, 1, 4, 3);
    becomeBad(s, p);
    expect([p.state, s.bad.length]).toEqual(['out', 0]);
  });
  it('anda 1 px/tick pelo lado; num canto vale a direção do outro lado; para no canto', () => {
    const { s, b } = badAt(15, 100);
    tick(s, BTN.UP); expect([b.x, b.y]).toEqual([15, 99]);
    tick(s, BTN.LEFT); expect([b.x, b.y]).toEqual([15, 99]);        // perpendicular: não anda
    for (let i = 0; i < 100; i++) tick(s, BTN.UP);
    expect([b.x, b.y]).toEqual([15, 32]);                            // parou no canto
    tick(s, BTN.RIGHT); expect([b.x, b.y]).toEqual([16, 32]);        // curva automática
  });
  it('arremessa para dentro com A: bomba de fogo 1, pavio cheio, voo da luva', () => {
    const { s, b } = badAt(15, 80);
    const ev = tick(s, BTN.A);
    const bomb = s.bombs[0];
    expect([bomb.bad, bomb.fire, bomb.fuse, bomb.owner, bomb.state, bomb.cell]).toEqual([true, 1, 126, 1, 'air', C(1, 3)]);
    expect(s.flyers.map(f => [f.flight, f.dir])).toEqual([['throw5', 1]]);
    expect(b.live).toBe(bomb.id);
    expect(ev).toEqual([{ type: 'throw', slot: 1 }]);
    tick(s, 0); tick(s, BTN.A);
    expect(s.bombs.length).toBe(1);                                  // uma por vez
  });
  it('cadência: só pega outra 48 ticks depois de a anterior sumir', () => {
    const { s, b } = badAt(15, 80);
    tick(s, BTN.A);
    removeBomb(s, s.bombs[0], true);                                 // tick 101
    expect([b.live, b.readyAt]).toEqual([-1, 149]);
    tick(s, 0); tick(s, BTN.A);
    expect(s.bombs.length).toBe(0);
    while (s.tick < 148) tick(s, 0);
    tick(s, BTN.A);
    expect(s.bombs.length).toBe(1);
  });
  it('não arremessa a menos de 16 px de um canto', () => {
    const { s } = badAt(15, 40);
    tick(s, BTN.A);
    expect(s.bombs.length).toBe(0);
  });
  it('sai de cena no gatilho da pressão', () => {
    const { s, p } = badAt(15, 80);
    clearBadBombers(s, []);
    expect([p.state, s.bad]).toEqual(['out', []]);
  });
});
