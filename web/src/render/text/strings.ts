import type { TextStyleId } from './types';
import { PAD_NAMES } from '../../input/input';

export const STAGE_NAMES_PT = ['O Clássico', 'Rápido e Devagar', 'Bombardeio Orbital', 'Não Me Empurre', 'Escola de Choques',
  'Piso Traiçoeiro', 'Esconde-Explode', 'Caça-Níquel', 'Gangorra', 'Alfaiataria'] as const;

export const RACER_PRIZE_NAMES = {
  'bomb+1': 'BOMBA +1', pierce: 'BOMBA PERFURANTE', 'fire+1': 'FOGO +1', fullFire: 'FOGO TOTAL', 'speed+1': 'PATINS +1',
  'remote+glove': 'REMOTA + LUVA', glove: 'LUVA', kick: 'CHUTE', none: 'NADA', passBomb: 'ATRAVESSA BOMBA',
  passSoft: 'ATRAVESSA BLOCO', 'speed-1': 'PATINS -1', punch: 'SOCO', heart: 'CORAÇÃO', p: 'GOLPE P',
} as const;

const DEVICE_NAMES = { kb: 'TECLADO', gp0: 'CONTROLE 1', gp1: 'CONTROLE 2', gp2: 'CONTROLE 3', gp3: 'CONTROLE 4', none: 'NENHUM' } as const;
const ACTIONS = { up: 'CIMA', down: 'BAIXO', left: 'ESQUERDA', right: 'DIREITA', a: 'A (BOMBA)', b: 'B (DETONAR)', x: 'X (PARA CHUTE)', y: 'Y (SOCO)', l: 'L', r: 'R', start: 'START', select: 'SELECT' } as const;

export const S = {
  title: { normal: 'JOGO NORMAL', battle: 'JOGO DE BATALHA', options: 'OPÇÕES', pressStart: 'APERTE START!' },
  vs: { title: 'Escolha o modo VS!', royale: 'Battle Royale', champ: 'Campeonato', mania: 'Bombermania', ffa: 'Todos contra Todos', team: 'Em Equipes' },
  players: { title: 'Defina os jogadores!', row: ['1º Jogador', '2º Jogador', '3º Jogador', '4º Jogador', '5º Jogador'], human: 'Humano', cpu: 'CPU', off: 'Nenhum' },
  rules: {
    title: 'Configure as regras!',
    labels: ['Nível da CPU', 'Coroas', 'Tempo', 'Morte Súbita', 'Bomber Vingador', 'Corrida Bônus'],
    cpu: ['Fraco', 'Normal', 'Forte'], crowns: ['1', '2', '3', '4', '5'], time: ['1:00', '2:00', '3:00', '5:00', '∞'], no: 'Não', yes: 'Sim',
  },
  chars: {
    title: 'Escolha um personagem!', tags: ['1P', '2P', '3P', '4P', '5P'], allReady: 'TUDO PRONTO', help: 'A: ESCOLHER   B: VOLTAR',
  },
  teams: { title: 'Escolha as equipes!', vs: 'VS', help: 'ESQ/DIR: LADO  A: OK  B: VOLTAR' },
  stage: { title: 'Escolha a fase!', stage: (n: number) => `Fase ${n}`, names: STAGE_NAMES_PT, battle: 'BATALHA!' },
  battle: { pause: 'PAUSA!', hurry: 'RÁPIDO!!', timeUp: 'TEMPO ESGOTADO!', timeUpShort: 'TEMPO!', disconnected: (n: number) => `CONTROLE ${n} DESCONECTADO` },
  score: { title: 'PLACAR', tags: ['1P', '2P', '3P', '4P', '5P'] },
  draw: { title: 'EMPATE' },
  victory: { title: 'VITÓRIA!' },
  racer: { press: 'APERTE B!', prize: 'PRÊMIO', names: RACER_PRIZE_NAMES },
  options: {
    title: 'Opções', controlsTitle: 'Controles', gameplayTitle: 'Jogabilidade',
    controlsMenu: 'CONTROLES', gameplayMenu: 'JOGABILIDADE', player: (n: number) => `JOGADOR ${n}`, devices: DEVICE_NAMES,
    controls: (n: number) => `CONTROLES DO JOGADOR ${n}`, device: 'DISPOSITIVO', all: 'CONFIGURAR TODOS',
    playerHelp: 'A: CONFIGURAR  ESQ/DIR: TROCA', pressAny: 'TECLA OU BOTÃO? (ESC CANCELA)',
    spawns: 'SPAWNS ALEATÓRIOS', escape: 'SOLTAR DA LUVA', slot: 'SLOT', slotEmpty: 'VAZIO', slotSave: 'SALVAR NO SLOT',
    slotLoad: 'CARREGAR DO SLOT', slotSaved: 'SALVO', slotLoaded: 'CARREGADO', throwStun: 'PLAYER EM PLAYER: STUN', sleep: 'SONECA (SEG)', fx: 'EFEITOS VISUAIS', music: 'VOLUME DA MÚSICA', sfx: 'VOLUME DOS EFEITOS',
    rom: 'ROM', romOk: 'CARREGADA ✓', romNo: 'NÃO CARREGADA', load: 'CARREGAR ROM...', forget: 'ESQUECER ROM',
    forgetAsk: 'ESQUECER A ROM? A: SIM  B: NÃO', reset: 'RESTAURAR PADRÃO', back: 'VOLTAR', no: 'NÃO', yes: 'SIM',
    pressKey: 'NOVA TECLA? (ESC CANCELA)', pressPad: 'NOVO BOTÃO? (ESC CANCELA)', actions: ACTIONS,
    button: (n: number) => `BOTÃO ${n}`,
  },
  password: {
    title: 'Senha', menu: 'SENHA', active: 'LIGADA', digit: (n: number) => `NÚMERO ${n}`, ok: 'CONFIRMAR',
    help: 'ESQ/DIR: MUDA O NÚMERO', wrong: 'SENHA ERRADA', on: 'TODAS AS MONTARIAS: SIM', off: 'TODAS AS MONTARIAS: NÃO',
  },
} as const;

