import type { App, Screen } from '../app/app';
import type { RuleChoices } from '../app/settings';
import { MenuList, clamp, type MenuItem } from './menu';
import { drawFooter, drawMenuPage } from './ui';
import { playersScreen } from './players';
import { charactersScreen } from './characters';

export const CPU_LEVEL_LABELS = ['FRACO', 'NORMAL', 'FORTE'];
export const TIME_LABELS = ['1:00', '2:00', '3:00', '5:00', 'SEM LIMITE'];
const onOff = (b: boolean) => (b ? 'LIGADO' : 'DESLIGADO');

/** "Configure as regras": os 6 ajustes do original + spawn aleatório. */
export function rulesScreen(app: App): Screen {
  const r = app.settings.setup.rules;
  const next = () => { app.save(); app.go(charactersScreen(app)); };
  const setNum = (key: 'cpuLevel' | 'matches' | 'timeIdx', v: number) => {
    if (key === 'cpuLevel') r.cpuLevel = v as 0 | 1 | 2;
    else r[key] = v;
    app.save();
  };
  const numeric = (label: string, get: () => string, key: 'cpuLevel' | 'matches' | 'timeIdx', min: number, max: number): MenuItem => ({
    label, value: get, select: next,
    left: () => setNum(key, clamp(r[key] - 1, min, max)),
    right: () => setNum(key, clamp(r[key] + 1, min, max)),
  });
  const toggle = (label: string, key: keyof Pick<RuleChoices, 'suddenDeath' | 'badBomber' | 'racer' | 'randomSpawns'>): MenuItem => ({
    label, value: () => onOff(r[key]), select: next,
    left: () => { r[key] = !r[key]; app.save(); },
    right: () => { r[key] = !r[key]; app.save(); },
  });
  const list = new MenuList([
    numeric('NÍVEL DA CPU', () => CPU_LEVEL_LABELS[r.cpuLevel], 'cpuLevel', 0, 2),
    numeric('COROAS PARA VENCER', () => String(r.matches), 'matches', 1, 5),
    numeric('TEMPO', () => TIME_LABELS[r.timeIdx], 'timeIdx', 0, 4),
    toggle('MORTE SÚBITA', 'suddenDeath'),
    toggle('BOMBER VINGADOR', 'badBomber'),
    toggle('CORRIDA', 'racer'),
    toggle('SPAWN ALEATÓRIO', 'randomSpawns'),
    { label: 'CONTINUAR', select: next },
  ]);
  return {
    id: 'rules',
    update(inp) { if (list.handle(inp.pressedAny) === 'back') app.go(playersScreen(app)); },
    draw(ctx, bank, frame) {
      drawMenuPage(ctx, bank, frame, 'CONFIGURE AS REGRAS', list, 224);
      drawFooter(ctx, bank, 'ESQ/DIR: MUDAR   A: CONTINUAR');
    },
  };
}
