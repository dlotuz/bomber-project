import type { App, Screen } from '../app/app';
import type { RuleChoices } from '../app/settings';
import { FADE_MENU } from '../app/fade';
import { MUSIC } from '../app/audio';
import { romState } from '../app/rom-api';
import { carry } from '../game/match-session';
import { S } from '../render/text/strings';
import { drawText } from '../render/text/text';
import type { Tone } from '../render/text/types';
import { PpuCanvas } from '../render/screens-rom/scene';
import { buildRulesScene, RULES_FRAME } from '../render/screens-rom/rules';
import { Menu, clamp, type MenuRow } from './menu';
import { drawFallbackFrame, drawStaticBackground, drawStaticCursor } from './ui';
import { playersScreen } from './players';
import { charactersScreen } from './characters';

type ToggleKey = keyof Pick<RuleChoices, 'suddenDeath' | 'badBomber' | 'racer'>;
/** Âncora (centro, topo) do título, presa à faixa de texto da captura em `tests/screens/menu-title.test.ts`. */
export const RULES_TITLE = { x: 127, y: 21 } as const;
const TOGGLES: readonly ToggleKey[] = ['suddenDeath', 'badBomber', 'racer'];
const onOff = (b: boolean): string => (b ? S.rules.yes : S.rules.no);
/** Coluna dos valores (I10): alinhados à esquerda na coluna 11 do BG1 da captura `rules` (x = 176), como os rótulos na
 *  coluna 2 (x = 32). */
export const RULES_VALUE_X = 176;
/** Cores dos valores, lidas nas palavras do BG1 da tradução (`$E1:FF13…`, capturas `rules`/`state_st_rules_after`):
 *  paleta 0 (azul) em "Low" e "Off", 3 (verde) em "Normal", nos números e nos tempos, e 2 (vermelho) em "Strong" e
 *  "On"; o ∞ sai azul. São as linhas `blue`/`green`/`red` do `menuItem`. */
const CPU_TONE: readonly Tone[] = ['blue', 'green', 'red'];
const onOffTone = (b: boolean): Tone => (b ? 'red' : 'blue');

/** "Configure as regras": os 6 ajustes do original (§6.5, §3.14). Spawn aleatório mora em Opções (T3). */
export function rulesScreen(app: App): Screen & { readonly cursor: number; values(): string[]; tones(): Tone[] } {
  const r = app.settings.setup.rules;
  app.audio.ensureMenus(MUSIC.menus);

  const values = (): string[] => [
    S.rules.cpu[r.cpuLevel], S.rules.crowns[r.matches - 1], S.rules.time[r.timeIdx],
    onOff(r.suddenDeath), onOff(r.badBomber), onOff(r.racer),
  ];
  const tones = (): Tone[] => [
    CPU_TONE[r.cpuLevel], 'green', r.timeIdx === S.rules.time.length - 1 ? 'blue' : 'green',
    onOffTone(r.suddenDeath), onOffTone(r.badBomber), onOffTone(r.racer),
  ];
  const next = (): boolean => { app.transition(() => charactersScreen(app), FADE_MENU); return true; };
  // `get`/`set` (em vez de indexar `r[key]` com uma chave-união) porque `cpuLevel` é `0 | 1 | 2`
  // e `matches`/`timeIdx` são `number`: escrever por uma chave só união faz o TS pedir a interseção
  // dos tipos das três propriedades, não a união.
  const numeric = (id: string, get: () => number, set: (v: number) => void, min: number, max: number): MenuRow => ({
    id, select: next,
    left: () => { const v = clamp(get() - 1, min, max); if (v === get()) return false; set(v); app.save(); return true; },
    right: () => { const v = clamp(get() + 1, min, max); if (v === get()) return false; set(v); app.save(); return true; },
  });
  const toggle = (key: ToggleKey): MenuRow => ({
    id: key, select: next,
    left: () => { if (!r[key]) return false; r[key] = false; app.save(); return true; },
    right: () => {
      if (r[key]) return false;
      r[key] = true;
      if (key === 'racer') carry.racerPrize = null;   // §3.14: ligar a Corrida Bônus zera o prêmio guardado.
      app.save();
      return true;
    },
  });
  const rows: MenuRow[] = [
    numeric('cpuLevel', () => r.cpuLevel, v => { r.cpuLevel = v as 0 | 1 | 2; }, 0, 2),
    numeric('matches', () => r.matches, v => { r.matches = v; }, 1, 5),
    numeric('timeIdx', () => r.timeIdx, v => { r.timeIdx = v; }, 0, 4),
    ...TOGGLES.map(toggle),
  ];
  const menu = new Menu(rows);
  const canvas = new PpuCanvas();

  return {
    id: 'rules',
    get cursor() { return menu.cursor; },
    values,
    tones,
    update(inp) {
      if (menu.update(inp.any, inp.pressedAny, app.audio) === 'back') app.transition(() => playersScreen(app), FADE_MENU);
    },
    draw(ctx, bank) {
      const a = romState.assets;
      if (a) canvas.draw(ctx, buildRulesScene(a, { cursor: menu.cursor }));
      else {
        drawStaticBackground(ctx);
        drawFallbackFrame(ctx, RULES_FRAME);
        drawStaticCursor(ctx, 16, 56 + 24 * menu.cursor);
      }
      drawText(ctx, bank, 'menuTitle', S.rules.title, RULES_TITLE.x, RULES_TITLE.y, { align: 'center' });
      const vals = values(), tn = tones();
      for (let i = 0; i < S.rules.labels.length; i++) {
        const y = 55 + 24 * i;
        drawText(ctx, bank, 'menuItem', S.rules.labels[i], 32, y);
        drawText(ctx, bank, 'menuItem', vals[i], RULES_VALUE_X, y, { tone: tn[i] });
      }
    },
  };
}
