import { ClipController, clipFileName, type ClipControllerDeps, type RecorderLike } from '../../src/clip/controller';
import { S } from '../../src/render/text/strings';

class FakeRec implements RecorderLike {
  state: 'recording' | 'paused' | 'inactive' = 'inactive';
  log: string[] = [];
  result: { blob: Blob; durMs: number } | null = { blob: new Blob(['x']), durMs: 15000 };
  constructor(readonly keepMs: number) {}
  start(): void { this.state = 'recording'; this.log.push('start'); }
  pause(): void { this.state = 'paused'; this.log.push('pause'); }
  resume(): void { this.state = 'recording'; this.log.push('resume'); }
  async stop(): Promise<void> { this.state = 'inactive'; this.log.push('stop'); }
  async take(ms: number): Promise<{ blob: Blob; durMs: number } | null> { this.log.push(`take ${ms}`); return this.result; }
}

function rig(o: Partial<{ supported: boolean }> = {}) {
  const st = { clipOn: true, clipSec: 15 as 15 | 30, battle: { paused: false, stage: 3 } as { paused: boolean; stage: number } | null,
    hidden: false, audio: 1 as unknown, now: 0, delivered: [] as string[], how: 'downloaded' as 'shared' | 'downloaded' | 'cancelled' };
  const recs: FakeRec[] = [];
  const deps: ClipControllerDeps = {
    supported: o.supported ?? true,
    options: () => ({ clipOn: st.clipOn, clipSec: st.clipSec }),
    battle: () => st.battle, hidden: () => st.hidden, audioKey: () => st.audio, now: () => st.now,
    newRecorder: keep => { const r = new FakeRec(keep); recs.push(r); return r; },
    deliver: async (_b, name) => { st.delivered.push(name); return st.how; },
    fileName: stage => `clipe-fase${stage}`,
  };
  return { st, recs, c: new ClipController(deps) };
}

describe('CLIPE: quando grava', () => {
  it('grava só na batalha com a opção ligada e o navegador com suporte; guarda N + 3 s', () => {
    const { st, recs, c } = rig();
    st.battle = null; c.update();
    expect(recs).toHaveLength(0);
    st.battle = { paused: false, stage: 3 }; c.update();
    expect([recs.length, recs[0].state, recs[0].keepMs, c.recording]).toEqual([1, 'recording', 18_000, true]);
    c.update();
    expect(recs).toHaveLength(1);                    // segue o mesmo
    const off = rig(); off.st.clipOn = false; off.c.update();
    const unsup = rig({ supported: false }); unsup.c.update();
    expect([off.recs.length, unsup.recs.length]).toEqual([0, 0]);
  });
  it('aba escondida pausa o gravador; voltar retoma', () => {
    const { st, recs, c } = rig();
    c.update(); st.hidden = true; c.update(); st.hidden = false; c.update();
    expect(recs[0].log).toEqual(['start', 'pause', 'resume']);
  });
  it('fora da batalha para (o anel fica para clipar o fim da rodada); a próxima batalha começa outro', () => {
    const { st, recs, c } = rig();
    c.update(); st.battle = null; c.update();
    expect([recs[0].state, c.recording, c.available]).toEqual(['inactive', false, true]);
    st.battle = { paused: false, stage: 4 }; c.update();
    expect([recs.length, recs[1].state]).toEqual([2, 'recording']);
  });
  it('desligar a opção solta o anel; som novo (outro AudioContext) ou outra duração recomeça o gravador', () => {
    const { st, recs, c } = rig();
    c.update(); st.audio = 2; c.update();
    expect([recs.length, recs[0].state, recs[1].state]).toEqual([2, 'inactive', 'recording']);
    st.battle = null; c.update(); st.clipSec = 30; st.battle = { paused: false, stage: 1 }; c.update();
    expect(recs[2].keepMs).toBe(33_000);
    st.clipOn = false; c.update();
    expect([recs[2].state, c.available]).toEqual(['inactive', false]);
  });
});

describe('CLIPE: ao apertar', () => {
  it('pega os últimos N s, entrega com o nome da fase e avisa CLIPE SALVO por alguns segundos', async () => {
    const { st, recs, c } = rig();
    c.update();
    await c.press();
    expect(recs[0].log).toContain('take 15000');
    expect(st.delivered).toEqual(['clipe-fase3']);
    expect(c.toast()).toBe(S.clip.saved);
    st.now = 10_000;
    expect(c.toast()).toBeNull();
  });
  it('depois da rodada ainda clipa o fim dela; sem gravador, nada acontece', async () => {
    const { st, recs, c } = rig();
    await c.press();
    expect(st.delivered).toEqual([]);
    c.update(); st.battle = null; c.update();
    await c.press();
    expect([recs[0].log.at(-1), st.delivered]).toEqual(['take 15000', ['clipe-fase3']]);
  });
  it('na pausa não clipa (o SELECT+START de sair não salva um clipe sem querer)', async () => {
    const { st, recs, c } = rig();
    c.update(); st.battle = { paused: true, stage: 3 };
    await c.press();
    expect(recs[0].log).not.toContain('take 15000');
  });
  it('ainda sem quadro-chave: avisa que está vazio; falha ao entregar: avisa a falha; cancelado: avisa', async () => {
    const { st, recs, c } = rig();
    c.update(); recs[0].result = null;
    await c.press();
    expect(c.toast()).toBe(S.clip.empty);
    recs[0].result = { blob: new Blob(['y']), durMs: 1 };
    st.how = 'cancelled';
    await c.press();
    expect(c.toast()).toBe(S.clip.cancelled);
    recs[0].take = async () => { throw new Error('quebrou'); };
    await c.press();
    expect(c.toast()).toBe(S.clip.failed);
  });
  it('dois apertos seguidos: o segundo espera o primeiro terminar (um arquivo só)', async () => {
    const { st, c } = rig();
    c.update();
    await Promise.all([c.press(), c.press()]);
    expect(st.delivered).toHaveLength(1);
  });
});

describe('nome do arquivo', () => {
  it('crown-blast, fase e data/hora local, com a extensão do formato', () => {
    const d = new Date(2026, 10, 4, 14, 5, 9);
    expect(clipFileName(d, 3, 'video/mp4;codecs=avc1,mp4a.40.2')).toBe('crown-blast-fase3-2026-11-04-14h05m09.mp4');
    expect(clipFileName(d, 12, 'video/webm;codecs=vp8,opus')).toBe('crown-blast-fase12-2026-11-04-14h05m09.webm');
  });
});
