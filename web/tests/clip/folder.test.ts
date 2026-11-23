import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ClipFolder, type DirHandle, type FolderStore } from '../../src/clip/folder';
import { Mp4Ring, withTitle } from '../../src/clip/mp4';
import { ClipController, clipTitle, type ClipControllerDeps, type RecorderLike } from '../../src/clip/controller';
import { folderLabel } from '../../src/screens/options';
import { S } from '../../src/render/text/strings';

function dir(perm: 'granted' | 'prompt' | 'denied', after: 'granted' | 'denied' = 'granted') {
  const files = new Map<string, Blob>(), log: string[] = [];
  let p = perm;
  const d: DirHandle = {
    name: 'Clipes',
    queryPermission: async () => p,
    requestPermission: async () => { log.push('pedido'); p = after; return p; },
    getFileHandle: async name => ({ createWritable: async () => ({ write: async (b: Blob) => { files.set(name, b); }, close: async () => {} }) }),
  };
  return { d, files, log };
}
const mem = (start: DirHandle | null = null): FolderStore & { v: DirHandle | null } => {
  const s = { v: start, get: async () => s.v, set: async (d: DirHandle | null) => { s.v = d; } };
  return s;
};
const blob = new Blob(['x'], { type: 'video/mp4' });

describe('PASTA DO CLIPE', () => {
  it('sem pasta: nada (quem chama baixa); escolhida: grava nela e lembra depois de recarregar', async () => {
    const { d, files } = dir('granted'), store = mem();
    const f = new ClipFolder(store, async () => d);
    expect(await f.save(blob, 'a.mp4')).toBe('none');
    expect(await f.pick()).toBe('picked');
    expect(f.name).toBe('Clipes');
    expect(await f.save(blob, 'a.mp4')).toBe('saved');
    expect([...files.keys()]).toEqual(['a.mp4']);
    const again = new ClipFolder(store, async () => d);
    await again.load();
    expect(again.name).toBe('Clipes');
    await again.clear();
    expect([again.name, store.v]).toEqual([null, null]);
  });
  it('depois de recarregar pede a permissão de novo; recusada = "denied" (vai para Downloads)', async () => {
    const ok = dir('prompt', 'granted'), no = dir('prompt', 'denied');
    const a = new ClipFolder(mem(ok.d), async () => ok.d); await a.load();
    expect([await a.save(blob, 'b.mp4'), ok.log]).toEqual(['saved', ['pedido']]);
    const b = new ClipFolder(mem(no.d), async () => no.d); await b.load();
    expect([await b.save(blob, 'b.mp4'), no.files.size]).toEqual(['denied', 0]);
  });
  it('seletor: cancelar não muda nada; sem gesto (controle) = failed; sem API = não suportado', async () => {
    const f = new ClipFolder(mem(), async () => { throw Object.assign(new Error(), { name: 'AbortError' }); });
    expect([await f.pick(), f.name]).toEqual(['cancelled', null]);
    const g = new ClipFolder(mem(), async () => { throw Object.assign(new Error(), { name: 'SecurityError' }); });
    expect(await g.pick()).toBe('failed');
    expect(new ClipFolder(mem(), null).supported).toBe(false);
  });
  it('nome da pasta na fonte das listas', () => {
    expect(folderLabel('Vídeos do jogo')).toBe('VÍDEOS DO JOGO');
    expect(folderLabel('Clipes_€')).toBe('CLIPES_?');
    expect(folderLabel('uma pasta com nome bem comprido')).toHaveLength(16);
  });
});

describe('TÍTULO dentro do clipe', () => {
  it('data e hora locais', () => {
    expect(clipTitle(new Date(2026, 10, 4, 14, 5, 9), 3)).toBe('Crown Blast - Fase 3 - 04/11/2026 14:05:09');
  });
  it('MP4 do Chrome: o moov ganha udta/meta/ilst/©nam e continua lido pelo anel', () => {
    const MP4 = new Uint8Array(readFileSync(fileURLToPath(new URL('../fixtures/clip/chrome.mp4', import.meta.url))));
    const r = new Mp4Ring(60_000); r.push(MP4);
    const f = r.build(5000, 'Crown Blast - Fase 1 - 23/11/2026 10:00:00')!;
    const moov = f.parts[1], dv = new DataView(moov.buffer, moov.byteOffset);
    expect(String.fromCharCode(...moov.subarray(4, 8))).toBe('moov');
    expect(dv.getUint32(0)).toBe(moov.length);
    const txt = new TextDecoder().decode(moov);
    expect(txt).toContain('udta');
    expect(txt).toContain('Crown Blast - Fase 1 - 23/11/2026 10:00:00');
    const again = new Mp4Ring(60_000); again.push(new Uint8Array(f.parts.flatMap(p => [...p])));
    expect(again.broken).toBe(false);
    expect(again.segments).toBeGreaterThan(0);
    expect(withTitle(moov, 'x')).toBe(moov);   // já tem udta: não duplica
  });
});

describe('CLIPE: pasta sem permissão', () => {
  it('avisa que foi para Downloads e passa o título ao gravador', async () => {
    const takes: (string | undefined)[] = [];
    const rec: RecorderLike = { state: 'inactive', start() { this.state = 'recording'; }, pause() {}, resume() {}, async stop() {},
      async take(_ms, title) { takes.push(title); return { blob, durMs: 1 }; } } as RecorderLike & { state: string };
    let now = 0;
    const deps: ClipControllerDeps = { supported: true, options: () => ({ clipOn: true, clipSec: 15 }), battle: () => ({ paused: false, stage: 2 }),
      hidden: () => false, audioKey: () => 1, now: () => now, newRecorder: () => rec,
      deliver: async () => 'noFolder', fileName: () => 'c.mp4', title: s => `T${s}` };
    const c = new ClipController(deps);
    c.update();
    await c.press();
    expect([takes, c.toast()]).toEqual([['T2'], S.clip.noFolder]);
    now = 10_000;
  });
});
