import { stageScreen } from '../../src/screens/stage';
import { BTN } from '../../src/game/core-api';
import type { MatchSession } from '../../src/game/match-session';
import { idleInput } from '../../src/input/input';
import { buildStageScene, STAGE_ICON_COL, STAGE_ICON_ROW } from '../../src/render/screens-rom/stagesel';
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

// Follow-up (revisão da T11): as 10 prévias de $C1:A901/$C1:A209 foram reconstruídas (ver
// `render/screens-rom/stagesel.ts`). A fase 1 é conferida contra a captura oficial já versionada
// (`analise/extraido/graficos-formato/cenas/stagesel.*`); as fases 2–10, contra capturas próprias desta
// tarefa nos mesmos savestates (`stagesel-faseNN.*`, não versionadas — `analise/extraido/` está no
// `.gitignore`, geradas a partir de `analise/estados/st_stageNN.bin`). Sem essas capturas extras
// (SB4_CAPTURES não aponta para uma pasta com elas), só a fase 1 roda; o resto pula.
//
// Cada captura tem a fase centralizada num dos 4 slots físicos do BG1 real (colunas 0/8/16/24 — um buffer
// giratório carregado sob demanda pela rolagem, ver o relatório); `buildStageScene` sempre põe o ícone
// pedido no slot canônico (coluna `STAGE_ICON_COL`), então a comparação lê o bloco de 7×7 de cada lado na
// sua própria coluna, em vez do `mapMatch` de tela inteira (que assume as duas pontas na mesma posição).
const captureNameOf = (stage: number): string => (stage === 1 ? 'stagesel' : `stagesel-fase${String(stage).padStart(2, '0')}`);
const CAPTURE_COL: Record<number, number> = { 1: 8, 2: 16, 3: 24, 4: 0, 5: 8, 6: 16, 7: 24, 8: 0, 9: 8, 10: 16 };
const TEXT_IGNORE: Rect[] = [
  { x0: 60, y0: 0, x1: 196, y1: 28 },     // título "Escolha a fase!"
  { x0: 40, y0: 146, x1: 216, y1: 200 },  // "Fase N" e o nome
];
function iconMatch(built: Uint16Array, capturedCol: number, cap: Uint16Array): number {
  let same = 0, total = 0;
  for (let gy = 0; gy < 7; gy++) for (let gx = 0; gx < 7; gx++) {
    total++;
    const lin = STAGE_ICON_ROW + gy;
    if (built[lin * 32 + STAGE_ICON_COL + gx] === cap[lin * 32 + capturedCol + gx]) same++;
  }
  return same / total;
}

describe.skipIf(!ASSETS)('prévias reconstruídas × capturas reais (todas as 10 fases)', () => {
  it.for([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('fase %s: ícone bate igual e o fundo (BG2) bate >= 97 fora dos textos', (stage, { skip }) => {
    const cap = loadCapture(captureNameOf(stage));
    if (!cap) return skip();   // captura ausente (só a oficial da fase 1 é garantida): aparece como pulado, não como aprovado
    const maps = buildStageScene(ASSETS!, stage, 0);
    expect(mapMatch(maps.bg2!, capturedMap(cap, 0x4400), TEXT_IGNORE)).toBeGreaterThanOrEqual(0.97);
    expect(iconMatch(maps.bg1!, CAPTURE_COL[stage], capturedMap(cap, 0x4000))).toBe(1);
  });
});
