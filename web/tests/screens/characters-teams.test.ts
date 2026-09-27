import { charactersScreen } from '../../src/screens/characters';
import { teamsScreen } from '../../src/screens/teams';
import { BTN } from '../../src/game/core-api';
import type { RomAssets } from '../../src/app/rom-api';
import type { SpriteBank } from '../../src/render/sprite-bank';
import { PLAYER_COLORS } from '../../src/render/draw-game';
import { sceneMaps } from '../../src/render/screens-rom/scene';
import { MAP_SOURCES } from '../../src/render/screens-rom/map-sources';
import {
  CHARSEL_GRID, CHARSEL_GRID_PX, CHARSEL_ICON_PX, CHARSEL_TITLE_PX, CHARSEL_SCROLL, CHARSEL_BG1_SHIFT, CHARSEL_STANDEE, CHARSEL_STANDEE_Y,
  charselMaps, charselFrame, charselPortraitWords,
} from '../../src/render/screens-rom/charsel';
import { obj } from '../../src/render/screens-rom/scene';
import { createImage, renderPpu } from '../../src/render/ppu';
import { idleInput, type MenuInput } from '../../src/input/input';
import { loadCapturePng, pixelMatch } from './capture-png';
import { mkApp, press, hold, settle, inputOf } from './helpers';
import { ASSETS } from './rom';
import { loadCapture, capturedMap, mapMatch, parseOam, type Rect } from './captures';

/** Bank falso (sem DOM): só precisa devolver algo com `width`/`height` para os `drawImage` não quebrarem. */
const fakeBank = {
  head: () => ({ width: 32, height: 32 }),
  bomber: () => ({ width: 32, height: 40 }),
  text: () => ({ width: 40, height: 12 }),
} as unknown as SpriteBank;
/** Contexto falso: grava `fillRect` (estilo:x,y,w,h) e a posição de cada `drawImage`. */
function recCtx() {
  const fills: string[] = [];
  const images: { x: number; y: number }[] = [];
  const ctx = {
    fillStyle: '',
    fillRect(x: number, y: number, w: number, h: number) { fills.push(`${this.fillStyle}:${x},${y},${w},${h}`); },
    drawImage(_img: unknown, x: number, y: number) { images.push({ x, y }); },
  };
  return { fills, images, ctx: ctx as unknown as CanvasRenderingContext2D };
}

describe('cena "charsel" (ROM, brief T10): personagens e equipes reaproveitam a mesma moldura', () => {
  const cap = loadCapture('charsel');
  it.skipIf(!cap)('charselMaps (nosso, sem MAP_SOURCES) bate ≥ 97% com a captura fora do título e da grade', () => {
    // `charselMaps` é o que `sceneMaps(a, 'charsel', charselMaps)` (T5) monta quando `MAP_SOURCES.charsel`
    // não existe — inclui a coluna de retratos dos personagens padrão 0..4 (os da captura). A origem real da ROM
    // (T19) abaixo não tem essa coluna (é conteúdo dinâmico, que `charselFrame` acrescenta), por isso a ignora.
    const built = charselMaps({} as RomAssets);
    const ignore: Rect[] = [CHARSEL_TITLE_PX, CHARSEL_GRID_PX];
    for (const [layer, addr] of [['bg1', 0x4000], ['bg2', 0x4400]] as const) {
      const ours = built[layer];
      expect(ours, layer).toBeDefined();
      expect(mapMatch(ours!, capturedMap(cap!, addr), ignore), layer).toBeGreaterThanOrEqual(0.97);
    }
  });
  it.skipIf(!cap || !ASSETS)('com ROM: sceneMaps devolve a origem real da T19 (MAP_SOURCES.charsel) e ainda bate ≥ 97%', () => {
    // `screens/characters.ts`/`teams.ts` chamam `sceneMaps(a, 'charsel', charselMaps)`: com a T19 mesclada,
    // `MAP_SOURCES.charsel` existe e vence — `charselMaps` fica de reserva (usado só no teste acima).
    expect(MAP_SOURCES.charsel).toBeDefined();
    const built = sceneMaps(ASSETS!, 'charsel', charselMaps);
    const ignore: Rect[] = [CHARSEL_TITLE_PX, CHARSEL_GRID_PX, CHARSEL_ICON_PX];
    for (const [layer, addr] of [['bg1', 0x4000], ['bg2', 0x4400]] as const) {
      const ours = built[layer];
      expect(ours, layer).toBeDefined();
      expect(mapMatch(ours!, capturedMap(cap!, addr), ignore), layer).toBeGreaterThanOrEqual(0.97);
    }
  });
});

