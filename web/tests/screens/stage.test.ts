import { stageScreen } from '../../src/screens/stage';
import { BTN } from '../../src/game/core-api';
import type { MatchSession } from '../../src/game/match-session';
import { idleInput } from '../../src/input/input';
import { buildStageScene, stageIcon, stagePreview, STAGE_ICON_COL, STAGE_ICON_ROW, STAGE_ICON_HOFS_BASE } from '../../src/render/screens-rom/stagesel';
import { sceneFrame, gfxFromVram, type SceneGfx } from '../../src/render/screens-rom/scene';
import { createImage, renderPpu } from '../../src/render/ppu';
import { mkApp, press, tap, idle, hold, settle } from './helpers';
import { ASSETS } from './rom';
import { loadCapture, capturedMap, mapMatch, type Rect } from './captures';

describe('seleção de fase (§6.7)', () => {
  it('→: $01 no botão, faixa rola 8 px/f por 16 f, o número troca no fim, com volta 10 → 1', () => {
    const { app, sink } = mkApp();
    app.settings.setup.stage = 10;
    const st = stageScreen(app); app.go(st); sink.clear();
    tap(app, BTN.RIGHT);
    expect([st.scroll(), st.stage]).toEqual([0, 10]);
    idle(app, 1); expect(st.scroll()).toBe(-8);
    idle(app, 14); expect([st.scroll(), st.stage]).toEqual([-120, 10]);
    idle(app, 1); expect([st.scroll(), st.stage]).toEqual([0, 1]);
    expect([app.settings.setup.stage, sink.of('sfx').map(c => c.id)]).toEqual([1, [1]]);
  });
  it('← anda para o outro lado, com volta 1 → 10', () => {
    const { app } = mkApp();
    const st = stageScreen(app); app.go(st);
    tap(app, BTN.LEFT); idle(app, 1);
    expect(st.scroll()).toBe(8);
    idle(app, 15);
    expect(st.stage).toBe(10);
  });
  it('segurar: 36 f e depois a cada 21 f', () => {
    const { app } = mkApp();
    const st = stageScreen(app); app.go(st);
    hold(app, BTN.RIGHT, 100);                     // pulsos em 0, 36, 57 e 78
    expect(st.stage).toBe(5);
  });
  it('↑/↓ não fazem nada', () => {
    const { app, sink } = mkApp();
    const st = stageScreen(app); app.go(st); sink.clear();
    press(app, BTN.UP); press(app, BTN.DOWN);
    expect([st.stage, st.scroll(), sink.calls.length]).toEqual([1, 0, 0]);
  });
  it('A: $02 f0, $13 f48, voz $07 f208, fade-out f278, FADE f310, $2F f511, $14 f523 e partida em f646', () => {
    const { app, sink } = mkApp();
    app.settings.setup.stage = 3;
    app.go(stageScreen(app)); sink.clear();
    tap(app, BTN.A);
    const t0 = app.tick;
    idle(app, 277);
    expect(app.inTransition).toBe(false);
    idle(app, 1);
    expect([app.inTransition, app.brightness()]).toEqual([true, 14]);
    while (app.screen.id !== 'battle') app.update(idleInput());
    expect(app.tick - t0).toBe(646);
    expect(sink.since(t0).filter(c => c.t < 646).map(c => [c.t, c.op, c.id])).toEqual([
      [0, 'sfx', 2], [48, 'music', 0x13], [208, 'voice', 0x07], [310, 'fade', undefined], [511, 'bank', 0x2f], [523, 'music', 0x14]]);
    expect((app.screen as unknown as { ms: MatchSession }).ms.cfg.stage).toBe(3);
  });
  it('"BATALHA!" pisca de f65 a f207 e fica de f208 a f277; o título sobe de f48 a f64; entradas ignoradas', () => {
    const { app } = mkApp();
    const st = stageScreen(app); app.go(st);
    tap(app, BTN.A);
    idle(app, 56); expect(st.titleDy()).toBe(-16);
    idle(app, 9); expect([st.seqF, st.battleVisible()]).toEqual([65, true]);
    idle(app, 1); expect(st.battleVisible()).toBe(false);
    press(app, BTN.B); press(app, BTN.RIGHT);
    expect([app.inTransition, st.stage]).toEqual([false, 1]);
    idle(app, 150); expect(st.battleVisible()).toBe(true);
  });
  it('B → personagens com $03; em Equipes → equipes (R12)', () => {
    const a = mkApp();
    a.app.go(stageScreen(a.app)); a.sink.clear();
    press(a.app, BTN.B); settle(a.app);
    expect([a.app.screen.id, a.sink.of('sfx')[0].id]).toEqual(['characters', 3]);
    const b = mkApp();
    b.app.settings.setup.mode = 'team';
    b.app.go(stageScreen(b.app)); press(b.app, BTN.B); settle(b.app);
    expect(b.app.screen.id).toBe('teams');
  });
});

