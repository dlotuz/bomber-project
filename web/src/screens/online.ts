// Online (net/online.ts, server/sala.mjs). Menu inicial: cartão do jogador (nome, aparência, conta), JOGAR COM AMIGOS e
// PARTIDA RÁPIDA.
//  - JOGAR COM AMIGOS: criar sala (nome, senha e as regras já configuradas), entrar pelo código ou escolher numa lista de
//    salas abertas (pede a senha das que têm).
//  - PARTIDA RÁPIDA: entra numa fila e joga com quem também está procurando partida.
// Na sala (visual HD próprio): jogadores com PRONTO, aparência (com o boneco), fase, CONFIGURAÇÕES (regras, num menu à
// parte), controle online e o código. Convidado marca ESTOU PRONTO; o anfitrião só inicia com todos prontos.
// A tela só lê o estado do cliente: se a sala cai, ela volta sozinha para o menu.
import type { App, Screen } from '../app/app';
import type { SlotKind } from '../game/config';
import { BTN } from '../game/core-api';
import { MUSIC, SFX } from '../app/audio';
import { FADE_TO_TITLE } from '../app/fade';
import { S, STAGE_NAMES_PT } from '../render/text/strings';
import { stepVisible, visibleStage } from '../game/stages';
import { CHARACTERS } from '../render/art/bomber';
import { TITLE_X, TITLE_Y, FOOTER_Y } from '../render/screens-rom/options';
import { drawText } from '../render/text/text';
import { romState } from '../app/rom-api';
import { obj, PpuCanvas } from '../render/screens-rom/scene';
import { CHARSEL_PICK_STANDEE, charselSprites, charselStandeeSrc } from '../render/screens-rom/charsel';
import type { Tone } from '../render/text/types';
import type { SpriteBank } from '../render/sprite-bank';
import { hdMenu, hdPanel } from '../render/hd-menu';
import { PLAYER_COLORS } from './ui';
import { online, type Lobby } from '../net/online';
import { startTextEntry, type TextEntry } from '../net/text-entry';
import { assignKey, DEFAULT_KEYMAPS, DEFAULT_PADMAP, KEY_FIELDS } from '../input/input';
import { defaultOnlineControls } from '../app/settings';
import { FADE_MENU } from '../app/fade';
import { remapTargetScreen } from './remap';
import { Menu, type MenuRow } from './menu';
import { titleScreen } from './title';

const NAME_MAX = 10, CODE_LEN = 4, ROOM_NAME_MAX = 12, PASS_MAX = 8, USER_MAX = 12, ACCOUNT_PASS_MAX = 16;
/** Salas que cabem na lista de JOGAR COM AMIGOS. */
const LIST_MAX = 6;
/** A lista de salas é pedida de novo a cada tantos ticks da tela. */
const LIST_EVERY = 90;
/** Tamanhos do texto HD nestas telas (px da base): rótulos grandes e texto pequeno (o padrão estoura as faixas). */
const SIZES = { hand: 0.9, item: 12, small: 7.5 } as const;

interface Row extends MenuRow { label: string; value?: () => string; dim?: () => boolean }
interface Rect { x: number; y: number; w: number; h: number }
/** Fase e regras: o que se configura ao criar a sala e depois, em CONFIGURAÇÕES. */
interface Cfg { stage: number; rules: Lobby['rules'] }

/** Opções de uma vaga sem jogador (anfitrião): CPU com cada personagem, depois NENHUM. */
const CPU_CHOICES = CHARACTERS.length + 1;
const cpuChoice = (L: Lobby, s: number): number => (L.slots[s] === 'off' ? CHARACTERS.length : L.chars[s]);

const TITLES = {
  home: S.online.title, friends: S.online.titleFriends, create: S.online.titleCreate, password: S.online.titlePassword,
  account: S.online.titleAccount,
} as const;
type View = 'home' | 'friends' | 'create' | 'password' | 'account';
export type OnlineScreen = Screen & { readonly menu: Menu; rowIds(): string[]; value(id: string): string; readonly editing: string | null; readonly view: string };

/** Layout da sala (px da base 256×224). */
const RM = {
  players: { x: 14, y: 26, w: 228, h: 64 },
  look: { x: 14, y: 94, w: 228, h: 36 },
  stage: { x: 14, y: 133, w: 228, h: 13 },
  config: { x: 14, y: 148, w: 228, h: 13 },
  controls: { x: 14, y: 163, w: 228, h: 13 },
  invite: { x: 14, y: 178, w: 228, h: 13 },
  start: { x: 14, y: 193, w: 150, h: 13 },
  leave: { x: 170, y: 193, w: 72, h: 13 },
} as const satisfies Record<string, Rect>;
/** Menu inicial. */
const HOME = {
  card: { x: 14, y: 28, w: 228, h: 62 },
  rows: { name: 36, look: 50, account: 64 } as Record<string, number>,
  friends: { x: 14, y: 98, w: 228, h: 40 }, quick: { x: 14, y: 144, w: 228, h: 40 },
  controls: { x: 14, y: 190, w: 110, h: 13 }, back: { x: 132, y: 190, w: 110, h: 13 },
} as const;

