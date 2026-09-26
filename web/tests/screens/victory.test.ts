import { victoryScreen } from '../../src/screens/victory';
import { createMatchSession, beginRound, endRound, carry, resetCarry } from '../../src/game/match-session';
import { parseConfig } from '../../src/game/config';
import { BTN, matchRngState } from '../../src/game/core-api';
import { forceWin, runUntil, skipIntro } from './core-helpers';
import { mkApp, tap, idle, settle } from './helpers';
import { victoryGeometry } from '../../src/render/screens-rom/victory';
import { loadCapture, capturedMap, mapMatch } from './captures';

beforeEach(() => resetCarry());
function champ(q = '?players=3&humans=1&matches=1') {
  const env = mkApp();
  const ms = createMatchSession(parseConfig(q));
  const r = beginRound(ms); skipIntro(r); forceWin(r, 1); runUntil(r, x => x.phase === 'over'); endRound(ms);
  const v = victoryScreen(env.app, ms, 557); env.app.go(v); env.sink.clear();
  return { ...env, ms, v };
}

describe('VITÓRIA (§6.12)', () => {
  it('descida de 2 px/f por 128 f a partir de S=557', () => {
    const { app, v } = champ();
    idle(app, 1); expect([v.s, v.cameraY()]).toEqual([557, 0]);
    idle(app, 64); expect(v.cameraY()).toBe(128);
    idle(app, 100); expect(v.cameraY()).toBe(256);
  });
  it('"VITÓRIA!" entra pela direita em 693–703; corredores em 723–763; confete em 763; campeão no troféu em 783', () => {
    const { app, v } = champ();
    idle(app, 136); expect([v.s, v.textX()]).toEqual([692, null]);
    idle(app, 1); expect(v.textX()).toBe(256);
    idle(app, 10); const tx = v.textX()!; idle(app, 5); expect(v.textX()).toBe(tx);
    expect(tx).toBeLessThan(128);
    idle(app, 15); expect([v.s, v.runnerX(0)]).toEqual([723, 256]);
    idle(app, 40); expect([v.runnerX(0), v.runnerX(1), v.confetti()]).toEqual([40, 88, true]);
    idle(app, 19); expect(v.championOnTrophy()).toBe(false);
    idle(app, 1); expect(v.championOnTrophy()).toBe(true);
  });
  it('voz $0A em S=795', () => {
    const { app, sink } = champ();
    idle(app, 238); expect(sink.of('voice')).toEqual([]);
    idle(app, 1); expect(sink.of('voice').map(c => c.id)).toEqual([0x0a]);
  });
  it('A, B ou START desde S=557: fade 15, preto 123, fase com a música $12; RNG levado adiante', () => {
    const { app, sink, ms } = champ();
    tap(app, BTN.START);
    const t0 = app.tick;
    expect(carry.seed).toBe(matchRngState(ms.match));
    settle(app);
    expect(app.screen.id).toBe('stage');
    expect(sink.since(t0).filter(c => c.op === 'music').map(c => [c.t, c.id])).toEqual([[138, 0x12]]);
  });
  it('Corrida Bônus ligada (Todos contra Todos): a corrida vem antes da fase', () => {
    const { app } = champ('?players=3&humans=1&matches=1&racer=1');
    tap(app, BTN.A); settle(app);
    expect(app.screen.id).toBe('racer');
  });
  it('espera sem limite', () => {
    const { app } = champ();
    idle(app, 3000);
    expect([app.screen.id, app.inTransition]).toEqual(['victory', false]);
  });
});

// Teste de captura (A14): a geometria do BG2 (checkerboard + moldura de cima) bate a cena `victory` capturada em
// `analise/extraido/graficos-formato/cenas`, fora do texto (aqui, nenhum: "VITÓRIA!" não faz parte do mapa da ROM,
// é OBJ/texto nosso). `victoryGeometry` não depende de `RomAssets` (mapa medido, A14 pendente da T19 para a
// origem exata na ROM — `sceneMaps` prioriza `MAP_SOURCES.victory` quando ela existir).
describe('geometria da cena victory (captura, A14)', () => {
  const cap = loadCapture('victory');
  it.skipIf(!cap)('BG2 bate a captura ≥ 97 % fora do texto', () => {
    const maps = victoryGeometry({} as never);
    expect(mapMatch(maps.bg2!, capturedMap(cap!, 0x4400))).toBeGreaterThanOrEqual(0.97);
  });
});
