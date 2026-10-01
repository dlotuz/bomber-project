/** Spec §4.4: alfa 255 onde o quadro com atores e o sem atores são iguais (chão à vista), 0 onde algum sprite cobre. */
export function groundMask(withActors: Uint8ClampedArray, without: Uint8ClampedArray, out: Uint8ClampedArray): void {
  for (let i = 0; i < out.length; i += 4) {
    const same = withActors[i] === without[i] && withActors[i + 1] === without[i + 1] && withActors[i + 2] === without[i + 2];
    out[i] = out[i + 1] = out[i + 2] = 0;
    out[i + 3] = same ? 255 : 0;
  }
}
