import { ROM } from './helpers';
import { createRomAssets } from '../../src/rom/assets';
import { sheetFrame } from '../../src/rom/assets-char';
import { SCENE_IDS } from '../../src/rom/types';

describe.skipIf(!ROM)('RomAssets (createRomAssets)', () => {
  const A = ROM ? createRomAssets(ROM) : null;
  it('cache: a mesma chamada devolve o mesmo objeto', () => {
    expect(A!.arena(1)).toBe(A!.arena(1));
    expect(A!.character(2)).toBe(A!.character(2));
    expect(A!.anim(0xd81693)).toBe(A!.anim(0xd81693));
    expect(A!.scene('title')).toBe(A!.scene('title'));
    expect(A!.mode7Draw()).toBe(A!.mode7Draw());
    expect(A!.audioData()).toBe(A!.audioData());
  });
  it('as 10 arenas e as 11 telas carregam', () => {
    for (let s = 1; s <= 10; s++) expect(A!.arena(s).stage).toBe(s);
    expect(() => A!.arena(0)).toThrow(RangeError);
    expect(() => A!.arena(11)).toThrow(RangeError);
    for (const id of SCENE_IDS) expect(A!.scene(id).cgram).toHaveLength(256);
  });
  it('playerAnim: mesma animação para os 6 personagens; índices ↑ → ↓ ← e +8 parado [spec §7.4]', () => {
    for (let c = 0; c < 6; c++) {
      expect(A!.playerAnim(0xc276c5, c, 1)).toBe(A!.anim(0xd81693));   // andar →
      expect(A!.playerAnim(0xc276c5, c, 0)).toBe(A!.anim(0xd816ac));   // andar ↑
      expect(A!.playerAnim(0xc276c5, c, 4)).toBe(A!.anim(0xd81661));   // andar ↓
      expect(A!.playerAnim(0xc276c5, c, 5)).toBe(A!.anim(0xd8167a));   // andar ←
      expect(A!.playerAnim(0xc276c5, c, 12)).toBe(A!.anim(0xd81645));  // parado ↓
    }
    expect(A!.playerAnim(0xc276c5, 0, 12).map(f => [f.pieces[0].tile, f.dur])).toEqual([[6, 255]]);
  });
  it('personagem 5 lê a folha pela tabela $C2:0730 (C1)', () => {
    expect(A!.character(5).frame(7)).toEqual(sheetFrame(A!.rom, 0xcd1800, 7));
    expect(() => A!.character(6)).toThrow(RangeError);
  });
  it('bombScript: normal e remota', () => {
    expect(A!.bombScript(0).slice(0, 4)).toEqual([{ word: 0x0b00, dur: 20 }, { word: 0x0b02, dur: 12 }, { word: 0x0b04, dur: 16 }, { word: 0x0b06, dur: 16 }]);
    expect(A!.bombScript(1).map(f => f.dur)).toEqual([16, 16, 16, 16]);
  });
  it('bombScript: cache (item 4) e RangeError fora de 0..6', () => {
    expect(A!.bombScript(0)).toBe(A!.bombScript(0));
    expect(A!.bombScript(6)).toBeTruthy();
    expect(() => A!.bombScript(-1)).toThrow(RangeError);
    expect(() => A!.bombScript(7)).toThrow(RangeError);
  });
});
