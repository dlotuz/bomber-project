import { ROM } from './helpers';
import { validateRom, stripCopierHeader, headerOk, sha1Hex, mensagemDe, KNOWN_SHA1, ROM_SIZE, ROM_TITLE } from '../../src/rom/validate';

/** 4 MiB zerados com o cabeçalho interno correto em $FFC0. */
function fakeRom(): Uint8Array {
  const b = new Uint8Array(ROM_SIZE);
  for (let i = 0; i < 21; i++) b[0xffc0 + i] = ROM_TITLE.charCodeAt(i);
  b[0xffd5] = 0x31; b[0xffd7] = 0x0c;
  b[0xffdc] = 0x9f; b[0xffdd] = 0x4b; b[0xffde] = 0x60; b[0xffdf] = 0xb4;
  return b;
}

describe('validação com buffers sintéticos', () => {
  it('cabeçalho sintético é aceito pela conferência do cabeçalho', () => {
    expect(headerOk(fakeRom())).toBe(true);
  });
  it('arquivo truncado → tamanho', async () => {
    const r = await validateRom(fakeRom().subarray(0, ROM_SIZE - 1));
    expect(r).toEqual({ ok: false, motivo: 'tamanho', mensagem: mensagemDe('tamanho') });
    expect((await validateRom(new Uint8Array(0))).ok).toBe(false);
  });
  it('cabeçalho errado → cabecalho (título, mapa, tamanho, checksum)', async () => {
    for (const [o, v] of [[0xffc0, 0x41], [0xffd5, 0x21], [0xffd7, 0x0b], [0xffde, 0x61], [0xffdc, 0x00]] as const) {
      const b = fakeRom(); b[o] = v;
      expect(await validateRom(b)).toMatchObject({ ok: false, motivo: 'cabecalho' });
    }
  });
  it('hash: aceita com o SHA-1 esperado e rejeita com 1 byte alterado', async () => {
    const b = fakeRom(), h = await sha1Hex(b);
    const ok = await validateRom(b, { sha1: h });
    expect(ok.ok && ok.sha1 === h && ok.rom.length === ROM_SIZE).toBe(true);
    const c = fakeRom(); c[0x123456] ^= 1;
    expect(await validateRom(c, { sha1: h })).toMatchObject({ ok: false, motivo: 'hash' });
    expect(await validateRom(b)).toMatchObject({ ok: false, motivo: 'hash' });   // SHA-1 conhecido ≠ sintético
  });
  it('remove o cabeçalho de copiadora de 512 bytes', async () => {
    const b = fakeRom(), h = await sha1Hex(b), withHdr = new Uint8Array(ROM_SIZE + 512);
    withHdr.fill(0xaa, 0, 512); withHdr.set(b, 512);
    expect(stripCopierHeader(withHdr)).toHaveLength(ROM_SIZE);
    expect(stripCopierHeader(b)).toBe(b);
    const r = await validateRom(withHdr.buffer, { sha1: h });
    expect(r.ok).toBe(true);
  });
  it('mensagem em PT-BR', () => {
    expect(mensagemDe('hash')).toBe('Este arquivo não é a ROM suportada de Super Bomberman 4 (é outra versão; use a ROM USA com a tradução).');
  });
});

describe.skipIf(!ROM)('validação com a ROM real', () => {
  it('aceita a ROM conhecida (SHA-1 38f4…9d7b)', async () => {
    const r = await validateRom(ROM!);
    expect(r).toMatchObject({ ok: true, sha1: KNOWN_SHA1 });
  });
  it('aceita a ROM com cabeçalho de copiadora', async () => {
    const b = new Uint8Array(ROM_SIZE + 512); b.set(ROM!, 512);
    expect((await validateRom(b)).ok).toBe(true);
  });
  it('rejeita a ROM real com 1 byte alterado', async () => {
    const b = ROM!.slice(); b[0x200000] ^= 0xff;
    expect(await validateRom(b)).toMatchObject({ ok: false, motivo: 'hash' });
  });
});
