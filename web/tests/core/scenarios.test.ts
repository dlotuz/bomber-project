import { arena, put, setCell, codeAt, run, runUntil, C } from './kit';
import { addBomb } from '../../src/core/bombs';
import { BTN, CODE, ITEM, type GameEvent } from '../../src/core/types';
import { cellAt } from '../../src/core/units';
import { itemCode } from '../../src/core/state';
import { createMatch, setRacerPrize, startRound, clearRacerPrize } from '../../src/core/match';

const inp = (p0 = 0, p1 = 0, p2 = 0): number[] => [p0, p1, p2, 0, 0];
const has = (ev: GameEvent[], type: GameEvent['type']) => ev.some(e => e.type === type);

describe('ponta a ponta', () => {
  it('A coloca; explode 127 ticks depois; a chama do tick t atinge no t+1; vitória 2 + 65 + 128', () => {
    const s = arena(); put(s, 0, 4, 1); put(s, 1, 6, 1);
    run(s, 1, inp(BTN.A));                                        // tick 101
    expect(s.bombs[0].born).toBe(101);
    run(s, 48, inp(BTN.DOWN));                                     // foge para (4,4)
    expect(cellAt(s.players[0].x, s.players[0].y)).toBe(C(4, 4));
    expect(runUntil(s, (_s, ev) => has(ev, 'explosion'))).toBe(228);
    expect(s.players[1].state).toBe('alive');
    run(s, 1);
    expect([s.players[1].state, s.players[1].hitT0]).toEqual(['dying', 229]);
    expect(runUntil(s, st => st.phase === 'over')).toBe(229 + 65 + 128);
    expect(s.result).toEqual({ kind: 'win', winner: 0, reason: 'last' });
  });
  it('chute: andar contra a bomba com Chute a leva até a parede', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.kick = true; put(s, 1, 8, 5);
    const b = addBomb(s, 1, C(6, 1));
    const ev = run(s, 120, inp(BTN.RIGHT));
    expect(ev.filter(e => e.type === 'bomb_kicked').length).toBe(1);
    expect([b.state, b.cell]).toEqual(['idle', C(14, 1)]);
  });
  it('soco na cabeça: atordoa 63 e o atingido perde itens, que voam', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.punch = true; p.face = 2;
    const q = put(s, 1, 8, 1); q.fire = 2;
    addBomb(s, 0, C(5, 1));
    const ev = run(s, 18, inp(BTN.Y));
    expect(ev).toContainEqual({ type: 'stunned', slot: 1 });
    expect([q.act, q.fire < 2]).toEqual(['stunned', true]);
    expect(s.flyers.some(f => f.kind === 'item' && f.ref === ITEM.FIRE)).toBe(true);
  });
  it('luva: A, A de novo e segura (pavio congela), solta → 5 casas', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.glove = true; p.face = 2; put(s, 1, 8, 5);
    run(s, 1, inp(BTN.A));                                         // 101: coloca
    run(s, 1);                                                     // 102
    run(s, 1, inp(BTN.A));                                         // 103: levanta
    const b = s.bombs[0];
    expect(b.state).toBe('held');
    const fuse = b.fuse;
    run(s, 9, inp(BTN.A));                                         // segura até 112
    expect(b.fuse).toBe(fuse);
    run(s, 1);                                                     // 113: solta → arremessa
    run(s, 12);
    expect([b.state, b.cell]).toEqual(['idle', C(9, 1)]);
  });
  it('pegar item cura a doença e a arremessa como caveira nova', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.disease = 0x22; put(s, 1, 8, 5);
    setCell(s, 5, 1, itemCode(ITEM.FIRE));
    const t = runUntil(s, (_s, ev) => has(ev, 'item_picked'), 60, inp(BTN.RIGHT));
    expect(t).toBeGreaterThan(0);
    expect([p.disease, p.fire]).toEqual([0, 1]);
    expect(s.flyers.some(f => f.kind === 'item' && f.ref >= 0x21 && f.ref <= 0x2b)).toBe(true);
  });
  it('drops da morte: no tick hitT0 + 22 as bombas extras aparecem inteiras', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.bombsCap = 3; p.bombsFree = 3; put(s, 1, 8, 5);
    setCell(s, 4, 1, CODE.FLAME); s.cellT0[C(4, 1)] = 100;
    run(s, 1);                                                     // 101: atingido
    expect(p.hitT0).toBe(101);
    run(s, 21);                                                    // 122
    expect(s.grid.filter(v => v === itemCode(ITEM.BOMB)).length).toBe(0);
    run(s, 1);                                                     // 123 = 101 + 22
    expect(s.grid.filter(v => v === itemCode(ITEM.BOMB)).length).toBe(2);
  });
  it('bloco de pressão mata mesmo com coração e invencibilidade', () => {
    const s = arena(); const p = put(s, 0, 2, 1); p.heart = true; p.inv = 500; put(s, 1, 8, 6);
    s.pressure.trigger = 100;
    expect(runUntil(s, (_s, ev) => ev.some(e => e.type === 'player_hit' && e.slot === 0))).toBe(100 + 205 + 38 + 1);
  });
  it('contágio por contato no passo', () => {
    const s = arena(); const a = put(s, 0, 4, 1); a.disease = 0x21; const b = put(s, 1, 5, 1);
    expect(runUntil(s, (_s, ev) => has(ev, 'disease_passed'), 20, inp(BTN.RIGHT))).toBeGreaterThan(0);
    expect([a.disease, b.disease]).toEqual([0, 0x21]);
  });
  it('$2B perde 1 item quando tick & 31 = 0', () => {
    const s = arena(); const p = put(s, 0, 8, 5); p.disease = 0x2b; p.kick = true; put(s, 1, 2, 1);
    run(s, 27);                                                    // 127
    expect(p.kick).toBe(true);
    run(s, 1);                                                     // 128
    expect(p.kick).toBe(false);
  });
  it('remota: B detona no mesmo tick', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.bombType = 1; put(s, 1, 8, 5);
    run(s, 1, inp(BTN.A));
    run(s, 48, inp(BTN.DOWN));
    run(s, 100);
    expect(s.bombs.length).toBe(1);
    const ev = run(s, 1, inp(BTN.B));
    expect(ev.filter(e => e.type === 'explosion')).toEqual([{ type: 'explosion', cell: C(4, 1), owner: 0 }]);
  });
  it('em `won` as bombas restantes não explodem', () => {
    const s = arena(); put(s, 0, 4, 1); put(s, 1, 8, 5);
    addBomb(s, 0, C(12, 9));
    setCell(s, 8, 5, CODE.FLAME); s.cellT0[C(8, 5)] = 100;
    const ev = run(s, 400);
    expect(ev.filter(e => e.type === 'explosion').length).toBe(0);
    expect(s.result).toEqual({ kind: 'win', winner: 0, reason: 'last' });
  });
  it('Bad Bomber: vira Bad 65 ticks depois do acerto, entra, arremessa e a cadência vale', () => {
    const s = arena({ players: 3, rules: { badBomber: true } });
    put(s, 0, 8, 5); put(s, 1, 4, 3); put(s, 2, 12, 9);
    setCell(s, 4, 3, CODE.FLAME); s.cellT0[C(4, 3)] = 100;
    run(s, 1);                                                     // 101: P2 atingido
    run(s, 65);                                                    // 166
    expect([s.players[1].state, s.bad.length, s.bad[0].x]).toEqual(['bad', 1, -16]);
    run(s, 31);                                                    // 197
    expect(s.bad[0].phase).toBe('patrol');
    run(s, 1, inp(0, BTN.A));                                      // 198
    expect(s.bombs.some(b => b.bad && b.state === 'air')).toBe(true);
    const t = runUntil(s, (_s, ev) => ev.some(e => e.type === 'explosion' && e.owner === 1), 400);
    expect(t).toBeGreaterThan(198);
    expect(s.bad[0].readyAt).toBe(t + 48);
  });
  it('em `won` o Bad Bomber não arremessa (a bomba congelaria no ar para sempre)', () => {
    const s = arena({ players: 3, rules: { badBomber: true } });
    put(s, 0, 8, 5); put(s, 1, 4, 3); put(s, 2, 12, 9);
    setCell(s, 4, 3, CODE.FLAME); s.cellT0[C(4, 3)] = 100;
    run(s, 97);                                                    // 197: P2 é Bad Bomber na moldura
    expect(s.bad[0].phase).toBe('patrol');
    setCell(s, 12, 9, CODE.FLAME); s.cellT0[C(12, 9)] = 197;       // P3 atingido em 198
    expect(runUntil(s, st => st.phase === 'won')).toBe(200);
    const ev = run(s, 1, inp(0, BTN.A));
    expect([has(ev, 'throw'), s.bombs.length, s.flyers.length]).toEqual([false, 0, 0]);
  });
  it('prêmio do Racer aplicado em toda rodada da partida', () => {
    const m = createMatch({ ...arena().rules, racer: true, active: [true, true, false, false, false] }, 1);
    setRacerPrize(m, 1, 0);
    expect(startRound(m).players[1].bombsCap).toBe(2);
    expect(startRound(m).players[1].bombsCap).toBe(2);
    clearRacerPrize(m);
    expect(startRound(m).players[1].bombsCap).toBe(1);
  });
});
