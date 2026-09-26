import { charactersScreen } from '../../src/screens/characters';
import { teamsScreen } from '../../src/screens/teams';
import { BTN } from '../../src/game/core-api';
import { mkApp, press, hold, settle } from './helpers';

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
  it('B de qualquer controle volta aos personagens', () => {
    const { app } = teamApp();
    press(app, BTN.B); settle(app);
    expect(app.screen.id).toBe('characters');
  });
});
