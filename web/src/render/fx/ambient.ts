/** Clima por arena (1..10, spec §4.7): cor multiplicada sobre o campo e força 0..0,25. Ajustar jogando. */
export const AMBIENT: Record<number, readonly [number, number]> = {
  1: [0x9fb0c8, 0.12], 2: [0xd8b890, 0.12], 3: [0xe8c8a0, 0.10], 4: [0x90a890, 0.20], 5: [0xc8a080, 0.15],
  6: [0xa8b8e0, 0.12], 7: [0x88a8a0, 0.20], 8: [0xf0e0f0, 0.06], 9: [0x8080b0, 0.25], 10: [0xb090d0, 0.18],
};
/** Cor de `multiply` equivalente a aplicar `color` com força `k` (k = 0 → branco, sem efeito). */
export function ambientFill(stage: number, fade: number): string | null {
  const a = AMBIENT[stage];
  if (!a) return null;
  const k = Math.min(0.25, a[1]) * fade;
  const ch = (v: number) => Math.round(255 - (255 - v) * k);
  return `rgb(${ch((a[0] >> 16) & 255)}, ${ch((a[0] >> 8) & 255)}, ${ch(a[0] & 255)})`;
}
