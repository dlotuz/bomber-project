const cache = new Map<string, HTMLCanvasElement>();

/** Disco radial 64×64: `stops` = [posição, 'rgba(...)'][], usado escalado para luz, halo, fumaça e sombra. */
export function radial(key: string, stops: readonly (readonly [number, string])[]): HTMLCanvasElement {
  let c = cache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!, grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [p, col] of stops) grad.addColorStop(p, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  cache.set(key, c);
  return c;
}
export const rgb = (c: number): string => `${(c >> 16) & 255}, ${(c >> 8) & 255}, ${c & 255}`;
export const flameLight = () => radial('flame', [[0, 'rgba(255, 240, 170, 1)'], [0.35, 'rgba(255, 170, 60, 0.6)'], [1, 'rgba(255, 90, 20, 0)']]);
export const halo = (c: number) => radial(`halo${c}`, [[0, `rgba(${rgb(c)}, 0.9)`], [1, `rgba(${rgb(c)}, 0)`]]);
export const puff = () => radial('puff', [[0, 'rgba(90, 90, 96, 0.55)'], [1, 'rgba(90, 90, 96, 0)']]);
export const shadowBlob = () => radial('shadow', [[0, 'rgba(0, 0, 0, 0.4)'], [0.6, 'rgba(0, 0, 0, 0.3)'], [1, 'rgba(0, 0, 0, 0)']]);
