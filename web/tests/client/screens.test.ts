import { App } from '../../src/app/app';
import { defaultSettings, type Settings } from '../../src/app/settings';
import { idleInput } from '../../src/input/input';
import { BTN } from '../../src/core';
import type { Session } from '../../src/game/session';
import { titleScreen } from '../../src/screens/title';
import { playersScreen, ERROR_FRAMES } from '../../src/screens/players';
import { rulesScreen } from '../../src/screens/rules';
import { charactersScreen, AUTO_ADVANCE_FRAMES } from '../../src/screens/characters';
import { stageScreen, START_DELAY_FRAMES } from '../../src/screens/stage';
import { settingsScreen, namesScreen, remapScreen } from '../../src/screens/settings-screen';

function mkApp(settings: Settings = defaultSettings()) {
  let saves = 0;
  const keymaps: unknown[] = [];
  const app = new App(settings, { save: () => { saves++; }, setKeymaps: m => { keymaps.push(m); }, seed: () => 1 });
  return { app, saves: () => saves, keymaps };
}

/** Aperta e solta um botão: em qualquer dispositivo (menus) e, se `slot` for dado, no dispositivo daquele jogador. */
function press(app: App, btn: number, slot?: number) {
  const i = idleInput();
  i.any = i.pressedAny = btn;
  if (slot !== undefined) { i.pads[slot] = btn; i.pressed[slot] = btn; }
  app.update(i);
  app.update(idleInput());
}
const idle = (app: App, n: number) => { for (let k = 0; k < n; k++) app.update(idleInput()); };

describe('título e modos', () => {
  it('cursor começa em JOGO DE BATALHA (JOGO NORMAL está "em breve")', () => {
    const { app } = mkApp();
    app.go(titleScreen(app));
    press(app, BTN.A);
    expect(app.screen.id).toBe('vs');
  });
  it('título → CONFIGURAÇÕES', () => {
    const { app } = mkApp();
    app.go(titleScreen(app));
    press(app, BTN.DOWN); press(app, BTN.START);
    expect(app.screen.id).toBe('settings');
  });
  it('VS → Battle Royale → Batalha em Times grava o modo e vai para jogadores; B volta', () => {
    const { app, saves } = mkApp();
    app.go(titleScreen(app));
    press(app, BTN.A); press(app, BTN.A);
    expect(app.screen.id).toBe('mode');
    press(app, BTN.DOWN); press(app, BTN.A);
    expect(app.screen.id).toBe('players');
    expect(app.settings.setup.mode).toBe('team');
    expect(saves()).toBeGreaterThan(0);
    press(app, BTN.B);
    expect(app.screen.id).toBe('mode');
    press(app, BTN.B); press(app, BTN.B);
    expect(app.screen.id).toBe('title');
  });
});

describe('jogadores', () => {
  it('ESQ/DIR alterna Humano → CPU → Desligado', () => {
    const { app } = mkApp();
    app.go(playersScreen(app));
    press(app, BTN.RIGHT);
    expect(app.settings.setup.slots[0]).toBe('cpu');
    press(app, BTN.RIGHT);
    expect(app.settings.setup.slots[0]).toBe('off');
    press(app, BTN.LEFT); press(app, BTN.LEFT);
    expect(app.settings.setup.slots[0]).toBe('human');
  });
  it('nos times, a opção inclui o time', () => {
    const { app } = mkApp();
    app.settings.setup.mode = 'team';
    app.settings.setup.teams[0] = 0;
    app.go(playersScreen(app));
    press(app, BTN.RIGHT);
    expect([app.settings.setup.slots[0], app.settings.setup.teams[0]]).toEqual(['human', 1]);
    press(app, BTN.RIGHT);
    expect([app.settings.setup.slots[0], app.settings.setup.teams[0]]).toEqual(['cpu', 0]);
  });
  it('formação inválida mostra erro e não avança; válida vai para regras', () => {
    const { app } = mkApp();
    app.settings.setup.slots = ['human', 'off', 'off', 'off', 'off'];
    const scr = playersScreen(app) as ReturnType<typeof playersScreen> & { error: string };
    app.go(scr);
    press(app, BTN.A);
    expect(app.screen.id).toBe('players');
    expect(scr.error).toBe('PRECISA DE 2 JOGADORES');
    idle(app, ERROR_FRAMES);
    expect(scr.error).toBe('');
    press(app, BTN.DOWN); press(app, BTN.LEFT); // 2º jogador: desligado → CPU
    press(app, BTN.A);
    expect(app.screen.id).toBe('rules');
  });
});

