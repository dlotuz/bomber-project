/** ROM do usuário para os testes de áudio (sem depender de tests/rom/helpers.ts do plano 5). */
import { env, fs } from './node';
import { maybeTrace } from '../rom/trace';
import { ROM as ROM_IMAGE } from '../rom/helpers';

function loadRom(): Uint8Array | null {
  if (env.SB4_PACK) return ROM_IMAGE;   // pacote embutido (tests/rom/helpers.ts)
  const p = env.SB4_ROM;
  if (!p || !fs.existsSync(p)) return null;
  let b = new Uint8Array(fs.readFileSync(p));
  if (b.length % 0x8000 === 512) b = b.subarray(512);
  return b.length === 0x400000 ? maybeTrace(b) : null;
}

/** Arquivo sem cabeçalho de copiadora (4 MB), ou null. */
export const ROM: Uint8Array | null = loadRom();
export const ROM_SHA1 = '38f4394986bd39fcbe32a722a3fe103ee6177d9b';
