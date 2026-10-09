// Contador discreto de FPS e ping no topo da tela (#stats no index.html). O FPS conta os quadros desenhados a cada
// meio segundo; o ping é o da sala online (net/online.ts) e só aparece com a conexão aberta.

/** Janela de medição do FPS, em ms. */
export const FPS_WINDOW_MS = 500;

/** Conta quadros e devolve o FPS da última janela fechada (0 até fechar a primeira). */
export class FpsMeter {
  fps = 0;
  private frames = 0;
  private since: number | null = null;

  frame(now: number): number {
    if (this.since === null) { this.since = now; return this.fps; }
    this.frames++;
    const dt = now - this.since;
    if (dt >= FPS_WINDOW_MS) { this.fps = Math.round(this.frames * 1000 / dt); this.frames = 0; this.since = now; }
    return this.fps;
  }
}

/** Texto do contador: "60 FPS" ou "60 FPS · 42 ms" (ping null = fora da sala online). Com o ping dos outros da sala
 *  (`peers`), acrescenta o de cada um: "60 FPS · 42 ms · 1P 3 · 2P 81" — mostra quem está puxando o atraso. */
export function statsText(fps: number, ping: number | null, peers: readonly { slot: number; ms: number }[] = []): string {
  const base = ping === null ? `${fps} FPS` : `${fps} FPS · ${Math.round(ping)} ms`;
  return peers.length > 1 ? `${base} · ${peers.map(p => `${p.slot + 1}P ${Math.round(p.ms)}`).join(' · ')}` : base;
}

/** Liga o contador ao elemento; chame `frame()` a cada quadro desenhado. O DOM só muda quando o texto muda. */
export function createStats(el: HTMLElement | null, ping: () => number | null,
  peers: () => readonly { slot: number; ms: number }[] = () => []): { frame(): void } {
  const meter = new FpsMeter();
  let shown = '';
  return {
    frame() {
      if (!el) return;
      const text = statsText(meter.frame(performance.now()), ping(), ping() === null ? [] : peers());
      if (text !== shown) { el.textContent = text; shown = text; }
    },
  };
}
