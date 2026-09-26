import { NoopSink, type AudioSink } from '../../src/audio/sink';
import { drawRomBattle } from '../../src/render/rom/battle';
import type { RomAssets } from '../../src/rom/types';

describe('contratos da onda 1 (spec §2.5)', () => {
  it('NoopSink aceita todas as chamadas em silêncio', () => {
    const s: AudioSink = new NoopSink();
    expect(() => { s.bank(0x2f); s.bank(0x30); s.music(0x14); s.sfx(0x0c); s.voice(0x0e); s.stop(); s.fade(); s.tick(); }).not.toThrow();
  });
  it('drawRomBattle devolve false quando os assets não têm os métodos da ROM (stub; M7)', () => {
    // Comportamento real de hoje: `{}` não tem `arena()`, `buildBattleFrame` lança e o fallback assume — sem
    // poluir a saída do teste com o aviso único (`warnOnce`, M1).
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(drawRomBattle({} as CanvasRenderingContext2D, {} as never, {} as never, {} as RomAssets, 0)).toBe(false);
    warn.mockRestore();
  });
});
