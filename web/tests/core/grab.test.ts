import { arena, put, run, setCell, C } from './kit';
import { addBomb } from '../../src/core/bombs';
import { checkHit } from '../../src/core/hit';
import { BTN, CODE, type RoundState } from '../../src/core/types';
import { playerCell } from '../../src/core/state';

function pair() {
  const s = arena({ players: 2 });
  const p = put(s, 0, 4, 1); p.glove = true; p.face = 2;
  const q = put(s, 1, 4, 1);
  return { s, p, q };
}
/** Até o arremessado pousar (ou `max` ticks). */
function untilLanded(s: RoundState, slot: number, max = 200): void {
  for (let i = 0; i < max && s.players[slot].flying; i++) run(s, 1);
}

describe('luva pega jogador', () => {
  it('A com outro jogador na mesma casa: pega, ele acompanha, e ao soltar A é arremessado 5 casas', () => {
    const { s, p, q } = pair();
    run(s, 1, [BTN.A, 0]);
    expect([p.grab, q.heldBy, q.act]).toEqual([1, 0, 'held']);
    run(s, 9, [BTN.A | BTN.RIGHT, 0]);   // levantar: 8 ticks travado (ROM $C2:3692); anda em T+9
    expect([q.x, q.y]).toEqual([p.x, p.y]);
    run(s, 1, [0, 0]);
    expect(q.flying).toBe(true);
    expect(p.grab).toBe(-1);
    untilLanded(s, 1);
    expect([q.flying, q.act, q.state]).toEqual([false, 'idle', 'alive']);
    expect(playerCell(q) - playerCell(p)).toBe(5);
  });
  it('quem segura B (trancar) não é pego; com bomba na casa, a luva levanta a bomba', () => {
    const { s, p, q } = pair();
    const b = addBomb(s, 1, C(4, 1));
    run(s, 1, [0, BTN.B]);
    run(s, 1, [BTN.A, BTN.B]);
    expect([p.grab, q.heldBy]).toEqual([-1, -1]);
    expect(p.carry).toBe(b.id);
  });
  it('B com luva não pega jogador', () => {
    const { s, p, q } = pair();
    run(s, 1, [BTN.B, 0]);
    run(s, 5, [BTN.B, 0]);
    expect([p.grab, q.heldBy]).toEqual([-1, -1]);
  });
  it('segurando B (trancar): travado na pose de detonar (não anda) e a luva não pega; soltou B, pode ser pego', () => {
    const s = arena({ players: 2 });
    const p = put(s, 0, 4, 1); p.glove = true;
    const q = put(s, 1, 4, 1);
    run(s, 5, [0, BTN.B]);
    const x0 = q.x, t0 = q.actT0;
    run(s, 3, [0, BTN.B | BTN.RIGHT]);
    expect([q.act, q.x, q.actT0]).toEqual(['detonate', x0, t0]);   // pose congelada, sem reiniciar
    run(s, 1, [BTN.A, BTN.B]);
    expect(p.grab).toBe(-1);
    run(s, 1, [0, 0]); run(s, 1, [0, 0]);
    run(s, 1, [BTN.A, 0]);
    expect([p.grab, q.act]).toEqual([1, 'held']);
  });
  it('na mão não toma chama', () => {
    const { s, p, q } = pair();
    run(s, 1, [BTN.A, 0]);
    setCell(s, 4, 1, CODE.FLAME);
    checkHit(s, q, []);
    expect(q.state).toBe('alive');
    expect(p.grab).toBe(1);
  });
  it('cair num bloco de pressão (mapa fechando) mata', () => {
    const { s, q } = pair();
    setCell(s, 9, 1, CODE.PRESSURE);
    run(s, 1, [BTN.A, 0]); run(s, 8, [BTN.A, 0]); run(s, 1, [0, 0]);
    untilLanded(s, 1);
    expect(q.state).toBe('dying');
  });
  it('cair num bloco quica para a casa seguinte e continua vivo', () => {
    const { s, q } = pair();
    setCell(s, 9, 1, CODE.SOFT);
    run(s, 1, [BTN.A, 0]); run(s, 8, [BTN.A, 0]); run(s, 1, [0, 0]);
    untilLanded(s, 1);
    expect([q.state, playerCell(q)]).toEqual(['alive', C(10, 1)]);
  });
  it('arremessado para fora do mapa quica e volta para a arena', () => {
    const s = arena({ players: 2 });
    const p = put(s, 0, 12, 1); p.glove = true; p.face = 2;
    const q = put(s, 1, 12, 1);
    run(s, 1, [BTN.A, 0]); run(s, 8, [BTN.A, 0]); run(s, 1, [0, 0]);
    untilLanded(s, 1, 400);
    expect([q.flying, q.state]).toEqual([false, 'alive']);
    expect(s.grid[playerCell(q)]).toBe(CODE.FLOOR);
  });
  it('apertando B Rules.gloveEscape vezes se solta', () => {
    const { s, p, q } = pair();
    s.rules.gloveEscape = 3;
    run(s, 1, [BTN.A, 0]);
    for (let k = 0; k < 2; k++) { run(s, 1, [BTN.A, BTN.B]); run(s, 1, [BTN.A, 0]); }
    expect(q.heldBy).toBe(0);
    run(s, 1, [BTN.A, BTN.B]);
    expect([q.heldBy, p.grab, q.act]).toEqual([-1, -1, 'idle']);
  });
  it('arremessado em outro jogador (ou em quem jogou): por padrão ninguém é atordoado, só quica', () => {
    const s = arena({ players: 3 });
    const p = put(s, 0, 4, 1); p.glove = true; p.face = 2;
    const q = put(s, 1, 4, 1);
    const o = put(s, 2, 9, 1);
    run(s, 1, [BTN.A, 0, 0]); run(s, 8, [BTN.A, 0, 0]); run(s, 1, [0, 0, 0]);
    untilLanded(s, 1);
    expect([o.act, q.act]).toEqual(['idle', 'idle']);
    expect(playerCell(q)).not.toBe(C(9, 1));
  });
  it('com Rules.throwStun: quem é atingido e quem foi arremessado ficam atordoados', () => {
    const s = arena({ players: 3 });
    s.rules.throwStun = true;
    const p = put(s, 0, 4, 1); p.glove = true; p.face = 2;
    const q = put(s, 1, 4, 1);
    const o = put(s, 2, 9, 1);
    run(s, 1, [BTN.A, 0, 0]); run(s, 8, [BTN.A, 0, 0]); run(s, 1, [0, 0, 0]);
    untilLanded(s, 1);
    expect([o.act, q.act]).toEqual(['stunned', 'stunned']);
  });
  it('Rules.throwStun não vale para bomba: bomba arremessada na cabeça atordoa sempre', () => {
    const s = arena({ players: 2 });
    expect(s.rules.throwStun).toBe(false);
    const p = put(s, 0, 4, 1); p.glove = true; p.face = 2;
    put(s, 1, 7, 1);
    addBomb(s, 0, C(4, 1));
    run(s, 1, [BTN.A, 0]); run(s, 8, [BTN.A, 0]); run(s, 1, [0, 0]);
    let stunned = false;
    for (let i = 0; i < 80 && !stunned; i++) { run(s, 1); stunned = s.players[1].act === 'stunned'; }
    expect(stunned).toBe(true);
  });
  it('B segurando jogador: larga na própria casa; ele cai em 52 ticks (pulo de perder montaria), imune, e ganha 32 de invencibilidade', () => {
    const { s, p, q } = pair();
    run(s, 1, [BTN.A, 0]); run(s, 8, [BTN.A, 0]);
    run(s, 1, [BTN.A | BTN.B, 0]);
    expect([p.grab, q.heldBy, q.act, playerCell(q)]).toEqual([-1, -1, 'dropped', playerCell(p)]);
    setCell(s, 4, 1, CODE.FLAME);
    checkHit(s, q, []);
    expect(q.state).toBe('alive');
    setCell(s, 4, 1, CODE.FLOOR);
    run(s, 50, [0, BTN.RIGHT]);
    expect(q.act).toBe('dropped');
    run(s, 2, [0, 0]);
    expect([q.act, q.inv > 0]).toEqual(['idle', true]);
  });
  it('largado por jogador de slot maior: também 52 ticks', () => {
    const s = arena({ players: 2 });
    const q = put(s, 0, 4, 1);
    const p = put(s, 1, 4, 1); p.glove = true; p.face = 2;
    run(s, 1, [0, BTN.A]); run(s, 8, [0, BTN.A]);
    run(s, 1, [0, BTN.A | BTN.B]);
    expect(q.act).toBe('dropped');
    run(s, 50);
    expect(q.act).toBe('dropped');
    run(s, 2);
    expect(q.act).toBe('idle');
  });
});
