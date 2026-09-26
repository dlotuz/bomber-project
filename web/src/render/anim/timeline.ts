/** Comando normalizado do script de tiles (dst/src = tile 8×8 do canto superior esquerdo do 16×16). */
export type TileCmd = { op: 'dma'; dst: number; src: number } | { op: 'wait'; n: number } | { op: 'loop' } | { op: 'end' };
export interface TileTimeline { events: { t: number; dst: number; src: number }[]; period: number | null }

export function tileTimeline(cmds: readonly TileCmd[]): TileTimeline {
  const events: TileTimeline['events'] = [];
  let c = 0;
  for (const k of cmds) {
    if (k.op === 'dma') { events.push({ t: c, dst: k.dst, src: k.src }); c += 1; }
    else if (k.op === 'wait') c += 1 + k.n;
    else if (k.op === 'loop') return { events, period: c };
    else return { events, period: null };
  }
  return { events, period: null };
}

function lastFrame(tl: TileTimeline, tick: number): { k: number; looped: boolean } | null {
  if (tick <= 0) return null;
  const last = tick - 1;
  if (tl.period !== null && tl.period > 0 && last >= tl.period) return { k: last % tl.period, looped: true };
  return { k: last, looped: false };
}

/** dst → src depois dos comandos dos ticks 0..tick−1. */
export function tileStateAt(tl: TileTimeline, tick: number): Map<number, number> {
  const m = new Map<number, number>();
  const lf = lastFrame(tl, tick);
  if (!lf) return m;
  if (lf.looped) for (const e of tl.events) m.set(e.dst, e.src);
  for (const e of tl.events) if (e.t <= lf.k) m.set(e.dst, e.src);
  return m;
}

/** Chave de cache: muda só quando o estado pode mudar. */
export function tileStateKey(tl: TileTimeline, tick: number): string {
  const lf = lastFrame(tl, tick);
  if (!lf) return 'F0';
  return (lf.looped ? 'L' : 'F') + tl.events.filter(e => e.t <= lf.k).length;
}

export interface PalCycle { index: number; frames: Uint16Array[]; period: number }

export function palFrameAt(p: PalCycle, tick: number): Uint16Array {
  return p.frames[Math.floor(Math.max(0, tick) / p.period) % p.frames.length];
}

/** Cor 15 da paleta BG 4 (CGRAM 79), `$C1:0965`. */
export function itemBlinkColor(frame: number): number {
  return frame & 4 ? 0x7d80 : 0x00bf;
}
