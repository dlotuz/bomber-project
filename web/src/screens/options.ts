import type { App, Screen } from '../app/app';
import { BTN } from '../game/core-api';
import { Menu, clamp, cycle, type MenuRow } from './menu';
import { DEVICE_IDS, type DeviceId } from '../input/input';
import { defaultSettings } from '../app/settings';
import { romState, openRomDialog, forgetStoredRom } from '../app/rom-api';
import { S } from '../render/text/strings';
import { FADE_MENU, FADE_TO_TITLE } from '../app/fade';
import { drawOptionsPage, PpuCanvas, type OptionsRow } from '../render/screens-rom/options';
import { titleScreen } from './title';
import { remapScreen } from './remap';

interface Row extends MenuRow { label: string; value?: () => string }

/**
 * Opções (§6.13, R15, R25): dispositivo por jogador, remapeamento de teclado/gamepad, spawns aleatórios, volume
 * de música/efeitos e o painel da ROM (carregar/esquecer). `back` (linha e B) volta ao título na "Opções".
 */
export function optionsScreen(app: App): Screen & { readonly menu: Menu; rowIds(): string[]; value(id: string): string; readonly asking: boolean } {
  const st = app.settings;
  const opt = st.options;
  let asking = false;

  const goBack = (): void => { app.transition(() => titleScreen(app, { cursor: 2 }), FADE_TO_TITLE); };
  const openRemap = (dev: Exclude<DeviceId, 'none'>) => (): void => { app.transition(() => remapScreen(app, dev), FADE_MENU); };

  const rows: Row[] = [];
  for (let i = 0; i < 5; i++) {
    rows.push({
      id: `p${i + 1}`, label: S.options.player(i + 1), value: () => S.options.devices[st.devices[i]],
      left: () => { st.devices[i] = cycle(DEVICE_IDS, st.devices[i], -1); app.save(); return true; },
      right: () => { st.devices[i] = cycle(DEVICE_IDS, st.devices[i], 1); app.save(); return true; },
    });
  }
  rows.push({ id: 'kb1', label: S.options.keys(1), select: openRemap('kb0') });
  rows.push({ id: 'kb2', label: S.options.keys(2), select: openRemap('kb1') });
  (['gp0', 'gp1', 'gp2', 'gp3'] as const).forEach((dev, i) => {
    rows.push({ id: `gp${i + 1}`, label: S.options.pad(i + 1), select: openRemap(dev) });
  });
  rows.push({
    id: 'spawns', label: S.options.spawns, value: () => (opt.randomSpawns ? S.options.yes : S.options.no),
    left: () => { const changed = opt.randomSpawns; opt.randomSpawns = false; app.save(); return changed; },
    right: () => { const changed = !opt.randomSpawns; opt.randomSpawns = true; app.save(); return changed; },
  });
  const setVol = (): void => app.audio.setVolume(opt.musicVol / 10, opt.sfxVol / 10);
  rows.push({
    id: 'music', label: S.options.music, value: () => String(opt.musicVol),
    left: () => { const b = opt.musicVol; opt.musicVol = clamp(opt.musicVol - 1, 0, 10); app.save(); setVol(); return opt.musicVol !== b; },
    right: () => { const b = opt.musicVol; opt.musicVol = clamp(opt.musicVol + 1, 0, 10); app.save(); setVol(); return opt.musicVol !== b; },
  });
  rows.push({
    id: 'sfx', label: S.options.sfx, value: () => String(opt.sfxVol),
    left: () => { const b = opt.sfxVol; opt.sfxVol = clamp(opt.sfxVol - 1, 0, 10); app.save(); setVol(); return opt.sfxVol !== b; },
    right: () => { const b = opt.sfxVol; opt.sfxVol = clamp(opt.sfxVol + 1, 0, 10); app.save(); setVol(); return opt.sfxVol !== b; },
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
  rows.push({ id: 'back', label: S.options.back, select: () => { goBack(); } });

  const menu = new Menu(rows);
  const canvas = new PpuCanvas();

  return {
    id: 'options',
    menu,
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
      drawOptionsPage(ctx, bank, canvas, S.options.title, displayRows, menu.cursor, asking ? S.options.forgetAsk : undefined);
    },
  };
}
