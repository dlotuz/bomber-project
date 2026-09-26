import { newRound, run, input, place } from './helpers';
import { BTN, DISEASE, ITEM } from '../../src/legacy-core/types';
import { idx } from '../../src/legacy-core/grid';
import { speedSub, flameRange } from '../../src/legacy-core/player';

describe('itens', () => {
  const walkInto = (item: number) => {
    const s = newRound({ clear: true });
    s.arena.items[idx(2, 1)] = item;
    run(s, 10, input(0, BTN.RIGHT));
    return s;
  };
  it('Fogo+ aumenta alcance e some do chão', () => {
    const s = walkInto(ITEM.FIRE);
    expect(s.players[0].fire).toBe(1);
    expect(flameRange(s.players[0])).toBe(3);
    expect(s.arena.items[idx(2, 1)]).toBe(ITEM.NONE);
  });
  it('Bomba+, Patins e habilidades', () => {
    expect(walkInto(ITEM.BOMB).players[0].maxBombs).toBe(2);
    expect(walkInto(ITEM.SPEED).players[0].speed).toBe(2);
    expect(walkInto(ITEM.KICK).players[0].kick).toBe(true);
    expect(walkInto(ITEM.PUNCH).players[0].punch).toBe(true);
    expect(walkInto(ITEM.GLOVE).players[0].glove).toBe(true);
    expect(walkInto(ITEM.PIERCE).players[0].pierce).toBe(true);
  });
  it('máximos respeitados', () => {
    const s = newRound({ clear: true });
    s.players[0].speed = 5; s.arena.items[idx(2, 1)] = ITEM.SPEED;
    run(s, 10, input(0, BTN.RIGHT));
    expect(s.players[0].speed).toBe(5);
  });
  it('caveira aplica doença 1..4 por ~600 frames', () => {
    const s = walkInto(ITEM.SKULL);
    const p = s.players[0];
    expect(p.disease).toBeGreaterThanOrEqual(1);
    expect(p.disease).toBeLessThanOrEqual(4);
    expect(p.diseaseTimer).toBeGreaterThan(590);
  });
  it('doença cura após 600 frames', () => {
    const s = newRound({ clear: true });
    const p = s.players[0];
    p.disease = DISEASE.SLOW; p.diseaseTimer = 600;
    run(s, 599);
    expect(p.disease).toBe(DISEASE.SLOW);
    run(s, 1);
    expect(p.disease).toBe(DISEASE.NONE);
  });
  it('doenças alteram velocidade e alcance', () => {
    const s = newRound({ clear: true });
    const p = s.players[0];
    p.disease = DISEASE.SLOW; expect(speedSub(p)).toBe(4);
    p.disease = DISEASE.FAST; expect(speedSub(p)).toBe(15);
    p.disease = DISEASE.LOW_FIRE; expect(flameRange(p)).toBe(1);
  });
  it('diarreia solta bombas sem apertar A', () => {
    const s = newRound({ clear: true });
    s.players[0].disease = DISEASE.DIARRHEA; s.players[0].diseaseTimer = 600;
    run(s, 1);
    expect(s.bombs).toHaveLength(1);
  });
  it('diarreia respeita maxBombs (nunca mais que o limite de bombas próprias)', () => {
    const s = newRound({ clear: true });
    const p = s.players[0];
    p.disease = DISEASE.DIARRHEA; p.diseaseTimer = 600; p.maxBombs = 2;
    run(s, 250, input(0, BTN.RIGHT)); // anda por várias casas, tentando soltar bomba a cada frame
    const own = s.bombs.filter(b => b.owner === 0);
    expect(own.length).toBeLessThanOrEqual(2);
  });
  it('contágio por contato', () => {
    const s = newRound({ clear: true });
    s.players[0].disease = DISEASE.SLOW; s.players[0].diseaseTimer = 600;
    place(s, 1, 1, 1);
    run(s, 1);
    expect(s.players[1].disease).toBe(DISEASE.SLOW);
  });
});
