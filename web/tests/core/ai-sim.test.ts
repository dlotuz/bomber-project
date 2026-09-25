import { simulate, type SimResult } from './simkit';

/**
 * Aceitação da IA por simulação: rodadas só de CPUs (fase 1, 3:00, spawns aleatórios), seeds fixas.
 * Os limiares vêm de medições com essas seeds (ver .superpowers/sdd/2026-09-25-crown-blast-4-cpu-ai/final-fix-report.md);
 * a IA é determinística, então cada número abaixo é exato para estas seeds — a folga é para mudanças futuras.
 */

const seeds = (base: number, n: number) => Array.from({ length: n }, (_, i) => base + i * 7);
const five = (l: number) => [l, l, l, l, l];

/** Bombas por CPU por minuto de rodada (aproximação: conta a rodada inteira para cada CPU). */
function bombRate(rs: SimResult[]): number {
  let bombs = 0, minutes = 0;
  for (const r of rs) {
    bombs += r.bombs.reduce((a, b) => a + b, 0);
    minutes += r.state.players.filter(p => p.active).length * r.frames / 3600;
  }
  return bombs / minutes;
}

const count = (rs: SimResult[], f: (d: SimResult['deaths'][number]) => boolean) =>
  rs.reduce((a, r) => a + r.deaths.filter(f).length, 0);

const normal = seeds(1000, 10).map(seed => simulate({ seed, levels: five(1) }));

describe('simulação só de CPUs', () => {
  it('10 rodadas × 5 CPUs Normal: terminam, quase sempre antes do relógio, e poucas mortes pela própria bomba', () => {
    const deaths = count(normal, () => true);
    const own = count(normal, d => d.cause === 'own');
    const ownOrTrapped = count(normal, d => d.cause === 'own' || d.cause === 'trapped');
    // medido: todas chegam ao resultado; 9/10 decididas antes do relógio zerar (a outra: dois CPUs se esquivando
    // até o fim); 42 mortes, 10 só pela própria bomba, 14 contando as em que o CPU também estava cercado por bomba alheia
    expect(normal.every(r => r.finished)).toBe(true);
    expect(normal.filter(r => !r.timeUp).length).toBeGreaterThanOrEqual(8);
    expect(ownOrTrapped / deaths).toBeLessThanOrEqual(0.35);
    expect(own / deaths).toBeLessThanOrEqual(0.3);
    expect(Math.max(...normal.flatMap(r => r.maxOsc))).toBeLessThanOrEqual(60);   // ninguém travado indo e voltando
  });

  it('5 rodadas com Racer (velocidade 4): CPUs seguem colocando bombas', () => {
    const racer = seeds(2000, 5).map(seed => simulate({ seed, levels: five(1), rules: { racer: true } }));
    // medido: 18,8 bombas/CPU/min com Racer contra 17,4 em velocidade normal
    expect(bombRate(racer)).toBeGreaterThanOrEqual(bombRate(normal) / 2);
    expect(Math.max(...racer.flatMap(r => r.maxOsc))).toBeLessThanOrEqual(60);
  });

  it('times: CPU não mata colega com a própria bomba', () => {
    const team = seeds(3000, 10).map(seed => simulate({ seed, levels: five(1), rules: { mode: 'team' } }));
    // medido: 26 mortes, 1 pela cadeia de uma bomba de colega — um CPU já cercado pela própria bomba e por uma
    // de adversário (ver relatório); nenhuma em que só a bomba do colega o pegaria
    expect(count(team, d => d.cause === 'mate' && !d.doomed)).toBe(0);
    expect(count(team, d => d.cause === 'mate')).toBeLessThanOrEqual(1);
  });

  it('1×1: Forte vence Fraco com folga e não perde para Normal', () => {
    const duel = (a: number, b: number) => seeds(4000, 20).map((seed, i) => {
      const levels = i % 2 ? [b, a, null, null, null] : [a, b, null, null, null];
      const r = simulate({ seed, levels });
      return r.winners.length === 1 ? (levels[r.winners[0]] === a ? 'a' : 'b') : '-';
    });
    const wins = (xs: string[], w: string) => xs.filter(x => x === w).length;
    const sw = duel(2, 0), sn = duel(2, 1);
    // medido: Forte 14 × 1 Fraco (5 empates); Forte 14 × 3 Normal (3 empates)
    expect(wins(sw, 'a')).toBeGreaterThanOrEqual(13);
    expect(wins(sn, 'a')).toBeGreaterThanOrEqual(wins(sn, 'b'));
  });
});