type Use = { style: TextStyleId; text: string };
const as = (style: TextStyleId, list: readonly string[]): Use[] => list.map(text => ({ style, text }));
const uniq = (u: Use[]): Use[] => [...new Map(u.map(x => [`${x.style}|${x.text}`, x])).values()];

/** Todo par (estilo, texto) que o jogo desenha. Base dos testes de cobertura (T4, T16–T18, T22). */
export const STRING_USES: readonly Use[] = uniq([
  ...as('titleMenu', [S.title.normal, S.title.battle, S.title.options, S.title.pressStart]),
  ...as('menuTitle', [S.vs.title, S.players.title, S.rules.title, S.chars.title, S.teams.title, S.options.title, S.options.controlsTitle, S.options.gameplayTitle, S.password.title]),
  ...as('menuItem', [S.vs.royale, S.vs.champ, S.vs.mania, S.vs.ffa, S.vs.team, ...S.players.row, S.players.human, S.players.cpu,
    S.players.off, ...S.rules.labels, ...S.rules.cpu, ...S.rules.crowns, ...S.rules.time, S.rules.no, S.rules.yes, S.teams.vs]),
  ...as('spriteBlue', [S.stage.title, ...Array.from({ length: 10 }, (_, i) => S.stage.stage(i + 1)), ...STAGE_NAMES_PT]),
  ...as('banner', [S.battle.pause, S.battle.hurry, S.battle.timeUp, S.battle.timeUpShort, S.racer.press]),
  ...as('ascii8', [
    ...[1, 2, 3, 4].map(S.battle.disconnected), ...S.score.tags, ...S.chars.tags, S.chars.allReady, S.chars.help, S.teams.help, S.racer.prize, ...Object.values(RACER_PRIZE_NAMES),
    ...[1, 2, 3, 4, 5].map(S.options.player), ...Object.values(DEVICE_NAMES), ...[1, 2, 3, 4, 5].map(S.options.controls),
    S.options.device, S.options.all, S.options.playerHelp, S.options.pressAny, ...PAD_NAMES, '---', S.options.controlsMenu, S.options.gameplayMenu, S.options.slot, S.options.slotEmpty, S.options.slotSave,
    S.options.slotLoad, S.options.slotSaved, S.options.slotLoaded, S.options.spawns, S.options.escape, S.options.throwStun, S.options.sleep, S.options.music, S.options.sfx, S.options.rom, S.options.romOk,
    S.options.romNo, S.options.load, S.options.forget, S.options.forgetAsk, S.options.reset, S.options.back, S.options.no,
    S.options.yes, S.options.pressKey, S.options.pressPad, ...Object.values(ACTIONS),
    ...Array.from({ length: 32 }, (_, i) => S.options.button(i)),
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789 -+.:!?', 'ESPAÇO', '0 1 2 3 4 5 6 7 8 9 10',
    S.password.menu, S.password.active, ...[1, 2, 3, 4].map(S.password.digit), S.password.ok, S.password.help,
    S.password.wrong, S.password.on, S.password.off,
  ]),
  ...as('bigBattle', [S.stage.battle]),
  ...as('bigScore', [S.score.title]),
  ...as('bigVictory', [S.victory.title]),
  ...as('bigDraw', [S.draw.title]),
]);