// Follow-up (revisão da T11) e correção I2 da revisão final: as prévias de `$C1:A8D1` (mapas) e `$C1:A92B` (paletas)
// são lidas da ROM (ver `render/screens-rom/stagesel.ts`). A fase 1 é conferida contra a captura oficial
// (`analise/extraido/graficos-formato/cenas/stagesel.*`); as fases 2–10, contra capturas próprias nos mesmos
// savestates (`stagesel-faseNN.*`, não versionadas — `analise/extraido/` está no `.gitignore`, geradas a partir de
// `analise/estados/st_stageNN.bin`). Sem essas capturas extras, só a fase 1 roda; o resto aparece como pulado.
//
// Cada captura tem a fase centralizada num dos 4 slots físicos do BG1 real (colunas 0/8/16/24 — um buffer giratório
// de mapas e de paletas, linhas 0–3 da CGRAM), com a anterior 8 colunas à esquerda e a seguinte 8 à direita. A
// comparação de cores renderiza as duas faixas só com o BG1 (a nossa com a CGRAM dos slots; a da captura com a VRAM e
// a CGRAM dela, rolada para pôr a coluna central em x = 72) e compara pixel a pixel as linhas das prévias.
const captureNameOf = (stage: number): string => (stage === 1 ? 'stagesel' : `stagesel-fase${String(stage).padStart(2, '0')}`);
const CAPTURE_COL: Record<number, number> = { 1: 8, 2: 16, 3: 24, 4: 0, 5: 8, 6: 16, 7: 24, 8: 0, 9: 8, 10: 16 };
const TEXT_IGNORE: Rect[] = [
  { x0: 60, y0: 0, x1: 196, y1: 28 },     // título "Escolha a fase!"
  { x0: 40, y0: 146, x1: 216, y1: 200 },  // "Fase N" e o nome
];
/** O bloco 7×7 do mapa `m` que começa na coluna `col` (com volta de 32), linha `STAGE_ICON_ROW`. */
function block(m: Uint16Array, col: number): number[] {
  const out: number[] = [];
  for (let gy = 0; gy < 7; gy++) for (let gx = 0; gx < 7; gx++) out.push(m[(STAGE_ICON_ROW + gy) * 32 + ((col + gx) & 31)]);
  return out;
}
const PREVIEW_Y0 = STAGE_ICON_ROW * 16 - 1, PREVIEW_Y1 = PREVIEW_Y0 + 7 * 16;   // linha y da tela mostra a linha y+1 do BG
/** Só o BG1 (fundo fixo preto), com `hofs`; devolve os pixels RGBA. */
function renderBg1(g: SceneGfx, bg1: Uint16Array, hofs: number): Uint8ClampedArray {
  const img = createImage(256, 224);
  renderPpu(sceneFrame(g, { bg1 }, { bg1: [hofs, 0], backdrop: 0 }), img);
  return img.data;
}
/** Fração de pixels iguais no retângulo [x0, x1) × [y0, y1) entre duas imagens (com deslocamento `dx` na segunda). */
function pixelMatch(a: Uint8ClampedArray, b: Uint8ClampedArray, x0: number, x1: number, y0: number, y1: number, dx = 0): number {
  let same = 0, total = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * 256 + x) * 4, j = (y * 256 + x + dx) * 4;
    total++;
    if (a[i] === b[j] && a[i + 1] === b[j + 1] && a[i + 2] === b[j + 2]) same++;
  }
  return same / total;
}

