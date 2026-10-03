// Pacote da ROM embutido no jogo (public/rom-pack.dat, gerado por scripts/rom-pack/build.mjs): só as faixas da ROM
// que o jogo lê (gráficos, paletas, mapas, tabelas, animações e áudio), comprimidas com gzip. Expandido de volta numa
// imagem de 4 MiB (o resto em zero), ele alimenta o mesmo createRomAssets da ROM do usuário — o jogo não precisa
// mais que o jogador carregue a ROM.
//
// Formato (antes do gzip, little-endian): "CBPK", u32 versão (1), u32 n, n × (u32 offset, u32 tamanho), os bytes
// das n faixas em sequência.
import { ROM_SIZE } from './validate';

export const PACK_MAGIC = 0x4b504243;   // "CBPK"
export const PACK_VERSION = 1;

/** Imagem de 4 MiB a partir do pacote já descomprimido. */
export function expandPack(buf: Uint8Array): Uint8Array {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== PACK_MAGIC) throw new Error('pacote da ROM inválido (assinatura)');
  if (dv.getUint32(4, true) !== PACK_VERSION) throw new Error('pacote da ROM: versão desconhecida');
  const n = dv.getUint32(8, true);
  const out = new Uint8Array(ROM_SIZE);
  let p = 12 + 8 * n;
  for (let i = 0; i < n; i++) {
    const off = dv.getUint32(12 + 8 * i, true), len = dv.getUint32(16 + 8 * i, true);
    if (off + len > ROM_SIZE || p + len > buf.length) throw new Error('pacote da ROM corrompido');
    out.set(buf.subarray(p, p + len), off);
    p += len;
  }
  return out;
}

/** Busca e descomprime o pacote (gzip via DecompressionStream). */
export async function fetchPack(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`pacote da ROM indisponível (${res.status})`);
  const raw = new Uint8Array(await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  return expandPack(raw);
}
