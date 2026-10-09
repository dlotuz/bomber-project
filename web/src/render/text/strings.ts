import type { TextStyleId } from './types';
import { PAD_NAMES } from '../../input/input';

export const STAGE_NAMES_PT = ['O Clássico', 'Rápido e Devagar', 'Bombardeio Orbital', 'Não Me Empurre', 'Escola de Choques',
  'Piso Traiçoeiro', 'Esconde-Explode', 'Caça-Níquel', 'Gangorra', 'Alfaiataria',
  // 11 em diante: cópias com outra paleta (game/stages.ts)
  'O Clássico Noturno', 'O Clássico Gelado', 'O Clássico em Brasa'] as const;

export const RACER_PRIZE_NAMES = {
  'bomb+1': 'BOMBA +1', pierce: 'BOMBA PERFURANTE', 'fire+1': 'FOGO +1', fullFire: 'FOGO TOTAL', 'speed+1': 'PATINS +1',
  'remote+glove': 'REMOTA + LUVA', glove: 'LUVA', kick: 'CHUTE', none: 'NADA', passBomb: 'ATRAVESSA BOMBA',
  passSoft: 'ATRAVESSA BLOCO', 'speed-1': 'PATINS -1', punch: 'SOCO', heart: 'CORAÇÃO', p: 'GOLPE P',
} as const;

const DEVICE_NAMES = { kb: 'TECLADO', gp0: 'CONTROLE 1', gp1: 'CONTROLE 2', gp2: 'CONTROLE 3', gp3: 'CONTROLE 4', none: 'NENHUM' } as const;
const ACTIONS = { up: 'CIMA', down: 'BAIXO', left: 'ESQUERDA', right: 'DIREITA', a: 'A (BOMBA)', b: 'B (DANCINHA)', x: 'X (PARA CHUTE)', y: 'Y (SOCO)', l: 'L', r: 'R', start: 'START', select: 'SELECT', power: 'PODER (P)' } as const;

export const S = {
  title: { normal: 'JOGO NORMAL', battle: 'JOGO DE BATALHA', options: 'OPÇÕES', pressStart: 'APERTE START!' },
  vs: { title: 'Escolha o modo VS!', royale: 'Battle Royale', champ: 'Campeonato', mania: 'Bombermania', ffa: 'Todos contra Todos', team: 'Em Equipes' },
  players: { title: 'Defina os jogadores!', row: ['1º Jogador', '2º Jogador', '3º Jogador', '4º Jogador', '5º Jogador'], human: 'Humano', cpu: 'CPU', off: 'Nenhum' },
  rules: {
    title: 'Configure as regras!',
    labels: ['Nível da CPU', 'Coroas', 'Tempo', 'Morte Súbita', 'Bomber Vingador', 'Corrida Bônus'],
    // atalhos para os submenus das Opções, sem voltar ao título
    controls: 'Controles', gameplay: 'Jogabilidade',
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
    slotLoad: 'CARREGAR DO SLOT', slotSaved: 'SALVO', slotLoaded: 'CARREGADO', devSlot: 'DEV CONTROLES', slotFixed: 'FIXO',
    allMounts: 'MONTARIAS EXTRAS', throwStun: 'PLAYER EM PLAYER: STUN', sleep: 'SONECA (SEG)', fx: 'EFEITOS VISUAIS', screen: 'TELA', screenHd: 'HD', screenClassic: 'CLÁSSICA', smooth: 'FILTRO SUAVE', music: 'VOLUME DA MÚSICA', sfx: 'VOLUME DOS EFEITOS',
    rom: 'ROM', romOk: 'CARREGADA ✓', romNo: 'NÃO CARREGADA', load: 'CARREGAR ROM...', forget: 'ESQUECER ROM',
    forgetAsk: 'ESQUECER A ROM? A: SIM  B: NÃO', reset: 'RESTAURAR PADRÃO', back: 'VOLTAR', no: 'NÃO', yes: 'SIM',
    powerHelp: 'SEM TECLA: Y FAZ P E SOCO  ESQ/DIR: APAGA',
    pressKey: 'NOVA TECLA? (ESC CANCELA)', pressPad: 'NOVO BOTÃO? (ESC CANCELA)', actions: ACTIONS,
    button: (n: number) => `BOTÃO ${n}`,
  },
  online: {
    menu: 'SALA ONLINE', title: 'Sala online',
    name: 'NOME', create: 'CRIAR SALA', code: 'CÓDIGO', join: 'ENTRAR NA SALA', back: 'VOLTAR', empty: '---',
    you: 'VOCÊ', cpu: 'CPU', off: 'NENHUM', stage: 'FASE', crowns: 'COROAS', time: 'TEMPO', level: 'FORÇA DA CPU',
    sudden: 'MORTE SÚBITA', bad: 'BOMBER VINGADOR', invite: 'CONVIDAR', copy: 'COPIAR LINK', copied: 'LINK COPIADO!',
    controls: 'CONTROLE ONLINE', start: 'INICIAR PARTIDA', waitHost: 'AGUARDANDO O ANFITRIÃO', playing: 'PARTIDA EM ANDAMENTO', leave: 'SAIR DA SALA',
    connecting: 'CONECTANDO...', typing: 'DIGITE E APERTE ENTER (ESC CANCELA)', needName: 'DIGITE UM NOME PRIMEIRO',
    needCode: 'DIGITE O CÓDIGO DA SALA', help: 'ESQ/DIR: MUDA   A: OK', guestHelp: 'ESQ/DIR: SEU PERSONAGEM',
    lost: 'A CONEXÃO COM A SALA CAIU', noServer: 'SEM SERVIDOR DA SALA (NPM RUN SALA)', desync: 'DESSINCRONIZOU! TERMINE E RECOMECE',
    waiting: (names: string) => `AGUARDANDO ${names.toUpperCase()}...`, slot: (s: number) => `${s + 1}P`,
    players: 'JOGADORES', rules: 'REGRAS', roomCode: 'CÓDIGO DA SALA', copyHelp: 'A: COPIA O LINK DE CONVITE',
    levelShort: 'CPU', badShort: 'VINGADOR',
    ready: 'PRONTO', notReadyTag: '...', readyBtn: 'ESTOU PRONTO', readyOn: 'PRONTO! (A: CANCELA)',
    waitReady: (names: string) => `FALTA FICAR PRONTO: ${names.toUpperCase()}`,
  },
} as const;

