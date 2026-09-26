import type { StageModule } from '../hooks';
import type { RoundState } from '../types';
import type { Stage2State } from './state';
import { A2_MODES } from './tables';
import { INTRO_LOGIC, rnd255, stageEvent } from './kit';

/** Soma no HOFS do BG1 a cada 4 ticks por modo ($C1:C4DD). */
export const HOFS_STEP = [8, 32, 1];

export const st2 = (s: RoundState): Stage2State =>
  (s.stageState ??= { mode: 0, left: 0, started: false, hofs: 8 }) as Stage2State;

/** Arena 2 ($C3:0AAF): modo global normal/rápido/lento sorteado a cada 320–574 ticks. */
export const stage2: StageModule = {
  init(s) { s.stageState = { mode: 0, left: 0, started: false, hofs: 8 }; },
  tick(s, ev) {
    const a = st2(s);
    if (!a.started) {
      a.started = true;
      // A ROM sorteia no tick lógico 1 do intro; os 10 ticks lógicos do intro já passaram (D3).
      a.left = 320 + rnd255(s) - (s.phase === 'intro' ? 0 : INTRO_LOGIC);
    } else if (--a.left === 0) {
      a.left = 320 + rnd255(s);                          // primeiro o temporizador ($C3:0B39)…
      a.mode = A2_MODES[rnd255(s) & 31] as 0 | 1 | 2;    // …depois o modo ($C3:0B11)
      stageEvent(ev, `a2_mode${a.mode}`);
    } else if (a.left === 128) {
      stageEvent(ev, 'a2_warn');
    }
    if ((s.tick & 3) === 0) a.hofs = (a.hofs + HOFS_STEP[a.mode]) & 0xff;
  },
  speedLevel(s, _p, lv) {
    const m = st2(s).mode;
    return m === 1 ? 6 : m === 2 ? 7 : lv;
  },
  fuseStep(s) {
    const m = st2(s).mode;
    if (m === 1) return 2;
    if (m === 2) return (s.tick & 1) === 0 ? 1 : 0;
    return 1;
  },
};
