// Sala online (net/online.ts, server/sala.mjs), no layout da página das Opções (HD: quebra-cabeça, luva, texto HD).
// Fora de sala: nome, criar sala, código e entrar. Na sala: as 5 vagas (←/→ troca o próprio personagem; o anfitrião
// troca as vagas sem jogador entre CPU com cada personagem e NENHUM), fase e regras (só o anfitrião muda), convidar
// (copia o link), iniciar e sair. A tela só lê o estado do cliente: se a sala cai, ela volta sozinha para "criar/entrar".
import type { App, Screen } from '../app/app';
import type { SlotKind } from '../game/config';
import { BTN } from '../game/core-api';
import { MUSIC, SFX } from '../app/audio';
import { FADE_TO_TITLE } from '../app/fade';
import { S, STAGE_NAMES_PT } from '../render/text/strings';
import { stepVisible, visibleStage } from '../game/stages';
import { CHARACTERS } from '../render/art/bomber';
import { drawOptionsPage, TITLE_X, TITLE_Y, FOOTER_Y } from '../render/screens-rom/options';
import { drawText } from '../render/text/text';
import type { Tone } from '../render/text/types';
import type { SpriteBank } from '../render/sprite-bank';
import { hdMenu, hdPanel } from '../render/hd-menu';
import { PLAYER_COLORS } from './ui';
import { online, HOST_SLOT, type Lobby } from '../net/online';
import { startTextEntry, type TextEntry } from '../net/text-entry';
import { assignKey, DEFAULT_KEYMAPS, DEFAULT_PADMAP, KEY_FIELDS } from '../input/input';
import { defaultOnlineControls } from '../app/settings';
import { FADE_MENU } from '../app/fade';
import { remapTargetScreen } from './remap';
import { Menu, type MenuRow } from './menu';
import { titleScreen } from './title';

const NAME_MAX = 10, CODE_LEN = 4;

/** Layout da sala (px da base 256×224, dentro da moldura de corda): seções, colunas e o quadro do código. */
const ROOM = { left: 24, right: 232, small: 9, codeSize: 18, playersY: 26, rulesY: 86, code: { y: 172, w: 116, h: 30 } } as const;
/** Regras: FASE numa linha inteira (o nome é longo); as outras em duas colunas (rótulo em `x`, valor alinhado à
 *  direita em `valueX`). O cursor anda na ordem das linhas da tela: coluna da esquerda e depois a da direita. */
const RULE_AT: Record<string, { x: number; valueX: number }> = {
  stage: { x: 24, valueX: 232 },
  crowns: { x: 24, valueX: 120 }, time: { x: 24, valueX: 120 }, sudden: { x: 24, valueX: 120 },
  level: { x: 140, valueX: 232 }, bad: { x: 140, valueX: 232 },
};
/** Posição (x do rótulo, y) de cada linha, para a luva. */
const ROOM_AT: Record<string, { x: number; y: number }> = {
  ...Object.fromEntries([0, 1, 2, 3, 4].map(s => [`p${s}`, { x: ROOM.left, y: ROOM.playersY + 10 + 10 * s }])),
  stage: { x: 24, y: 96 }, crowns: { x: 24, y: 106 }, time: { x: 24, y: 116 }, sudden: { x: 24, y: 126 },
  level: { x: 140, y: 106 }, bad: { x: 140, y: 116 },
  start: { x: 128, y: 140 }, controls: { x: 128, y: 150 }, leave: { x: 128, y: 160 },
  invite: { x: 128, y: ROOM.code.y + 9 },
};
interface Row extends MenuRow { label: string; value?: () => string }

/** Opções de uma vaga sem jogador (anfitrião): CPU com cada personagem, depois NENHUM. */
const CPU_CHOICES = CHARACTERS.length + 1;
const cpuChoice = (L: Lobby, s: number): number => (L.slots[s] === 'off' ? CHARACTERS.length : L.chars[s]);

export type OnlineScreen = Screen & { readonly menu: Menu; rowIds(): string[]; value(id: string): string; readonly editing: string | null };

/** Controle da sala online (Settings.online), editado na tela de remapear: separado dos 5 jogadores locais. */
function onlineControls(app: App, back: () => void) {
  const c = (): ReturnType<typeof defaultOnlineControls> => app.settings.online;
  return remapTargetScreen(app, {
    title: S.online.controls,
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
    back,
  });
}

