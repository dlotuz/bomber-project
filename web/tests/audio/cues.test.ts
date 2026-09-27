import { CUES, CuePlayer, MUSIC_BANK, VOICE_BANK, type Bank, type CueScript } from '../../src/audio/cues';
import type { AudioSink } from '../../src/audio/sink';

describe('roteiros de transição', () => {
  const scripts = CUES as Record<string, CueScript>;
  for (const [name, sc] of Object.entries(scripts)) {
    it(`${name}: cada música e cada voz tocam com o banco certo`, () => {
      let bank: Bank = sc.startBank;
      for (const c of [...sc.cues].sort((a, b) => a.at - b.at)) {
        if (c.kind === 'bank') bank = c.id;
        if (c.kind === 'music') expect(MUSIC_BANK[c.id], `música $${c.id.toString(16)}`).toBe(bank);
        if (c.kind === 'voice') expect(VOICE_BANK[c.id], `voz $${c.id.toString(16)}`).toBe(bank);
      }
    });
  }
  it('fase → partida, TIME UP e todos mortos com os frames medidos [AUD §2, empates.py]', () => {
    const f = (sc: CueScript) => sc.cues.map(c => `${c.at}:${c.kind}${'id' in c ? ' ' + c.id.toString(16) : ''}`);
    expect(f(CUES.stageToBattle)).toEqual(['0:sfx 2', '48:music 13', '208:voice 7', '310:fade', '511:bank 2f', '523:music 14']);
    expect(f(CUES.timeUpDraw)).toEqual(['0:stop', '161:fade', '218:bank 30', '228:music 18', '426:voice e']);
    expect(f(CUES.roundWin)).toEqual(['0:sfx 17', '97:fade', '113:bank 30', '154:music 15']);
    expect(f(CUES.allDeadDraw)).toEqual(['0:fade', '57:bank 30', '68:music 18', '266:voice e']);
  });
  it('CuePlayer emite cada item no frame certo', () => {
    const got: string[] = [];
    const s: AudioSink = {
      bank: id => { got.push(`${frame} bank ${id}`); }, music: id => { got.push(`${frame} music ${id}`); }, sfx: id => { got.push(`${frame} sfx ${id}`); },
      voice: id => { got.push(`${frame} voice ${id}`); }, stop: () => { got.push(`${frame} stop`); }, fade: () => { got.push(`${frame} fade`); }, tick: () => {},
    };
    let frame = 0;
    const p = new CuePlayer(s, CUES.nextRound);
    while (p.tick()) frame++;
    expect(got).toEqual([`0 bank ${0x2f}`, `12 music ${0x14}`]);
  });
});
