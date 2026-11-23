import { battleScreen } from '../../src/screens/battle';
import { drawBattleOverlays } from '../../src/render/draw-screens';
import { hdActive, hdBegin, hdText, hdTexts } from '../../src/render/hd-menu';
import { createMatchSession, resetCarry } from '../../src/game/match-session';
import { parseConfig } from '../../src/game/config';
import { BTN } from '../../src/game/core-api';
import { idleInput } from '../../src/input/input';
import { MUSIC, BANK } from '../../src/app/audio';
import { mkApp, press, tap, idle, settle } from './helpers';
import type { App } from '../../src/app/app';

beforeEach(() => resetCarry());

function start(q = '?players=3&humans=1&stage=1') {
  const env = mkApp();
  const ms = createMatchSession(parseConfig(q));
  const b = battleScreen(env.app, ms);
  env.app.go(b);
  while (b.round.phase === 'intro') env.app.update(idleInput());
  return { ...env, ms, b };
}
/** Desce até o item `id` do menu da pausa. */
function goTo(app: App, b: ReturnType<typeof battleScreen>, id: string): void {
  for (let k = 0; k < 10 && b.pauseMenu!.items[b.pauseMenu!.cursor] !== id; k++) press(app, BTN.DOWN);
  expect(b.pauseMenu!.items[b.pauseMenu!.cursor]).toBe(id);
}