describe('regras', () => {
  it('ajusta valores com limites e alterna ligado/desligado', () => {
    const { app } = mkApp();
    const r = app.settings.setup.rules;
    app.go(rulesScreen(app));
    press(app, BTN.DOWN);                       // coroas
    press(app, BTN.RIGHT); press(app, BTN.RIGHT); press(app, BTN.RIGHT);
    expect(r.matches).toBe(5);
    press(app, BTN.UP); press(app, BTN.LEFT); press(app, BTN.LEFT);
    expect(r.cpuLevel).toBe(0);
    press(app, BTN.DOWN); press(app, BTN.DOWN); press(app, BTN.DOWN); // morte súbita
    press(app, BTN.RIGHT);
    expect(r.suddenDeath).toBe(true);
    press(app, BTN.A);
    expect(app.screen.id).toBe('characters');
  });
  it('B volta para jogadores', () => {
    const { app } = mkApp();
    app.go(rulesScreen(app));
    press(app, BTN.B);
    expect(app.screen.id).toBe('players');
  });
});

describe('personagens', () => {
  it('cada humano move o próprio cursor com o próprio controle e confirma', () => {
    const { app } = mkApp();
    const scr = charactersScreen(app);
    app.go(scr);
    press(app, BTN.RIGHT, 0);
    press(app, BTN.DOWN, 1);
    expect(app.settings.setup.chars.slice(0, 2)).toEqual([1, 4]);
    press(app, BTN.A, 0);
    expect(scr.locked.slice(0, 2)).toEqual([true, false]);
    press(app, BTN.RIGHT, 0);                   // travado: não mexe
    expect(app.settings.setup.chars[0]).toBe(1);
    press(app, BTN.B, 0);
    expect(scr.locked[0]).toBe(false);
  });
  it('CPUs já começam prontas; com todos prontos, START segue para a fase', () => {
    const { app } = mkApp();
    const scr = charactersScreen(app);
    app.go(scr);
    expect(scr.locked).toEqual([false, false, true, true, true]);
    press(app, BTN.A, 0); press(app, BTN.A, 1);
    expect(app.screen.id).toBe('characters');
    press(app, BTN.START);
    expect(app.screen.id).toBe('stage');
  });
  it('segue sozinho depois de um tempo com todos prontos', () => {
    const { app } = mkApp();
    app.go(charactersScreen(app));
    press(app, BTN.A, 0); press(app, BTN.A, 1);
    idle(app, AUTO_ADVANCE_FRAMES);
    expect(app.screen.id).toBe('stage');
  });
  it('humano sem controle atribuído fica pronto automaticamente', () => {
    const { app } = mkApp();
    app.settings.devices[1] = 'none';
    const scr = charactersScreen(app);
    app.go(scr);
    expect(scr.locked[1]).toBe(true);
  });
  it('B de quem ainda escolhe, sem ninguém travado, volta para regras', () => {
    const { app } = mkApp();
    app.go(charactersScreen(app));
    press(app, BTN.B, 1);
    expect(app.screen.id).toBe('rules');
  });
});

