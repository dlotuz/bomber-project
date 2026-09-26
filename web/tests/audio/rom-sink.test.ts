import { RomAudioSink, SFX_QUEUE } from '../../src/audio/rom-sink';
import type { AudioCmd } from '../../src/audio/engine/commands';

function make(onTick?: () => void) {
  const sent: AudioCmd[] = [];
  const gains: number[] = [];
  return { sent, gains, sink: new RomAudioSink({ send: c => { sent.push(c); }, setGain: g => { gains.push(g); } }, { onTick }) };
}

describe('RomAudioSink', () => {
  it('5 explosões no mesmo tick saem em 5 ticks, 1 por tick (§11)', () => {
    const { sent, sink } = make();
    for (let i = 0; i < 5; i++) sink.sfx(0x07);
    expect(sent).toEqual([]);
    const perTick: number[] = [];
    for (let t = 0; t < 7; t++) { const n = sent.length; sink.tick(); perTick.push(sent.length - n); }
    expect(perTick).toEqual([1, 1, 1, 1, 1, 0, 0]);
    expect(sent).toEqual(Array.from({ length: 5 }, () => ({ t: 'sfx', id: 0x07 })));
  });
  it('mantém a ordem de chegada', () => {
    const { sent, sink } = make();
    sink.sfx(0x0c); sink.sfx(0x07); sink.sfx(0x08);
    sink.tick(); sink.tick(); sink.tick();
    expect(sent.map(c => (c.t === 'sfx' ? c.id : -1))).toEqual([0x0c, 0x07, 0x08]);
  });
  it('fila circular de 64: o 65º é descartado', () => {
    const { sink } = make();
    for (let i = 0; i < SFX_QUEUE + 1; i++) sink.sfx(1);
    expect(sink.pending).toBe(64);
    expect(sink.dropped).toBe(1);
  });
  it('banco, música, voz, STOP e FADE vão na hora', () => {
    const { sent, sink } = make();
    sink.bank(0x2f); sink.music(0x14); sink.voice(0x10); sink.stop(); sink.fade();
    expect(sent).toEqual([{ t: 'bank', id: 0x2f }, { t: 'music', id: 0x14 }, { t: 'voice', id: 0x10 }, { t: 'stop' }, { t: 'fade' }]);
  });
  it('flag $CA: descarta tudo menos o $13', () => {
    const { sent, sink } = make();
    sink.dropAllButSfx13 = true;
    sink.sfx(0x01); sink.sfx(0x02); sink.sfx(0x13); sink.sfx(0x04);
    sink.tick(); sink.tick();
    expect(sent).toEqual([{ t: 'sfx', id: 0x13 }]);
    expect(sink.pending).toBe(0);
  });
  it('onTick roda no início de cada tick, antes de tirar o SFX (atrasos entram na mesma fila)', () => {
    const order: string[] = [];
    const { sent, sink } = make(() => { order.push('onTick'); sink.sfx(0x10); });
    sink.tick();
    expect(order).toEqual(['onTick']);
    expect(sent).toEqual([{ t: 'sfx', id: 0x10 }]);
  });
  it('volume (VolumeControl do plano 10): ganho geral = o maior dos dois, entre 0 e 1', () => {
    const { gains, sink } = make();
    sink.setVolume(0.3, 0.8); sink.setVolume(0, 0); sink.setVolume(2, 0);
    expect(gains).toEqual([0.8, 0, 1]);
  });
});
