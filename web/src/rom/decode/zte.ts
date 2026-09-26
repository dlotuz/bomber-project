// ZTE: tiles com elisão de tile zerado [GFX §2.1] (rotinas $C4:09A5 / $C1:874D). Porte de decomp.decode_zte.
import { hiromOffset } from '../view';

export interface ZteResult { data: Uint8Array; used: number }

/** Decodifica o bloco ZTE em `addr` (endereço SNES). `used` = bytes consumidos (cabeçalho e fim incluídos). */
export function decodeZte(rom: Uint8Array, addr: number, limit = 0x10000): ZteResult {
  const p = hiromOffset(addr);
  const z = rom[p], e = rom[p + 1];
  let i = p + 2, n = 0;
  const out = new Uint8Array(limit);
  for (;;) {
    const b = rom[i];
    if (b === z) { n += 32; i += 1; }                 // tile vazio (Z testado antes de E)
    else if (b === e) { i += 1; break; }
    else { out.set(rom.subarray(i, i + 32), n); n += 32; i += 32; }
    if (n > limit) throw new RangeError(`bloco ZTE sem fim em ${addr.toString(16)}`);
  }
  return { data: out.slice(0, n), used: i - p };
}
