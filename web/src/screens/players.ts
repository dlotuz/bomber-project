import type { App, Screen } from '../app/app';
import type { SlotKind } from '../app/settings';
import { validateSetup } from '../game/config';
import { MenuList, type MenuItem } from './menu';
import { COLORS, drawFooter, drawMenuPage } from './ui';
import { modeScreen } from './vs';
import { rulesScreen } from './rules';

interface SlotOption { kind: SlotKind; team: number }

const FFA_OPTIONS: SlotOption[] = [{ kind: 'human', team: -1 }, { kind: 'cpu', team: -1 }, { kind: 'off', team: -1 }];
const TEAM_OPTIONS: SlotOption[] = [
  { kind: 'human', team: 0 }, { kind: 'human', team: 1 }, { kind: 'cpu', team: 0 }, { kind: 'cpu', team: 1 }, { kind: 'off', team: -1 },
];
const KIND_LABEL: Record<SlotKind, string> = { human: 'HUMANO', cpu: 'CPU', off: 'DESLIGADO' };
export const TEAM_LABEL = ['VERMELHO', 'BRANCO'];
export const TEAM_COLOR = ['#ff5f5f', '#ffffff'];
export const ERROR_FRAMES = 150;

/** "Defina os jogadores": Humano / CPU / Desligado (e o time, na batalha em times). */
export function playersScreen(app: App): Screen {
  const setup = app.settings.setup;
  let error = '';
  let errorTimer = 0;
  const options = () => (setup.mode === 'team' ? TEAM_OPTIONS : FFA_OPTIONS);
  const current = (i: number) => Math.max(0, options().findIndex(o =>
    o.kind === setup.slots[i] && (setup.mode !== 'team' || o.kind === 'off' || o.team === setup.teams[i])));
  const change = (i: number, d: number) => {
    const opts = options();
    const o = opts[(current(i) + d + opts.length) % opts.length];
    setup.slots[i] = o.kind;
    if (o.team >= 0) setup.teams[i] = o.team;
    app.save();
  };
  const label = (i: number) => {
    const k = setup.slots[i];
    return setup.mode === 'team' && k !== 'off' ? `${KIND_LABEL[k]} ${TEAM_LABEL[setup.teams[i]]}` : KIND_LABEL[k];
  };
  const color = (i: number) => {
    if (setup.slots[i] === 'off') return COLORS.dim;
    return setup.mode === 'team' ? TEAM_COLOR[setup.teams[i]] : setup.slots[i] === 'human' ? COLORS.ok : COLORS.value;
  };
  const confirm = () => {
    const err = validateSetup(setup.mode, setup.slots, setup.teams);
    if (err) { error = err; errorTimer = ERROR_FRAMES; return; }
    app.go(rulesScreen(app));
  };
  const items: MenuItem[] = [0, 1, 2, 3, 4].map(i => ({
    label: `${i + 1}º JOGADOR`, value: () => label(i), valueColor: () => color(i),
    left: () => change(i, -1), right: () => change(i, 1), select: confirm,
  }));
  items.push({ label: 'CONTINUAR', select: confirm });
  const list = new MenuList(items);
  return {
    id: 'players',
    update(inp) {
      if (errorTimer > 0) errorTimer--;
      if (list.handle(inp.pressedAny) === 'back') app.go(modeScreen(app));
    },
    draw(ctx, bank, frame) {
      drawMenuPage(ctx, bank, frame, 'DEFINA OS JOGADORES', list, 224);
      if (errorTimer > 0) drawFooter(ctx, bank, error, COLORS.error);
      else drawFooter(ctx, bank, 'ESQ/DIR: MUDAR   A: CONTINUAR');
    },
    get error() { return errorTimer > 0 ? error : ''; },
  } as Screen & { readonly error: string };
}
