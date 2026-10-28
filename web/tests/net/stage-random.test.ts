// Sala online com ALEATÓRIO: o anfitrião deixa a fase em ALEATÓRIO e cada navegador sorteia sozinho, a partir da
// semente da mensagem `start` (a mesma para todos) — então todos jogam a MESMA fase, sem mensagem nova no protocolo.
import { OnlineClient, type Lobby } from '../../src/net/online';
import type { MatchSession } from '../../src/game/match-session';
import { VISIBLE_STAGES } from '../../src/game/stages';
import { RANDOM_STAGE, resolveOnlineStage, seedStagePick } from '../../src/game/stage-choice';
import { mkApp } from '../screens/helpers';

const lobby = (stage: number): Lobby => ({
  stage, mode: 'ffa', teams: [0, 1, 0, 1, 0], slots: ['human', 'human', 'human', 'cpu', 'off'], chars: [0, 1, 2, 3, 4],
  names: ['ANA', 'BETO', 'CAIO', '', ''], rules: { cpuLevel: 1, matches: 3, timeIdx: 2, suddenDeath: false, badBomber: false },
});
const extras = { gloveEscape: 10, throwStun: true, sleepTicks: 180, allMounts: true, randomSpawns: false };

/** Três navegadores recebem o mesmo `start` (cada um com a sua vaga); devolve a fase da partida de cada um. */
function startAll(stage: number, seed: number): number[] {
  return [0, 1, 2].map(you => {
    const { app } = mkApp();
    const c = new OnlineClient(app);
    (c as unknown as { receive(m: object): void }).receive({ t: 'start', lobby: lobby(stage), seed, delay: 3, you, extras });
    expect(app.screen.id).toBe('battle');
    return (app.screen as unknown as { ms: MatchSession }).ms.cfg.stage;
  });
}

afterEach(() => seedStagePick(''));

describe('sala online com ALEATÓRIO', () => {
  it('todos os navegadores jogam a mesma fase sorteada, que é uma das visíveis', () => {
    for (const seed of [0, 1, 0x1234, 0xbeef, 0xffff]) {
      const got = startAll(RANDOM_STAGE, seed);
      expect(new Set(got).size).toBe(1);
      expect(VISIBLE_STAGES).toContain(got[0]);
      expect(got[0]).toBe(resolveOnlineStage(RANDOM_STAGE, seed));
    }
  });
  it('não depende do sorteio local de cada navegador (Math.random ou ?seed diferentes)', () => {
    seedStagePick('', () => 0);
    const a = startAll(RANDOM_STAGE, 777);
    seedStagePick('', () => 0.999);
    const b = startAll(RANDOM_STAGE, 777);
    seedStagePick('?seed=9');
    expect([startAll(RANDOM_STAGE, 777), b]).toEqual([a, a]);
  });
  it('as sementes das partidas cobrem todas as fases visíveis', () => {
    const seen = new Set(Array.from({ length: 512 }, (_, seed) => resolveOnlineStage(RANDOM_STAGE, seed)));
    expect([...seen].sort((x, y) => x - y)).toEqual([...VISIBLE_STAGES].sort((x, y) => x - y));
  });
  it('fase escolhida pelo anfitrião: todos jogam ela, sem sorteio', () => {
    for (const st of VISIBLE_STAGES) expect(startAll(st, 0x4321)).toEqual([st, st, st]);
  });
});