describe.skipIf(!ASSETS || !loadCapturePng('charsel'))('quadro da charsel × charsel.png (I6, I8)', () => {
  const png = loadCapturePng('charsel')!;
  const standees = () => CHARSEL_STANDEE.map((s, k) =>
    obj(CHARSEL_GRID.x[k % 3], CHARSEL_STANDEE_Y[Math.floor(k / 3)], s.tile, s.pal, { big: true, prio: 3 }));
  const render = (chars: (number | null)[]) => { const img = createImage(256, 224); renderPpu(charselFrame(ASSETS!, chars, standees()), img); return img.data; };
  const shifted = (r: Rect) => ({ x0: r.x0 + CHARSEL_BG1_SHIFT.x, y0: r.y0 + CHARSEL_BG1_SHIFT.y, x1: r.x1 + CHARSEL_BG1_SHIFT.x, y1: r.y1 + CHARSEL_BG1_SHIFT.y });
  it('BG1 com HOFS −8 (a corda em x = 65/222 da captura), BG2 sem scroll', () => {
    expect(CHARSEL_SCROLL).toEqual({ bg1: [-8, 0], bg2: [0, 0] });
  });
  it('coluna de retratos (x 24–55, y 31–190) = a da captura, pixel a pixel (personagens 0..4 nos slots 0..4)', () => {
    expect(pixelMatch(render([0, 1, 2, 3, 4]), png, [], { x0: 24, y0: 31, x1: 55, y1: 190 })).toBe(1);
  });
  it('fora do título e dos cursores (OBJ da captura), o quadro inteiro bate, com o miolo escurecido', () => {
    const cursors = parseOam(loadCapture('charsel')!.oam).filter(r => r.tile >= 0xc0)
      .map(r => ({ x0: r.x, y0: r.y, x1: r.x + (r.big ? 31 : 15), y1: r.y + (r.big ? 31 : 15) }));
    expect(pixelMatch(render([0, 1, 2, 3, 4]), png, [...cursors, shifted(CHARSEL_TITLE_PX)])).toBe(1);
  });
  it('retratos por slot e personagem: palavras de BG1 da captura e "×" no slot desligado', () => {
    const words = charselPortraitWords([0, 1, 2, 3, 4]);
    const cap = capturedMap(loadCapture('charsel')!, 0x4000);
    for (const p of words) expect(p.w, `${p.col},${p.row}`).toBe(cap[p.row * 32 + p.col]);
    const off = charselPortraitWords([5, null, 0, 0, 0]);
    expect(off[0].w & 0x3ff).toBe(0x240);        // RUBI = retrato 4 da folha
    expect(off[4].w & 0x3ff).toBe(0x20c);        // "×"
  });
});

describe('desenho (revisão da Task 10, rodada 2)', () => {
  it('cursor "[ ]" da grade: 4 cantos com fillRect na cor do jogador, não um retângulo só', () => {
    const { app } = mkApp();
    const c = charactersScreen(app); app.go(c);
    const { fills, ctx } = recCtx();
    c.draw(ctx, fakeBank, 0);
    // P1/P2 (default: ambos humanos com dispositivo, nenhum confirmado) têm cursor aberto: 8 fillRect cada
    // (2 por canto × 4 cantos), nunca 1 retângulo (`strokeRect`, que nem existe no ctx falso) cobrindo a célula.
    expect(fills.filter(k => k.startsWith(`${PLAYER_COLORS[0]}:`))).toHaveLength(8);
    expect(fills.filter(k => k.startsWith(`${PLAYER_COLORS[1]}:`))).toHaveLength(8);
  });
  it('título de personagens vai dentro do vão da corda (CHARSEL_TITLE_PX), não na barra fixa y=12', () => {
    const { app } = mkApp();
    const c = charactersScreen(app); app.go(c);
    const { images, ctx } = recCtx();
    c.draw(ctx, fakeBank, 0);
    // T22: 2 linhas de 16 px na fonte `menuTitle`, como "Select a" / "character!" na ROM, centradas no vão.
    const cx = Math.floor((CHARSEL_TITLE_PX.x0 + CHARSEL_TITLE_PX.x1 + 1) / 2);
    const x = cx - Math.floor(fakeBank.text('', '').width / 2);
    expect(images).toContainEqual({ x, y: CHARSEL_TITLE_PX.y0 });
    expect(images).toContainEqual({ x, y: CHARSEL_TITLE_PX.y0 + 16 });
    expect(images.some(p => p.y === 12)).toBe(false);
  });
  it('título de equipes também vai dentro do mesmo vão', () => {
    const { app } = mkApp();
    const t = teamsScreen(app); app.go(t);
    const { images, ctx } = recCtx();
    t.draw(ctx, fakeBank, 0);
    // T22: 2 linhas de 16 px na fonte `menuTitle`, como "Select a" / "character!" na ROM, centradas no vão.
    const cx = Math.floor((CHARSEL_TITLE_PX.x0 + CHARSEL_TITLE_PX.x1 + 1) / 2);
    const x = cx - Math.floor(fakeBank.text('', '').width / 2);
    expect(images).toContainEqual({ x, y: CHARSEL_TITLE_PX.y0 });
    expect(images).toContainEqual({ x, y: CHARSEL_TITLE_PX.y0 + 16 });
    expect(images.some(p => p.y === 12)).toBe(false);
  });
});

