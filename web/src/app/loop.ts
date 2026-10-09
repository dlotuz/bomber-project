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

/** Loop do jogo: `step` a 60 Hz e `render` a cada quadro. Com a aba escondida (alt+tab, outra aba, janela minimizada)
 *  o navegador para o requestAnimationFrame; se `keepAlive()` (partida online), os ticks continuam por um relógio num
 *  Worker — que o navegador não freia em segundo plano — sem desenhar, para os outros jogadores não ficarem esperando. */
export function startLoop(step: () => void, render: () => void, keepAlive: () => boolean = () => false): void {
  let acc = 0;
  let last = performance.now();
  const advance = (now: number): void => {
    const r = stepsFor(acc, now - last);
    last = now; acc = r.acc;
    for (let i = 0; i < r.steps; i++) step();
  };
  const frame = (now: number) => {
    advance(now);
    render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  if (typeof Worker === 'undefined' || typeof document === 'undefined') return;
  try {
    const src = 'setInterval(function(){postMessage(0)},8)';
    const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    w.onmessage = () => { if (document.hidden && keepAlive()) advance(performance.now()); };
  } catch { /* sem Worker (CSP): a partida espera a aba voltar, como antes */ }
}
