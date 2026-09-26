import { App } from '../../src/app/app';
import { defaultSettings, type Settings } from '../../src/app/settings';
import { idleInput, type MenuInput } from '../../src/input/input';
import type { AudioSink } from '../../src/app/rom-api';

export type AudioOp = 'bank' | 'music' | 'sfx' | 'voice' | 'stop' | 'fade';
export interface AudioCall { t: number; op: AudioOp; id?: number }

/** Sink que grava cada chamada com o `app.tick` do momento. */
export class RecordingSink implements AudioSink {
  calls: AudioCall[] = [];
  ticks = 0;
  now: () => number = () => 0;
  private rec(op: AudioOp, id?: number): void { this.calls.push(id === undefined ? { t: this.now(), op } : { t: this.now(), op, id }); }
  bank(id: number): void { this.rec('bank', id); }
  music(id: number): void { this.rec('music', id); }
  sfx(id: number): void { this.rec('sfx', id); }
  voice(id: number): void { this.rec('voice', id); }
  stop(): void { this.rec('stop'); }
  fade(): void { this.rec('fade'); }
  tick(): void { this.ticks++; }
  of(op: AudioOp): AudioCall[] { return this.calls.filter(c => c.op === op); }
  /** Chamadas a partir do tick `t0` (inclusive), com `t` relativo a ele. */
  since(t0: number): AudioCall[] { return this.calls.filter(c => c.t >= t0).map(c => ({ ...c, t: c.t - t0 })); }
  clear(): void { this.calls = []; }
}

export function mkApp(settings: Settings = defaultSettings()) {
  const sink = new RecordingSink();
  let saves = 0;
  const app = new App(settings, { save: () => { saves++; }, setKeymaps: () => {}, seed: () => 1 }, sink);
  sink.now = () => app.tick;
  return { app, sink, saves: () => saves };
}

/** Entrada de 1 tick: `held` segurados e `edge` recém-apertados em qualquer dispositivo; com `slot`, também no do jogador. */
export function inputOf(held: number, edge: number, slot?: number, extra: Partial<MenuInput> = {}): MenuInput {
  const i = idleInput();
  i.any = held; i.pressedAny = edge;
  if (slot !== undefined) { i.pads[slot] = held; i.pressed[slot] = edge; }
  return { ...i, ...extra };
}
/** 1 tick com o botão recém-apertado (sem soltar). */
export const tap = (app: App, btn: number, slot?: number): void => app.update(inputOf(btn, btn, slot));
/** Aperta num tick e solta no seguinte (2 ticks). */
export const press = (app: App, btn: number, slot?: number): void => { tap(app, btn, slot); app.update(idleInput()); };
/** Segura por `n` ticks (borda só no 1º) e solta no tick seguinte (n + 1 ticks). */
export function hold(app: App, btn: number, n: number, slot?: number): void {
  for (let k = 0; k < n; k++) app.update(inputOf(btn, k === 0 ? btn : 0, slot));
  app.update(idleInput());
}
export const idle = (app: App, n: number): void => { for (let k = 0; k < n; k++) app.update(idleInput()); };
/** Roda ticks ociosos até a transição em curso acabar. Devolve quantos rodou. */
export function settle(app: App, max = 3000): number {
  let n = 0;
  while (app.inTransition && n < max) { app.update(idleInput()); n++; }
  if (app.inTransition) throw new Error('settle: transição não acabou');
  return n;
}
/** Brilho observado depois de cada um de `n` ticks ociosos. */
export function brightnessTrace(app: App, n: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < n; k++) { app.update(idleInput()); out.push(app.brightness()); }
  return out;
}
export const range = (a: number, b: number): number[] => {
  const s = a <= b ? 1 : -1; const r: number[] = [];
  for (let v = a; v !== b + s; v += s) r.push(v);
  return r;
};
/** Tela mínima para testes: conta updates e guarda a última entrada. */
export function probe(id: string, extra: Partial<{ brightness: () => number; frozen: () => boolean }> = {}) {
  const s = { id, updates: 0, last: null as MenuInput | null, update(i: MenuInput) { s.updates++; s.last = i; }, draw() {}, ...extra };
  return s;
}
