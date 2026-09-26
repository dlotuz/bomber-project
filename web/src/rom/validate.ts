// Validação da ROM do usuário (spec §2.3).
export const ROM_SIZE = 4_194_304;
export const KNOWN_SHA1 = '38f4394986bd39fcbe32a722a3fe103ee6177d9b';
export const ROM_TITLE = 'SUPER BOMBERMAN 4    ';           // 21 bytes em $FFC0
const HDR = 0xffc0;

export type RomMotivo = 'tamanho' | 'cabecalho' | 'hash';
export type ValidateResult = { ok: true; rom: Uint8Array; sha1: string } | { ok: false; motivo: RomMotivo; mensagem: string };

export const MENSAGEM_BASE = 'Este arquivo não é a ROM suportada de Super Bomberman 4';
const DETALHE: Record<RomMotivo, string> = {
  tamanho: 'o tamanho não é de 4 MB',
  cabecalho: 'o cabeçalho interno não confere',
  hash: 'é outra versão; use a ROM USA com a tradução',
};
export function mensagemDe(m: RomMotivo): string { return `${MENSAGEM_BASE} (${DETALHE[m]}).`; }

export async function sha1Hex(bytes: Uint8Array): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-1', bytes as Uint8Array<ArrayBuffer>));
  return Array.from(d, b => b.toString(16).padStart(2, '0')).join('');
}

/** Tira o cabeçalho de copiadora (512 bytes) quando `tamanho % $8000 == 512`. Devolve uma vista, sem copiar. */
export function stripCopierHeader(b: Uint8Array): Uint8Array {
  return b.length % 0x8000 === 512 ? b.subarray(512) : b;
}

/** Confere o cabeçalho interno HiROM: título, mapa $31, tamanho $0C, complemento $4B9F, checksum $B460. */
export function headerOk(b: Uint8Array): boolean {
  if (b.length < 0x10000) return false;
  for (let i = 0; i < 21; i++) if (b[HDR + i] !== ROM_TITLE.charCodeAt(i)) return false;
  const u16 = (o: number) => b[o] | (b[o + 1] << 8);
  return b[HDR + 0x15] === 0x31 && b[HDR + 0x17] === 0x0c && u16(HDR + 0x1c) === 0x4b9f && u16(HDR + 0x1e) === 0xb460;
}

export async function validateRom(input: Uint8Array | ArrayBuffer, opts: { sha1?: string } = {}): Promise<ValidateResult> {
  const b = stripCopierHeader(input instanceof Uint8Array ? input : new Uint8Array(input));
  const fail = (motivo: RomMotivo): ValidateResult => ({ ok: false, motivo, mensagem: mensagemDe(motivo) });
  if (b.length !== ROM_SIZE) return fail('tamanho');
  if (!headerOk(b)) return fail('cabecalho');
  const sha1 = await sha1Hex(b);
  if (sha1 !== (opts.sha1 ?? KNOWN_SHA1)) return fail('hash');
  return { ok: true, rom: b.slice(), sha1 };
}