describe.skipIf(!ASSETS)('prévias reconstruídas × capturas reais (todas as 10 fases)', () => {
  it.for([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('fase %s: mapas da ROM = captura (fora da paleta) e o fundo (BG2) bate >= 97 fora dos textos', (stage, { skip }) => {
    const cap = loadCapture(captureNameOf(stage));
    if (!cap) return skip();   // captura ausente (só a oficial da fase 1 é garantida): aparece como pulado, não como aprovado
    const maps = buildStageScene(ASSETS!, stage);
    expect(mapMatch(maps.bg2!, capturedMap(cap, 0x4400), TEXT_IGNORE)).toBeGreaterThanOrEqual(0.97);
    const capBg1 = capturedMap(cap, 0x4000), col = CAPTURE_COL[stage];
    const noPal = (ws: number[]) => ws.map(w => w & 0xe3ff);
    expect(noPal(block(maps.bg1!, STAGE_ICON_COL))).toEqual(noPal(block(capBg1, col)));
    for (const [d, c] of [[-1, col - 8], [0, col], [1, col + 8]]) expect(noPal(Array.from(stageIcon(ASSETS!, stage + d)))).toEqual(noPal(block(capBg1, c)));
  });
  it.for([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('fase %s: cores da anterior, da atual e da seguinte = captura pixel a pixel (paleta por slot)', (stage, { skip }) => {
    const cap = loadCapture(captureNameOf(stage));
    if (!cap) return skip();
    const p = stagePreview(ASSETS!, stage);
    const ours = renderBg1(p.g, p.maps.bg1!, STAGE_ICON_HOFS_BASE);
    const theirs = renderBg1(gfxFromVram(cap.vram, cap.cgram), capturedMap(cap, 0x4000), (CAPTURE_COL[stage] * 16 - 72) & 511);
    expect(pixelMatch(ours, theirs, 72, 184, PREVIEW_Y0, PREVIEW_Y1)).toBe(1);   // atual
    expect(pixelMatch(ours, theirs, 0, 56, PREVIEW_Y0, PREVIEW_Y1)).toBe(1);     // anterior (pedaço visível)
    expect(pixelMatch(ours, theirs, 200, 256, PREVIEW_Y0, PREVIEW_Y1)).toBe(1);  // seguinte (pedaço visível)
  });
  it.for([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('fase %s: rolando, a fase ± 2 entra no 4º slot (paleta 3) com as cores dela', (stage) => {
    const center = (n: number) => { const q = stagePreview(ASSETS!, n); return renderBg1(q.g, q.maps.bg1!, STAGE_ICON_HOFS_BASE); };
    const right = stagePreview(ASSETS!, stage, 1), left = stagePreview(ASSETS!, stage, -1);
    // → no fim (scroll −120): a seguinte da seguinte aparece em x 208–255, que são os px 0–47 da prévia.
    expect(pixelMatch(renderBg1(right.g, right.maps.bg1!, STAGE_ICON_HOFS_BASE + 120), center(stage + 2), 208, 256, PREVIEW_Y0, PREVIEW_Y1, 72 - 208)).toBe(1);
    // ← no fim (scroll +120): a anterior da anterior aparece em x 0–47, que são os px 64–111 da prévia.
    expect(pixelMatch(renderBg1(left.g, left.maps.bg1!, STAGE_ICON_HOFS_BASE - 120), center(stage - 2), 0, 48, PREVIEW_Y0, PREVIEW_Y1, 136)).toBe(1);
    expect(right.maps.bg1![STAGE_ICON_ROW * 32 + 24] >> 10 & 7).toBe(3);
  });
  it('a prévia é memorizada por (ROM, fase, direção): o mesmo objeto a cada quadro', () => {
    expect(stagePreview(ASSETS!, 4, 0)).toBe(stagePreview(ASSETS!, 4, 0));
    expect(stagePreview(ASSETS!, 11, 1)).toBe(stagePreview(ASSETS!, 1, 1));
    expect(stagePreview(ASSETS!, 4, 1)).not.toBe(stagePreview(ASSETS!, 4, 0));
  });
});