describe('personagens (§6.6, R13, R32)', () => {
  it('cada humano move o próprio cursor: ←/→ com volta nas 3 colunas, ↑/↓ trocam a linha', () => {
    const { app } = mkApp();
    const c = charactersScreen(app); app.go(c);
    press(app, BTN.LEFT, 0); expect(c.charOf(0)).toBe(2);
    press(app, BTN.DOWN, 0); expect(c.charOf(0)).toBe(5);
    press(app, BTN.RIGHT, 1); expect(c.charOf(1)).toBe(2);
    press(app, BTN.UP, 1); expect(c.charOf(1)).toBe(5);          // dois no mesmo personagem
  });
  it('A confirma ($02); o P1 escolhe as CPUs em ordem depois do próprio; o último A leva à fase', () => {
    const { app, sink } = mkApp();
    const c = charactersScreen(app); app.go(c); sink.clear();
    press(app, BTN.A, 1);
    expect(c.confirmed).toEqual([false, true, false, false, false]);
    expect(c.controlling).toBeNull();
    press(app, BTN.A, 0);
    expect([c.controller, c.controlling]).toEqual([0, 2]);
    press(app, BTN.RIGHT, 1);                                    // P2 já confirmou: não mexe em nada
    press(app, BTN.RIGHT, 0); expect(c.charOf(2)).toBe(0);
    press(app, BTN.A, 0); expect(c.controlling).toBe(3);
    press(app, BTN.A, 0); press(app, BTN.A, 0);
    expect(app.inTransition).toBe(true);
    settle(app);
    expect(app.screen.id).toBe('stage');
    expect(sink.of('sfx').filter(x => x.id === 2)).toHaveLength(5);
    expect(app.settings.setup.chars).toEqual([0, 1, 0, 3, 4]);
  });
  it('B de qualquer controle, mesmo depois de confirmar, volta às regras com $03', () => {
    const { app, sink } = mkApp();
    app.go(charactersScreen(app));
    press(app, BTN.A, 0); sink.clear();
    press(app, BTN.B); settle(app);
    expect([app.screen.id, sink.of('sfx')[0].id]).toEqual(['rules', 3]);
  });
  it('humano sem dispositivo entra na fila do P1', () => {
    const { app } = mkApp();
    app.settings.devices[1] = 'none';
    const c = charactersScreen(app); app.go(c);
    press(app, BTN.A, 0);
    expect(c.controlling).toBe(1);
  });
  it('I9: humano com gamepad desconectado não trava: entra na fila do P1 e a tela termina', () => {
    const { app } = mkApp();
    app.settings.setup.slots = ['human', 'human', 'human', 'cpu', 'off'];   // P3 = gp0 (padrão), desligado
    const connected = [true, true, false, true, false];
    const pressC = (btn: number, slot?: number) => { app.update(inputOf(btn, btn, slot, { connected })); app.update({ ...idleInput(), connected } as MenuInput); };
    const c = charactersScreen(app); app.go(c);
    pressC(BTN.A, 1); pressC(BTN.A, 0);
    expect([c.controller, c.controlling]).toEqual([0, 2]);
    pressC(BTN.RIGHT, 0); expect(c.charOf(2)).toBe(0);
    pressC(BTN.A, 0); pressC(BTN.A, 0);
    settle(app);
    expect(app.screen.id).toBe('stage');
  });
  it('I9: sem nenhum humano conectado, qualquer controle decide por todos', () => {
    const { app } = mkApp();
    app.settings.setup.slots = ['cpu', 'off', 'human', 'cpu', 'off'];
    const connected = [false, false, false, false, false];
    const c = charactersScreen(app); app.go(c);
    app.update({ ...idleInput(), connected } as MenuInput);
    expect([c.controller, c.controlling]).toEqual([null, 0]);
    for (let k = 0; k < 3; k++) { app.update(inputOf(BTN.A, BTN.A, undefined, { connected })); app.update({ ...idleInput(), connected } as MenuInput); }
    settle(app);
    expect(app.screen.id).toBe('stage');
  });
  it('I9: o gamepad volta → o humano volta a escolher sozinho', () => {
    const { app } = mkApp();
    app.settings.setup.slots = ['human', 'human', 'human', 'off', 'off'];
    const c = charactersScreen(app); app.go(c);
    app.update({ ...idleInput(), connected: [true, true, false, false, false] } as MenuInput);
    expect(c.confirmed[2]).toBe(false);
    press(app, BTN.RIGHT, 2);                                     // idleInput: tudo conectado
    expect(c.charOf(2)).toBe(0);
  });
  it('sem humano com dispositivo, qualquer controle escolhe por todos', () => {
    const { app } = mkApp();
    app.settings.setup.slots = ['cpu', 'cpu', 'off', 'cpu', 'off'];
    const c = charactersScreen(app); app.go(c);
    expect([c.controller, c.controlling]).toEqual([null, 0]);
    press(app, BTN.RIGHT); expect(c.charOf(0)).toBe(1);
    press(app, BTN.A); press(app, BTN.A); press(app, BTN.A);
    settle(app);
    expect(app.screen.id).toBe('stage');
  });
  it('Em Equipes: depois dos personagens vem "Escolha as equipes!"', () => {
    const { app } = mkApp();
    app.settings.setup.mode = 'team';
    app.go(charactersScreen(app));
    press(app, BTN.A, 1); for (let k = 0; k < 4; k++) press(app, BTN.A, 0);
    settle(app);
    expect(app.screen.id).toBe('teams');
  });
  it('repetição 20/5 pelo direcional do próprio jogador', () => {
    const { app } = mkApp();
    const c = charactersScreen(app); app.go(c);
    hold(app, BTN.RIGHT, 21, 0);                                 // pulsos nos frames 0 e 20
    expect(c.charOf(0)).toBe(2);
  });
});

