import { victoryScreen } from '../../src/screens/victory';
import { createMatchSession, beginRound, endRound, carry, resetCarry } from '../../src/game/match-session';
import { parseConfig } from '../../src/game/config';
import { BTN, matchRngState } from '../../src/game/core-api';
import { forceWin, runUntil, skipIntro } from './core-helpers';
import { mkApp, tap, idle, settle } from './helpers';
import { championDrawOrder, victoryGeometry, victoryMaps } from '../../src/render/screens-rom/victory';
import { loadCapture, capturedMap, mapMatch, type Rect } from './captures';
import { ASSETS } from './rom';
import type { SpriteBank } from '../../src/render/sprite-bank';

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

// Fix round 1: em Em Equipes, todos os campeões do time ficam sobre o troféu com `champions[0]` por cima —
// quem desenha por último fica na frente, então a ordem de desenho tem de ser a inversa de `ms.champions`.
describe('campeões sobre o troféu em Em Equipes (fix round 1)', () => {
  it('championDrawOrder inverte (o [0] desenha por último = por cima)', () => {
    expect(championDrawOrder([3, 1])).toEqual([1, 3]);
    expect(championDrawOrder([2, 0, 4])).toEqual([4, 0, 2]);
  });

  it('draw(): com 2+ campeões, o slot de champions[0] é desenhado por último (fica por cima)', () => {
    const env = mkApp();
    const ms = createMatchSession(parseConfig('?players=4&humans=1&matches=1&mode=team'));
    ms.champions = [3, 1];   // champions[0] = slot 3: tem de ficar por cima (desenhado por último)
    const v = victoryScreen(env.app, ms, 557);
    env.app.go(v);
    idle(env.app, 227);   // s = 557 + 226 = 783 = VICTORY.jumpAt: campeões já subiram no troféu
    expect(v.championOnTrophy()).toBe(true);

    const calls: string[] = [];
    const known: Record<string, unknown> = {
      bomber: (ch: number) => { const tag = `b${ch}`; return { width: 32, height: 40, tag }; },
      text: () => ({ width: 0, height: 0, tag: 't' }),
      trophy: () => ({ width: 48, height: 48, tag: 'trophy' }),
    };
    // o placar (T13) usa outros métodos do banco (cabeças, coroas…): qualquer outro devolve uma imagem neutra
    const bank = new Proxy(known, {
      get: (t, k: string) => t[k] ?? (() => ({ width: 16, height: 16, tag: `other:${k}` })),
    }) as unknown as SpriteBank;
    const ctx = {
      fillStyle: '', save() {}, restore() {}, translate() {}, fillRect() {},
      drawImage(img: { tag?: string }) { if (img?.tag) calls.push(img.tag); },
    } as unknown as CanvasRenderingContext2D;
    env.app.screen.draw(ctx, bank, 0);

    const char3 = ms.cfg.chars[3], char1 = ms.cfg.chars[1];
    const idx3 = calls.lastIndexOf(`b${char3}`), idx1 = calls.lastIndexOf(`b${char1}`);
    expect(idx3).toBeGreaterThan(-1); expect(idx1).toBeGreaterThan(-1);
    expect(idx3).toBeGreaterThan(idx1);
  });
});

describe('geometria da cena victory (captura, A14)', () => {
  const cap = loadCapture('victory');

  // `victoryGeometry` é a geometria própria (medida na captura), usada só quando `MAP_SOURCES.victory` não
  // existir (T19). "VITÓRIA!" não faz parte do mapa da ROM (é o nosso texto, por cima) — sem casas para ignorar.
  it.skipIf(!cap)('victoryGeometry (reserva): BG2 bate a captura ≥ 97 % fora do texto', () => {
    const maps = victoryGeometry({} as never);
    expect(mapMatch(maps.bg2!, capturedMap(cap!, 0x4400))).toBeGreaterThanOrEqual(0.97);
  });

  // Com a T19 mesclada, `victoryMaps` (usada de fato pela tela) resolve pelo descritor real da ROM
  // ($C2:9C17). O miolo do xadrez (colunas 3–14, linhas 4–13) tem uma animação de cor/tile periódica
  // [§7.1] que a captura mostra num instante e o descritor decodifica no estado-base — por isso ele fica de
  // fora da comparação; a moldura de cima e as bordas batem 100 %.
  describe.skipIf(!ASSETS)('victoryMaps (de verdade, com a ROM)', () => {
    const CHECKERBOARD_INTERIOR: Rect = { x0: 48, y0: 64, x1: 239, y1: 223 };
    it.skipIf(!cap)('BG2 bate a captura ≥ 97 % fora do miolo animado', () => {
      const maps = victoryMaps(ASSETS!);
      expect(mapMatch(maps.bg2!, capturedMap(cap!, 0x4400), [CHECKERBOARD_INTERIOR])).toBeGreaterThanOrEqual(0.97);
    });
    it('não sobra nenhuma casa do logotipo "VICTORY!" original no BG1 (paleta 6, T18/T19)', () => {
      const maps = victoryMaps(ASSETS!);
      const withEnglishTitle = maps.bg1 ? Array.from(maps.bg1).some(w => w !== 0 && ((w >> 10) & 7) === 6) : false;
      expect(withEnglishTitle).toBe(false);
    });
  });
});
