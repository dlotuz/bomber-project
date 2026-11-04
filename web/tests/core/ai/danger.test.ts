import { arena, put, setCell, C, run } from '../kit';
import { blockedUntil, dangerMap, hazards, SAFE, kickPath, pressureCells } from '../../../src/core/ai/danger';
import { addBomb, burnCell } from '../../../src/core/bombs';
import { punchBomb } from '../../../src/core/flyers';
import { step } from '../../../src/core/step';
import { BURN_TICKS } from '../../../src/core/constants';
import { BURN, CODE, type RoundState } from '../../../src/core/types';
import { CELLS } from '../../../src/core/units';

describe('mapa de perigo (offsets a partir do próximo tick)', () => {
  it('bomba no ar que cai num bloco de pressão some ($C1:27D7): não é perigo; em piso, é', () => {
    for (const code of [CODE.PRESSURE, CODE.FLOOR]) {
      const s = arena(); const p = put(s, 0, 4, 1); p.punch = true; p.face = 2;
      addBomb(s, 0, C(5, 1)); setCell(s, 8, 1, code);
      punchBomb(s, p, []);
      const d = dangerMap(s, 1);
      if (code === CODE.FLOOR) expect(d[C(8, 1)]).toBeLessThan(SAFE);
      else expect([d[C(8, 1)], d[C(9, 1)], d[C(10, 1)]]).toEqual([SAFE, SAFE, SAFE]);   // nada de quique por cima
    }
  });
  it('bomba recém-colocada: cruz letal a partir do offset 128; resto seguro', () => {
    const s = arena(); addBomb(s, 0, C(6, 1));
    const d = dangerMap(s);
    for (const c of [C(6, 1), C(5, 1), C(4, 1), C(7, 1), C(8, 1), C(6, 2), C(6, 3)]) expect(d[c]).toBe(128);
    expect([d[C(9, 1)], d[C(6, 4)], d[C(10, 5)]]).toEqual([SAFE, SAFE, SAFE]);
  });
  it('pilar e soft param a cruz como no núcleo', () => {
    const s = arena(); addBomb(s, 0, C(5, 1), { fire: 3 }); setCell(s, 7, 1, CODE.SOFT);
    const d = dangerMap(s);
    expect([d[C(5, 2)], d[C(7, 1)], d[C(8, 1)]]).toEqual([SAFE, 128, SAFE]);
  });
  it('cadeia: +2 por elo', () => {
    const s = arena();
    addBomb(s, 0, C(4, 1), { fuse: 10 });
    addBomb(s, 1, C(6, 1), { fuse: 100 });
    const d = dangerMap(s);
    expect([d[C(4, 1)], d[C(6, 1)], d[C(8, 1)]]).toEqual([12, 14, 14]);
  });
  /** Confere o mapa contra o núcleo: o offset em que cada casa vira chama pela 1ª vez (+1) é o previsto; as SAFE não
   *  acendem nos próximos `n` passos. */
  const sameAsCore = (s: RoundState, n = 160) => {
    const d = dangerMap(s), first = new Int32Array(CELLS).fill(SAFE);
    const sim = structuredClone(s);
    for (let k = 1; k <= n; k++) {
      expect(sim.phase).toBe('play');
      step(sim, [0, 0, 0, 0, 0]);
      for (let c = 0; c < CELLS; c++) if (sim.grid[c] === CODE.FLAME && first[c] === SAFE && s.grid[c] !== CODE.FLAME) first[c] = k + 1;
    }
    for (let c = 0; c < CELLS; c++) if (s.grid[c] !== CODE.FLAME) expect([c, d[c]]).toEqual([c, first[c]]);
    return d;
  };
  it('cruzamento ($C1:40B2): o braço da 2ª da cadeia para no centro da 1ª — além dele não é perigo', () => {
    const s = arena(); for (const p of s.players) p.inv = 9999;
    addBomb(s, 0, C(8, 5), { fuse: 10, fire: 0 });              // alcance 2
    addBomb(s, 1, C(10, 5), { fuse: 100, fire: 4 });            // alcance 6: o braço esquerdo iria até a col 4
    const d = sameAsCore(s);
    expect([d[C(4, 5)], d[C(5, 5)], d[C(6, 5)], d[C(9, 5)], d[C(14, 5)]]).toEqual([SAFE, SAFE, 12, 12, 14]);
  });
  it('cruzamento: bomba que explode dentro de um braço aceso não passa da casa seguinte na mesma direção', () => {
    const s = arena(); for (const p of s.players) p.inv = 9999;
    addBomb(s, 0, C(6, 5), { fuse: 0, fire: 3 }).born = 0;        // alcance 5: 7..11 acesos no tick 101
    run(s, 4);
    addBomb(s, 1, C(8, 5), { fuse: 3, fire: 6 }).born = 0;        // alcance 8, explode com o braço de A aceso
    const d = sameAsCore(s), end = hazards(s).end;
    expect([d[C(12, 5)], d[C(13, 5)], d[C(8, 1)], d[C(8, 11)]]).toEqual([SAFE, SAFE, 5, 5]);
    // 9..11 continuam de A (apagam com ela); 7 vira de B (o esquerdo passa por cima do braço direito de A)
    expect([end[C(9, 5)], end[C(11, 5)], end[C(7, 5)], end[C(6, 5)]]).toEqual([23, 23, 30, 23]);
  });
  it('bomba que já terá explodido e apagado não segura o braço de uma posterior', () => {
    const s = arena(); for (const p of s.players) p.inv = 9999;
    addBomb(s, 0, C(6, 5), { fuse: 10, fire: 0 });              // explode no offset 11, apaga no 36
    addBomb(s, 1, C(3, 5), { fuse: 60, fire: 4 });              // alcance 6 (4..9): passa pela casa 6 já apagada
    const d = sameAsCore(s);
    expect([d[C(7, 5)], d[C(9, 5)], d[C(10, 5)]]).toEqual([12, 62, SAFE]);
  });
  it('cruzamento perpendicular e de frente passam: o perigo segue até o alcance', () => {
    const s = arena(); for (const p of s.players) p.inv = 9999;
    addBomb(s, 0, C(6, 3), { fuse: 4, fire: 2 });
    addBomb(s, 1, C(4, 5), { fuse: 8, fire: 2 });
    addBomb(s, 0, C(12, 5), { fuse: 6, fire: 1 });
    sameAsCore(s);
  });
  it('chama atual é letal já no próximo tick', () => {
    const s = arena(); setCell(s, 6, 1, CODE.FLAME); s.cellT0[C(6, 1)] = 100;
    expect(dangerMap(s)[C(6, 1)]).toBe(1);
  });
  it('remota de adversário é perigo permanente; a própria não', () => {
    const s = arena(); addBomb(s, 1, C(6, 1), { type: 1 });
    expect(dangerMap(s, 0)[C(6, 1)]).toBe(1);
    expect(dangerMap(s, 1)[C(6, 1)]).toBe(SAFE);
  });
  it('remota de dono que não está de pé: não é perigo permanente (só bloqueia); explode por cadeia', () => {
    const s = arena({ players: 3 }); addBomb(s, 1, C(6, 1), { type: 1 });
    s.players[1].state = 'out';
    const d = dangerMap(s, 0);
    expect([d[C(6, 1)], d[C(7, 1)], d[C(6, 2)]]).toEqual([SAFE, SAFE, SAFE]);
    expect(s.grid[C(6, 1)]).toBe(CODE.BOMB);                   // a casa continua bloqueada (bomba na grade)
    addBomb(s, 2, C(4, 1), { fuse: 10 });                     // cadeia: a órfã explode 2 ticks depois da que a alcança
    expect(dangerMap(s, 0)[C(8, 1)]).toBe(14);
  });
  it('blockedUntil: queima de T0 vira piso no tick T0+24; o 1º passo que pode entrar é o do tick T0+25 (offset +1)', () => {
    const s = arena(); burnCell(s, C(6, 1), BURN.SOFT);         // T0 = 100
    const bu = blockedUntil(s)[C(6, 1)];
    expect(bu).toBe(BURN_TICKS + 1);
    let k = 0;
    while (s.grid[C(6, 1)] === CODE.BURNING) { step(s, [0, 0, 0, 0, 0]); k++; }
    expect([k, s.tick]).toEqual([BURN_TICKS, 100 + BURN_TICKS]);   // limpa no passo de objetos, depois dos jogadores
    expect(bu).toBe(k + 1);
  });
  it('bomba chutada que não para a tempo explode no meio do caminho, com a trilha marcada', () => {
    const s = arena(); put(s, 1, 8, 5);
    const b = addBomb(s, 0, C(5, 1), { fuse: 20 });
    s.grid[C(5, 1)] = CODE.FLOOR; b.state = 'kicked'; b.dir = 2; b.step = 0;
    const k = kickPath(s, b);
    expect([k.cell, k.t]).toEqual([C(7, 1), 21]);
    expect(k.trail).toEqual([C(5, 1), C(6, 1), C(7, 1)]);
    const d = dangerMap(s);
    expect([d[C(6, 1)], d[C(9, 1)]]).toEqual([22, 22]);
  });
  it('pressão: cronograma exato mesmo antes do gatilho (pelo relógio)', () => {
    const s = arena(); s.clock = { sec: 62, sub: 10 };
    const pc = pressureCells(s);
    expect(pc.get(C(2, 1))).toBe(10 + 205 + 38);
    expect(pc.get(C(3, 1))).toBe(10 + 219 + 38);
    // bloco a 253 ticks: além do horizonte, ainda não é perigo (senão todos correm para o centro em 1:00)
    expect(dangerMap(s)[C(2, 1)]).toBe(SAFE);
    s.tick = 1000; s.pressure.trigger = s.tick - 150;        // 150 ticks depois do gatilho: pousa em 93, dentro
    expect([pressureCells(s).get(C(2, 1)), dangerMap(s)[C(2, 1)], dangerMap(s)[C(8, 6)]]).toEqual([93, 94, SAFE]);
  });
});
