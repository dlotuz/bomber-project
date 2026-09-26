// Pós-processamento da arena 9 [GFX §2.3] ($C3:215C). Porte de decomp.arena9_post. Altera `buf` (32 KB).
import { composite } from './composite';

export function arena9Post(buf: Uint8Array): void {
  buf.copyWithin(0x2c00, 0x2000, 0x2400);
  buf.copyWithin(0x2400, 0x3800, 0x4000);
  buf.copyWithin(0x3000, 0x3800, 0x4000);
  composite(buf, 0x1d80, 0x2000, 96);
  composite(buf, 0x1c80, 0x2c00, 96);
}