export function onlineScreen(app: App, o: { code?: string; cursor?: string } = {}): OnlineScreen {
  const net = online();
  app.audio.ensureMenus(MUSIC.menus);
  let code = (o.code ?? '').toUpperCase().slice(0, CODE_LEN);
  let entry: { field: 'name' | 'code'; t: TextEntry } | null = null;
  let copied = 0;
  let blink = 0;

  const edit = (field: 'name' | 'code'): void => {
    entry = { field, t: startTextEntry(field === 'name' ? net.name : code, field === 'name' ? NAME_MAX : CODE_LEN) };
  };
  const shown = (field: 'name' | 'code', v: string): string =>
    (entry?.field === field ? entry.t.value + (blink % 40 < 20 ? '_' : ' ') : v || S.online.empty);

  // ------------------------------------------------------------------------------------------- fora de sala
  const outRows: Row[] = [
    { id: 'name', label: S.online.name, value: () => shown('name', net.name), select: () => { edit('name'); } },
    {
      id: 'create', label: S.online.create, select: () => {
        if (!net.name) { net.message = S.online.needName; return false; }
        net.create();
      },
    },
    { id: 'controls', label: S.online.controls, select: () => { openControls('controls'); } },
    { id: 'code', label: S.online.code, value: () => shown('code', code), select: () => { edit('code'); } },
    {
      id: 'join', label: S.online.join, select: () => {
        if (!net.name) { net.message = S.online.needName; return false; }
        if (code.length !== CODE_LEN) { net.message = S.online.needCode; return false; }
        net.join(code);
      },
    },
    { id: 'back', label: S.online.back, select: () => { app.transition(() => titleScreen(app, { cursor: 1 }), FADE_TO_TITLE); } },
  ];
  const outMenu = new Menu(outRows, { cursor: Math.max(0, outRows.findIndex(r => r.id === (o.cursor ?? (code ? 'code' : 'name')))) });

  // ---------------------------------------------------------------------------------------------- na sala
  const L = (): Lobby => net.room!.lobby;
  const host = (): boolean => !!net.room?.host;
  const setRule = (patch: Partial<Lobby['rules']>): boolean => { net.setLobby({ rules: { ...L().rules, ...patch } }); return true; };
  const slotRow = (s: number): Row => ({
    id: `p${s}`, label: '',
    left: () => shiftSlot(s, -1), right: () => shiftSlot(s, 1),
  });
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
  const yesNo = (b: boolean): string => (b ? S.rules.yes : S.rules.no).toUpperCase();
  const cycleRule = (n: number, cur: number, d: number): number => (cur + d + n) % n;
  const inRows: Row[] = [
    ...[0, 1, 2, 3, 4].map(slotRow),
    {
      id: 'stage', label: S.online.stage, value: () => STAGE_NAMES_PT[visibleStage(L().stage) - 1].toUpperCase(),
      left: () => (host() ? (net.setLobby({ stage: stepVisible(L().stage, -1) }), true) : false),
      right: () => (host() ? (net.setLobby({ stage: stepVisible(L().stage, 1) }), true) : false),
    },
    {
      id: 'crowns', label: S.online.crowns, value: () => String(L().rules.matches),
      left: () => host() && setRule({ matches: cycleRule(5, L().rules.matches - 1, -1) + 1 }),
      right: () => host() && setRule({ matches: cycleRule(5, L().rules.matches - 1, 1) + 1 }),
    },
    {
      id: 'time', label: S.online.time, value: () => S.rules.time[L().rules.timeIdx],
      left: () => host() && setRule({ timeIdx: cycleRule(S.rules.time.length, L().rules.timeIdx, -1) }),
      right: () => host() && setRule({ timeIdx: cycleRule(S.rules.time.length, L().rules.timeIdx, 1) }),
    },
    {
      id: 'sudden', label: S.online.sudden, value: () => yesNo(L().rules.suddenDeath),
      left: () => host() && setRule({ suddenDeath: !L().rules.suddenDeath }), right: () => host() && setRule({ suddenDeath: !L().rules.suddenDeath }),
    },
    {   // rótulos curtos na sala (cabem na coluna da direita)
      id: 'level', label: S.online.levelShort, value: () => S.rules.cpu[L().rules.cpuLevel].toUpperCase(),
      left: () => host() && setRule({ cpuLevel: cycleRule(3, L().rules.cpuLevel, -1) as 0 | 1 | 2 }),
      right: () => host() && setRule({ cpuLevel: cycleRule(3, L().rules.cpuLevel, 1) as 0 | 1 | 2 }),
    },
    {
      id: 'bad', label: S.online.badShort, value:() => yesNo(L().rules.badBomber),
      left: () => host() && setRule({ badBomber: !L().rules.badBomber }), right: () => host() && setRule({ badBomber: !L().rules.badBomber }),
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
    { id: 'controls', label: S.online.controls, select: () => { openControls('controls'); } },
    { id: 'leave', label: S.online.leave, select: () => { net.leave(); } },
    {   // código da sala, no quadro de destaque embaixo: A copia o link de convite
      id: 'invite', label: S.online.invite, value: () => (copied > 0 ? S.online.copied : S.online.copy),
      select: () => { void navigator.clipboard?.writeText(net.invite()).catch(() => {}); copied = 180; },
    },
  ];
  const LEAVE = inRows.findIndex(r => r.id === 'leave');
  const inMenu = new Menu(inRows, { cursor: Math.max(0, inRows.findIndex(r => r.id === o.cursor)) });
  let wasIn = !!net.room && o.cursor !== undefined;   // voltando de outra tela (controles), o cursor fica onde estava
  /** Abre o controle da sala online; ao voltar, a sala continua (a conexão não cai) com o cursor na mesma linha. */
  function openControls(cursor: string): void {
    app.transition(() => onlineControls(app, () => app.transition(() => onlineScreen(app, { code, cursor }), FADE_MENU)), FADE_MENU);
  }

  const footer = (): string => {
    if (entry) return S.online.typing;
    if (net.message) return net.message;
    if (net.connecting) return S.online.connecting;
    if (net.room && inRows[inMenu.cursor].id === 'invite') return copied > 0 ? S.online.copied : S.online.copyHelp;
    if (net.room && !net.room.playing && inRows[inMenu.cursor].id === 'start') {
      const waiting = net.notReady();
      if (net.room.host && waiting.length) {
        const names = S.online.waitReady(waiting.map(s => L().names[s] || S.online.slot(s)).join(', '));
        return names.length <= 48 ? names : S.online.waitReady(waiting.map(S.online.slot).join(', '));   // não cabe: só as vagas
      }
      if (!net.room.host && net.ready) return S.online.waitHost;
    }
    return net.room ? (net.room.host ? S.online.help : S.online.guestHelp) : '';
  };

  /** Sala (HD): jogadores, regras em duas colunas, botões no centro e o código da sala em destaque embaixo. */
  function drawRoom(ctx: CanvasRenderingContext2D, bank: SpriteBank): void {
    const room = net.room!, lob = L();
    const id = inRows[inMenu.cursor].id;
    const textW = (s: string, size: number = ROOM.small): number => s.length * size * 0.52;   // mesma estimativa do hdText
    const at = ROOM_AT[id] ?? { x: ROOM.left, y: ROOM.code.y };
    // a luva fica à esquerda do item; nos centrados, à esquerda do texto
    const handX = id === 'invite' ? 128 - textW(room.code, ROOM.codeSize) / 2 - 22
      : id === 'start' || id === 'controls' || id === 'leave' ? 128 - textW(centerLabel(id)) / 2 - 18 : at.x - 16;
    hdMenu(ctx, [handX, at.y], { hand: 0.9, item: ROOM.codeSize });
    drawText(ctx, bank, 'menuTitle', S.online.title, TITLE_X, TITLE_Y, { align: 'center', bare: true });
    const t = (s: string, x: number, y: number, o: { align?: 'left' | 'right' | 'center'; tone?: Tone; color?: string } = {}): void => {
      drawText(ctx, bank, 'ascii8', s, x, y, { ...o, bare: true });
    };

    t(S.online.players, ROOM.left, ROOM.playersY, { tone: 'blue' });
    for (let s = 0; s < 5; s++) {
      const y = ROOM.playersY + 10 + 10 * s, kind = lob.slots[s];
      const who = kind === 'human' ? `${lob.names[s] || S.online.slot(s)}${s === room.you ? ` (${S.online.you})` : ''}` : kind === 'cpu' ? S.online.cpu : S.online.off;
      const editable = s === room.you || (room.host && kind !== 'human');
      t(S.online.slot(s), ROOM.left, y, { color: kind === 'off' ? '#9a9a9a' : PLAYER_COLORS[s] });
      t(who, ROOM.left + 20, y, { tone: editable ? undefined : 'gray' });
      if (kind !== 'off') t(CHARACTERS[lob.chars[s]].name, ROOM.right, y, { align: 'right', tone: editable ? 'green' : 'gray' });
      // PRONTO de cada convidado (o anfitrião é quem inicia; CPU não precisa)
      if (kind === 'human' && s !== HOST_SLOT && !room.playing) {
        const ok = !!lob.ready?.[s];
        t(ok ? S.online.ready : S.online.notReadyTag, ROOM.right - 54, y, { align: 'right', tone: ok ? 'green' : 'gray' });
      }
    }

    t(S.online.rules, ROOM.left, ROOM.rulesY, { tone: 'blue' });
    const ruleTone: Tone | undefined = room.host ? undefined : 'gray';
    for (const r of inRows) {
      const p = RULE_AT[r.id];
      if (!p) continue;
      t(r.label, p.x, ROOM_AT[r.id].y, { tone: ruleTone });
      t(r.value!(), p.valueX, ROOM_AT[r.id].y, { align: 'right', tone: room.host ? 'green' : 'gray' });
    }

    for (const k of ['start', 'controls', 'leave'] as const) {
      const off = k === 'start' && (room.playing || (room.host && net.notReady().length > 0));
      const tone: Tone | undefined = off ? 'gray' : k !== 'start' ? undefined : !room.host && net.ready ? 'green' : 'yellow';
      t(centerLabel(k), 128, ROOM_AT[k].y, { align: 'center', tone });
    }

    // código da sala: quadro de destaque, centralizado
    const c = ROOM.code, focus = id === 'invite';
    hdPanel({ x: 128 - c.w / 2, y: c.y - 4, w: c.w, h: c.h, fill: focus ? 'rgba(10,30,90,0.82)' : 'rgba(10,30,90,0.62)',
      stroke: focus ? '#ffe46b' : '#8fd8ff', glow: focus ? 'rgba(255,220,90,0.9)' : undefined });
    t(S.online.roomCode, 128, c.y, { align: 'center', color: '#bfe8ff' });
    drawText(ctx, bank, 'menuItem', room.code, 128, c.y + 9, { align: 'center', tone: 'yellow' });

    const foot = footer();
    if (foot) t(foot, 128, FOOTER_Y, { align: 'center', tone: 'gray' });
  }
  function centerLabel(id: 'start' | 'controls' | 'leave'): string {
    const room = net.room!;
    if (id === 'start') return room.playing ? S.online.playing : room.host ? S.online.start : net.ready ? S.online.readyOn : S.online.readyBtn;
    return id === 'controls' ? S.online.controls : S.online.leave;
  }

  return {
    id: 'online',
    get menu() { return net.room ? inMenu : outMenu; },
    get editing() { return entry?.field ?? null; },
    rowIds() { return (net.room ? inRows : outRows).map(r => r.id); },
    value(id: string) { return (net.room ? inRows : outRows).find(r => r.id === id)?.value?.() ?? ''; },
    update(inp) {
      blink++;
      if (copied > 0) copied--;
      if (entry) {
        const e = entry;
        if (e.t.done === null) return;          // digitando: o jogo não lê os controles
        if (e.t.done) {
          if (e.field === 'name') net.name = e.t.value.trim(); else code = e.t.value;
          net.message = '';
          app.audio.sfx(SFX.confirm);
        }
        e.t.close();
        entry = null;
        return;
      }
      if (net.room && !wasIn) inMenu.cursor = net.room.you;   // entrou na sala: cursor na própria vaga
      wasIn = !!net.room;
      if (net.room) {
        // B na sala não sai sem querer: leva o cursor para "SAIR DA SALA"
        if (inp.pressedAny & BTN.B) { inMenu.cursor = LEAVE; app.audio.sfx(SFX.move); return; }
        inMenu.update(inp.any, inp.pressedAny, app.audio);
      } else if (outMenu.update(inp.any, inp.pressedAny, app.audio) === 'back') {
        app.transition(() => titleScreen(app, { cursor: 1 }), FADE_TO_TITLE);
      }
    },
    draw(ctx, bank) {
      if (net.room) drawRoom(ctx, bank);
      else {
        const rows = outRows.map(r => ({ label: r.label, value: r.value?.() ?? '' }));
        drawOptionsPage(ctx, bank, S.online.title, rows, outMenu.cursor, footer());
      }
    },
  };
}