type Use = { style: TextStyleId; text: string };
const as = (style: TextStyleId, list: readonly string[]): Use[] => list.map(text => ({ style, text }));
const uniq = (u: Use[]): Use[] => [...new Map(u.map(x => [`${x.style}|${x.text}`, x])).values()];

/** Todo par (estilo, texto) que o jogo desenha. Base dos testes de cobertura (T4, T16–T18, T22). */
export const STRING_USES: readonly Use[] = uniq([
  ...as('titleMenu', [S.title.normal, S.title.battle, S.title.options, S.title.pressStart]),
  ...as('menuTitle', [S.vs.title, S.players.title, S.rules.title, S.chars.title, S.teams.title, S.options.title, S.options.controlsTitle, S.options.gameplayTitle, S.online.title]),
  ...as('menuItem', [S.vs.royale, S.vs.champ, S.vs.mania, S.vs.ffa, S.vs.team, ...S.players.row, S.players.human, S.players.cpu,
    S.players.off, ...S.rules.labels, S.rules.controls, S.rules.gameplay, ...S.rules.cpu, ...S.rules.crowns, ...S.rules.time, S.rules.no, S.rules.yes, S.teams.vs]),
  ...as('spriteBlue', [S.stage.title, ...Array.from({ length: 10 }, (_, i) => S.stage.stage(i + 1)), ...STAGE_NAMES_PT]),
  ...as('banner', [S.battle.pause, S.battle.hurry, S.battle.timeUp, S.battle.timeUpShort, S.racer.press]),
  ...as('ascii8', [
    ...[1, 2, 3, 4].map(S.battle.disconnected), ...S.score.tags, ...S.chars.tags, S.chars.allReady, S.chars.help, S.teams.help, S.racer.prize, ...Object.values(RACER_PRIZE_NAMES),
    ...[1, 2, 3, 4, 5].map(S.options.player), ...Object.values(DEVICE_NAMES), ...[1, 2, 3, 4, 5].map(S.options.controls),
    S.options.device, S.options.all, S.options.playerHelp, S.options.pressAny, ...PAD_NAMES, '---', S.options.controlsMenu, S.options.gameplayMenu, S.options.slot, S.options.slotEmpty, S.options.slotSave,
    S.options.slotLoad, S.options.slotSaved, S.options.slotLoaded, S.options.spawns, S.options.escape, S.options.throwStun, S.options.sleep, S.options.fx, S.options.screen, S.options.screenHd, S.options.screenClassic, S.options.smooth, S.options.music, S.options.sfx, S.options.rom, S.options.romOk,
    S.options.romNo, S.options.load, S.options.forget, S.options.forgetAsk, S.options.reset, S.options.back, S.options.no,
    S.options.yes, S.options.pressKey, S.options.pressPad, ...Object.values(ACTIONS),
    ...Array.from({ length: 32 }, (_, i) => S.options.button(i)),
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789 -+.:!?', 'ESPAÇO', '0 1 2 3 4 5 6 7 8 9 10',
    S.options.devSlot, S.options.slotFixed, S.options.allMounts,
    S.online.name, S.online.create, S.online.code, S.online.join, S.online.back, S.online.empty, S.online.you, S.online.cpu,
    S.online.off, S.online.stage, S.online.crowns, S.online.time, S.online.level, S.online.sudden, S.online.bad,
    S.online.controls, S.online.invite, S.online.copy, S.online.copied, S.online.start, S.online.waitHost, S.online.playing, S.online.leave,
    S.online.connecting, S.online.typing, S.online.needName, S.online.needCode, S.online.help, S.online.guestHelp,
    S.online.players, S.online.rules, S.online.roomCode, S.online.copyHelp, S.online.levelShort, S.online.badShort,
    S.online.lost, S.online.noServer, S.online.desync, S.online.waiting('ANA, BETO'), S.online.ready, S.online.notReadyTag, S.online.readyBtn, S.online.readyOn, S.online.waitReady('ANA, BETO'), ...[0, 1, 2, 3, 4].map(S.online.slot),
  ]),
  ...as('bigBattle', [S.stage.battle]),
  ...as('bigScore', [S.score.title]),
  ...as('bigVictory', [S.victory.title]),
  ...as('bigDraw', [S.draw.title]),
]);
