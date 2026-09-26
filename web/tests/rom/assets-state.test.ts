import 'fake-indexeddb/auto';
import { ROM } from './helpers';
import { romState, onRomChange, useRomBytes, bootRom, forgetStoredRom, openRomDialog, registerRomDialog, type RomStatus } from '../../src/rom/state';
import { saveRom, loadStoredRom, forgetRom } from '../../src/rom/store';
import { mensagemDe } from '../../src/rom/validate';

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
});
