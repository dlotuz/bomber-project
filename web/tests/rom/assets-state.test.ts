import 'fake-indexeddb/auto';
import { ROM } from './helpers';
import { romState, onRomChange, useRomBytes, bootRom, forgetStoredRom, openRomDialog, registerRomDialog, type RomStatus } from '../../src/rom/state';
import { saveRom, loadStoredRom, forgetRom } from '../../src/rom/store';
import { mensagemDe, ROM_SIZE, ROM_TITLE } from '../../src/rom/validate';

/** 4 MiB com o cabeçalho interno válido (spec §2.3 `headerOk`), mas conteúdo qualquer: passa tamanho e
 *  cabeçalho em `validateRom`, chegando ao SHA-1 (onde dá pra forçar uma falha inesperada de verdade). */
function fakeHeaderedRom(): Uint8Array {
  const b = new Uint8Array(ROM_SIZE), HDR = 0xffc0;
  for (let i = 0; i < ROM_TITLE.length; i++) b[HDR + i] = ROM_TITLE.charCodeAt(i);
  b[HDR + 0x15] = 0x31; b[HDR + 0x17] = 0x0c;
  b[HDR + 0x1c] = 0x9f; b[HDR + 0x1d] = 0x4b;
  b[HDR + 0x1e] = 0x60; b[HDR + 0x1f] = 0xb4;
  return b;
}
/** Some `crypto.subtle` só durante `fn` (simula HTTP não-local); sempre restaura, mesmo se `fn` lançar. */
async function semCryptoSubtle<T>(fn: () => Promise<T>): Promise<T> {
  const c = globalThis.crypto as unknown as { subtle?: unknown };
  Object.defineProperty(c, 'subtle', { value: undefined, configurable: true });
  try { return await fn(); } finally { delete c.subtle; }
}
/** `store falso que falha`: o próximo `delete` do IndexedDB (via fake-indexeddb) lança, só durante `fn`. */
async function comDeleteFalhando<T>(fn: () => Promise<T>): Promise<T> {
  const orig = IDBObjectStore.prototype.delete;
  IDBObjectStore.prototype.delete = function (): never { throw new Error('delete falso: IndexedDB indisponível'); };
  try { return await fn(); } finally { IDBObjectStore.prototype.delete = orig; }
}

describe('romState sem ROM válida', () => {
  beforeEach(async () => { await forgetStoredRom(); });
  it('arquivo inválido: status erro, mensagem PT-BR, nada guardado', async () => {
    const seen: RomStatus[] = [];
    const off = onRomChange(s => seen.push(s.status));
    const r = await useRomBytes(new Uint8Array(100));
    off();
    expect(r.ok).toBe(false);
    expect(seen).toEqual(['verificando', 'erro']);
    expect(romState).toMatchObject({ assets: null, status: 'erro', erro: mensagemDe('tamanho') });
    expect(await loadStoredRom()).toBeNull();
  });
  it('boot sem ROM guardada → false; ROM guardada inválida é apagada', async () => {
    expect(await bootRom()).toBe(false);
    await saveRom(new Uint8Array(10));
    expect(await bootRom()).toBe(false);
    expect(await loadStoredRom()).toBeNull();
    expect(romState.status).toBe('vazio');
  });
  it('openRomDialog chama o painel registrado', () => {
    let n = 0;
    registerRomDialog(() => { n++; });
    openRomDialog(); openRomDialog();
    registerRomDialog(null); openRomDialog();
    expect(n).toBe(2);
  });
  it('onRomChange devolve o cancelamento', async () => {
    let n = 0; const off = onRomChange(() => n++); off();
    await forgetStoredRom();
    expect(n).toBe(0);
  });
  it('item 1: sem crypto.subtle (ex.: HTTP não-local) não trava em "verificando" — rejeita e marca erro PT-BR', async () => {
    await semCryptoSubtle(async () => {
      const seen: RomStatus[] = [];
      const off = onRomChange(s => seen.push(s.status));
      await expect(useRomBytes(fakeHeaderedRom(), { persist: false })).rejects.toThrow();
      off();
      expect(seen).toEqual(['verificando', 'erro']);
      expect(romState.status).toBe('erro');
      expect(romState.erro).toBe(mensagemDe('falha'));
    });
  });
  it('item 3: bootRom nunca rejeita mesmo se apagar a ROM inválida guardada falhar (IndexedDB)', async () => {
    await saveRom(new Uint8Array(10));   // ROM guardada inválida (tamanho errado)
    await comDeleteFalhando(async () => {
      await expect(bootRom()).resolves.toBe(false);
    });
    expect(romState.status).toBe('vazio');
  });
  it('item 3: forgetStoredRom sempre limpa o estado em memória; marca erro se o delete falhar', async () => {
    await comDeleteFalhando(async () => {
      await expect(forgetStoredRom()).resolves.toBeUndefined();
    });
    expect(romState.assets).toBeNull();
    expect(romState.status).toBe('vazio');
    expect(romState.erro).toBeTruthy();
  });
});

describe.skipIf(!ROM)('romState com a ROM real', () => {
  beforeEach(async () => { await forgetStoredRom(); });
  it('carrega, guarda no IndexedDB e o boot seguinte reusa', async () => {
    const r = await useRomBytes(ROM!);
    expect(r.ok).toBe(true);
    expect(romState.status).toBe('ok');
    expect(romState.assets!.rom.data).toHaveLength(4_194_304);
    expect((await loadStoredRom())!.sha1).toBe('38f4394986bd39fcbe32a722a3fe103ee6177d9b');
    romState.assets = null;
    expect(await bootRom()).toBe(true);
    expect(romState.assets).not.toBeNull();
  });
  it('arquivo errado depois de uma ROM boa mantém a ROM e mostra o erro', async () => {
    await useRomBytes(ROM!, { persist: false });
    const antes = romState.assets;
    await useRomBytes(new Uint8Array(10));
    expect(romState.assets).toBe(antes);                // toBe: comparar 4 MB com toEqual é lento
    expect([romState.status, romState.erro]).toEqual(['ok', mensagemDe('tamanho')]);
  });
  it('esquecer volta para a arte por código', async () => {
    await useRomBytes(ROM!);
    await forgetStoredRom();
    expect([romState.assets, romState.status]).toEqual([null, 'vazio']);
    expect(await loadStoredRom()).toBeNull();
    await forgetRom();
  });
  it('item 1: falha inesperada depois de uma ROM boa mantém a ROM ("ok") e grava o erro PT-BR', async () => {
    await useRomBytes(ROM!, { persist: false });
    const antes = romState.assets;
    await semCryptoSubtle(async () => {
      await expect(useRomBytes(fakeHeaderedRom(), { persist: false })).rejects.toThrow();
    });
    expect(romState.assets).toBe(antes);
    expect([romState.status, romState.erro]).toEqual(['ok', mensagemDe('falha')]);
  });
});