describe('menu da pausa', () => {
  it('START abre o menu com os 10 itens; START de novo fecha e o jogo segue do mesmo tick', () => {
    const { app, b } = start();
    press(app, BTN.START);
    expect(b.pauseMenu).toEqual({ items: ['resume', 'players', 'rules', 'chars', 'stage', 'controls', 'gameplay', 'options', 'draw', 'quit'], cursor: 0 });
    const tick = b.round.tick;
    idle(app, 20);
    expect(b.round.tick).toBe(tick);
    tap(app, BTN.START);
    expect([b.paused, b.pauseMenu]).toEqual([false, null]);
    idle(app, 1);
    expect(b.round.tick).toBe(tick + 1);
  });
  it('CONTINUAR e B também fecham', () => {
    const { app, b } = start();
    press(app, BTN.START); press(app, BTN.A);
    expect(b.paused).toBe(false);
    press(app, BTN.START); press(app, BTN.B);
    expect(b.paused).toBe(false);
  });
  it('↑/↓ andam no menu com volta; o cursor reabre no CONTINUAR', () => {
    const { app, b } = start();
    press(app, BTN.START); press(app, BTN.UP);
    expect(b.pauseMenu!.cursor).toBe(9);
    press(app, BTN.START); press(app, BTN.START);
    expect(b.pauseMenu!.cursor).toBe(0);
  });
  it('CONTROLES abre as Opções > Controles; VOLTAR devolve a MESMA rodada pausada, com o banco e a música da batalha', () => {
    const { app, b, sink } = start();
    app.audio.bank(BANK.battle); app.audio.music(MUSIC.battle);
    const round = b.round, tick = round.tick;
    press(app, BTN.START); goTo(app, b, 'controls'); press(app, BTN.A);
    settle(app);
    expect([app.screen.id, (app.screen as { page?: string }).page]).toEqual(['options', 'controls']);
    sink.clear();
    press(app, BTN.B);
    settle(app);
    expect(app.screen).toBe(b);
    expect([b.round, b.round.tick, b.paused, b.pauseMenu!.cursor]).toEqual([round, tick, true, 5]);
    expect(sink.of('bank').map(c => c.id)).toEqual([BANK.battle]);
    expect(sink.of('music').map(c => c.id)).toEqual([MUSIC.battle]);
  });
  it('JOGABILIDADE vale na hora: a regra muda na rodada em andamento', () => {
    const { app, b, ms } = start();
    press(app, BTN.START); goTo(app, b, 'gameplay'); press(app, BTN.A);
    settle(app);
    expect((app.screen as { page?: string }).page).toBe('gameplay');
    app.settings.options.gloveEscape = 3; app.settings.options.throwStun = true; app.settings.options.sleepSec = 5;
    press(app, BTN.B); settle(app);
    expect(app.screen).toBe(b);
    for (const r of [b.round.rules, ms.match.rules, ms.cfg.rules]) {
      expect([r.gloveEscape, r.throwStun, r.sleepTicks]).toEqual([3, true, 300]);
    }
  });
  it('CONTROLES vale na hora: dispositivos e tecla do P da partida acompanham as Opções', () => {
    const { app, b, ms } = start();
    press(app, BTN.START); goTo(app, b, 'controls'); press(app, BTN.A); settle(app);
    app.settings.devices[0] = 'gp3';
    press(app, BTN.B); settle(app);
    expect(ms.cfg.devices[0]).toBe('gp3');
    expect(b.round.rules.powerKey?.[0]).toBe(true);   // padrão do controle: P no RB
  });
  it('TROCAR MAPA: a fase escolhida entra na próxima rodada; a atual continua e o aviso aparece', () => {
    const { app, b, ms } = start();
    press(app, BTN.START); goTo(app, b, 'stage'); press(app, BTN.A); settle(app);
    expect(app.screen.id).toBe('stage');
    app.settings.setup.stage = 3;
    press(app, BTN.A); settle(app);
    expect(app.screen).toBe(b);
    expect([ms.nextStage, ms.cfg.stage, b.paused]).toEqual([3, 1, true]);
    // próxima rodada: troca a fase e zera o pedido
    const next = battleScreen(app, ms);
    expect([ms.cfg.stage, ms.nextStage, next.round.stage]).toEqual([3, null, ms.match.stage]);
  });
  it('TROCAR MAPA: B volta sem trocar', () => {
    const { app, b, ms } = start();
    press(app, BTN.START); goTo(app, b, 'stage'); press(app, BTN.A); settle(app);
    press(app, BTN.B); settle(app);
    expect([app.screen, ms.nextStage]).toEqual([b, null]);
  });
  it('TROCAR PERSONAGEM vale na hora na rodada atual e nas próximas', () => {
    const { app, b, ms } = start('?players=5&humans=2&stage=1');
    const round = b.round;
    press(app, BTN.START); goTo(app, b, 'chars'); press(app, BTN.A); settle(app);
    expect(app.screen.id).toBe('characters');
    press(app, BTN.RIGHT, 0);                        // P1: personagem 0 → 1
    for (let k = 0; k < 10 && app.screen.id === 'characters'; k++) { press(app, BTN.A, 1); press(app, BTN.A, 0); }
    settle(app);
    expect([app.screen, b.round, b.paused]).toEqual([b, round, true]);
    expect([round.players[0].char, ms.cfg.chars[0], ms.match.chars[0]]).toEqual([1, 1, 1]);
    expect(round.players[1].char).toBe(1);           // os outros continuam com o que tinham
  });
  it('TROCAR PERSONAGEM: só os jogadores da partida escolhem (não os das Opções)', () => {
    const { app, b } = start('?players=2&humans=2&stage=1');
    press(app, BTN.START); goTo(app, b, 'chars'); press(app, BTN.A); settle(app);
    expect((app.screen as unknown as { confirmed: boolean[] }).confirmed).toEqual([false, false, true, true, true]);
  });
  it('TROCAR PERSONAGEM: B volta sem trocar nada', () => {
    const { app, b, ms } = start('?players=5&humans=2&stage=1');
    press(app, BTN.START); goTo(app, b, 'chars'); press(app, BTN.A); settle(app);
    press(app, BTN.RIGHT, 0); press(app, BTN.B, 0); settle(app);
    expect([app.screen, b.round.players[0].char, ms.cfg.chars[0], app.settings.setup.chars[0]]).toEqual([b, 0, 0, 0]);
  });
  it('ENCERRAR RODADA: todo mundo morre, a rodada acaba em empate e a próxima começa com o placar intacto', () => {
    const { app, b, ms } = start();
    const crowns = [...ms.match.crowns];
    press(app, BTN.START); goTo(app, b, 'draw'); press(app, BTN.A);
    expect(b.paused).toBe(false);
    expect(b.round.players.filter(p => p.present).every(p => p.state === 'dying')).toBe(true);
    for (let k = 0; k < 600 && b.round.phase !== 'over'; k++) idle(app, 1);
    expect(b.round.result).toEqual({ kind: 'draw', winner: null, reason: 'dead' });
    settle(app);
    expect(app.screen.id).toBe('draw');
    expect([...ms.match.crowns]).toEqual(crowns);
  });
  it('JOGADORES: Humano → CPU vale na hora (a CPU assume o boneco) e fica no menu de jogadores', () => {
    const { app, b, ms } = start('?players=3&humans=2&stage=1');
    press(app, BTN.START); goTo(app, b, 'players'); press(app, BTN.A); settle(app);
    expect(app.screen.id).toBe('players');
    press(app, BTN.DOWN); press(app, BTN.LEFT);      // P2: Humano → CPU
    press(app, BTN.A); settle(app);
    expect([app.screen, b.paused, ms.cfg.humans.slice(0, 3), ms.nextRules]).toEqual([b, true, [true, false, false], null]);
    expect(app.settings.setup.slots).toEqual(['human', 'cpu', 'cpu', 'off', 'off']);
  });
  it('JOGADORES: CPU → Humano vale na hora; quem entra ou sai da partida, só da próxima rodada', () => {
    const { app, b, ms } = start('?players=3&humans=1&stage=1');
    press(app, BTN.START); goTo(app, b, 'players'); press(app, BTN.A); settle(app);
    press(app, BTN.DOWN); press(app, BTN.RIGHT);     // P2: CPU → Humano
    press(app, BTN.DOWN); press(app, BTN.LEFT);      // P3: CPU → Nenhum
    press(app, BTN.DOWN); press(app, BTN.RIGHT);     // P4: Nenhum → CPU
    press(app, BTN.A); settle(app);
    expect(app.screen).toBe(b);
    expect(ms.cfg.humans.slice(0, 4)).toEqual([true, true, false, false]);
    expect(b.round.players.map(p => p.present)).toEqual([true, true, true, false, false]);   // a rodada atual não muda
    expect(ms.nextRules).toEqual({ active: [true, true, false, true, false] });
    const next = battleScreen(app, ms);
    expect(next.round.players.map(p => p.present)).toEqual([true, true, false, true, false]);
    expect([ms.nextRules, ms.cfg.rules.active]).toEqual([null, [true, true, false, true, false]]);
  });
  it('JOGADORES: menos de 2 na partida é recusado; B volta sem mudar nada', () => {
    const { app, b, ms } = start('?players=2&humans=1&stage=1');
    press(app, BTN.START); goTo(app, b, 'players'); press(app, BTN.A); settle(app);
    press(app, BTN.DOWN); press(app, BTN.LEFT); press(app, BTN.LEFT);   // P2: CPU → Nenhum
    press(app, BTN.A); settle(app);
    expect(app.screen.id).toBe('players');
    press(app, BTN.B); settle(app);
    expect([app.screen, ms.nextRules, ms.cfg.humans.slice(0, 2)]).toEqual([b, null, [true, false]]);
  });
  it('REGRAS: nível da CPU e coroas na hora; tempo na próxima rodada', () => {
    const { app, b, ms } = start('?players=3&humans=1&stage=1&level=1&matches=3&time=2');
    press(app, BTN.START); goTo(app, b, 'rules'); press(app, BTN.A); settle(app);
    expect(app.screen.id).toBe('rules');
    press(app, BTN.RIGHT);                           // CPU: normal → forte
    press(app, BTN.DOWN); press(app, BTN.LEFT);      // coroas 3 → 2
    press(app, BTN.DOWN); press(app, BTN.RIGHT);     // tempo 3:00 → 5:00
    press(app, BTN.A); settle(app);
    expect(app.screen).toBe(b);
    for (const r of [ms.cfg.rules, ms.match.rules, b.round.rules]) expect([r.cpuLevel, r.matches]).toEqual([2, 2]);
    expect([ms.cfg.rules.timeIdx, ms.nextRules]).toEqual([2, { timeIdx: 3 }]);
    battleScreen(app, ms);
    expect([ms.cfg.rules.timeIdx, ms.nextRules]).toEqual([3, null]);
  });
  it('REGRAS: B volta sem mudar a partida nem o menu de regras', () => {
    const { app, b, ms } = start('?players=3&humans=1&stage=1&level=1');
    const before = { ...app.settings.setup.rules };
    press(app, BTN.START); goTo(app, b, 'rules'); press(app, BTN.A); settle(app);
    press(app, BTN.RIGHT); press(app, BTN.B); settle(app);
    expect([app.screen, ms.cfg.rules.cpuLevel, ms.nextRules, app.settings.setup.rules]).toEqual([b, 1, null, before]);
  });
  it('OPÇÕES: abre a página principal; o submenu volta para ela e VOLTAR devolve a rodada pausada', () => {
    const { app, b } = start();
    press(app, BTN.START); goTo(app, b, 'options'); press(app, BTN.A); settle(app);
    expect([app.screen.id, (app.screen as { page?: string }).page]).toEqual(['options', 'main']);
    press(app, BTN.A); settle(app);                  // CONTROLES
    expect((app.screen as { page?: string }).page).toBe('controls');
    press(app, BTN.B); settle(app);
    expect((app.screen as { page?: string }).page).toBe('main');
    press(app, BTN.B); settle(app);
    expect([app.screen, b.paused]).toEqual([b, true]);
  });
  it('SAIR DA PARTIDA volta para a escolha de fase', () => {
    const { app, b } = start();
    press(app, BTN.START); goTo(app, b, 'quit'); press(app, BTN.A);
    settle(app);
    expect(app.screen.id).toBe('stage');
  });
});