/** Controle da sala online (Settings.online), editado na tela de remapear: separado dos 5 jogadores locais. */
function onlineControls(app: App, back: () => void) {
  const c = (): ReturnType<typeof defaultOnlineControls> => app.settings.online;
  return remapTargetScreen(app, {
    title: S.online.titleControls,
    lobby: true,
    device: () => c().device,
    setDevice: d => { c().device = d; },
    keymap: () => c().keymap,
    padmap: () => c().padmap,
    assignKey: (f, code) => assignKey([c().keymap], 0, f, code),
    reset: () => {
      for (const f of KEY_FIELDS) assignKey([c().keymap], 0, f, DEFAULT_KEYMAPS[0][f]);
      c().padmap = { ...DEFAULT_PADMAP };
      c().device = 'kb';
    },
    copyFrom: p => {   // os controles de um jogador do BATTLE GAME viram os da sala
      const st = app.settings;
      c().device = st.devices[p];
      c().keymap = { ...st.keymaps[p] };
      c().padmap = { ...st.padmaps[p] };
    },
    back,
  });
}

export function onlineScreen(app: App, o: { code?: string; cursor?: string; view?: View } = {}): OnlineScreen {
  const net = online();
  app.audio.ensureMenus(MUSIC.menus);
  let view: View = o.view ?? (o.code ? 'friends' : 'home');
  let roomView: 'main' | 'config' = 'main';
  let code = (o.code ?? '').toUpperCase().slice(0, CODE_LEN);
  let roomName = '', password = '', pendingCode = '', accUser = '', accPass = '';
  /** Fase e regras escolhidas ao criar a sala (o servidor aplica já na criação). */
  const draft: Cfg = { stage: 1, rules: { cpuLevel: 1, matches: 3, timeIdx: 2, suddenDeath: false, badBomber: false } };
  type Field = 'name' | 'code' | 'roomName' | 'password' | 'accUser' | 'accPass';
  let entry: { field: Field; t: TextEntry } | null = null;
  let copied = 0;
  let blink = 0;
  let sinceList = LIST_EVERY;
  const ppu = new PpuCanvas();

  const FIELD_MAX: Record<Field, number> = {
    name: NAME_MAX, code: CODE_LEN, roomName: ROOM_NAME_MAX, password: PASS_MAX, accUser: USER_MAX, accPass: ACCOUNT_PASS_MAX,
  };
  const fieldValue = (f: Field): string => ({ name: net.name, code, roomName, password, accUser, accPass })[f];
  const edit = (field: Field): void => { entry = { field, t: startTextEntry(fieldValue(field), FIELD_MAX[field]) }; };
  /** Texto de um campo (com cursor piscando enquanto digita); `mask` esconde com asteriscos (senha da conta). */
  const shown = (field: Field, v: string, none: string = S.online.empty, mask = false): string => {
    const hide = (s: string): string => (mask ? '*'.repeat(s.length) : s);
    return entry?.field === field ? hide(entry.t.value) + (blink % 40 < 20 ? '_' : ' ') : hide(v) || none;
  };
  const needName = (): boolean => {
    if (net.name) return false;
    net.message = S.online.needName;
    return true;
  };

  const go = (v: View, cursor?: string): void => {
    view = v;
    net.message = '';
    if (v === 'friends') { sinceList = LIST_EVERY; net.listRooms(); } else if (v === 'home' && !net.room && !net.queue) net.disconnect();
    const m = menus()[v];
    const want = cursor ?? (v === 'friends' && net.name ? 'create' : undefined);   // com nome, a lista abre em CRIAR SALA
    m.cursor = Math.max(0, want ? m.rows.findIndex(r => r.id === want) : 0);
  };
  const toTitle = (): void => { net.disconnect(); app.transition(() => titleScreen(app, { cursor: 1 }), FADE_TO_TITLE); };

  // ------------------------------------------------------------------------------------- fase e regras (compartilhado)
  const yesNo = (b: boolean): string => (b ? S.rules.yes : S.rules.no).toUpperCase();
  const cycleRule = (n: number, cur: number, d: number): number => (cur + d + n) % n;
  /** Linhas de fase e regras sobre `get`/`set`; só mudam quando `can()` (anfitrião, ou o rascunho ao criar a sala). */
  function ruleRows(get: () => Cfg, set: (p: Partial<Cfg>) => void, can: () => boolean, withStage: boolean): Row[] {
    const rule = (p: Partial<Lobby['rules']>): boolean => { set({ rules: { ...get().rules, ...p } }); return true; };
    const toggle = (k: 'suddenDeath' | 'badBomber') => (): boolean => can() && rule({ [k]: !get().rules[k] });
    const dim = (): boolean => !can();
    const rows: Row[] = [
      {
        id: 'stage', label: S.online.stage, dim, value: () => STAGE_NAMES_PT[visibleStage(get().stage) - 1].toUpperCase(),
        left: () => can() && (set({ stage: stepVisible(get().stage, -1) }), true),
        right: () => can() && (set({ stage: stepVisible(get().stage, 1) }), true),
      },
      {
        id: 'crowns', label: S.online.crowns, dim, value: () => String(get().rules.matches),
        left: () => can() && rule({ matches: cycleRule(5, get().rules.matches - 1, -1) + 1 }),
        right: () => can() && rule({ matches: cycleRule(5, get().rules.matches - 1, 1) + 1 }),
      },
      {
        id: 'time', label: S.online.time, dim, value: () => S.rules.time[get().rules.timeIdx],
        left: () => can() && rule({ timeIdx: cycleRule(S.rules.time.length, get().rules.timeIdx, -1) }),
        right: () => can() && rule({ timeIdx: cycleRule(S.rules.time.length, get().rules.timeIdx, 1) }),
      },
      { id: 'sudden', label: S.online.sudden, dim, value: () => yesNo(get().rules.suddenDeath), left: toggle('suddenDeath'), right: toggle('suddenDeath') },
      {
        id: 'level', label: S.online.level, dim, value: () => S.rules.cpu[get().rules.cpuLevel].toUpperCase(),
        left: () => can() && rule({ cpuLevel: cycleRule(3, get().rules.cpuLevel, -1) as 0 | 1 | 2 }),
        right: () => can() && rule({ cpuLevel: cycleRule(3, get().rules.cpuLevel, 1) as 0 | 1 | 2 }),
      },
      { id: 'bad', label: S.online.bad, dim, value: () => yesNo(get().rules.badBomber), left: toggle('badBomber'), right: toggle('badBomber') },
    ];
    return withStage ? rows : rows.filter(r => r.id !== 'stage');
  }

  // ------------------------------------------------------------------------------------------------ menu inicial
  const cycleChar = (d: number): boolean => { net.setChar((net.char + d + CHARACTERS.length) % CHARACTERS.length); return true; };
  const homeRows: Row[] = [
    { id: 'name', label: S.online.name, value: () => shown('name', net.name), select: () => { edit('name'); } },
    { id: 'look', label: S.online.look, value: () => CHARACTERS[net.char].name, left: () => cycleChar(-1), right: () => cycleChar(1) },
    { id: 'account', label: S.online.account, value: () => net.account?.user ?? S.online.signIn, select: () => { go('account'); } },
    { id: 'friends', label: S.online.friends, select: () => { go('friends'); } },
    {
      id: 'quick', label: S.online.quick, select: () => {
        if (needName()) return false;
        net.quick();
      },
    },
    { id: 'controls', label: S.online.controls, select: () => { openControls('controls'); } },
    { id: 'back', label: S.online.back, select: () => { toTitle(); } },
  ];

  // ------------------------------------------------------------------------------------------ jogar com amigos
  const joinRoom = (c: string, locked: boolean): boolean => {
    if (needName()) return false;
    if (locked) { pendingCode = c; password = ''; go('password'); return true; }
    net.join(c);
    return true;
  };
  const friendsRows = (): Row[] => {
    const rows: Row[] = [
      { id: 'name', label: S.online.name, value: () => shown('name', net.name), select: () => { edit('name'); } },
      { id: 'create', label: S.online.create, select: () => { if (needName()) return false; go('create'); } },
      { id: 'code', label: S.online.code, value: () => shown('code', code), select: () => { edit('code'); } },
      {
        id: 'join', label: S.online.join, select: () => {
          if (needName()) return false;
          if (code.length !== CODE_LEN) { net.message = S.online.needCode; return false; }
          net.join(code);
        },
      },
      { id: 'header', label: S.online.roomsOpen, disabled: true },
    ];
    if (!net.rooms.length) rows.push({ id: 'none', label: S.online.noRooms, disabled: true });
    for (const r of net.rooms.slice(0, LIST_MAX)) {
      rows.push({
        id: `room:${r.code}`, label: r.name.slice(0, 14), disabled: r.playing,
        value: () => (r.playing ? S.online.inGame : `${r.players}/${r.max}${r.locked ? ` ${S.online.locked}` : ''}`),
        select: () => joinRoom(r.code, r.locked),
      });
    }
    rows.push({ id: 'back', label: S.online.back, select: () => { go('home', 'friends'); } });
    return rows;
  };
  /** Conta: sem login, usuário/senha/entrar/criar; com login, o usuário e SAIR DA CONTA. */
  const accountRows = (): Row[] => {
    if (net.account) {
      return [
        { id: 'user', label: S.online.accountUser, value: () => net.account?.user ?? '' },
        { id: 'signOut', label: S.online.signOut, select: () => { net.logout(); go('account'); } },
        { id: 'back', label: S.online.back, select: () => { go('home', 'account'); } },
      ];
    }
    const submit = (kind: 'login' | 'register') => (): boolean => {
      if (net.accountBusy) return false;
      if (!accUser.trim() || !accPass) { net.message = S.online.needAccount; return false; }
      void net.auth(kind, accUser, accPass).then(ok => { if (ok) { accPass = ''; const m = net.message; go('account'); net.message = m; } });
      return true;
    };
    return [
      { id: 'user', label: S.online.accountUser, value: () => shown('accUser', accUser), select: () => { edit('accUser'); } },
      { id: 'pass', label: S.online.password, value: () => shown('accPass', accPass, S.online.empty, true), select: () => { edit('accPass'); } },
      { id: 'signIn', label: S.online.signIn, select: submit('login') },
      { id: 'signUp', label: S.online.signUp, select: submit('register') },
      { id: 'back', label: S.online.back, select: () => { go('home', 'account'); } },
    ];
  };
  /** Criar sala: nome, senha e as regras já configuradas (o servidor aplica na criação). */
  const createRows: Row[] = [
    { id: 'roomName', label: S.online.roomName, value: () => shown('roomName', roomName, S.online.roomNameAuto), select: () => { edit('roomName'); } },
    { id: 'password', label: S.online.password, value: () => shown('password', password, S.online.noPassword), select: () => { edit('password'); } },
    ...ruleRows(() => draft, p => { Object.assign(draft, p); }, () => true, true),
    {
      id: 'confirm', label: S.online.createConfirm, select: () => {
        if (needName()) return false;
        net.create(roomName, password, { stage: draft.stage, rules: draft.rules });
      },
    },
    { id: 'back', label: S.online.back, select: () => { go('friends', 'create'); } },
  ];
  const passwordRows: Row[] = [
    { id: 'password', label: S.online.password, value: () => shown('password', password), select: () => { edit('password'); } },
    { id: 'enter', label: S.online.enter, select: () => { net.join(pendingCode, password); } },
    { id: 'back', label: S.online.back, select: () => { go('friends'); } },
  ];

  // rows de friends mudam com a lista; o Menu guarda a referência e é atualizado a cada tick
  const homeMenu = new Menu(homeRows, { cursor: Math.max(0, homeRows.findIndex(r => r.id === (o.cursor ?? (net.name ? 'friends' : 'name')))) });
  const friendsMenu = new Menu(friendsRows(), { cursor: Math.max(0, friendsRows().findIndex(r => r.id === (o.cursor ?? (!net.name ? 'name' : code ? 'join' : 'create')))) });
  const createMenu = new Menu(createRows);
  const passwordMenu = new Menu(passwordRows);
  let accountLoggedIn = !!net.account;
  const accountMenu = new Menu(accountRows());
  const menus = (): Record<View, Menu> => ({
    home: homeMenu, friends: friendsMenu, create: createMenu, password: passwordMenu, account: accountMenu,
  });
  /** Refaz as linhas da conta quando entra/sai (as de quem está logado são outras). */
  function refreshAccount(): void {
    if (accountLoggedIn === !!net.account) return;
    accountLoggedIn = !!net.account;
    accountMenu.rows = accountRows();
    accountMenu.cursor = 0;
  }
  /** Atualiza as linhas da lista de salas sem perder a sala sob o cursor. */
  function refreshFriends(): void {
    const keep = friendsMenu.rows[friendsMenu.cursor]?.id;
    friendsMenu.rows = friendsRows();
    const i = friendsMenu.rows.findIndex(r => r.id === keep);
    friendsMenu.cursor = i >= 0 ? i : Math.min(friendsMenu.cursor, friendsMenu.rows.length - 1);
    if (friendsMenu.rows[friendsMenu.cursor].disabled) friendsMenu.cursor = 0;
  }

  // ---------------------------------------------------------------------------------------------------- na sala
  const L = (): Lobby => net.room!.lobby;
  const host = (): boolean => !!net.room?.host;
  const roomCfg = ruleRows(() => ({ stage: L().stage, rules: L().rules }), p => { net.setLobby(p); }, host, true);
  const slotRow = (s: number): Row => ({ id: `p${s}`, label: '', left: () => shiftSlot(s, -1), right: () => shiftSlot(s, 1) });
  /** ←/→ numa vaga: a própria troca o personagem; a sem jogador (anfitrião) troca entre CPU+personagem e NENHUM. */
  function shiftSlot(s: number, d: number): boolean {
    const room = net.room!, lob = L();
    if (s === room.you) { net.setChar((lob.chars[s] + d + CHARACTERS.length) % CHARACTERS.length); return true; }
    if (!room.host || lob.slots[s] === 'human') return false;
    const c = (cpuChoice(lob, s) + d + CPU_CHOICES) % CPU_CHOICES;
    const kind: SlotKind = c === CHARACTERS.length ? 'off' : 'cpu';
    net.setLobby({ slots: lob.slots.map((k, i) => (i === s ? kind : k)), chars: lob.chars.map((ch, i) => (i === s && kind === 'cpu' ? c : ch)) });
    return true;
  }
  const inRows: Row[] = [
    ...[0, 1, 2, 3, 4].map(slotRow),
    {   // aparência (personagem): também dá para trocar na própria vaga, com ←/→
      id: 'look', label: S.online.look, value: () => CHARACTERS[L().chars[net.room!.you]].name,
      left: () => shiftSlot(net.room!.you, -1), right: () => shiftSlot(net.room!.you, 1),
    },
    roomCfg.find(r => r.id === 'stage')!,
    { id: 'config', label: S.online.config, select: () => { roomView = 'config'; configMenu.cursor = 0; } },
    { id: 'controls', label: S.online.controls, select: () => { openControls('controls'); } },
    {   // código da sala: A copia o link de convite
      id: 'invite', label: S.online.roomCode, value: () => net.room?.code ?? '',
      select: () => { void navigator.clipboard?.writeText(net.invite()).catch(() => {}); copied = 180; },
    },
    {
      // anfitrião: INICIAR PARTIDA, só com todos os jogadores PRONTOS (CPU não conta); convidado: marca/desmarca PRONTO
      id: 'start', label: S.online.start, select: () => {
        const lob = L();
        if (net.room!.playing) return false;
        if (!host()) { net.setReady(!net.ready); return; }
        if (lob.slots.filter(k => k !== 'off').length < 2 || net.notReady().length) return false;
        net.start();
      },
    },
    { id: 'leave', label: S.online.leave, select: () => { net.leave(); view = 'home'; } },
  ];
  const START = inRows.findIndex(r => r.id === 'start'), LEAVE = inRows.findIndex(r => r.id === 'leave');
  const configRows: Row[] = [
    ...roomCfg.filter(r => r.id !== 'stage'),
    { id: 'back', label: S.online.back, select: () => { roomView = 'main'; } },
  ];
  const configMenu = new Menu(configRows);
  const inMenu = new Menu(inRows, { cursor: Math.max(0, inRows.findIndex(r => r.id === (o.cursor ?? 'start'))) });
  let wasIn = !!net.room && o.cursor !== undefined;   // voltando de outra tela (controles), o cursor fica onde estava
  /** Abre o controle online; ao voltar, a sala (ou o menu) continua com o cursor na mesma linha. */
  function openControls(cursor: string): void {
    app.transition(() => onlineControls(app, () => app.transition(() => onlineScreen(app, { code, cursor, view }), FADE_MENU)), FADE_MENU);
  }

  const footer = (): string => {
    if (entry) return S.online.typing;
    if (net.message) return net.message;
    if (net.connecting) return S.online.connecting;
    if (net.room) {
      if (roomView === 'config') return host() ? S.online.help : S.online.hostOnly;
      const id = inRows[inMenu.cursor].id;
      if (id === 'invite') return copied > 0 ? S.online.copied : S.online.copyHelp;
      if (id === 'look') return S.online.lookHelp;
      if (id === 'stage') return host() ? S.online.stageHelp : S.online.hostOnly;
      if (id === 'config') return S.online.configHelp;
      if (!net.room.playing && id === 'start') {
        const waiting = net.notReady();
        if (net.room.host && waiting.length) {
          const names = S.online.waitReady(waiting.map(s => L().names[s] || S.online.slot(s)).join(', '));
          return names.length <= 40 ? names : S.online.waitReady(waiting.map(S.online.slot).join(', '));   // não cabe: só as vagas
        }
        if (!net.room.host) return net.ready ? S.online.waitHost : S.online.readyHelp;
        return S.online.startHelp;
      }
      return '';
    }
    if (net.queue) return S.online.cancelHelp;
    if (net.accountBusy) return S.online.connecting;
    if (view === 'account') return S.online.accountHelp;
    if (view === 'friends') return S.online.friendsHelp;
    if (view === 'home') return homeRows[homeMenu.cursor].id === 'look' ? S.online.homeHelp : '';
    return '';
  };

  // ----------------------------------------------------------------------------------------------------- desenho
  /** Quadro de um botão/cartão: em foco fica dourado e brilhante. */
  const box = (r: Rect, focus: boolean, accent = '#8fd8ff'): void => {
    hdPanel({ ...r, fill: focus ? 'rgba(16,40,112,0.92)' : 'rgba(10,30,90,0.6)', stroke: focus ? '#ffe46b' : accent,
      glow: focus ? 'rgba(255,220,90,0.9)' : undefined });
  };
  type TextOpts = { align?: 'left' | 'right' | 'center'; tone?: Tone; color?: string };
  const small = (ctx: CanvasRenderingContext2D, bank: SpriteBank, s: string, x: number, y: number, o: TextOpts = {}): void => {
    drawText(ctx, bank, 'ascii8', s, x, y, { ...o, bare: true });
  };
  const big = (ctx: CanvasRenderingContext2D, bank: SpriteBank, s: string, x: number, y: number, o: TextOpts = {}): void => {
    drawText(ctx, bank, 'menuItem', s, x, y, { ...o, bare: true });
  };
  const title = (ctx: CanvasRenderingContext2D, bank: SpriteBank, text: string): void => {
    drawText(ctx, bank, 'menuTitle', text, TITLE_X, TITLE_Y, { align: 'center', bare: true });
  };
  const foot = (ctx: CanvasRenderingContext2D, bank: SpriteBank): void => {
    const f = footer();
    if (f) small(ctx, bank, f, 128, FOOTER_Y, { align: 'center', tone: 'white' });
  };
  /** Boneco do personagem (OBJ da seleção de personagem da ROM = a skin da partida; sem o pacote, a arte do fallback). */
  const standee = (ctx: CanvasRenderingContext2D, bank: SpriteBank, ch: number, x: number, y: number): void => {
    const a = romState.assets;
    if (a) {
      const st = CHARSEL_PICK_STANDEE[ch];
      ppu.drawOver(ctx, charselSprites(a, [], [{ ...obj(x, y, st.tile, st.pal, { big: true, prio: 3 }), src: charselStandeeSrc(a, ch) }]));
    } else ctx.drawImage(bank.bomber(ch, 2, 0), x - 4, y - 6, 40, 50);
  };

  /** Menu inicial: cartão do jogador (nome, aparência, conta) e botões grandes. */
  function drawHome(ctx: CanvasRenderingContext2D, bank: SpriteBank): void {
    const sel = homeRows[homeMenu.cursor].id;
    const onCard = sel in HOME.rows;
    hdMenu(ctx, onCard ? [56, HOME.rows[sel] - 4] : null, SIZES, 'lobby');
    title(ctx, bank, TITLES.home);
    box(HOME.card, onCard);
    standee(ctx, bank, net.char, 26, 38);
    small(ctx, bank, CHARACTERS[net.char].name, 42, 74, { align: 'center', tone: 'yellow' });
    const val: Record<string, string> = {
      name: shown('name', net.name), look: CHARACTERS[net.char].name, account: net.account?.user ?? S.online.signIn,
    };
    for (const id of ['name', 'look', 'account'] as const) {
      const y = HOME.rows[id];
      small(ctx, bank, homeRows.find(r => r.id === id)!.label, 78, y, { tone: sel === id ? 'yellow' : 'blue' });
      small(ctx, bank, val[id], 232, y, { align: 'right', tone: sel === id ? 'yellow' : 'white' });
    }
    for (const id of ['friends', 'quick'] as const) {
      const r = HOME[id], focus = sel === id;
      box(r, focus, id === 'quick' ? '#ff9a4a' : '#8fd8ff');
      big(ctx, bank, id === 'friends' ? S.online.friends : S.online.quick, 128, r.y + 6, { align: 'center', tone: focus ? 'yellow' : 'white' });
      small(ctx, bank, id === 'friends' ? S.online.friendsSub : S.online.quickSub, 128, r.y + 26, { align: 'center', tone: 'white' });
    }
    for (const id of ['controls', 'back'] as const) {
      const r = HOME[id], focus = sel === id;
      box(r, focus);
      small(ctx, bank, id === 'controls' ? S.online.controls : S.online.back, r.x + r.w / 2, r.y + 3, { align: 'center', tone: focus ? 'yellow' : 'white' });
    }
    foot(ctx, bank);
  }

  /** Jogar com amigos: ações no alto e a lista de salas como tabela (sala, jogadores, acesso). */
  function drawFriends(ctx: CanvasRenderingContext2D, bank: SpriteBank): void {
    const rows = friendsMenu.rows as Row[];
    // linha de cada item (px da base): 4 ações, cabeçalho da tabela, salas, voltar
    const yOf = (id: string, i: number): number => {
      const top = ['name', 'create', 'code', 'join'].indexOf(id);
      if (top >= 0) return 28 + top * 16;
      if (id === 'header') return 96;
      if (id === 'none') return 112;
      if (id === 'back') return 192;
      return 108 + (i - 5) * 13;
    };
    const y = rows.map((r, i) => yOf(r.id, i));
    const handY = y[friendsMenu.cursor];
    hdMenu(ctx, handY === undefined ? null : [6, handY - 1], SIZES, 'lobby');
    title(ctx, bank, TITLES.friends);
    rows.forEach((r, i) => {
      const focus = i === friendsMenu.cursor, ry = y[i];
      if (r.id === 'header') {
        small(ctx, bank, S.online.colRoom, 22, ry, { tone: 'blue' });
        small(ctx, bank, S.online.colPlayers, 178, ry, { align: 'right', tone: 'blue' });
        small(ctx, bank, S.online.colAccess, 236, ry, { align: 'right', tone: 'blue' });
        return;
      }
      if (r.id === 'none') { small(ctx, bank, r.label, 128, ry, { align: 'center', tone: 'gray' }); return; }
      const isRoom = r.id.startsWith('room:');
      box({ x: 14, y: ry - 3, w: 228, h: 13 }, focus);
      if (isRoom) {
        const info = net.rooms.find(x => `room:${x.code}` === r.id)!;
        const off = info.playing;
        small(ctx, bank, r.label, 22, ry, { tone: off ? 'gray' : focus ? 'yellow' : 'white' });
        small(ctx, bank, `${info.players}/${info.max}`, 178, ry, { align: 'right', tone: off ? 'gray' : 'white' });
        small(ctx, bank, off ? S.online.inGame : info.locked ? S.online.locked : S.online.open, 236, ry,
          { align: 'right', tone: off ? 'gray' : info.locked ? 'yellow' : 'green' });
      } else {
        small(ctx, bank, r.label, 22, ry, { tone: focus ? 'yellow' : 'white' });
        const v = r.value?.();
        if (v) small(ctx, bank, v, 236, ry, { align: 'right', tone: 'yellow' });
      }
    });
    foot(ctx, bank);
  }

  /** Criar sala, senha da sala, conta e configurações: faixas com rótulo e valor. */
  function drawForm(ctx: CanvasRenderingContext2D, bank: SpriteBank, m: Menu, ttl: string): void {
    const rows = m.rows as Row[];
    const tight = rows.length > 6, step = tight ? 18 : 28, h = tight ? 15 : 22, top = tight ? 26 : 38;
    const yOf = (i: number): number => top + i * step;
    hdMenu(ctx, [6, yOf(m.cursor) + (tight ? 1 : 4)], SIZES, 'lobby');
    title(ctx, bank, ttl);
    rows.forEach((r, i) => {
      const focus = i === m.cursor, y = yOf(i), dim = r.dim?.() ?? false;
      box({ x: 14, y, w: 228, h }, focus);
      if (tight) small(ctx, bank, r.label, 22, y + 3.5, { tone: focus ? 'yellow' : dim ? 'gray' : 'white' });
      else big(ctx, bank, r.label, 22, y + 3, { tone: focus ? 'yellow' : dim ? 'gray' : 'white' });
      const v = r.value?.();
      if (v) small(ctx, bank, v, 234, y + (tight ? 3.5 : 7), { align: 'right', tone: dim ? 'gray' : 'yellow' });
    });
    foot(ctx, bank);
  }

  /** Fila da partida rápida: quadro central com a busca, quantos esperam e a contagem. */
  function drawQueue(ctx: CanvasRenderingContext2D, bank: SpriteBank): void {
    const q = net.queue!;
    hdMenu(ctx, null, SIZES, 'lobby');
    title(ctx, bank, S.online.titleQuick);
    box({ x: 30, y: 44, w: 196, h: 122 }, true, '#ff9a4a');
    const dots = '.'.repeat(1 + Math.floor(blink / 20) % 3);
    big(ctx, bank, S.online.searching.replace('...', dots), 128, 54, { align: 'center', tone: 'white' });
    standee(ctx, bank, net.char, 112, 80);
    small(ctx, bank, `${S.online.inQueue}: ${q.n}`, 128, 122, { align: 'center', tone: 'white' });
    big(ctx, bank, q.left === null ? S.online.needTwo : `${S.online.startsIn} ${q.left}S`, 128, 138, { align: 'center', tone: 'yellow' });
    foot(ctx, bank);
  }

  /** Sala: jogadores com PRONTO, aparência com o boneco, fase, configurações, controle, código e iniciar/pronto. */
  function drawRoom(ctx: CanvasRenderingContext2D, bank: SpriteBank): void {
    const room = net.room!, lob = L(), sel = inRows[inMenu.cursor].id;
    const isHost = room.host, tyOf = (r: Rect): number => r.y + 3;
    const hand: Record<string, [number, number]> = {
      look: [6, RM.look.y + 10], stage: [6, tyOf(RM.stage) - 1], config: [6, tyOf(RM.config) - 1], controls: [6, tyOf(RM.controls) - 1],
      invite: [6, tyOf(RM.invite) - 1], start: [6, RM.start.y + 2], leave: [172, RM.leave.y + 2],
    };
    for (let s = 0; s < 5; s++) hand[`p${s}`] = [6, 30 + s * 12 - 1];
    hdMenu(ctx, hand[sel] ?? null, SIZES, 'lobby');
    title(ctx, bank, S.online.title);

    // jogadores
    box(RM.players, sel.startsWith('p'));
    for (let s = 0; s < 5; s++) {
      const y = 30 + s * 12, kind = lob.slots[s];
      const editable = s === room.you || (isHost && kind !== 'human');
      small(ctx, bank, S.online.slot(s), 22, y, { color: kind === 'off' ? '#9a9a9a' : PLAYER_COLORS[s] });
      const who = kind === 'human' ? `${lob.names[s] || S.online.slot(s)}${s === room.you ? ` (${S.online.you})` : ''}` : kind === 'cpu' ? S.online.cpu : S.online.off;
      small(ctx, bank, who, 42, y, { tone: kind === 'human' ? (s === room.you ? 'yellow' : 'white') : 'gray' });
      if (kind !== 'off') small(ctx, bank, CHARACTERS[lob.chars[s]].name, 112, y, { tone: editable ? 'green' : 'gray' });
      const ping = kind === 'human' ? net.pings[s] : null;
      if (ping !== null) small(ctx, bank, `${ping}MS`, 156, y, { tone: 'gray' });   // colunas: nome | boneco | ping | situação (sem se cobrirem)
      if (kind === 'human') {
        if (s === room.hostSlot) small(ctx, bank, S.online.hostTag, 236, y, { align: 'right', tone: 'yellow' });
        else if (!room.playing) {
          const ok = !!lob.ready?.[s];
          small(ctx, bank, ok ? S.online.ready : S.online.waiting2, 236, y, { align: 'right', tone: ok ? 'green' : 'gray' });
        }
      }
    }

    // aparência (com o boneco ao lado), fase, configurações, controle online, código
    box(RM.look, sel === 'look');
    standee(ctx, bank, lob.chars[room.you], 22, RM.look.y + 2);
    small(ctx, bank, S.online.look, 66, RM.look.y + 8, { tone: sel === 'look' ? 'yellow' : 'blue' });
    small(ctx, bank, CHARACTERS[lob.chars[room.you]].name, 66, RM.look.y + 22, { tone: 'white' });
    const strip = (r: Rect, id: string, label: string, value: string, vTone: Tone = 'yellow'): void => {
      const focus = sel === id;
      box(r, focus);
      small(ctx, bank, label, 22, tyOf(r), { tone: focus ? 'yellow' : 'white' });
      if (value) small(ctx, bank, value, 234, tyOf(r), { align: 'right', tone: vTone });
    };
    strip(RM.stage, 'stage', S.online.stage, STAGE_NAMES_PT[visibleStage(lob.stage) - 1].toUpperCase(), isHost ? 'yellow' : 'gray');
    strip(RM.config, 'config', S.online.config, '');
    strip(RM.controls, 'controls', S.online.controls, '');
    strip(RM.invite, 'invite', S.online.roomCode, `${room.code}  ${copied > 0 ? S.online.copied : S.online.copy}`);

    // iniciar (anfitrião) / ESTOU PRONTO (convidado) e sair
    const waiting = net.notReady().length > 0, canStart = !room.playing && isHost && !waiting;
    const label = room.playing ? S.online.playing : isHost ? S.online.start : net.ready ? S.online.readyOn : S.online.readyBtn;
    const accent = isHost ? (canStart ? '#6aff6a' : '#8fd8ff') : net.ready ? '#6aff6a' : '#ff9a4a';
    box(RM.start, sel === 'start', accent);
    small(ctx, bank, label, RM.start.x + RM.start.w / 2, RM.start.y + 3,
      { align: 'center', tone: room.playing || (isHost && !canStart) ? 'gray' : net.ready && !isHost ? 'green' : 'yellow' });
    box(RM.leave, sel === 'leave', '#ff7a7a');
    small(ctx, bank, S.online.leave, RM.leave.x + RM.leave.w / 2, RM.leave.y + 3, { align: 'center', tone: sel === 'leave' ? 'yellow' : 'white' });
    foot(ctx, bank);
  }

  const current = (): Menu => (net.room ? (roomView === 'config' ? configMenu : inMenu) : menus()[view]);
  const rowsOf = (): Row[] => (net.room ? (roomView === 'config' ? configRows : inRows) : (current().rows as Row[]));
  /** Sai da fila ou volta um nível (B). */
  function back(): void {
    if (net.queue) { net.disconnect(); go('home', 'quick'); return; }
    if (view === 'home') toTitle();
    else if (view === 'friends') go('home', 'friends');
    else if (view === 'account') go('home', 'account');
    else go('friends', view === 'create' ? 'create' : 'join');
  }

  return {
    id: 'online',
    get menu() { return current(); },
    get editing() { return entry?.field ?? null; },
    get view() { return net.room ? (roomView === 'config' ? 'config' : 'room') : net.queue ? 'queue' : view; },
    rowIds() { return rowsOf().map(r => r.id); },
    value(id: string) { return rowsOf().find(r => r.id === id)?.value?.() ?? ''; },
    update(inp) {
      blink++;
      if (copied > 0) copied--;
      if (entry) {
        const e = entry;
        if (e.t.done === null) return;          // digitando: o jogo não lê os controles
        if (e.t.done) {
          const v = e.t.value.trim();
          if (e.field === 'name') net.name = v;
          else if (e.field === 'code') code = v;
          else if (e.field === 'roomName') roomName = v;
          else if (e.field === 'accUser') accUser = v;
          else if (e.field === 'accPass') accPass = e.t.value;
          else password = v;
          net.message = '';
          app.audio.sfx(SFX.confirm);
        }
        e.t.close();
        entry = null;
        return;
      }
      if (net.room && !wasIn) { inMenu.cursor = START; roomView = 'main'; }   // entrou na sala: cursor em PRONTO/INICIAR
      if (wasIn && !net.room) view = 'home';   // a sala acabou (anfitrião saiu, conexão caiu): volta ao menu
      wasIn = !!net.room;
      if (net.room) {
        if (roomView === 'config') {
          if (configMenu.update(inp.any, inp.pressedAny, app.audio) === 'back') roomView = 'main';
          return;
        }
        // B na sala não sai sem querer: leva o cursor para "SAIR DA SALA"
        if (inp.pressedAny & BTN.B) { inMenu.cursor = LEAVE; app.audio.sfx(SFX.move); return; }
        inMenu.update(inp.any, inp.pressedAny, app.audio);
        return;
      }
      if (net.queue) {   // na fila: só dá para cancelar
        if (inp.pressedAny & BTN.B) { app.audio.sfx(SFX.back); back(); }
        return;
      }
      if (view === 'account') { refreshAccount(); if (net.accountBusy) return; }
      if (view === 'friends') {
        if (++sinceList >= LIST_EVERY) { sinceList = 0; net.listRooms(); }
        refreshFriends();
      }
      if (current().update(inp.any, inp.pressedAny, app.audio) === 'back') back();
    },
    draw(ctx, bank) {
      if (net.room) {
        if (roomView === 'config') drawForm(ctx, bank, configMenu, S.online.titleConfig);
        else drawRoom(ctx, bank);
        return;
      }
      if (net.queue) { drawQueue(ctx, bank); return; }
      if (view === 'home') drawHome(ctx, bank);
      else if (view === 'friends') drawFriends(ctx, bank);
      else drawForm(ctx, bank, current(), TITLES[view]);
    },
  };
}
