// ALEATÓRIO na seleção de fase: uma opção a mais (no fim da lista, nunca a padrão) que sorteia uma das fases visíveis
// ao confirmar e inicia a partida com ela. Os testes usam só VISIBLE_STAGES (nada de lista fixa de fases).
import { stageScreen } from '../../src/screens/stage';
import { BTN } from '../../src/game/core-api';
import type { MatchSession } from '../../src/game/match-session';
import { idleInput } from '../../src/input/input';
import { VISIBLE_STAGES } from '../../src/game/stages';
import {
  RANDOM_STAGE, stageChoices, stepChoice, choiceNumber, pickStage, stageRandom, seedStagePick, drawStage, resolveStage,
  randomPreviewStage,
} from '../../src/game/stage-choice';
import { defaultSettings, defaultSetup, normalizeSettings } from '../../src/app/settings';
import { parseConfig } from '../../src/game/config';
import { mkApp, tap, idle } from './helpers';

const FIRST = VISIBLE_STAGES[0], LAST = VISIBLE_STAGES[VISIBLE_STAGES.length - 1];
const N = VISIBLE_STAGES.length;
/** Confirma na tela de fase e espera a partida entrar; devolve a fase que ela joga. */
function confirmAndPlay(app: ReturnType<typeof mkApp>['app']): number {
  tap(app, BTN.A);
  while (app.screen.id !== 'battle') app.update(idleInput());
  return (app.screen as unknown as { ms: MatchSession }).ms.cfg.stage;
}

afterEach(() => seedStagePick(''));

describe('ALEATÓRIO na lista de fases', () => {
  it('é uma opção a mais, depois da última visível, e não tem número de fase', () => {
    expect(stageChoices()).toEqual([...VISIBLE_STAGES, RANDOM_STAGE]);
    expect(VISIBLE_STAGES).not.toContain(RANDOM_STAGE);
    expect(stepChoice(LAST, 1)).toBe(RANDOM_STAGE);
    expect(stepChoice(RANDOM_STAGE, 1)).toBe(FIRST);
    expect(stepChoice(FIRST, -1)).toBe(RANDOM_STAGE);
    expect(stepChoice(RANDOM_STAGE, -1)).toBe(LAST);
    expect(VISIBLE_STAGES.map(choiceNumber)).toEqual(VISIBLE_STAGES.map((_, i) => i + 1));   // "Fase N" das outras
    expect(choiceNumber(RANDOM_STAGE)).toBeNull();
  });
  it('a volta completa da lista passa por todas as visíveis e por ALEATÓRIO uma vez cada', () => {
    const seen: number[] = [];
    let c = FIRST;
    for (let k = 0; k <= N; k++) { seen.push(c); c = stepChoice(c, 1); }
    expect([seen, c]).toEqual([[...VISIBLE_STAGES, RANDOM_STAGE], FIRST]);
  });
  it('na tela: → na última visível chega em ALEATÓRIO e → de novo volta para a 1ª; ← na 1ª vai para ALEATÓRIO', () => {
    const { app } = mkApp();
    app.settings.setup.stage = LAST;
    const st = stageScreen(app); app.go(st);
    tap(app, BTN.RIGHT); idle(app, 16);
    expect([st.stage, app.settings.setup.stage]).toEqual([RANDOM_STAGE, RANDOM_STAGE]);
    tap(app, BTN.RIGHT); idle(app, 16);
    expect(st.stage).toBe(FIRST);
    tap(app, BTN.LEFT); idle(app, 16);
    expect(st.stage).toBe(RANDOM_STAGE);
  });
  it('não é a padrão: configuração nova e tela nova abrem na 1ª fase visível', () => {
    expect(defaultSetup().stage).toBe(FIRST);
    expect(defaultSetup().stage).not.toBe(RANDOM_STAGE);
    const { app } = mkApp();
    const st = stageScreen(app); app.go(st);
    expect(st.stage).toBe(FIRST);
  });
  it('fica salvo como ALEATÓRIO: a configuração lida de volta mantém a opção e a tela abre com o cursor nela', () => {
    const s = defaultSettings();
    s.setup.stage = RANDOM_STAGE;
    const back = normalizeSettings(JSON.parse(JSON.stringify(s)));
    expect(back.setup.stage).toBe(RANDOM_STAGE);
    const { app } = mkApp(back);
    const st = stageScreen(app); app.go(st);
    expect(st.stage).toBe(RANDOM_STAGE);
  });
  it('a prévia de ALEATÓRIO passa pelas fases visíveis (um ciclo, sem arte nova)', () => {
    const seen = new Set(Array.from({ length: N * 24 }, (_, t) => randomPreviewStage(t)));
    expect([...seen].sort((a, b) => a - b)).toEqual([...VISIBLE_STAGES].sort((a, b) => a - b));
  });
});

