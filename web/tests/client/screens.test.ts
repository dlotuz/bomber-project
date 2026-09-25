import { App } from '../../src/app/app';
import { defaultSettings, type Settings } from '../../src/app/settings';
import { idleInput, buildInput, InputManager, emptyDevices, type DeviceState } from '../../src/input/input';
import { BTN, INTRO_FRAMES } from '../../src/core';
import type { Session } from '../../src/game/session';
import { ROUND_OVER_FRAMES, SCOREBOARD_FRAMES, SKIP_AFTER } from '../../src/game/session';
import { titleScreen } from '../../src/screens/title';
import { playersScreen, ERROR_FRAMES } from '../../src/screens/players';
import { rulesScreen } from '../../src/screens/rules';
import { charactersScreen, AUTO_ADVANCE_FRAMES } from '../../src/screens/characters';
import { stageScreen, START_DELAY_FRAMES } from '../../src/screens/stage';
import { settingsScreen, namesScreen, remapScreen } from '../../src/screens/settings-screen';
import { COLORS } from '../../src/screens/ui';

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
  it('B de qualquer dispositivo volta para regras mesmo com os controles dos humanos desconectados', () => {
    const { app } = mkApp();
    app.settings.setup.slots = ['human', 'human', 'off', 'off', 'off'];
    app.settings.devices = ['gp2', 'gp3', 'gp0', 'gp1', 'none'];
    app.go(charactersScreen(app));
    press(app, BTN.B); // nenhum slot: um dispositivo não atribuído a ninguém aperta B
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
  it('sair pela pausa pede confirmação; volta para a seleção de fase só depois de A; a animação congela na pausa', () => {
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
    expect(app.screen.id).toBe('battle');
    const s = (app.screen as unknown as { session: Session }).session;
    expect(s.confirmQuit).toBe(true);
    press(app, BTN.A, 0);
    expect(app.screen.id).toBe('stage');
  });
  it('formação toda CPU: pausa e confirma a saída com um dispositivo sem jogador atribuído', () => {
    const { app } = mkApp();
    app.settings.setup.slots = ['cpu', 'cpu', 'off', 'off', 'off'];
    const scr = stageScreen(app);
    app.go(scr);
    press(app, BTN.A);
    idle(app, START_DELAY_FRAMES);
    expect(app.screen.id).toBe('battle');
    const s = (app.screen as unknown as { session: Session }).session;
    expect(s.anyControl).toBe(true);
    press(app, BTN.START);
    const f = app.frame;
    idle(app, 5);
    expect(app.frame).toBe(f);
    expect(s.paused).toBe(true);
    press(app, BTN.B);
    expect(s.confirmQuit).toBe(true);
    press(app, BTN.A);
    expect(app.screen.id).toBe('stage');
  });
  it('formação com humanos: partida vai à vitória e volta para a fase depois de START', () => {
    const { app } = mkApp();
    app.settings.setup.slots = ['human', 'human', 'off', 'off', 'off'];
    app.settings.setup.rules.matches = 1;
    app.go(stageScreen(app));
    press(app, BTN.A);
    idle(app, START_DELAY_FRAMES);
    expect(app.screen.id).toBe('battle');
    const s = (app.screen as unknown as { session: Session }).session;
    idle(app, INTRO_FRAMES + 1);
    s.round.players.forEach((p, i) => { if (i !== 0) p.alive = false; });
    idle(app, 1);
    expect(s.phase).toBe('roundOver');
    idle(app, ROUND_OVER_FRAMES);
    expect(s.phase).toBe('scoreboard');
    idle(app, SCOREBOARD_FRAMES);
    expect(s.phase).toBe('victory');
    idle(app, SKIP_AFTER + 1);
    press(app, BTN.START, 0);
    expect(app.screen.id).toBe('stage');
  });
  it('formação inválida na fase: A/START voltam para jogadores em vez de começar', () => {
    const { app } = mkApp();
    app.settings.setup.slots = ['human', 'off', 'off', 'off', 'off'];
    app.go(stageScreen(app));
    press(app, BTN.A);
    expect(app.screen.id).toBe('players');
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
  it('dispositivo atribuído a mais de um jogador aparece em vermelho', () => {
    const { app } = mkApp();
    app.settings.devices = ['kb0', 'kb0', 'gp0', 'gp1', 'none'];
    const scr = settingsScreen(app);
    const calls: { text: string; color: string }[] = [];
    const bank = { text: (s: string, color: string) => { calls.push({ text: s, color }); return { width: s.length * 6, height: 10 }; } };
    const ctx = { fillStyle: '', fillRect() {}, drawImage() {} };
    scr.draw(ctx as unknown as CanvasRenderingContext2D, bank as unknown as import('../../src/render/sprite-bank').SpriteBank, 0);
    const duped = calls.filter(c => c.text === 'TECLADO 1');
    expect(duped.length).toBeGreaterThan(0);
    expect(duped.every(c => c.color === COLORS.error)).toBe(true);
    const single = calls.filter(c => c.text === 'CONTROLE 1');
    expect(single.length).toBeGreaterThan(0);
    expect(single.every(c => c.color === COLORS.value)).toBe(true);
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

describe('remap não se dispara de novo com a tecla ainda segurada', () => {
  class FakeTarget {
    handlers = new Map<string, Set<EventListener>>();
    addEventListener(t: string, fn: EventListener) { if (!this.handlers.has(t)) this.handlers.set(t, new Set()); this.handlers.get(t)!.add(fn); }
    removeEventListener(t: string, fn: EventListener) { this.handlers.get(t)?.delete(fn); }
    fire(t: string, e: object = {}) { for (const fn of this.handlers.get(t) ?? []) fn(e as Event); }
    key(t: 'keydown' | 'keyup', code: string, extra: object = {}) {
      const ev = { code, prevented: false, preventDefault() { ev.prevented = true; }, ...extra };
      this.fire(t, ev);
      return ev;
    }
  }

  function setup() {
    const settings = defaultSettings();
    const t = new FakeTarget();
    const input = new InputManager(t, settings.keymaps, () => []);
    const app = new App(settings, { save: () => {}, setKeymaps: m => input.setKeymaps(m), seed: () => 1 });
    let prev: DeviceState = emptyDevices();
    const drive = () => {
      const cur = input.poll();
      app.update(buildInput(cur, prev, app.settings.devices, input.takeLastKey()));
      prev = cur;
    };
    const tapKey = (code: string) => { t.key('keydown', code); drive(); t.key('keyup', code); drive(); };
    return { app, t, drive, tapKey };
  }

  it('remapear B para uma tecla segurada não sai do remap nem recaptura', () => {
    const { app, t, drive, tapKey } = setup();
    const scr = remapScreen(app, 0);
    app.go(scr);
    // KEY_FIELDS = up, down, left, right, a, b, y, start; 'b' está no índice 5.
    for (let i = 0; i < 5; i++) tapKey('KeyS'); // baixo (kb0) 5x
    tapKey('KeyJ'); // A (kb0): entra em captura no campo 'b'
    expect(scr.capturing).toBe('b');
    t.key('keydown', 'KeyX'); // segura a tecla nova sem soltar
    drive(); // tick da captura: grava b = KeyX, entra em modo "ignorar até soltar"
    expect(scr.capturing).toBeNull();
    expect(app.settings.keymaps[0].b).toBe('KeyX');
    for (let i = 0; i < 5; i++) drive(); // KeyX ainda segurada, agora mapeada para B
    expect(app.screen.id).toBe('remap');
    expect(scr.capturing).toBeNull();
    t.key('keyup', 'KeyX');
    drive();
  });

  it('remapear A para a mesma tecla não reentra em captura imediatamente', () => {
    const { app, t, drive, tapKey } = setup();
    const scr = remapScreen(app, 0);
    app.go(scr);
    for (let i = 0; i < 5; i++) tapKey('KeyS'); // até 'b'
    tapKey('KeyJ');
    t.key('keydown', 'KeyX');
    drive();
    t.key('keyup', 'KeyX');
    drive(); // solta: sai do modo "ignorar"
    tapKey('KeyW'); // sobe uma linha: volta para 'a'
    tapKey('KeyJ'); // captura 'a'
    expect(scr.capturing).toBe('a');
    t.key('keydown', 'KeyX'); // mesma tecla já usada em 'b'
    drive(); // grava a = KeyX também
    expect(scr.capturing).toBeNull();
    expect(app.settings.keymaps[0].a).toBe('KeyX');
    for (let i = 0; i < 5; i++) drive(); // KeyX segurada mapeia A e B ao mesmo tempo
    expect(scr.capturing).toBeNull();
    expect(app.screen.id).toBe('remap');
    t.key('keyup', 'KeyX');
    drive();
  });
});
