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
import { CHARACTERS } from '../render/art/bomber';
import { drawOptionsPage, type OptionsRow } from '../render/screens-rom/options';
import { online, type Lobby } from '../net/online';
import { startTextEntry, type TextEntry } from '../net/text-entry';
import { Menu, type MenuRow } from './menu';
import { titleScreen } from './title';

const NAME_MAX = 10, CODE_LEN = 4;
interface Row extends MenuRow { label: string; value?: () => string }

/** Opções de uma vaga sem jogador (anfitrião): CPU com cada personagem, depois NENHUM. */
const CPU_CHOICES = CHARACTERS.length + 1;
const cpuChoice = (L: Lobby, s: number): number => (L.slots[s] === 'off' ? CHARACTERS.length : L.chars[s]);

export type OnlineScreen = Screen & { readonly menu: Menu; rowIds(): string[]; value(id: string): string; readonly editing: string | null };

export function onlineScreen(app: App, o: { code?: string } = {}): OnlineScreen {
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
  const outMenu = new Menu(outRows, { cursor: code ? 2 : 0 });

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
      id: 'stage', label: S.online.stage, value: () => STAGE_NAMES_PT[L().stage - 1].toUpperCase(),
      left: () => (host() ? (net.setLobby({ stage: cycleRule(10, L().stage - 1, -1) + 1 }), true) : false),
      right: () => (host() ? (net.setLobby({ stage: cycleRule(10, L().stage - 1, 1) + 1 }), true) : false),
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
      id: 'level', label: S.online.level, value: () => S.rules.cpu[L().rules.cpuLevel].toUpperCase(),
      left: () => host() && setRule({ cpuLevel: cycleRule(3, L().rules.cpuLevel, -1) as 0 | 1 | 2 }),
      right: () => host() && setRule({ cpuLevel: cycleRule(3, L().rules.cpuLevel, 1) as 0 | 1 | 2 }),
    },
    {
      id: 'sudden', label: S.online.sudden, value: () => yesNo(L().rules.suddenDeath),
      left: () => host() && setRule({ suddenDeath: !L().rules.suddenDeath }), right: () => host() && setRule({ suddenDeath: !L().rules.suddenDeath }),
    },
    {
      id: 'bad', label: S.online.bad, value: () => yesNo(L().rules.badBomber),
      left: () => host() && setRule({ badBomber: !L().rules.badBomber }), right: () => host() && setRule({ badBomber: !L().rules.badBomber }),
    },
    {
      id: 'invite', label: S.online.invite, value: () => (copied > 0 ? S.online.copied : S.online.copy),
      select: () => { void navigator.clipboard?.writeText(net.invite()).catch(() => {}); copied = 180; },
    },
    {
      id: 'start', label: S.online.start, select: () => {
        const lob = L();
        if (!host() || net.room!.playing || lob.slots.filter(k => k !== 'off').length < 2) return false;
        net.start();
      },
    },
    { id: 'leave', label: S.online.leave, select: () => { net.leave(); } },
  ];
  const inMenu = new Menu(inRows, { cursor: 0 });
  let wasIn = false;

  /** Texto de uma vaga: "1P  NOME (VOCÊ)" / "2P  CPU" / "3P  NENHUM" e o personagem à direita. */
  function slotTexts(s: number): OptionsRow {
    const room = net.room!, lob = L(), kind = lob.slots[s];
    const who = kind === 'human' ? `${lob.names[s] || S.online.slot(s)}${s === room.you ? ` (${S.online.you})` : ''}` : kind === 'cpu' ? S.online.cpu : S.online.off;
    const editable = s === room.you || (room.host && kind !== 'human');
    return { label: `${S.online.slot(s)}  ${who}`, value: kind === 'off' ? '' : CHARACTERS[lob.chars[s]].name, disabled: !editable };
  }
  function inDisplay(): OptionsRow[] {
    const room = net.room!;
    return inRows.map((r, i) => {
      if (i < 5) return slotTexts(i);
      const rule = i >= 5 && i <= 10;
      if (r.id === 'invite') return { label: `${S.online.code} ${room.code}`, value: r.value!() };   // código + copiar o link
      if (r.id === 'start') {
        const label = room.playing ? S.online.playing : room.host ? S.online.start : S.online.waitHost;
        return { label, value: '', disabled: !room.host || room.playing };
      }
      return { label: r.label, value: r.value?.() ?? '', disabled: rule && !room.host };
    });
  }
  const footer = (): string => {
    if (entry) return S.online.typing;
    if (net.message) return net.message;
    if (net.connecting) return S.online.connecting;
    return net.room ? (net.room.host ? S.online.help : S.online.guestHelp) : '';
  };

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
        if (inp.pressedAny & BTN.B) { inMenu.cursor = inRows.length - 1; app.audio.sfx(SFX.move); return; }
        inMenu.update(inp.any, inp.pressedAny, app.audio);
      } else if (outMenu.update(inp.any, inp.pressedAny, app.audio) === 'back') {
        app.transition(() => titleScreen(app, { cursor: 1 }), FADE_TO_TITLE);
      }
    },
    draw(ctx, bank) {
      if (net.room) drawOptionsPage(ctx, bank, S.online.title, inDisplay(), inMenu.cursor, footer());
      else {
        const rows = outRows.map(r => ({ label: r.label, value: r.value?.() ?? '' }));
        drawOptionsPage(ctx, bank, S.online.title, rows, outMenu.cursor, footer());
      }
    },
  };
}
