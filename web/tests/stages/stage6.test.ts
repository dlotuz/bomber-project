import '../../src/core/stages';                    // entra no ciclo pelo índice (senão STAGES[6] fica undefined)
import { stage6, st6 } from '../../src/core/stages/stage6';
import { stage6Ai } from '../../src/core/ai/stages/stage6';
import { BTN, CODE, type GameEvent } from '../../src/core/types';
import { cellOf, centerX, px } from '../../src/core/units';
import { addBomb } from '../../src/core/bombs';
import { playerCell } from '../../src/core/state';
import { fallbackLayers } from '../../src/render/battle-layers';
import '../../src/render/fallback/stages/stage6';
import { stageArena, fullRound, put, run, setCell, stageEvents, mirror, fakeCtx } from './kit';

const HIDDEN_6: [number, number, number][] = [
  [10, 8, 1], [9, 1, 1], [7, 1, 1], [14, 5, 1], [14, 4, 1], [12, 6, 1], [13, 9, 1], [10, 4, 1], [2, 3, 1], [7, 3, 1],
  [3, 7, 3], [11, 9, 3], [10, 7, 3], [8, 9, 3], [6, 9, 3], [6, 4, 3], [13, 7, 5], [6, 11, 5], [6, 1, 5],
  [4, 4, 0x0e], [8, 10, 0x0e], [3, 9, 0x0e], [5, 11, 0x12], [10, 1, 0x12], [4, 5, 7], [14, 7, 7], [2, 6, 0x0d], [10, 6, 0x0d],
  [10, 3, 4], [8, 8, 0x21], [5, 7, 0x30], [6, 8, 0x30], [12, 11, 0x30], [6, 5, 0x30],
];

describe('arena 6: carga [D1]', () => {
  it('golden: $1EAA = 111, itens escondidos e semente $61B3 (1 sorteio do init antes dos itens)', () => {
    const s = fullRound(6);
    expect(st6(s).counter).toBe(111);
    expect(s.rng.seed).toBe(0x61b3);
    expect(s.hidden).toEqual(HIDDEN_6.map(([c, l, i]) => [cellOf(c, l), i]));
  });
});

/** Explosão em (8,5) com braços de 2 casas, na ordem do plano 6 (centro, cima, dir, baixo, esq), e o tick da arena. */
function explode(s: ReturnType<typeof stageArena>): void {
  const call = (c: number, l: number, dir: number) => {
    setCell(s, c, l, CODE.FLAME);
    stage6.onFlameCell!(s, cellOf(c, l), dir, []);
  };
  call(8, 5, -1);
  call(8, 4, 0); call(8, 3, 0);
  call(9, 5, 2); call(10, 5, 2);
  call(8, 6, 4); call(8, 7, 4);
  call(7, 5, 6); call(6, 5, 6);
  stage6.tick!(s, []);
}

describe('arena 6: repintura [D9]', () => {
  it('4 sorteios por explosão (v = 15, 4, 3, 5 a partir de $42B9), braços na ordem, centro por último com o v da esquerda', () => {
    const s = stageArena(6);                       // init: 64 + (66 & 63) = 66, semente $42B9
    expect(st6(s).counter).toBe(66);
    explode(s);
    expect(s.rng.seed).toBe(0xc689);
    const f = (c: number, l: number) => s.floor[cellOf(c, l)];
    expect([f(8, 4), f(8, 3)]).toEqual([0x1c0a, 0x1c0a]);   // v = 15
    expect([f(9, 5), f(10, 5)]).toEqual([0x1c0a, 0x1c0a]);  // v = 4
    expect([f(8, 6), f(8, 7)]).toEqual([0x1c06, 0x1c06]);   // v = 3
    expect([f(7, 5), f(6, 5)]).toEqual([0x1c0a, 0x1c08]);   // v = 5; contador 58: 58 & 7 = 2 → caveirinhas
    expect(f(8, 5)).toBe(0x1c0a);                           // centro, v da esquerda
    expect(st6(s).counter).toBe(57);
  });
  it('contador chega a 0: caveira 1C0C e novo contador 64 + (rnd255 & 63)', () => {
    const s = stageArena(6);
    setCell(s, 8, 5, CODE.FLAME);
    stage6.onFlameCell!(s, cellOf(8, 5), -1, []);
    st6(s).counter = 1;
    setCell(s, 8, 4, CODE.FLAME);
    stage6.onFlameCell!(s, cellOf(8, 4), 0, []);
    expect(s.floor[cellOf(8, 4)]).toBe(0x1c0c);
    expect(st6(s).counter).toBe(114);
    expect(s.rng.seed).toBe(0x331b);
  });
  it('casa com bit $2000 (queimando) não é repintada nem conta', () => {
    const s = stageArena(6);
    setCell(s, 8, 5, CODE.FLAME);
    stage6.onFlameCell!(s, cellOf(8, 5), -1, []);
    setCell(s, 8, 4, CODE.BURNING);
    stage6.onFlameCell!(s, cellOf(8, 4), 0, []);
    expect(s.floor[cellOf(8, 4)]).toBe(0);
    expect(st6(s).counter).toBe(66);
  });
});

