import type { App, Screen } from '../app/app';
import { Menu, cycle, type MenuRow } from './menu';
import {
  KEY_FIELDS, DEFAULT_KEYMAPS, DEFAULT_PADMAP, DEVICE_IDS, keyLabel, padLabel, assignKey, assignPadButton, isReservedKey,
  type DeviceId, type KeyMap, type PadMap,
} from '../input/input';
import { defaultSettings, setDevice } from '../app/settings';
import { S } from '../render/text/strings';
import { FADE_MENU } from '../app/fade';
import { drawLobbyList, type LobbyItem } from '../render/lobby-list';
import { optionsScreen } from './options';

type Capture = keyof KeyMap | 'device';
/** "Configurar todos" pede só as 12 ações do SNES; o PODER (opcional) fica de fora. */
const SEQ: readonly (keyof KeyMap)[] = KEY_FIELDS.filter(f => f !== 'power');

/**
 * Controles de um jogador: dispositivo (←/→ troca; A espera uma tecla ou um botão e escolhe o teclado ou aquele
 * controle), as 12 ações dele (A na ação, depois a tecla/botão nova), "configurar todos" (pede uma ação depois da
 * outra), restaurar o padrão deste jogador e voltar. Na captura vale tecla (`inp.key`; Escape cancela; F1–F12, Tab e
 * as teclas do sistema são ignoradas) ou botão de qualquer controle (`inp.padButton`), e o jogador passa para o
 * dispositivo usado. Tecla/botão já usado em outra ação: as duas
 * trocam (`assignKey`/`assignPadButton`). Depois de gravar ou cancelar: `applyInput()`, `save()` e ignora tudo até
 * soltar (evita reabrir com a tecla/botão novo ainda segurado).
 */
export type RemapScreen = Screen & { readonly menu: Menu; readonly capturing: Capture | null };

/** De quem são os controles editados: um dos 5 jogadores locais ou um perfil avulso (o controle da sala online). */
export interface RemapTarget {
  title: string;
  /** Visual das telas do online (fundo azul, faixas em duas colunas) em vez da página das Opções. */
  lobby?: boolean;
  /** Linha de rodapé quando nada mais pede ajuda (ex.: de quem são os controles). */
  sub?: string;
  device(): DeviceId;
  setDevice(d: DeviceId): void;
  keymap(): KeyMap;
  padmap(): PadMap;
  /** Grava a tecla na ação (trocando com quem já a usava). */
  assignKey(f: keyof KeyMap, code: string): void;
  /** Volta ao padrão (teclas, botões e dispositivo). */
  reset(): void;
  /** Opcional: carrega o dispositivo, as teclas e os botões de um dos 5 jogadores locais (0–4). */
  copyFrom?(player: number): void;
  /** Jogador que não pode ser a origem da cópia (o próprio, nos controles locais). */
  copyExclude?: number;
  back(): void;
}

/** Controles do jogador local `player` (Opções > Controles). `ret`: para onde o submenu Controles volta (ver
 *  `optionsScreen`). */
export function remapScreen(app: App, player: number, ret?: () => Screen): RemapScreen {
  const st = app.settings;
  return remapTargetScreen(app, {
    title: S.options.controlsTitle,
    sub: S.options.controls(player + 1),
    device: () => st.devices[player],
    setDevice: d => setDevice(st.devices, player, d),
    keymap: () => st.keymaps[player],
    padmap: () => st.padmaps[player],
    assignKey: (f, code) => assignKey(st.keymaps, player, f, code),
    reset: () => {
      for (const f of KEY_FIELDS) assignKey(st.keymaps, player, f, DEFAULT_KEYMAPS[player][f]);
      st.padmaps[player] = { ...DEFAULT_PADMAP };
      setDevice(st.devices, player, defaultSettings().devices[player]);
    },
    copyExclude: player,
    copyFrom: p => {   // teclas e botões do outro jogador; o controle (gamepad) em uso continua o mesmo
      st.keymaps[player] = { ...st.keymaps[p] };
      st.padmaps[player] = { ...st.padmaps[p] };
      if (st.devices[p] === 'kb' || st.devices[p] === 'none') setDevice(st.devices, player, st.devices[p]);
    },
    back: () => { app.transition(() => optionsScreen(app, player, 'controls', ret), FADE_MENU); },
  });
}

