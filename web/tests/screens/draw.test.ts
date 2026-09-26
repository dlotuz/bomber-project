import { drawScreen } from '../../src/screens/draw';
import { buildDrawTexture, m7Pixel, CHAR_X, CHAR_Y, CYCLE_RGB, bigDrawReady } from '../../src/render/screens-rom/draw';
import { sceneMaps } from '../../src/render/screens-rom/scene';
import { buildRomFont, layoutText } from '../../src/render/text/text';
import { S } from '../../src/render/text/strings';
import { createMatchSession, resetCarry } from '../../src/game/match-session';
import { parseConfig } from '../../src/game/config';
import { BTN, crownsOf } from '../../src/game/core-api';
import { idleInput } from '../../src/input/input';
import { mkApp, tap, idle } from './helpers';
import { ASSETS } from './rom';
import { loadCapture, parseOam, capturedMap, mapMatch } from './captures';

beforeEach(() => resetCarry());
function drawEnv() {
  const env = mkApp();
  const ms = createMatchSession(parseConfig('?players=5&humans=1'));
  const d = drawScreen(env.app, ms); env.app.go(d); env.sink.clear();
  return { ...env, ms, d };
}

describe('EMPATE (§6.11, R21)', () => {
  it('voz $0E em S=100 e nenhuma coroa', () => {
    const { app, sink, ms } = drawEnv();
    idle(app, 100); expect(sink.of('voice')).toEqual([]);
    idle(app, 1); expect(sink.of('voice').map(c => c.id)).toEqual([0x0e]);
    expect(crownsOf(ms.match)).toEqual([0, 0, 0, 0, 0]);
  });
  it('letras: escala 0 até S=34, linear até 1 em S=148; depois trocam de cor a cada 8 f', () => {
    const { app, d } = drawEnv();
    idle(app, 35); expect(d.letters()).toEqual({ scale: 0, color: 0 });
    idle(app, 57); expect(d.letters().scale).toBe(0.5);
    idle(app, 57); expect(d.letters()).toEqual({ scale: 1, color: 0 });
    idle(app, 8); expect(d.letters().color).toBe(1);
    idle(app, 8); expect(d.letters().color).toBe(2);
  });
  it('só A ou B pulam, a partir de S=18; START não', () => {
    const { app } = drawEnv();
    idle(app, 17); tap(app, BTN.A); expect(app.inTransition).toBe(false);
    tap(app, BTN.START); expect(app.inTransition).toBe(false);
    tap(app, BTN.B); expect(app.inTransition).toBe(true);
  });
  it('pular: próxima rodada depois de 15 + 385, com $2F +31 e $14 +43', () => {
    const { app, sink } = drawEnv();
    idle(app, 20); tap(app, BTN.A);
    const t0 = app.tick;
    while (app.screen.id !== 'battle') app.update(idleInput());
    expect(app.tick - t0).toBe(400);
    expect(sink.since(t0).map(c => [c.t, c.op, c.id])).toEqual([[31, 'bank', 0x2f], [43, 'music', 0x14]]);
  });
  it('sem botão espera sem limite', () => {
    const { app } = drawEnv();
    idle(app, 5000);
    expect([app.screen.id, app.inTransition]).toEqual(['draw', false]);
  });
});

describe('textura Modo 7 do EMPATE (pura)', () => {
  it('centraliza no plano 1024×1024; tile 0 vazio; tiles iguais reaproveitados', () => {
    const tex = buildDrawTexture({ w: 20, h: 10, px: new Uint8Array(200).fill(5) });
    expect([tex.map.length, tex.chr.length]).toEqual([128 * 128, 256 * 64]);
    expect([m7Pixel(tex, 502, 507), m7Pixel(tex, 521, 516)]).toEqual([5, 5]);
    expect([m7Pixel(tex, 501, 507), m7Pixel(tex, 502, 517), m7Pixel(tex, 0, 0)]).toEqual([0, 0, 0]);
    expect(new Set(tex.map).size).toBeLessThanOrEqual(7);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Com ROM (skipIf sem ela): a fonte bigDraw (T18, roda em paralelo) e a textura de "EMPATE".

describe('bigDraw × textura do EMPATE (com ROM)', () => {
  it.skipIf(!ASSETS)('bigDrawReady reflete se o mapa tem E, M, A, P e T', () => {
    const a = ASSETS!;
    const f = buildRomFont('bigDraw', a);
    const expected = !!f && ['E', 'M', 'A', 'P', 'T'].every(ch => f.glyphs.has(ch));
    expect(bigDrawReady(a)).toBe(expected);
  });
  // Só roda de verdade quando a T18 (roda em paralelo) publicar o mapa `bigDraw`; até lá, fica pulado (documentado
  // no relatório) em vez de falhar por uma dependência que esta tarefa não possui.
  it.skipIf(!ASSETS || !bigDrawReady(ASSETS!))('com a fonte pronta, a textura de "EMPATE" tem pixel não nulo no centro do plano', () => {
    const a = ASSETS!;
    const f = buildRomFont('bigDraw', a)!;
    for (const ch of ['E', 'M', 'A', 'P', 'T']) expect(f.glyphs.has(ch)).toBe(true);
    const tex = buildDrawTexture(layoutText(f, S.draw.title));
    expect(m7Pixel(tex, 512, 512) !== 0 || m7Pixel(tex, 508, 508) !== 0 || m7Pixel(tex, 516, 512) !== 0).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Capturas (skipIf sem elas, spec §7.5): posições reais dos 5 bomberitas e os índices vermelho/amarelo/verde da CGRAM.

const cap1 = loadCapture('draw1'), cap2 = loadCapture('draw2');

describe.skipIf(!cap1 || !cap2)('posições e cores reais (draw1.oam/draw2.oam, draw2.cgram)', () => {
  it('os 5 OBJ 32×32 ficam lado a lado sobre o disco em CHAR_X/CHAR_Y, iguais nas duas capturas', () => {
    for (const cap of [cap1!, cap2!]) {
      const big = parseOam(cap.oam).filter(r => r.big);
      expect(big.map(r => r.x)).toEqual([...CHAR_X]);
      expect(big.every(r => r.y === CHAR_Y)).toBe(true);
    }
  });
  it('CYCLE_RGB é o vermelho/amarelo/verde mais saturado das rampas da CGRAM de draw2 (índices 27/44/12)', () => {
    const cg = cap2!.cgram;
    const rgb = (c: number): [number, number, number] => { const f = (v: number) => (v << 3) | (v >> 2); return [f(c & 31), f((c >> 5) & 31), f((c >> 10) & 31)]; };
    expect([rgb(cg[27]), rgb(cg[44]), rgb(cg[12])]).toEqual(CYCLE_RGB);
  });
  it.skipIf(!ASSETS)('MAP_SOURCES.draw2 (T19) bate ≥ 97 % com o BG2 capturado em $5C00 (palavra)', () => {
    const maps = sceneMaps(ASSETS!, 'draw2', () => ({}));
    expect(maps.bg2).toBeDefined();
    expect(mapMatch(maps.bg2!, capturedMap(cap2!, 0x5c00))).toBeGreaterThanOrEqual(0.97);
  });
});