describe('equipes (A1, R14)', () => {
  const teamApp = () => {
    const env = mkApp();
    Object.assign(env.app.settings.setup, { mode: 'team', slots: ['human', 'human', 'cpu', 'cpu', 'off'], teams: [0, 1, 0, 1, 0] });
    const t = teamsScreen(env.app); env.app.go(t); env.sink.clear();
    return { ...env, t };
  };
  it('cada humano escolhe o lado com ←/→ ($01)', () => {
    const { app, t, sink } = teamApp();
    press(app, BTN.RIGHT, 0); expect(t.sideOf(0)).toBe(1);
    press(app, BTN.LEFT, 1); expect(t.sideOf(1)).toBe(0);
    expect(sink.of('sfx').map(c => c.id)).toEqual([1, 1]);
  });
  it('o P1 decide as CPUs depois de confirmar; equipes válidas → fase', () => {
    const { app, t } = teamApp();
    press(app, BTN.A, 1); press(app, BTN.A, 0);
    expect(t.controlling).toBe(2);
    press(app, BTN.A, 0); press(app, BTN.A, 0);
    settle(app);
    expect(app.screen.id).toBe('stage');
    expect(app.settings.setup.teams.slice(0, 4)).toEqual([0, 1, 0, 1]);
  });
  it('último A com uma equipe vazia: $03 e a vaga continua sem confirmar', () => {
    const { app, t, sink } = teamApp();
    press(app, BTN.LEFT, 1); press(app, BTN.A, 1); press(app, BTN.A, 0);
    press(app, BTN.LEFT, 0); press(app, BTN.A, 0);               // CPU 2 → equipe 0
    press(app, BTN.LEFT, 0); sink.clear(); press(app, BTN.A, 0); // CPU 3 → equipe 0: todos na 0
    expect([t.confirmed[3], app.inTransition, sink.of('sfx')[0].id]).toEqual([false, false, 3]);
    press(app, BTN.RIGHT, 0); press(app, BTN.A, 0);
    expect(app.inTransition).toBe(true);
  });
  it('I9: humano desconectado também não trava as equipes', () => {
    const { app } = teamApp();
    app.settings.setup.slots = ['human', 'human', 'human', 'cpu', 'off'];
    const t2 = teamsScreen(app); app.go(t2);
    const connected = [true, true, false, true, false];
    const pressC = (btn: number, slot?: number) => { app.update(inputOf(btn, btn, slot, { connected })); app.update({ ...idleInput(), connected } as MenuInput); };
    pressC(BTN.A, 1); pressC(BTN.A, 0);
    expect(t2.controlling).toBe(2);
    pressC(BTN.A, 0); pressC(BTN.A, 0);
    settle(app);
    expect(app.screen.id).toBe('stage');
  });
  it('B de qualquer controle volta aos personagens', () => {
    const { app } = teamApp();
    press(app, BTN.B); settle(app);
    expect(app.screen.id).toBe('characters');
  });
});
