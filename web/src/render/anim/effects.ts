/** Caveira (exceto $29): paleta preta quando frame & 4 ($C1:758C). */
export function skullBlack(frame: number): boolean { return (frame & 4) !== 0; }

/** Invencível: não desenha quando inv & 2 ($C1:77E7). */
export function invincibleHidden(inv: number): boolean { return inv > 0 && (inv & 2) !== 0; }

export interface PressureSprite { shadow: boolean; blockY: number | null }

/** Sombra de t0 a land+1; bloco com topo da casa − 8·(land − tick), a partir de y = 0 (D11). */
export function pressureSprite(d: { t0: number; land: number }, lin: number, tick: number): PressureSprite {
  if (tick < d.t0 || tick >= d.land + 2) return { shadow: false, blockY: null };
  const top = 16 * lin + 24;
  const y = top - 8 * Math.max(0, d.land - tick);
  return { shadow: true, blockY: y >= 0 ? y : null };
}
