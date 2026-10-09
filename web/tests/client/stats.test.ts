// Contador de FPS e ping no topo da tela (src/app/stats.ts).
import { FpsMeter, statsText } from '../../src/app/stats';

describe('contador de FPS e ping', () => {
  it('mede 60 FPS com quadros a cada 1/60 s', () => {
    const m = new FpsMeter();
    let fps = 0;
    for (let i = 0; i <= 60; i++) fps = m.frame(i * 1000 / 60);
    expect(fps).toBe(60);
  });

  it('fica em 0 até fechar a primeira janela', () => {
    const m = new FpsMeter();
    expect(m.frame(0)).toBe(0);
    expect(m.frame(100)).toBe(0);
  });

  it('acompanha a queda de quadros', () => {
    const m = new FpsMeter();
    let fps = 0;
    for (let i = 0; i <= 30; i++) fps = m.frame(i * 1000 / 30);
    expect(fps).toBe(30);
  });

  it('mostra o ping só quando há sala', () => {
    expect(statsText(60, null)).toBe('60 FPS');
    expect(statsText(59, 42.6)).toBe('59 FPS · 43 ms');
    expect(statsText(60, 3, [{ slot: 0, ms: 2.6 }, { slot: 2, ms: 81.2 }])).toBe('60 FPS · 3 ms · 1P 3 · 3P 81');
    expect(statsText(60, 3, [{ slot: 0, ms: 2.6 }])).toBe('60 FPS · 3 ms');   // sozinho na sala: só o próprio ping
  });
});