describe('arena 6: efeitos [D10, D11]', () => {
  it('1C0C: controles invertidos {$0A, $40}, renovado; SFX só se não havia efeito', () => {
    const s = stageArena(6);
    s.floor[cellOf(5, 5)] = 0x1c0c;
    const p = put(s, 0, 5, 5);
    const ev1: GameEvent[] = [];
    stage6.onStand!(s, p, cellOf(5, 5), ev1);
    expect(p.effect).toEqual({ kind: 0x0a, left: 0x40 });
    expect(stageEvents(ev1, 'a6_reverse').length).toBe(1);
    p.effect.left = 10;
    const ev2: GameEvent[] = [];
    stage6.onStand!(s, p, cellOf(5, 5), ev2);
    expect(p.effect.left).toBe(0x40);
    expect(stageEvents(ev2, 'a6_reverse').length).toBe(0);
  });
  it('1C0A: empurra na face, 2 px/tick, até o centro da casa seguinte (medido 72 → 95 em 12 ticks)', () => {
    const s = stageArena(6);
    s.floor[cellOf(5, 5)] = 0x1c0a;
    const p = put(s, 0, 5, 5, -7, 3);                   // x = 72 px; y fora do centro
    p.face = 2;
    stage6.onStand!(s, p, cellOf(5, 5), []);
    expect(p.push).toEqual({ vx: 512, vy: 0, left: 12 });
    expect(p.act).toBe('pushed');
    expect(px(p.y)).toBe(111);                          // eixo perpendicular alinhado
    run(s, 13);
    expect(px(p.x)).toBe(95);
  });
  it('1C0A: bomba que aparece na casa de destino no meio do empurrão: para no centro da casa atual, não entra nela', () => {
    // $C2:1E6D–$C2:1E92: a cada tick do empurrão, objeto bomba ([$38] bit $4000) na casa da frente → $C2:1F08 alinha
    // X e Y no centro da casa ATUAL e volta ao estado normal ($C2:22F0). Antes, o alinhamento final do empurrão ia para
    // o centro do destino mesmo depois de o empurrão parar, e o jogador era posto dentro da bomba.
    const s = stageArena(6);
    s.floor[cellOf(5, 5)] = 0x1c0a;
    const p = put(s, 0, 5, 5, -7, 0);
    p.face = 2;
    stage6.onStand!(s, p, cellOf(5, 5), []);
    run(s, 2);
    addBomb(s, 1, cellOf(6, 5));                        // alguém pôs uma bomba no destino
    for (let i = 0; i < 20; i++) { run(s, 1); expect(playerCell(p), `tick ${s.tick}`).toBe(cellOf(5, 5)); }
    expect(px(p.x)).toBe(79);                           // centro da (5,5)
  });
  it('1C0A: não empurra se a casa da frente tem bit $8000', () => {
    const s = stageArena(6);
    s.floor[cellOf(5, 5)] = 0x1c0a;
    setCell(s, 6, 5, CODE.SOFT);
    const p = put(s, 0, 5, 5);
    p.face = 2;
    stage6.onStand!(s, p, cellOf(5, 5), []);
    expect(p.push.left).toBe(0);
  });
  it('1C08: jogador lento (nível 7, 128/tick) e bomba chutada para antes', () => {
    const s = stageArena(6);
    s.floor[cellOf(3, 1)] = 0x1c08;
    const p = put(s, 0, 3, 1);
    expect(stage6.speedLevel!(s, p, 1)).toBe(7);
    run(s, 1, [BTN.RIGHT, 0, 0, 0, 0]);
    const x0 = p.x;
    run(s, 1, [BTN.RIGHT, 0, 0, 0, 0]);
    expect(p.x - x0).toBe(128);
    expect(stage6.kickedBombEnter!(s, s.bombs[0] as never, cellOf(3, 1))).toBe('stop');
    expect(stage6.kickedBombEnter!(s, s.bombs[0] as never, cellOf(4, 1))).toBe('go');
  });
  it('piso normal 1C06 (floor = 0) não faz nada', () => {
    const s = stageArena(6);
    const p = put(s, 0, 5, 5);
    stage6.onStand!(s, p, cellOf(5, 5), []);
    expect([p.effect.kind, p.push.left]).toEqual([0, 0]);
    expect(stage6.speedLevel!(s, p, 1)).toBe(1);
  });
});

describe('arena 6: IA e fallback', () => {
  it('avoid: caveira 1C0C sempre; listras 1C0A só quando o empurrão pode levar à chama (spec §9 item 8)', () => {
    const s = stageArena(6);
    s.floor[cellOf(5, 5)] = 0x1c0c;
    s.floor[cellOf(6, 5)] = 0x1c0a;
    s.floor[cellOf(7, 5)] = 0x1c08;
    s.floor[cellOf(10, 5)] = 0x1c0a;
    expect([...stage6Ai.avoid!(s, 0)]).toEqual([cellOf(5, 5)]);
    setCell(s, 6, 6, CODE.FLAME);
    expect([...stage6Ai.avoid!(s, 0)].sort((a, b) => a - b)).toEqual([cellOf(5, 5), cellOf(6, 5)]);
  });
  it('kickEnd: para antes do 1C08', () => {
    const s = stageArena(6);
    s.floor[cellOf(8, 1)] = 0x1c08;
    expect(stage6Ai.kickEnd!(s, cellOf(3, 1), 2)).toBe(cellOf(7, 1));
  });
  it('fallback: pinta as casas repintadas', () => {
    const s = stageArena(6);
    s.floor[cellOf(5, 5)] = 0x1c0c;
    const a = fakeCtx();
    fallbackLayers.find(l => l.id === 'stage6')!.draw(s, a.ctx, {} as never, 0);
    expect(a.log).toContain('fillRect');
  });
  it('referência: centro da col 5 = 79 px', () => { expect(px(centerX(5))).toBe(79); });
});
