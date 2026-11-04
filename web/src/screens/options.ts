import type { App, Screen } from '../app/app';
import { BTN } from '../game/core-api';
import { Menu, clamp, cycle, type MenuRow } from './menu';
import { DEVICE_IDS, keyLabel, padLabel } from '../input/input';
import { CLIP_SECONDS, clipKeyAllowed, clipKeyConflict, clipPadConflict, type ClipConflict } from '../clip/binding';
import { SLOT_COUNT, controlsOf, defaultSettings, devControls, gameplayOf, setDevice, type ControlPreset } from '../app/settings';
import { S } from '../render/text/strings';
import { MUSIC } from '../app/audio';
import { FADE_MENU, FADE_TO_TITLE } from '../app/fade';
import { drawLobbyList, type LobbyItem } from '../render/lobby-list';
import { titleScreen } from './title';
import { remapScreen } from './remap';
import { isTouchDevice, setTouchStyle, touchStyle } from '../input/touch';
import type { Tone } from '../render/text/types';

interface Row extends MenuRow { label: string; value?: () => string; tone?: () => Tone | undefined }

/** Página das Opções: a principal e os submenus Controles, Jogabilidade e Clipe. */
export type OptionsPage = 'main' | 'controls' | 'gameplay' | 'clip';
/** Linha de cada submenu na página principal (o VOLTAR do submenu devolve o cursor nela). */
const SUBMENU_ROW: Record<Exclude<OptionsPage, 'main'>, number> = { controls: 0, gameplay: 1, clip: 2 };
type ClipCapture = 'clipKey' | 'clipPad';

/**
 * Opções (§6.13, R15, R25). Principal: submenus, volume de música/efeitos (a ROM vem embutida: rom/pack.ts).
 * Controles: por jogador, dispositivo (←/→) e controles próprios (A abre); depois do slot 3 vem o DEV CONTROLES (fixo,
 * só carrega). Jogabilidade: spawns aleatórios, as regras extras (luva, arremesso de jogador, soneca) e as montarias extras. `back` (linha e B): do submenu volta às Opções; das Opções, ao
 * título na "Opções". `ret`: submenu aberto de fora das Opções (atalho em "Configure as regras"); o `back` dele volta
 * para essa tela em vez das Opções.
 */
export type OptionsScreen = Screen & {
  readonly menu: Menu; readonly page: OptionsPage; readonly capturing: ClipCapture | null;
  rowIds(): string[]; value(id: string): string; footer(): string | undefined;
};

