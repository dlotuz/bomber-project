import type { KeyMap, MenuInput } from '../input/input';
import type { SpriteBank } from '../render/sprite-bank';
import type { Settings } from './settings';

/** Uma tela do jogo (menu, batalha…). `frozen` pausa o contador de animação global. */
export interface Screen {
  /** Identificador da tela (testes e depuração). */
  id: string;
  update(inp: MenuInput): void;
  draw(ctx: CanvasRenderingContext2D, bank: SpriteBank, frame: number): void;
  frozen?(): boolean;
}

export interface AppHooks {
  save(s: Settings): void;
  setKeymaps(maps: readonly KeyMap[]): void;
  seed(): number;
}

/** Roteador de telas + configurações compartilhadas. As telas recebem o App e chamam `go()` para trocar. */
export class App {
  frame = 0;
  screen: Screen = { id: 'none', update() {}, draw() {} };

  constructor(public settings: Settings, private hooks: AppHooks) {}

  go(next: Screen): void { this.screen = next; }
  save(): void { this.hooks.save(this.settings); }
  applyKeymaps(): void { this.hooks.setKeymaps(this.settings.keymaps); }
  seed(): number { return this.hooks.seed(); }

  update(inp: MenuInput): void {
    this.screen.update(inp);
    if (!this.screen.frozen?.()) this.frame++;
  }

  draw(ctx: CanvasRenderingContext2D, bank: SpriteBank): void {
    this.screen.draw(ctx, bank, this.frame);
  }
}
