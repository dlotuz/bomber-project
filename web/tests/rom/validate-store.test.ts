import 'fake-indexeddb/auto';
import { loadStoredRom, saveRom, forgetRom } from '../../src/rom/store';
import { sha1Hex } from '../../src/rom/validate';

describe('ROM no IndexedDB (fake-indexeddb)', () => {
  beforeEach(async () => { await forgetRom(); });
  it('sem nada guardado → null', async () => {
    expect(await loadStoredRom()).toBeNull();
  });
  it('ida e volta: bytes, SHA-1 e data', async () => {
    const b = new Uint8Array(4096).map((_, i) => (i * 7) & 0xff);
    const antes = Date.now();
    await saveRom(b);
    const r = await loadStoredRom();
    expect(r).not.toBeNull();
    expect(new Uint8Array(r!.bytes)).toEqual(b);
    expect(r!.sha1).toBe(await sha1Hex(b));
    expect(r!.salvaEm).toBeGreaterThanOrEqual(antes);
  });
  it('guardar de novo substitui; esquecer apaga', async () => {
    await saveRom(new Uint8Array([1, 2, 3]));
    await saveRom(new Uint8Array([4, 5]));
    expect(new Uint8Array((await loadStoredRom())!.bytes)).toEqual(new Uint8Array([4, 5]));
    await forgetRom();
    expect(await loadStoredRom()).toBeNull();
  });
  it('a cópia guardada não muda quando o buffer original muda', async () => {
    const b = new Uint8Array([9, 9, 9]);
    await saveRom(b); b[0] = 0;
    expect(new Uint8Array((await loadStoredRom())!.bytes)[0]).toBe(9);
  });
});