export function optionsScreen(app: App, cursor?: number, page: OptionsPage = 'main', ret?: () => Screen): OptionsScreen {
  const st = app.settings;
  // `opt()` lê `st.options` na hora (nunca um alias congelado): "RESTAURAR PADRÃO" troca `st.options` por um
  // objeto novo (`d.options`), e um alias tirado na criação da tela ficaria apontando para o objeto antigo —
  // os controles de música/efeitos/spawns pareceriam obedecer, mas editariam um objeto órfão, nunca salvo.
  const opt = (): typeof st.options => st.options;

  app.audio.ensureMenus(ret ? MUSIC.menus : MUSIC.title);   // aberto das regras: segue a música dos menus da batalha

  const goBack = (): void => {
    if (page === 'main') app.transition(() => titleScreen(app, { cursor: 2 }), FADE_TO_TITLE);
    else if (ret) app.transition(ret, FADE_MENU);
    else app.transition(() => optionsScreen(app, SUBMENU_ROW[page]), FADE_MENU);
  };
  const open = (to: OptionsPage): void => { app.transition(() => optionsScreen(app, 0, to), FADE_MENU); };
  const turn = (i: number, d: number): boolean => { setDevice(st.devices, i, cycle(DEVICE_IDS, st.devices[i], d)); app.save(); return true; };
  const rows: Row[] = [];
  // Slots (Controles e Jogabilidade): SLOT escolhe com ←/→; SALVAR grava o atual; CARREGAR aplica o do slot. Nos
  // Controles, um a mais depois do 3: o DEV CONTROLES (fixo: não salva, só carrega).
  let slot = page === 'controls' ? SLOT_COUNT : 0;   // Controles abre no DEV CONTROLES (o padrão carregado)
  const dev = (): boolean => page === 'controls' && slot === SLOT_COUNT;
  let note: { id: string; text: string } | null = null;
  const said = (id: string): string => (note?.id === id ? note.text : '');
  const slotRows = (has: () => boolean, save: () => void, load: () => void): void => {
    const last = page === 'controls' ? SLOT_COUNT : SLOT_COUNT - 1;
    rows.push({
      id: 'slot', label: S.options.slot, value: () => (dev() ? S.options.devSlot : `${slot + 1}${has() ? '' : ' ' + S.options.slotEmpty}`),
      left: () => { const b = slot; slot = clamp(slot - 1, 0, last); note = null; return slot !== b; },
      right: () => { const b = slot; slot = clamp(slot + 1, 0, last); note = null; return slot !== b; },
    });
    rows.push({ id: 'slotSave', label: S.options.slotSave, value: () => said('slotSave'),
      select: () => {
        if (dev()) { note = { id: 'slotSave', text: S.options.slotFixed }; return false; }
        save(); app.save(); note = { id: 'slotSave', text: S.options.slotSaved };
      } });
    rows.push({ id: 'slotLoad', label: S.options.slotLoad, value: () => said('slotLoad'),
      select: () => { if (!has()) return; load(); app.save(); note = { id: 'slotLoad', text: S.options.slotLoaded }; } });
  };
  if (page === 'main') {
    rows.push({ id: 'controls', label: S.options.controlsMenu, select: () => { open('controls'); } });
    rows.push({ id: 'gameplay', label: S.options.gameplayMenu, select: () => { open('gameplay'); } });
    rows.push({ id: 'clip', label: S.options.clipMenu, select: () => { open('clip'); } });
  }
  // CLIPE (src/clip): gravar ou não, a duração e o botão (tecla e botão de controle, lidos fora das entradas do jogo).
  // Sem suporte (fora do Chrome), tudo desativado com o aviso.
  let capturing: ClipCapture | null = null;
  let suppress = false;
  const off = !app.clipSupported;
  const conflict = (id: string): ClipConflict | null =>
    id === 'clipKey' ? clipKeyConflict(st, opt().clipKey) : id === 'clipPad' ? clipPadConflict(st, opt().clipPad) : null;
  const bound = (): void => { app.applyInput(); app.save(); };
  if (page === 'clip') {
    const setOn = (on: boolean): boolean => { const changed = opt().clipOn !== on; opt().clipOn = on; app.save(); return changed; };
    const setSec = (sec: (typeof CLIP_SECONDS)[number]): boolean => { const changed = opt().clipSec !== sec; opt().clipSec = sec; app.save(); return changed; };
    rows.push({
      id: 'clipOn', label: S.options.clipOn, disabled: off,
      tone: () => (off ? 'gray' : undefined),
      value: () => (off ? S.options.clipOnlyChrome : opt().clipOn ? S.options.yes : S.options.no),
      left: () => setOn(false), right: () => setOn(true),
    });
    rows.push({
      id: 'clipSec', label: S.options.clipSec, disabled: off, value: () => S.options.clipSecValue(opt().clipSec),
      tone: () => (off ? 'gray' : undefined),
      left: () => setSec(CLIP_SECONDS[0]), right: () => setSec(CLIP_SECONDS[CLIP_SECONDS.length - 1]),
    });
    rows.push({
      id: 'clipKey', label: S.options.clipKey, disabled: off,
      value: () => (opt().clipKey ? keyLabel(opt().clipKey) : S.options.clipNone),
      tone: () => (off ? 'gray' : conflict('clipKey') ? 'orange' : undefined),
      select: () => { capturing = 'clipKey'; },
      left: () => { opt().clipKey = ''; bound(); return true; }, right: () => { opt().clipKey = ''; bound(); return true; },
    });
    rows.push({
      id: 'clipPad', label: S.options.clipPad, disabled: off,
      value: () => (opt().clipPad >= 0 ? padLabel(opt().clipPad) : S.options.clipNone),
      tone: () => (off ? 'gray' : conflict('clipPad') ? 'orange' : undefined),
      select: () => { capturing = 'clipPad'; },
      left: () => { opt().clipPad = -1; bound(); return true; }, right: () => { opt().clipPad = -1; bound(); return true; },
    });
  }
  if (page === 'controls') for (let i = 0; i < 5; i++) {
    rows.push({
      id: `p${i + 1}`, label: S.options.player(i + 1), value: () => S.options.devices[st.devices[i]],
      left: () => turn(i, -1), right: () => turn(i, 1),
      select: () => { app.transition(() => remapScreen(app, i, ret), FADE_MENU); },
    });
  }
  const presetAt = (): ControlPreset | null => (dev() ? devControls() : st.controlSlots[slot]);
  if (page === 'controls') slotRows(() => !!presetAt(), () => { st.controlSlots[slot] = controlsOf(st); }, () => {
    const c = controlsOf(presetAt()!);
    st.devices = c.devices; st.keymaps = c.keymaps; st.padmaps = c.padmaps;
    app.applyInput();
  });
  if (page === 'gameplay') {
    rows.push({
      id: 'spawns', label: S.options.spawns, value: () => (opt().randomSpawns ? S.options.yes : S.options.no),
      left: () => { const changed = opt().randomSpawns; opt().randomSpawns = false; app.save(); return changed; },
      right: () => { const changed = !opt().randomSpawns; opt().randomSpawns = true; app.save(); return changed; },
    });
    rows.push({
      id: 'escape', label: S.options.escape, value: () => String(opt().gloveEscape),   // apertos de B para sair da luva
      left: () => { const b = opt().gloveEscape; opt().gloveEscape = clamp(b - 1, 1, 30); app.save(); return opt().gloveEscape !== b; },
      right: () => { const b = opt().gloveEscape; opt().gloveEscape = clamp(b + 1, 1, 30); app.save(); return opt().gloveEscape !== b; },
    });
    rows.push({
      id: 'throwStun', label: S.options.throwStun, value: () => (opt().throwStun ? S.options.yes : S.options.no),
      left: () => { const changed = opt().throwStun; opt().throwStun = false; app.save(); return changed; },
      right: () => { const changed = !opt().throwStun; opt().throwStun = true; app.save(); return changed; },
    });
    rows.push({
      id: 'sleep', label: S.options.sleep, value: () => String(opt().sleepSec),   // duração do soneca (montaria F)
      left: () => { const b = opt().sleepSec; opt().sleepSec = clamp(b - 1, 1, 10); app.save(); return opt().sleepSec !== b; },
      right: () => { const b = opt().sleepSec; opt().sleepSec = clamp(b + 1, 1, 10); app.save(); return opt().sleepSec !== b; },
    });
    rows.push({   // ovos dos 13 tipos (a senha 0164 do original); padrão SIM
      id: 'allMounts', label: S.options.allMounts, value: () => (opt().allMounts ? S.options.yes : S.options.no),
      left: () => { const changed = opt().allMounts; opt().allMounts = false; app.save(); return changed; },
      right: () => { const changed = !opt().allMounts; opt().allMounts = true; app.save(); return changed; },
    });
    slotRows(() => !!st.gameplaySlots[slot], () => { st.gameplaySlots[slot] = gameplayOf(opt()); },
      () => { Object.assign(opt(), st.gameplaySlots[slot]); });
  }
  const setVol = (): void => app.audio.setVolume(opt().musicVol / 10, opt().sfxVol / 10);
  if (page === 'main') {
    rows.push({
      id: 'fx', label: S.options.fx, value: () => (opt().fx ? S.options.yes : S.options.no),
      left: () => { const changed = opt().fx; opt().fx = false; app.save(); return changed; },
      right: () => { const changed = !opt().fx; opt().fx = true; app.save(); return changed; },
    });
    if (isTouchDevice()) {   // só em tela de toque (ou ?touch): joystick flutuante ou direcional fixo
      const pick = (s: 'joystick' | 'dpad'): boolean => { const changed = touchStyle() !== s; if (changed) setTouchStyle(s); return changed; };
      rows.push({
        id: 'touchStyle', label: S.options.touchStyle,
        value: () => (touchStyle() === 'joystick' ? S.options.touchJoystick : S.options.touchDpad),
        left: () => pick('joystick'), right: () => pick('dpad'),
        select: () => { pick(touchStyle() === 'joystick' ? 'dpad' : 'joystick'); },
      });
    }
    rows.push({
      id: 'music', label: S.options.music, value: () => String(opt().musicVol),
      left: () => { const b = opt().musicVol; opt().musicVol = clamp(opt().musicVol - 1, 0, 10); app.save(); setVol(); return opt().musicVol !== b; },
      right: () => { const b = opt().musicVol; opt().musicVol = clamp(opt().musicVol + 1, 0, 10); app.save(); setVol(); return opt().musicVol !== b; },
    });
    rows.push({
      id: 'sfx', label: S.options.sfx, value: () => String(opt().sfxVol),
      left: () => { const b = opt().sfxVol; opt().sfxVol = clamp(opt().sfxVol - 1, 0, 10); app.save(); setVol(); return opt().sfxVol !== b; },
      right: () => { const b = opt().sfxVol; opt().sfxVol = clamp(opt().sfxVol + 1, 0, 10); app.save(); setVol(); return opt().sfxVol !== b; },
    });
    // MÚSICA PRÓPRIA: liga/desliga as faixas do jogador na batalha; ADICIONAR abre o seletor de arquivos (as faixas
    // ficam no navegador); APAGAR esquece todas. "Restaurar padrão" religa a opção, mas não apaga as faixas.
    const own = app.audio.ownMusic;
    const setOwn = (on: boolean): boolean => {
      const changed = opt().ownMusic !== on;
      opt().ownMusic = on; app.audio.setOwnMusicOn(on); app.save(); return changed;
    };
    rows.push({
      id: 'ownMusic', label: S.options.ownMusic, value: () => (opt().ownMusic ? S.options.yes : S.options.no),
      left: () => setOwn(false), right: () => setOwn(true),
    });
    rows.push({
      id: 'ownAdd', label: S.options.ownAdd, value: () => (own?.count ? S.options.ownCount(own.count) : S.options.ownNone),
      select: () => { note = null; own?.pick(); },
    });
    rows.push({
      id: 'ownClear', label: S.options.ownClear, value: () => said('ownClear'),
      select: () => { if (!own?.count) return; void own.clear(); note = { id: 'ownClear', text: S.options.ownCleared }; },
    });
    rows.push({
      id: 'reset', label: S.options.reset, select: () => {
        const d = defaultSettings();
        st.devices = d.devices; st.keymaps = d.keymaps; st.padmaps = d.padmaps; st.options = d.options;
        app.applyInput(); setVol(); app.audio.setOwnMusicOn(d.options.ownMusic); app.save();
      },
    });
  }
  rows.push({ id: 'back', label: S.options.back, select: () => { goBack(); } });

  const menu = new Menu(rows, { cursor });

  const who = (c: ClipConflict): string => (c.who === 'online' ? S.options.clipOnline : `P${c.who}`);
  const footer = (): string | undefined => {
    if (page === 'controls') return menu.cursor < 5 ? S.options.playerHelp : undefined;
    if (page !== 'clip') return undefined;
    if (capturing) return capturing === 'clipKey' ? S.options.clipPressKey : S.options.clipPressPad;
    if (off) return S.options.clipUnsupported;
    const id = rows[menu.cursor].id, c = conflict(id);
    if (c) return S.options.clipConflict(S.options.actions[c.action], who(c));
    return id === 'clipKey' || id === 'clipPad' ? S.options.clipBindHelp : S.options.clipHelp;
  };
  /** Captura do botão do clipe: tecla (Esc cancela; as do navegador e do sistema não valem) ou botão de qualquer controle. */
  const capture = (inp: Parameters<Screen['update']>[0]): void => {
    if (inp.key === 'Escape') { capturing = null; suppress = true; return; }
    if (capturing === 'clipKey' && inp.key && clipKeyAllowed(inp.key)) opt().clipKey = inp.key;
    else if (capturing === 'clipPad' && inp.padButton) opt().clipPad = inp.padButton.button;
    else return;
    capturing = null; suppress = true;
    bound();
  };

  return {
    id: 'options',
    menu,
    page,
    get capturing() { return capturing; },
    footer,
    rowIds() { return rows.map(r => r.id); },
    value(id: string) { return rows.find(r => r.id === id)?.value?.() ?? ''; },
    update(inp) {
      if (suppress) { if (inp.any === 0) suppress = false; return; }
      if (capturing) { capture(inp); return; }
      const ev = menu.update(inp.any, inp.pressedAny, app.audio);
      if (ev === 'back') goBack();
    },
    draw(ctx, bank) {
      const items: LobbyItem[] = rows.map(r => ({ label: r.label, value: r.value?.() ?? '', disabled: r.disabled,
        capturing: capturing === r.id, tone: r.tone?.() }));
      const title = page === 'controls' ? S.options.controlsTitle : page === 'gameplay' ? S.options.gameplayTitle
        : page === 'clip' ? S.options.clipTitle : S.options.title;
      drawLobbyList(ctx, bank, title, items, menu.cursor, footer());
    },
  };
}