describe('desenho do menu da pausa', () => {
  it('no visual HD dos menus, por cima da partida: PAUSA!, os itens, a mão no item e o mapa da próxima rodada', () => {
    hdBegin();
    const ctx = { drawImage: () => {}, fillRect: () => {}, fillStyle: '' } as never;
    const bank = { text: () => ({ width: 1, height: 1 }) } as never;
    drawBattleOverlays(ctx, bank, { paused: true, disconnected: null, hurry: null, timeUp: null,
      pauseMenu: { items: ['Continuar', 'Sair da partida'], cursor: 1, note: 'GANGORRA' } });
    expect(hdTexts().map(t => t.text)).toEqual(['Jogo pausado!', 'Continuar', 'Sair da partida', 'MAPA DA PRÓXIMA RODADA:', 'GANGORRA']);
    expect(hdTexts().map(t => t.tone)).toEqual(['default', 'white', 'yellow', 'white', 'yellow']);
    expect(hdActive()).toBe(true);
    // depois do menu, textos de outras camadas (aviso do clipe) não entram no HD
    expect(hdText('ascii8', 'CLIPE SALVO', 0, 0)).toBeNull();
  });
  it('sem o menu (desconexão no online etc.) segue o PAUSA! da ROM, fora do HD', () => {
    hdBegin();
    const ctx = { drawImage: () => {}, fillRect: () => {}, fillStyle: '' } as never;
    const bank = { text: () => ({ width: 1, height: 1 }) } as never;
    drawBattleOverlays(ctx, bank, { paused: true, disconnected: null, hurry: null, timeUp: null });
    expect([hdActive(), hdTexts().length]).toEqual([false, 0]);
  });
});
