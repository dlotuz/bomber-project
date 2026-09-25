export const STEP_MS = 1000 / 60;
export const MAX_STEPS = 5;

/** Quantos ticks de 60 Hz rodar para `dtMs` decorridos, e quanto sobra no acumulador. */
export function stepsFor(acc: number, dtMs: number): { steps: number; acc: number } {
  const dt = Math.abs(dtMs - STEP_MS) < 1 ? STEP_MS : dtMs;
  let a = acc + Math.max(0, Math.min(dt, 250));
  let steps = 0;
  while (a >= STEP_MS && steps < MAX_STEPS) { a -= STEP_MS; steps++; }
  if (steps === MAX_STEPS) a = Math.min(a, STEP_MS);
  return { steps, acc: a };
}

export function startLoop(step: () => void, render: () => void): void {
  let acc = 0;
  let last = performance.now();
  const frame = (now: number) => {
    const r = stepsFor(acc, now - last);
    last = now; acc = r.acc;
    for (let i = 0; i < r.steps; i++) step();
    render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
