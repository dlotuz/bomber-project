import { idleInput, type KeyMap, type MenuInput } from '../input/input';
import type { SpriteBank } from '../render/sprite-bank';
import type { Settings } from './settings';
import type { AudioSink } from './rom-api';
import { AudioDirector } from './audio';

export interface Screen {
  id: string;
  update(inp: MenuInput): void;
  draw(ctx: CanvasRenderingContext2D, bank: SpriteBank, frame: number): void;
  /** Brilho 0..15 fora das transições (padrão 15). A partida usa para o intro. */
  brightness?(): number;
  frozen?(): boolean;
}

/** Ação agendada numa transição; `at` conta do 1º frame da saída (0). */
export interface Cue { at: number; run(app: App): void }
/** Saída (brilho por frame, a tela velha parada), preto, entrada (a tela nova criada no 1º frame dela). */
export interface TransitionSpec { out: readonly number[]; black: number; in: readonly number[]; cues?: readonly Cue[] }

export interface AppHooks {
  save(s: Settings): void;
  setKeymaps(maps: readonly KeyMap[]): void;
  seed(): number;
  /** Aplica toda a configuração de entrada (teclas, botões de gamepad). Se ausente, usa setKeymaps. */
  applyInput?(s: Settings): void;
}

interface Running { spec: TransitionSpec; next: () => Screen; k: number; created: boolean }
const NONE: Screen = { id: 'none', update() {}, draw() {} };
const clampB = (b: number): number => Math.max(0, Math.min(15, Math.round(b)));

export class App {
  /** Contador de animação (para quando a tela congela). */
  frame = 0;
  /** Updates desde o boot, inclusive transições. */
  tick = 0;
  screen: Screen = NONE;
  readonly audio: AudioDirector;
  private run: Running | null = null;

  constructor(public settings: Settings, private hooks: AppHooks, sink?: AudioSink) {
    this.audio = new AudioDirector(sink);
  }

  go(next: Screen): void { this.run = null; this.screen = next; }

  transition(next: () => Screen, spec: TransitionSpec): void {
    this.run = { spec, next, k: 0, created: false };
    this.cues(0);
    this.createIfDue();
  }

  get inTransition(): boolean { return this.run !== null; }

  brightness(): number {
    const r = this.run;
    if (!r) return clampB(this.screen.brightness?.() ?? 15);
    const { out, black } = r.spec;
    if (r.k < out.length) return out[r.k];
    if (r.k < out.length + black) return 0;
    return r.spec.in[r.k - out.length - black] ?? 15;
  }

  save(): void { this.hooks.save(this.settings); }
  applyKeymaps(): void { this.hooks.setKeymaps(this.settings.keymaps); }
  applyInput(): void {
    if (this.hooks.applyInput) this.hooks.applyInput(this.settings);
    else this.hooks.setKeymaps(this.settings.keymaps);
  }
  seed(): number { return this.hooks.seed(); }

  update(inp: MenuInput): void {
    this.tick++;
    this.audio.tick();
    const r = this.run;
    if (r) {
      r.k++;
      this.cues(r.k);
      this.createIfDue();
      const inStart = r.spec.out.length + r.spec.black;
      if (r.k < inStart + r.spec.in.length) {
        if (r.k >= inStart) { this.screen.update(idleInput()); this.frame++; }
        return;
      }
      this.run = null;   // acabou: este update já é da tela nova, com a entrada real
    }
    this.screen.update(inp);
    if (!this.screen.frozen?.()) this.frame++;
  }

  draw(ctx: CanvasRenderingContext2D, bank: SpriteBank): void {
    this.screen.draw(ctx, bank, this.frame);
    const b = this.brightness();
    if (b < 15) {
      ctx.fillStyle = `rgba(0,0,0,${1 - b / 15})`;
      ctx.fillRect(0, 0, 256, 224);
    }
  }

  private cues(k: number): void {
    const r = this.run;
    if (!r) return;
    for (const c of r.spec.cues ?? []) if (c.at === k) c.run(this);
  }

  private createIfDue(): void {
    const r = this.run;
    if (!r || r.created) return;
    if (r.k >= r.spec.out.length + r.spec.black) { this.screen = r.next(); r.created = true; }
  }
}