export function remapTargetScreen(app: App, t: RemapTarget): RemapScreen {
  const dev = (): DeviceId => t.device();
  let capturing: Capture | null = null;
  let seq = false;
  let suppress = false;

  const goBack = (): void => { t.back(); };
  const capture = (c: Capture): void => { capturing = c; menu.cursor = rows.findIndex(r => r.id === c); };
  const turn = (d: number): boolean => { t.setDevice(cycle(DEVICE_IDS, dev(), d)); app.save(); return true; };
  /** ←/→ no PODER apaga a tecla própria do P (volta ao Y fazendo P e soco, como na ROM). */
  const clearPower = (): boolean => {
    t.keymap().power = ''; t.padmap().power = -1;
    app.applyInput(); app.save();
    return true;
  };

  const step = (from: number, d: number): number => {
    let n = from + d;
    if (n === t.copyExclude) n += d;
    return n < 0 || n > 4 ? from : n;
  };
  let src = t.copyExclude === 0 ? 1 : 0;
  let copied = false;
  const rows: MenuRow[] = [
    { id: 'device', left: () => turn(-1), right: () => turn(1), select: () => { capture('device'); } },
    ...KEY_FIELDS.map(f => ({ id: f, select: () => { capture(f); }, ...(f === 'power' ? { left: clearPower, right: clearPower } : {}) })),
    ...(t.copyFrom ? [{
      id: 'copy',
      left: () => { const b = src; src = step(src, -1); copied = false; return src !== b; },
      right: () => { const b = src; src = step(src, 1); copied = false; return src !== b; },
      select: () => { t.copyFrom!(src); copied = true; app.applyInput(); app.save(); },
    }] : []),
    { id: 'all', select: () => { seq = true; capture(SEQ[0]); } },
    {
      id: 'reset', select: () => {
        t.reset();
        app.applyInput(); app.save();
      },
    },
    { id: 'back', select: () => { goBack(); } },
  ];
  const menu = new Menu(rows);

  const label = (id: string): string => (id === 'device' ? S.options.device : id === 'copy' ? S.options.copyFrom : id === 'all' ? S.options.all
    : id === 'reset' ? S.options.reset : id === 'back' ? S.options.back : S.options.actions[id as keyof KeyMap]);
  const value = (id: string): string => {
    if (id === capturing) return '';
    if (id === 'device') return S.options.devices[dev()];
    if (id === 'copy') return copied ? S.options.copyDone : `P${src + 1}`;
    if (!(KEY_FIELDS as readonly string[]).includes(id) || dev() === 'none') return '';
    const f = id as keyof KeyMap;
    return dev() === 'kb' ? keyLabel(t.keymap()[f]) : padLabel(t.padmap()[f]);
  };

  const done = (): void => {
    const i = seq && capturing && capturing !== 'device' ? SEQ.indexOf(capturing) + 1 : SEQ.length;
    if (i < SEQ.length) capture(SEQ[i]);
    else { capturing = null; seq = false; }
    suppress = true; app.applyInput(); app.save();
  };
  const cancel = (): void => { seq = false; capturing = null; suppress = true; app.applyInput(); app.save(); };

  return {
    id: 'remap',
    menu,
    get capturing() { return capturing; },
    update(inp) {
      if (suppress) { if (inp.any === 0) suppress = false; return; }
      if (capturing) {
        if (inp.key === 'Escape') { cancel(); return; }
        // Aceita qualquer dispositivo (senão quem está no controle ficaria preso esperando uma tecla): o jogador passa a
        // usar aquele em que apertou.
        const key = inp.key && !isReservedKey(inp.key) ? inp.key : null;
        const pb = inp.padButton && inp.padButton.pad < 4 ? inp.padButton : null;
        if (!key && !pb) return;
        t.setDevice(key ? 'kb' : `gp${pb!.pad}` as DeviceId);
        if (capturing !== 'device') {
          if (key) t.assignKey(capturing, key);
          else assignPadButton(t.padmap(), capturing, pb!.button);
        }
        done();
        return;
      }
      const ev = menu.update(inp.any, inp.pressedAny, app.audio);
      if (ev === 'back') goBack();
    },
    draw(ctx, bank) {
      const items: LobbyItem[] = rows.map(r => ({ label: label(r.id), value: value(r.id), capturing: capturing === r.id }));
      const id = rows[menu.cursor].id;
      const footer = capturing ? S.options.pressAny : id === 'power' ? S.options.powerHelp : id === 'copy' ? S.options.copyHelp(src + 1) : t.sub;
      drawLobbyList(ctx, bank, t.title, items, menu.cursor, footer);
    },
  };
}
