import { arena, put, withStage } from './kit';
import { applyDiseaseInput, speedLevel, tickDisease, contagion, rollSkull, cureAndThrow, invisibleVisible, inContact } from '../../src/core/disease';
import { BTN, type GameEvent } from '../../src/core/types';
import { centerX } from '../../src/core/units';

describe('entrada', () => {
  it('$2A e efeito $0A invertem ↑↓ e ←→', () => {
    const s = arena(); const p = s.players[0];
    p.disease = 0x2a;
    expect(applyDiseaseInput(s, p, BTN.UP | BTN.LEFT | BTN.A)).toBe(BTN.DOWN | BTN.RIGHT | BTN.A);
    p.disease = 0; p.effect = { kind: 0x0a, left: 64 };
    expect(applyDiseaseInput(s, p, BTN.DOWN)).toBe(BTN.UP);
  });
  it('$26: sem direção, repete a última', () => {
    const s = arena(); const p = s.players[0]; p.disease = 0x26;
    applyDiseaseInput(s, p, BTN.RIGHT);
    expect(applyDiseaseInput(s, p, BTN.A)).toBe(BTN.RIGHT | BTN.A);
    p.disease = 0;
    expect(applyDiseaseInput(s, p, 0)).toBe(0);
  });
});

describe('velocidade', () => {
  it('$21 → 6, $22 → 7, efeito lento → 7; senão o nível dos patins; gancho da arena', () => {
    const s = arena(); const p = s.players[0]; p.speedLv = 3;
    expect(speedLevel(s, p)).toBe(3);
    p.disease = 0x21; expect(speedLevel(s, p)).toBe(6);
    p.disease = 0x22; expect(speedLevel(s, p)).toBe(7);
    p.disease = 0; p.effect = { kind: 2, left: 64 }; expect(speedLevel(s, p)).toBe(7);
    p.effect = { kind: 0, left: 0 };
    withStage(1, { speedLevel: () => 6 }, () => expect(speedLevel(s, p)).toBe(6));
  });
  it('efeito $0A com left 64 dura 256 ticks', () => {
    const s = arena(); const p = s.players[0]; p.effect = { kind: 0x0a, left: 64 };
    for (let i = 0; i < 255; i++) { s.tick++; tickDisease(s, p, []); }
    expect(p.effect.kind).toBe(0x0a);
    s.tick++; tickDisease(s, p, []);
    expect(p.effect).toEqual({ kind: 0, left: 0 });
  });
});

describe('caveira', () => {
  it('sorteio: nunca $2C; $24 só 1 vez por rodada', () => {
    const s = arena();
    const got = Array.from({ length: 300 }, () => rollSkull(s));
    expect(got.every(id => id >= 0x21 && id <= 0x2b)).toBe(true);
    expect(got.filter(id => id === 0x24).length).toBeLessThanOrEqual(1);
    expect(new Set(got).size).toBeGreaterThanOrEqual(9);
  });
  it('cura ao pegar item: a doença sai voando como caveira nova', () => {
    const s = arena(); const p = put(s, 0, 8, 5); p.disease = 0x22; p.diseaseT = 77;
    cureAndThrow(s, p, []);
    expect([p.disease, p.diseaseT]).toEqual([0, 0]);
    expect(s.flyers.length).toBe(1);
    expect(s.flyers[0].kind).toBe('item');
    expect(s.flyers[0].ref).toBeGreaterThanOrEqual(0x21);
  });
  it('invisível: padrão $C2:4F68 (0x55 no começo, some de vez depois de 128 ticks)', () => {
    const p = arena().players[0]; p.disease = 0x29;
    const vis = (t: number) => { p.diseaseT = t; return invisibleVisible(p); };
    expect([0, 1, 2, 3].map(vis)).toEqual([true, false, true, false]);
    expect(vis(24)).toBe(true);                       // 0x33, bit 0
    expect(vis(26)).toBe(false);                      // 0x33, bit 2
    expect(vis(128)).toBe(false);
    p.disease = 0;
    expect(invisibleVisible(p)).toBe(true);
  });
});

describe('contágio (t65)', () => {
  it('|dx| ≤ 8 e |dy| ≤ 8 px: passa e cura quem passou; não volta enquanto o contato continua', () => {
    const s = arena(); const a = put(s, 0, 4, 1); const b = put(s, 1, 4, 1, 8, 0);
    a.disease = 0x21;
    const ev: GameEvent[] = [];
    contagion(s, ev);
    expect([a.disease, b.disease]).toEqual([0, 0x21]);
    expect(ev).toEqual([{ type: 'disease_passed', from: 0, to: 1 }]);
    contagion(s, ev);
    expect([a.disease, b.disease]).toEqual([0, 0x21]);
    b.x = centerX(8); contagion(s, ev);              // separou: trava sai
    b.x = a.x; contagion(s, ev);
    expect([a.disease, b.disease]).toEqual([0x21, 0]);
  });
  it('3 jogadores em contato: passa em ordem de slot no mesmo tick (0→1, depois 1→2)', () => {
    const s = arena({ players: 3 }); const a = put(s, 0, 4, 1); const b = put(s, 1, 4, 1, 4, 0); const c = put(s, 2, 4, 1, 8, 0);
    a.disease = 0x22; a.diseaseT = 40;
    const ev: GameEvent[] = [];
    contagion(s, ev);
    expect([a.disease, b.disease, c.disease]).toEqual([0, 0, 0x22]);
    expect([a.diseaseT, b.diseaseT, c.diseaseT]).toEqual([0, 0, 0]);
    expect(ev).toEqual([{ type: 'disease_passed', from: 0, to: 1 }, { type: 'disease_passed', from: 1, to: 2 }]);
  });
  it('9 px não é contato; fora de `play` não passa', () => {
    const s = arena(); const a = put(s, 0, 4, 1); const b = put(s, 1, 4, 1, 9, 0);
    expect(inContact(a, b)).toBe(false);
    b.x = a.x; a.disease = 0x21; s.phase = 'won';
    contagion(s, []);
    expect(b.disease).toBe(0);
  });
});
