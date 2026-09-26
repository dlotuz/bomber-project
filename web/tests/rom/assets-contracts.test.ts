import { NoopSink, type AudioSink } from '../../src/audio/sink';
import { drawRomBattle } from '../../src/render/rom/battle';
import type { RomAssets } from '../../src/rom/types';

describe('contratos da onda 1 (spec §2.5)', () => {
  it('NoopSink aceita todas as chamadas em silêncio', () => {
    const s: AudioSink = new NoopSink();
    expect(() => { s.bank(0x2f); s.bank(0x30); s.music(0x14); s.sfx(0x0c); s.voice(0x0e); s.stop(); s.fade(); s.tick(); }).not.toThrow();
  });
  it('drawRomBattle (stub) devolve false', () => {
    expect(drawRomBattle({} as CanvasRenderingContext2D, {} as never, {} as never, {} as RomAssets, 0)).toBe(false);
  });
});
