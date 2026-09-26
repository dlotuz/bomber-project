import { romTables } from '../../src/render/rom/tables';
import { ASSETS } from './rom-fixture';
import { fakeAssets } from './fakes';

describe('tabelas da ROM (assets falsos)', () => {
  it('lê item, coroa e paleta de time pelos endereços', () => {
    const t = romTables(fakeAssets());
    expect(t.itemWord(0x01)).toBe(0x1280);
    expect(t.itemWord(0x41)).toBe(0x1280);   // só os 6 bits baixos
    expect(t.crownWord(2)).toBe(0x2642);
    expect(t.crownWord(12)).toBe(0x2649);    // limita a 9
    expect(t.crownWord(-1)).toBe(0x2640);
    expect(t.teamPalette(0, 0)[3]).toBe(0x0103);
  });
  it('cache por RomAssets', () => {
    const a = fakeAssets();
    expect(romTables(a)).toBe(romTables(a));
  });
});

describe.skipIf(!ASSETS)('tabelas da ROM (real)', () => {
  const t = () => romTables(ASSETS!);
  it('item → palavra do BG2 ($C1:5FE0): as da §7.1 e as que a A13 deixava em aberto', () => {
    const known: [number, number][] = [
      [0x01, 0x1280], [0x03, 0x1282], [0x05, 0x12a2], [0x0d, 0x12ec], [0x0e, 0x12a4], [0x07, 0x12a6], [0x12, 0x12a8],
      [0x21, 0x128a], [0x2b, 0x128a], [0x02, 0x1284], [0x04, 0x1286], [0x06, 0x128e], [0x08, 0x128c], [0x09, 0x12c0],
      [0x0a, 0x12a0], [0x0b, 0x1288], [0x0c, 0x12ae], [0x0f, 0x12ea], [0x11, 0x12e8]];
    for (const [id, w] of known) expect(t().itemWord(id), `item $${id.toString(16)}`).toBe(w);
  });
  it('coroas ($C4:5D11, u16): 0→$264F, 1..5→$263B..$263F, 6..9→$264B..$264E', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => t().crownWord(n)))
      .toEqual([0x264f, 0x263b, 0x263c, 0x263d, 0x263e, 0x263f, 0x264b, 0x264c, 0x264d, 0x264e]);
  });
  it('paletas de time ($C2:7B9D): o personagem 0 aponta para as mesmas da tabela normal', () => {
    for (let s = 0; s < 5; s++) expect(Array.from(t().teamPalette(0, s))).toEqual(Array.from(ASSETS!.character(0).palettes[s]));
  });
});