describe('fase e batalha', () => {
  it('ESQ/DIR trocam a fase com volta', () => {
    const { app } = mkApp();
    app.go(stageScreen(app));
    press(app, BTN.LEFT);
    expect(app.settings.setup.stage).toBe(10);
    press(app, BTN.RIGHT); press(app, BTN.RIGHT);
    expect(app.settings.setup.stage).toBe(2);
  });
  it('A mostra BATALHA! e depois abre a partida com a formação escolhida', () => {
    const { app } = mkApp();
    app.settings.setup.slots = ['human', 'cpu', 'off', 'human', 'off'];
    app.settings.setup.stage = 3;
    app.settings.names[0] = 'ANA';
    const scr = stageScreen(app);
    app.go(scr);
    press(app, BTN.A);
    expect(scr.starting).toBe(START_DELAY_FRAMES - 1);
    idle(app, START_DELAY_FRAMES);
    expect(app.screen.id).toBe('battle');
    const s = (app.screen as unknown as { session: Session }).session;
    expect(s.cfg.stage).toBe(3);
    expect(s.cfg.humans).toEqual([true, false, false, true, false]);
    expect(s.cfg.rules.active).toEqual([true, true, false, true, false]);
    expect(s.cfg.names[0]).toBe('ANA');
  });
  it('sair pela pausa volta para a seleção de fase; a animação congela na pausa', () => {
    const { app } = mkApp();
    const scr = stageScreen(app);
    app.go(scr);
    press(app, BTN.A);
    idle(app, START_DELAY_FRAMES);
    expect(app.screen.id).toBe('battle');
    press(app, BTN.START, 0);
    const f = app.frame;
    idle(app, 10);
    expect(app.frame).toBe(f);
    press(app, BTN.B, 0);
    expect(app.screen.id).toBe('stage');
  });
});

describe('configurações', () => {
  it('troca o controle de um jogador e grava', () => {
    const { app, saves } = mkApp();
    app.go(settingsScreen(app));
    press(app, BTN.RIGHT);
    expect(app.settings.devices[0]).toBe('kb1');
    press(app, BTN.LEFT); press(app, BTN.LEFT);
    expect(app.settings.devices[0]).toBe('none');
    expect(saves()).toBe(3);
  });
  it('restaurar padrão volta controles, teclas e nomes', () => {
    const { app, keymaps } = mkApp();
    app.settings.devices[0] = 'gp3';
    app.settings.names[0] = 'X';
    app.settings.keymaps[0].up = 'KeyI';
    app.go(settingsScreen(app));
    for (let k = 0; k < 8; k++) press(app, BTN.DOWN);  // RESTAURAR PADRÃO
    press(app, BTN.A);
    expect(app.settings.devices[0]).toBe('kb0');
    expect(app.settings.names[0]).toBe('');
    expect(app.settings.keymaps[0].up).toBe('KeyW');
    expect(keymaps).toHaveLength(1);
  });
  it('edita um nome letra a letra', () => {
    const { app } = mkApp();
    const scr = namesScreen(app);
    app.go(scr);
    press(app, BTN.A);
    expect(scr.editing).toBe(0);
    press(app, BTN.UP);               // ' ' → 'A'
    press(app, BTN.A);                // próxima posição
    press(app, BTN.DOWN);             // ' ' → '-'
    press(app, BTN.DOWN);             // '-' → '9'
    press(app, BTN.START);
    expect(scr.editing).toBe(-1);
    expect(app.settings.names[0]).toBe('A9');
  });
  it('B cancela a edição sem gravar', () => {
    const { app } = mkApp();
    const scr = namesScreen(app);
    app.go(scr);
    press(app, BTN.A); press(app, BTN.UP); press(app, BTN.B);
    expect(scr.editing).toBe(-1);
    expect(app.settings.names[0]).toBe('');
  });
  it('remapeia uma tecla; ESC cancela', () => {
    const { app, keymaps } = mkApp();
    const scr = remapScreen(app, 0);
    app.go(scr);
    press(app, BTN.A);
    expect(scr.capturing).toBe('up');
    const k = idleInput(); k.key = 'KeyI';
    app.update(k);
    expect(scr.capturing).toBeNull();
    expect(app.settings.keymaps[0].up).toBe('KeyI');
    expect(keymaps).toHaveLength(1);
    press(app, BTN.A);
    const esc = idleInput(); esc.key = 'Escape';
    app.update(esc);
    expect(scr.capturing).toBeNull();
    expect(app.settings.keymaps[0].up).toBe('KeyI');
  });
});
