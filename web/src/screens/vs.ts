import type { App, Screen } from '../app/app';
import { MenuList } from './menu';
import { drawMenuPage } from './ui';
import { titleScreen } from './title';
import { playersScreen } from './players';

export function vsModeScreen(app: App): Screen {
  const list = new MenuList([
    { label: 'BATTLE ROYALE', select: () => app.go(modeScreen(app)) },
    { label: 'CHAMPIONSHIP', value: () => 'EM BREVE', disabled: true },
    { label: 'BOMBERMANIA', value: () => 'EM BREVE', disabled: true },
  ]);
  return {
    id: 'vs',
    update(inp) { if (list.handle(inp.pressedAny) === 'back') app.go(titleScreen(app)); },
    draw(ctx, bank, frame) { drawMenuPage(ctx, bank, frame, 'ESCOLHA O MODO VS', list); },
  };
}

export function modeScreen(app: App): Screen {
  const setup = app.settings.setup;
  const pick = (mode: 'ffa' | 'team') => () => { setup.mode = mode; app.save(); app.go(playersScreen(app)); };
  const list = new MenuList([
    { label: 'TODOS CONTRA TODOS', select: pick('ffa') },
    { label: 'BATALHA EM TIMES', select: pick('team') },
  ]);
  if (setup.mode === 'team') list.cursor = 1;
  return {
    id: 'mode',
    update(inp) { if (list.handle(inp.pressedAny) === 'back') app.go(vsModeScreen(app)); },
    draw(ctx, bank, frame) { drawMenuPage(ctx, bank, frame, 'BATTLE ROYALE', list); },
  };
}
