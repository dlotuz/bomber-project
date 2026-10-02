import type { App, Screen } from '../app/app';
import { BTN } from '../game/core-api';
import { Menu, clamp, cycle, type MenuRow } from './menu';
import { DEVICE_IDS } from '../input/input';
import { SLOT_COUNT, controlsOf, defaultSettings, gameplayOf, setDevice } from '../app/settings';
import { romState, openRomDialog, forgetStoredRom } from '../app/rom-api';
import { S } from '../render/text/strings';
import { MUSIC } from '../app/audio';
import { FADE_MENU, FADE_TO_TITLE } from '../app/fade';
import { drawOptionsPage, type OptionsRow } from '../render/screens-rom/options';
import { titleScreen } from './title';
import { remapScreen } from './remap';
import { passwordScreen } from './password';

interface Row extends MenuRow { label: string; value?: () => string }

/** Página das Opções: a principal e os submenus Controles e Jogabilidade. */
export type OptionsPage = 'main' | 'controls' | 'gameplay';

/**
 * Opções (§6.13, R15, R25). Principal: submenus, volume de música/efeitos e o painel da ROM (carregar/esquecer).
 * Controles: por jogador, dispositivo (←/→) e controles próprios (A abre). Jogabilidade: spawns aleatórios e as
 * regras extras (luva, arremesso de jogador, soneca). `back` (linha e B): do submenu volta às Opções; das Opções, ao
 * título na "Opções".
 */
export function optionsScreen(app: App, cursor?: number, page: OptionsPage = 'main'): Screen & { readonly menu: Menu; readonly page: OptionsPage; rowIds(): string[]; value(id: string): string; readonly asking: boolean } {
  const st = app.settings;
  // `opt()` lê `st.options` na hora (nunca um alias congelado): "RESTAURAR PADRÃO" troca `st.options` por um
  // objeto novo (`d.options`), e um alias tirado na criação da tela ficaria apontando para o objeto antigo —
  // os controles de música/efeitos/spawns pareceriam obedecer, mas editariam um objeto órfão, nunca salvo.
  const opt = (): typeof st.options => st.options;
  let asking = false;

  app.audio.ensureMenus(MUSIC.title);

  const goBack = (): void => {
    if (page === 'main') app.transition(() => titleScreen(app, { cursor: 1 }), FADE_TO_TITLE);
    else app.transition(() => optionsScreen(app, page === 'controls' ? 0 : 1), FADE_MENU);
  };
  const open = (to: OptionsPage): void => { app.transition(() => optionsScreen(app, 0, to), FADE_MENU); };
  const turn = (i: number, d: number): boolean => { setDevice(st.devices, i, cycle(DEVICE_IDS, st.devices[i], d)); app.save(); return true; };
  const rows: Row[] = [];
  // Slots (Controles e Jogabilidade): SLOT escolhe com ←/→; SALVAR grava o atual; CARREGAR aplica o do slot.
  let slot = 0;
  let note: { id: string; text: string } | null = null;
  const said = (id: string): string => (note?.id === id ? note.text : '');
  const slotRows = (has: () => boolean, save: () => void, load: () => void): void => {
    rows.push({
      id: 'slot', label: S.options.slot, value: () => `${slot + 1}${has() ? '' : ' ' + S.options.slotEmpty}`,
      left: () => { const b = slot; slot = clamp(slot - 1, 0, SLOT_COUNT - 1); note = null; return slot !== b; },
      right: () => { const b = slot; slot = clamp(slot + 1, 0, SLOT_COUNT - 1); note = null; return slot !== b; },
    });
    rows.push({ id: 'slotSave', label: S.options.slotSave, value: () => said('slotSave'),
      select: () => { save(); app.save(); note = { id: 'slotSave', text: S.options.slotSaved }; } });
    rows.push({ id: 'slotLoad', label: S.options.slotLoad, value: () => said('slotLoad'),
      select: () => { if (!has()) return; load(); app.save(); note = { id: 'slotLoad', text: S.options.slotLoaded }; } });
  };
  if (page === 'main') {
    rows.push({ id: 'controls', label: S.options.controlsMenu, select: () => { open('controls'); } });
    rows.push({ id: 'gameplay', label: S.options.gameplayMenu, select: () => { open('gameplay'); } });
  }
  if (page === 'controls') for (let i = 0; i < 5; i++) {
    rows.push({
      id: `p${i + 1}`, label: S.options.player(i + 1), value: () => S.options.devices[st.devices[i]],
      left: () => turn(i, -1), right: () => turn(i, 1),
      select: () => { app.transition(() => remapScreen(app, i), FADE_MENU); },
    });
  }
  if (page === 'controls') slotRows(() => !!st.controlSlots[slot], () => { st.controlSlots[slot] = controlsOf(st); }, () => {
    const c = controlsOf(st.controlSlots[slot]!);
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
    rows.push({
      id: 'password', label: S.password.menu, value: () => (opt().allMounts ? S.password.active : ''),
      select: () => { const back = rows.findIndex(r => r.id === 'password'); app.transition(() => passwordScreen(app, back), FADE_MENU); },
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
    rows.push({
      id: 'romStatus', label: S.options.rom, disabled: true, value: () => (romState.assets ? S.options.romOk : S.options.romNo),
    });
    rows.push({ id: 'romLoad', label: S.options.load, select: () => { openRomDialog(); } });
    rows.push({ id: 'romForget', label: S.options.forget, select: () => { asking = true; } });
    rows.push({
      id: 'reset', label: S.options.reset, select: () => {
        const d = defaultSettings();
        st.devices = d.devices; st.keymaps = d.keymaps; st.padmaps = d.padmaps; st.options = d.options;
        app.applyInput(); setVol(); app.save();
      },
    });
  }
  rows.push({ id: 'back', label: S.options.back, select: () => { goBack(); } });

  const menu = new Menu(rows, { cursor });

  return {
    id: 'options',
    menu,
    page,
    get asking() { return asking; },
    rowIds() { return rows.map(r => r.id); },
    value(id: string) { return rows.find(r => r.id === id)?.value?.() ?? ''; },
    update(inp) {
      if (asking) {
        if (inp.pressedAny & BTN.A) { asking = false; void forgetStoredRom(); }
        else if (inp.pressedAny & BTN.B) { asking = false; }
        return;
      }
      const ev = menu.update(inp.any, inp.pressedAny, app.audio);
      if (ev === 'back') goBack();
    },
    draw(ctx, bank) {
      const displayRows: OptionsRow[] = rows.map(r => ({ label: r.label, value: r.value?.() ?? '', disabled: r.disabled }));
      const footer = asking ? S.options.forgetAsk : page === 'controls' && menu.cursor < 5 ? S.options.playerHelp : undefined;
      const title = page === 'controls' ? S.options.controlsTitle : page === 'gameplay' ? S.options.gameplayTitle : S.options.title;
      drawOptionsPage(ctx, bank, title, displayRows, menu.cursor, footer);
    },
  };
}
