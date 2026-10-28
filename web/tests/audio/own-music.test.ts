import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { AudioDirector, MUSIC, BANK, type OwnMusicPlayer } from '../../src/app/audio';
import { OwnMusic, isAudioFile } from '../../src/audio/own-music';
import { RecordingSink } from '../screens/helpers';

class FakeOwn implements OwnMusicPlayer {
  count = 2;
  log: string[] = [];
  play(): void { this.log.push('play'); }
  pause(): void { this.log.push('pause'); }
  fade(): void { this.log.push('fade'); }
  setVolume(v: number): void { this.log.push(`vol ${v}`); }
  pick(): void {}
  async clear(): Promise<void> { this.count = 0; }
}

const ops = (s: RecordingSink) => s.calls.map(c => (c.id === undefined ? c.op : `${c.op} ${c.id}`));

describe('MÚSICA PRÓPRIA no AudioDirector', () => {
  it('a música da batalha vira a do jogador; jingles e menus seguem os da ROM', () => {
    const sink = new RecordingSink(), own = new FakeOwn(), d = new AudioDirector(sink);
    d.setOwnMusic(own, true);
    d.music(MUSIC.battleStart);
    d.music(MUSIC.battle);
    expect(ops(sink)).toEqual([`music ${MUSIC.battleStart}`, 'stop']);
    expect(own.log).toEqual(['pause', 'play']);
    d.fade();
    expect(own.log.at(-1)).toBe('fade');
    d.music(MUSIC.score);
    expect(ops(sink).at(-1)).toBe(`music ${MUSIC.score}`);
    d.ensureMenus(MUSIC.menus);
    expect(own.log.at(-1)).toBe('pause');
  });
  it('desligada ou sem faixas, a batalha toca a música da ROM', () => {
    for (const [on, count] of [[false, 2], [true, 0]] as const) {
      const sink = new RecordingSink(), own = new FakeOwn(), d = new AudioDirector(sink);
      own.count = count;
      d.setOwnMusic(own, on);
      d.music(MUSIC.battle);
      expect(ops(sink)).toEqual([`music ${MUSIC.battle}`]);
      expect(own.log).not.toContain('play');
    }
  });
  it('o sink real que chega depois não repete a música da ROM por cima da do jogador', () => {
    const own = new FakeOwn(), d = new AudioDirector();
    d.setOwnMusic(own, true);
    d.bank(BANK.battle); d.music(MUSIC.battle);
    const real = new RecordingSink();
    d.setSink(real);
    expect(ops(real)).toEqual([`bank ${BANK.battle}`]);
  });
  it('volume da música vale também para as faixas do jogador', () => {
    const own = new FakeOwn(), d = new AudioDirector();
    d.setVolume(0.5, 1);
    d.setOwnMusic(own, true);
    d.setVolume(0.3, 1);
    expect(own.log).toEqual(['vol 0.5', 'vol 0.3']);
  });
});

describe('OwnMusic (IndexedDB)', () => {
  const file = (name: string, type: string) => new File([new Uint8Array([1, 2, 3])], name, { type });
  it('guarda só arquivos de áudio, sobrevive a recarregar e apaga tudo', async () => {
    expect(isAudioFile({ type: 'audio/mpeg' })).toBe(true);
    expect(isAudioFile({ type: 'image/png' })).toBe(false);
    const a = new OwnMusic();
    expect(await a.add([file('a.mp3', 'audio/mpeg'), file('capa.png', 'image/png'), file('b.ogg', 'audio/ogg')])).toBe(2);
    const b = new OwnMusic();
    await b.load();
    expect(b.count).toBe(2);
    await b.clear();
    const c = new OwnMusic();
    await c.load();
    expect(c.count).toBe(0);
  });
  it('pick abre um seletor de arquivos de áudio múltiplo; o que vier é guardado', async () => {
    const input = { type: '', accept: '', multiple: false, files: [file('c.wav', 'audio/wav')] as unknown as FileList,
      click: vi.fn(), on: null as (() => void) | null, addEventListener(_: string, f: () => void) { this.on = f; } };
    const doc = { createElement: vi.fn(() => input) } as unknown as Pick<Document, 'createElement'>;
    const m = new OwnMusic(doc);
    await m.clear();
    m.pick();
    expect(input.click).toHaveBeenCalledOnce();
    expect([input.type, input.accept, input.multiple]).toEqual(['file', 'audio/*', true]);
    input.on!();
    await vi.waitFor(() => expect(m.count).toBe(1));
  });
});
