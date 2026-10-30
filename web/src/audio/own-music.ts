// MÚSICA PRÓPRIA (Opções): arquivos de áudio que o jogador escolhe no computador dele tocam no lugar da música da
// batalha, em ordem aleatória. Ficam no IndexedDB do navegador (banco próprio, separado da ROM); nada sai do
// navegador e nada vem junto com o jogo.
import type { OwnMusicPlayer } from '../app/audio';

export const OWN_DB = 'crown-blast-music', OWN_STORE = 'tracks';
export interface OwnTrack { name: string; blob: Blob }
/** Duração do fade de fim de partida (o `fade()` da ROM), ms. */
export const OWN_FADE_MS = 1000;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OWN_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(OWN_STORE)) req.result.createObjectStore(OWN_STORE, { autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void): Promise<T | undefined> {
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(OWN_STORE, mode), req = fn(tx.objectStore(OWN_STORE));
      tx.oncomplete = () => resolve(req ? (req.result as T) : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

/** Só o que o navegador diz ser áudio (mp3, ogg, wav, m4a…). */
export const isAudioFile = (f: { type: string }): boolean => f.type.startsWith('audio/');

export class OwnMusic implements OwnMusicPlayer {
  private tracks: OwnTrack[] = [];
  private el: HTMLAudioElement | null = null;
  private url: string | null = null;
  private cur = -1;
  private vol = 1;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;

  /** `doc` só é lido ao abrir o seletor ou tocar (os testes rodam sem DOM). */
  constructor(private readonly doc: Pick<Document, 'createElement'> | null = null, private readonly rand: () => number = Math.random) {}
  private get dom(): Pick<Document, 'createElement'> { return this.doc ?? document; }

  get count(): number { return this.tracks.length; }

  /** Lê as faixas guardadas. Sem IndexedDB (modo privado restrito etc.), fica sem nenhuma. */
  async load(): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    try { this.tracks = (await run<OwnTrack[]>('readonly', s => s.getAll())) ?? []; }
    catch { this.tracks = []; }
  }

  /** Guarda os arquivos de áudio escolhidos (os outros são ignorados). Devolve quantos entraram. */
  async add(files: readonly File[]): Promise<number> {
    const novos = files.filter(isAudioFile).map(f => ({ name: f.name, blob: f as Blob }));
    if (!novos.length) return 0;
    this.tracks.push(...novos);
    if (typeof indexedDB !== 'undefined') {
      try { await run('readwrite', s => { for (const t of novos) s.add(t); }); }
      catch { /* sem armazenamento: valem só nesta sessão */ }
    }
    return novos.length;
  }

  async clear(): Promise<void> {
    this.stopNow();
    this.tracks = [];
    if (typeof indexedDB !== 'undefined') {
      try { await run('readwrite', s => s.clear()); } catch { /* nada guardado */ }
    }
  }

  /** Abre o seletor de arquivos do sistema (precisa vir logo depois de uma tecla, clique ou toque). */
  pick(): void {
    const input = this.dom.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.multiple = true;
    input.addEventListener('change', () => { void this.add(Array.from(input.files ?? [])); });
    input.click();
  }

  /** Continua a faixa pausada; se não há, sorteia uma. */
  play(): void {
    if (!this.tracks.length) return;
    this.endFade();
    if (this.el && this.cur >= 0 && this.el.paused && !this.el.ended) {
      this.el.volume = this.vol;
      void this.el.play().catch(() => {});
      return;
    }
    this.next();
  }

  pause(): void { this.endFade(); this.el?.pause(); }

  /** Abaixa até zero em OWN_FADE_MS e pausa; a próxima `play()` sorteia outra faixa. */
  fade(): void {
    const el = this.el;
    if (!el || el.paused) return;
    this.endFade();
    const steps = 20, dv = el.volume / steps;
    let n = 0;
    this.fadeTimer = setInterval(() => {
      el.volume = Math.max(0, el.volume - dv);
      if (++n >= steps) { this.endFade(); this.stopNow(); }
    }, OWN_FADE_MS / steps);
  }

  setVolume(v: number): void {
    this.vol = Math.max(0, Math.min(1, v));
    if (this.el && !this.fadeTimer) this.el.volume = this.vol;
  }

  /** Sorteia a próxima faixa (outra, quando há mais de uma) e toca. */
  private next(): void {
    const n = this.tracks.length;
    if (!n) return;
    let i = Math.floor(this.rand() * n);
    if (n > 1 && i === this.cur) i = (i + 1) % n;
    this.cur = i;
    if (!this.el) {
      this.el = this.dom.createElement('audio');
      this.el.addEventListener('ended', () => this.next());
    }
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = URL.createObjectURL(this.tracks[i].blob);
    this.el.src = this.url;
    this.el.volume = this.vol;
    void this.el.play().catch(() => {});
  }

  private stopNow(): void {
    this.el?.pause();
    this.cur = -1;
  }

  private endFade(): void {
    if (this.fadeTimer) { clearInterval(this.fadeTimer); this.fadeTimer = null; }
    if (this.el) this.el.volume = this.vol;
  }
}