describe('sorteio da fase', () => {
  it('cobre todas as visíveis, com a mesma chance, e só elas', () => {
    expect(Array.from({ length: N }, (_, i) => pickStage((i + 0.5) / N))).toEqual([...VISIBLE_STAGES]);
    expect([pickStage(0), pickStage(0.999999)]).toEqual([FIRST, LAST]);
    seedStagePick('');   // Math.random
    const seen = new Set(Array.from({ length: 400 }, drawStage));
    expect([...seen].sort((a, b) => a - b)).toEqual([...VISIBLE_STAGES].sort((a, b) => a - b));
  });
  it('sem ?seed usa o aleatório da camada do jogo (Math.random ou o que for passado)', () => {
    const r = () => 0.5;
    expect(stageRandom('', r)).toBe(r);
    expect(stageRandom('?quick&stage=3', r)).toBe(r);
  });
  it('com ?seed é reproduzível: a mesma semente dá a mesma sequência de sorteios, e não depende de Math.random', () => {
    const seq = (search: string, n = 40) => { const g = stageRandom(search, () => 0); return Array.from({ length: n }, () => pickStage(g())); };
    expect(seq('?seed=4660')).toEqual(seq('?seed=4660'));
    expect(seq('?quick&seed=70000')).toEqual(seq('?seed=' + (70000 & 0xffff)));
    expect(new Set(seq('?seed=4660', 400)).size).toBe(N);   // ainda cobre as visíveis
    if (N > 1) expect(seq('?seed=1')).not.toEqual(seq('?seed=2'));
  });
  it('uma fase escolhida não é sorteada; ALEATÓRIO, sim', () => {
    for (const st of VISIBLE_STAGES) expect(resolveStage(st, () => -1)).toBe(st);
    expect(resolveStage(RANDOM_STAGE, () => LAST)).toBe(LAST);
  });
  it('?stage=N continua forçando a fase da partida rápida', () => {
    for (const st of VISIBLE_STAGES) expect(parseConfig(`?quick&seed=5&stage=${st}`).stage).toBe(st);
  });
});

describe('confirmar ALEATÓRIO', () => {
  it('sorteia uma das visíveis e inicia a partida com ela pelo mesmo fluxo; a escolha salva continua ALEATÓRIO', () => {
    for (let i = 0; i < N; i++) {
      const { app, saves } = mkApp();
      app.settings.setup.stage = RANDOM_STAGE;
      seedStagePick('', () => (i + 0.5) / N);
      const st = stageScreen(app); app.go(st);
      const t0 = app.tick + 1;                               // o tick do A, como em stage.test.ts
      expect(confirmAndPlay(app)).toBe(VISIBLE_STAGES[i]);
      expect(app.tick - t0).toBe(323);                      // a mesma sequência "BATALHA!" de uma fase normal
      expect([st.picked, app.settings.setup.stage]).toEqual([VISIBLE_STAGES[i], RANDOM_STAGE]);
      expect(saves()).toBe(0);                               // nada de gravar a fase sorteada por cima de ALEATÓRIO
    }
  });
  it('com ?seed, duas sessões iguais jogam as mesmas fases; escolher ALEATÓRIO de novo sorteia de novo', () => {
    const run = (): number[] => {
      seedStagePick('?seed=321');
      return Array.from({ length: 6 }, () => {
        const { app } = mkApp();
        app.settings.setup.stage = RANDOM_STAGE;
        app.go(stageScreen(app));
        return confirmAndPlay(app);
      });
    };
    const a = run();
    expect(run()).toEqual(a);
    const g = stageRandom('?seed=321');
    expect(a).toEqual(Array.from({ length: 6 }, () => pickStage(g())));
    for (const st of a) expect(VISIBLE_STAGES).toContain(st);
  });
  it('fase normal: nada é sorteado (o gerador não anda)', () => {
    let calls = 0;
    seedStagePick('', () => { calls++; return 0; });
    const { app } = mkApp();
    app.settings.setup.stage = LAST;
    const st = stageScreen(app); app.go(st);
    expect([confirmAndPlay(app), st.picked, calls]).toEqual([LAST, LAST, 0]);
  });
});
