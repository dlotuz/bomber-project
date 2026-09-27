import { drawScreen } from '../../src/screens/draw';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildDrawTexture, m7Pixel, CHAR_X, CHAR_Y, CYCLE_RGB, bigDrawReady, empateFrame, renderEmpate, stageOnlyBg2, stageVisible,
  DRAW2_BG2_EMPTY, DRAW2_BG2_SCROLL, DRAW2_STAGE_PAL,
} from '../../src/render/screens-rom/draw';
import { DRAW_SCENE } from '../../src/game/timeline';
import { sceneMaps } from '../../src/render/screens-rom/scene';
import { buildRomFont, layoutText } from '../../src/render/text/text';
import { S } from '../../src/render/text/strings';
import { createMatchSession, resetCarry } from '../../src/game/match-session';
import { parseConfig } from '../../src/game/config';
import { BTN, crownsOf } from '../../src/game/core-api';
import { idleInput } from '../../src/input/input';
import { mkApp, tap, idle } from './helpers';
import { ASSETS } from './rom';
import { CAPTURES, loadCapture, parseOam, capturedMap, mapMatch } from './captures';

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
  it.skipIf(!ASSETS)('MAP_SOURCES.draw2 (T19) = BG2 capturado em $5C00, palavra a palavra, nas 14 linhas visíveis', () => {
    const maps = sceneMaps(ASSETS!, 'draw2', () => ({}));
    expect(maps.bg2).toBeDefined();
    expect(mapMatch(maps.bg2!, capturedMap(cap2!, 0x5c00))).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Palco do EMPATE (revisão final I3): sem o "DRAW GAME" em inglês do BG2, 14 px acima e só depois do crescimento.

const WRAM2 = CAPTURES && existsSync(join(CAPTURES, 'draw2.wram')) ? new Uint8Array(readFileSync(join(CAPTURES, 'draw2.wram'))) : null;
const INPUT5 = { chars: [0, 1, 2, 3, 4], active: [true, true, true, true, true] };
const pal = (w: number) => (w >> 10) & 7;

describe('palco do EMPATE (BG2 de draw2)', () => {
  it('stageOnlyBg2: toda casa fora da paleta 3 vira a casa vazia $0084', () => {
    const m = Uint16Array.from([0x0060, 0x0406, 0x0948, 0x0d6e, 0x4d64, DRAW2_BG2_EMPTY, 0x04ec]);
    expect([...stageOnlyBg2(m)]).toEqual([0x84, 0x84, 0x84, 0x0d6e, 0x4d64, 0x84, 0x84]);
  });
  it('o palco só aparece a partir de growTo (S=148); antes, só fundo e OBJ', () => {
    expect([stageVisible(0), stageVisible(DRAW_SCENE.growTo - 1), stageVisible(DRAW_SCENE.growTo), stageVisible(5000)])
      .toEqual([false, false, true, true]);
  });

  describe.skipIf(!ASSETS)('com ROM', () => {
    it('antes de growTo o quadro não tem BG2 (só OBJ); de growTo em diante tem, com o scroll [0, 14]', () => {
      for (const s of [0, 60, DRAW_SCENE.growFrom, DRAW_SCENE.growTo - 1]) {
        const f = empateFrame(ASSETS!, INPUT5, s);
        expect([f.bg2, f.bands[0].main], `S=${s}`).toEqual([undefined, 16]);
      }
      for (const s of [DRAW_SCENE.growTo, 200, 5000]) {
        const f = empateFrame(ASSETS!, INPUT5, s);
        expect([f.bg2?.hofs, f.bg2?.vofs, f.bands[0].main & 2], `S=${s}`).toEqual([0, 14, 2]);
      }
      expect(DRAW2_BG2_SCROLL).toEqual([0, 14]);
    });
    it('o mapa montado não tem nenhuma casa das letras em inglês: só $0084 e o palco (paleta 3); linhas 0–8 vazias', () => {
      const bg2 = empateFrame(ASSETS!, INPUT5, DRAW_SCENE.growTo).bg2!.map;
      expect(bg2.every(w => w === DRAW2_BG2_EMPTY || pal(w) === DRAW2_STAGE_PAL)).toBe(true);
      expect(bg2.slice(0, 9 * 32).every(w => w === DRAW2_BG2_EMPTY)).toBe(true);
      // Tiles do pé do "A" amarelo de "GAME" (os únicos das letras que existem na VRAM remontada) e do pé do "E".
      const tiles = new Set(Array.from(bg2, w => w & 0x3ff));
      for (const t of [0x148, 0x14a, 0x16c, 0x0ec, 0x0ee]) expect(tiles.has(t), t.toString(16)).toBe(false);
      // Mesmo assim o palco fica inteiro: as 6 linhas do disco e dos feixes (9–14) seguem com casas não vazias.
      for (let lin = 9; lin <= 14; lin++) expect(bg2.slice(lin * 32, lin * 32 + 16).some(w => pal(w) === DRAW2_STAGE_PAL), `lin ${lin}`).toBe(true);
    });
    it('pixels: antes de growTo o lugar do disco é só o fundo; depois, é o disco', () => {
      const img = { width: 256, height: 224, data: new Uint8ClampedArray(256 * 224 * 4) } as ImageData;
      const at = (x: number, y: number) => Array.from(img.data.slice((y * 256 + x) * 4, (y * 256 + x) * 4 + 3));
      renderEmpate(img, ASSETS!, INPUT5, { scale: 0.9, color: 0 }, DRAW_SCENE.growTo - 1);
      const back = at(2, 220);
      expect(at(128, 205)).toEqual(back);   // miolo do disco, entre os pés dos bomberitas
      renderEmpate(img, ASSETS!, INPUT5, { scale: 1, color: 0 }, DRAW_SCENE.growTo);
      expect(at(128, 205)).not.toEqual(back);
      expect(at(2, 220)).toEqual(back);
    });
  });

  describe.skipIf(!WRAM2 || !cap2)('VOFS conferido na captura (draw2.wram)', () => {
    it('$48 (o que o NMI $C3:4CC5 grava em $2110) = $017E + 7 + $018E = 14; HOFS $017C + 8 + $018C = 0', () => {
      const w = WRAM2!, r16 = (a: number) => (w[a] | (w[a + 1] << 8)) << 16 >> 16;
      expect(r16(0x48)).toBe(DRAW2_BG2_SCROLL[1]);
      expect(r16(0x17e) + 7 + r16(0x18e)).toBe(DRAW2_BG2_SCROLL[1]);
      expect(r16(0x17c) + 8 + r16(0x18c)).toBe(DRAW2_BG2_SCROLL[0]);
    });
    it('com o VOFS 14 as casas do palco (paleta 3) batem 100 % com as da captura nas linhas visíveis', () => {
      const ours = empateFrame(ASSETS!, INPUT5, DRAW_SCENE.growTo).bg2!.map, cap = capturedMap(cap2!, 0x5c00);
      for (let i = 0; i < 16 * 32; i++) {
        const c = cap[i];
        expect(ours[i], `casa ${i}`).toBe(pal(c) === DRAW2_STAGE_PAL ? c : DRAW2_BG2_EMPTY);
      }
    });
  });
});
