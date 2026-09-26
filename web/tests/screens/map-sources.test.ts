import { MAP_SOURCES } from '../../src/render/screens-rom/map-sources';
import { decodeSceneMap, readDescriptor, keepPalette, setPriority } from '../../src/render/screens-rom/map-decode';
import { menuBg1Vofs, type MenuScene } from '../../src/render/screens-rom/scene';
import { decodeMapCodes, codesToEntries } from '../../src/rom/decode/tilemap';
import { ASSETS } from './rom';
import { loadCapture, capturedMap, mapMatch, type Rect } from './captures';

/** Áreas de texto original (ignoradas: viram fundo porque o texto é nosso). */
const TEXT: Record<string, Rect[]> = {
  title: [{ x0: 40, y0: 140, x1: 216, y1: 212 }],
  vsmode: [{ x0: 60, y0: 44, x1: 194, y1: 62 }, { x0: 76, y0: 76, x1: 176, y1: 158 }],
  ffa: [{ x0: 60, y0: 60, x1: 194, y1: 78 }, { x0: 80, y0: 90, x1: 200, y1: 142 }],   // título na linha 4 (T5)
  players: [{ x0: 46, y0: 12, x1: 208, y1: 32 }, { x0: 40, y0: 44, x1: 232, y1: 190 }],
  rules: [{ x0: 52, y0: 20, x1: 202, y1: 40 }, { x0: 28, y0: 52, x1: 232, y1: 190 }],
  charsel: [{ x0: 40, y0: 28, x1: 216, y1: 62 }],   // "Select a character!" nas linhas 2–3 do mapa
  stagesel: [{ x0: 60, y0: 0, x1: 196, y1: 28 }, { x0: 40, y0: 146, x1: 216, y1: 200 }],
  scoreboard: [{ x0: 40, y0: 16, x1: 220, y1: 56 }],
  victory: [],
  draw2: [],
};
/** Conteúdo dinâmico que a tela desenha por cima (não é da origem estática): retratos, prévias e coroas. */
const DYNAMIC: Record<string, Rect[]> = {
  charsel: [{ x0: 16, y0: 32, x1: 47, y1: 191 }],
  stagesel: [{ x0: 0, y0: 36, x1: 255, y1: 160 }],
  scoreboard: [{ x0: 80, y0: 64, x1: 239, y1: 223 }],
  victory: [{ x0: 80, y0: 64, x1: 239, y1: 223 }],
};
const MENUS: readonly string[] = ['vsmode', 'ffa', 'players', 'rules'];
/** Nas regras o VOFS do BG1 muda por faixa (HDMA): o texto vai para linhas do mapa pela faixa (como na T5). */
const bg1Rects = (scene: string, rs: Rect[]) => (MENUS.includes(scene)
  ? rs.map(r => ({ ...r, y0: r.y0 + menuBg1Vofs(scene as MenuScene, r.y0), y1: r.y1 + menuBg1Vofs(scene as MenuScene, r.y1) }))
  : rs);

describe('origens de mapa (A14)', () => {
  it('só cenas conhecidas', () => {
    for (const k of Object.keys(MAP_SOURCES)) expect(Object.keys(TEXT)).toContain(k);
  });
  it('keepPalette esvazia as casas de outra paleta; setPriority liga o bit 13 só no bloco', () => {
    const m = new Uint16Array(1024);
    m[0] = 0x1404; m[1] = 0x1c40; m[2] = 0x0008; m[3] = 0x5404;
    expect(Array.from(keepPalette(m, 5).slice(0, 4))).toEqual([0x1404, 0, 0, 0x5404]);
    const p = setPriority(m, 0, 0, 32, 16);
    expect(p[0]).toBe(0x3404);
    expect(p[15 * 32 + 31]).toBe(0x2000);
    expect(p[16 * 32]).toBe(0);
    expect(m[0]).toBe(0x1404);
  });
  describe.skipIf(!ASSETS)('com ROM', () => {
    it('descritores apontam para os scripts gráficos do GFX §3', () => {
      const rom = ASSETS!.rom;
      expect(readDescriptor(rom, 0xc1c00e).script).toBe(0xc1c182);
      expect(readDescriptor(rom, 0xc1c044).script).toBe(0xc1c1b2);
      expect(readDescriptor(rom, 0xc1c0d4).script).toBe(0xc1c1e2);
      expect(readDescriptor(rom, 0xc29c17).script).toBe(0xc29c35);
    });
    it('decodeSceneMap = decodeMapCodes + codesToEntries do plano 5', () => {
      const rom = ASSETS!.rom;
      for (const d of [0xc1c00e, 0xc1c044, 0xc1c0d4, 0xc1c0ef, 0xc29c17]) {
        for (const [stream, table] of [readDescriptor(rom, d).bg1, readDescriptor(rom, d).bg2]) {
          expect(decodeSceneMap(rom, stream, table)).toEqual(codesToEntries(rom, decodeMapCodes(rom, stream).codes, table));
        }
      }
    });
    it('nenhum mapa dos menus traz texto original (só a paleta 5 da corda)', () => {
      for (const s of ['vsmode', 'ffa', 'players', 'rules', 'charsel'] as const) {
        const bg1 = MAP_SOURCES[s]!(ASSETS!).bg1!;
        expect(bg1.every(w => w === 0 || ((w >> 10) & 7) === 5), s).toBe(true);
      }
    });
  });
  describe.skipIf(!ASSETS)('com ROM e capturas', () => {
    it.each(Object.keys(TEXT))('%s: mapa da ROM = captura fora do texto (≥ 99 %)', scene => {
      const src = MAP_SOURCES[scene as keyof typeof MAP_SOURCES];
      const cap = loadCapture(scene);
      if (!src || !cap) return;
      const maps = src(ASSETS!);
      const dyn = DYNAMIC[scene] ?? [];
      for (const [layer, addr] of [['bg1', 0x4000], ['bg2', 0x4400]] as const) {
        const ign = [...(layer === 'bg1' ? bg1Rects(scene, TEXT[scene]) : TEXT[scene]), ...dyn];
        if (maps[layer]) expect(mapMatch(maps[layer]!, capturedMap(cap, addr), ign), `${scene} ${layer}`).toBeGreaterThanOrEqual(0.99);
      }
    });
  });
});
