// PASTA DO CLIPE (Opções > Clipe): no Chrome do computador o jogador escolhe uma pasta (File System Access API,
// `showDirectoryPicker`) e os clipes são gravados direto nela, em vez de irem para Downloads. A pasta fica guardada
// no IndexedDB (o "handle" sobrevive a recarregar a página). Depois de recarregar, o Chrome pode pedir de novo a
// permissão de escrita: o pedido sai no próprio botão do clipe (tecla/clique contam como gesto; botão de controle
// não). Sem permissão, ou se a gravação falhar, o clipe vai para Downloads como antes.

type Perm = 'granted' | 'denied' | 'prompt';
interface Writable { write(b: Blob): Promise<void>; close(): Promise<void> }
export interface DirHandle {
  readonly name: string;
  queryPermission?(d: { mode: 'readwrite' }): Promise<Perm>;
  requestPermission?(d: { mode: 'readwrite' }): Promise<Perm>;
  getFileHandle(name: string, o: { create: boolean }): Promise<{ createWritable(): Promise<Writable> }>;
}
/** Onde o handle fica guardado (IndexedDB no navegador; memória nos testes). */
export interface FolderStore { get(): Promise<DirHandle | null>; set(d: DirHandle | null): Promise<void> }

export const CLIP_DB = 'crown-blast-clip', CLIP_STORE = 'kv', DIR_KEY = 'dir';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CLIP_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(CLIP_STORE)) req.result.createObjectStore(CLIP_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(CLIP_STORE, mode), req = fn(t.objectStore(CLIP_STORE));
      t.oncomplete = () => resolve(req.result as T);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } finally { db.close(); }
}
export const idbFolderStore: FolderStore = {
  get: async () => (typeof indexedDB === 'undefined' ? null : (await tx<DirHandle | undefined>('readonly', s => s.get(DIR_KEY))) ?? null),
  set: async d => {
    if (typeof indexedDB === 'undefined') return;
    await tx('readwrite', s => (d ? s.put(d, DIR_KEY) : s.delete(DIR_KEY)));
  },
};

type Picker = (o: { id: string; mode: 'readwrite'; startIn: string }) => Promise<DirHandle>;
const browserPicker = (): Picker | null => {
  const w = (typeof window === 'undefined' ? null : window) as (Window & { showDirectoryPicker?: Picker }) | null;
  return w?.showDirectoryPicker ? o => w.showDirectoryPicker!(o) : null;
};

export type FolderSave = 'none' | 'saved' | 'denied';

export class ClipFolder {
  private dir: DirHandle | null = null;

  constructor(private readonly store: FolderStore = idbFolderStore, private readonly picker: Picker | null = browserPicker()) {}

  /** O navegador deixa escolher pasta (Chrome/Edge no computador). */
  get supported(): boolean { return !!this.picker; }
  /** Nome da pasta escolhida (null = Downloads). */
  get name(): string | null { return this.dir?.name ?? null; }

  async load(): Promise<void> {
    if (!this.picker) return;
    try { this.dir = await this.store.get(); } catch { this.dir = null; }
  }

  /** Abre o seletor de pasta. Precisa de gesto (tecla, clique ou toque): sem ele o Chrome recusa ('failed'). */
  async pick(): Promise<'picked' | 'cancelled' | 'failed'> {
    if (!this.picker) return 'failed';
    try {
      const d = await this.picker({ id: 'crown-blast-clipes', mode: 'readwrite', startIn: 'videos' });
      this.dir = d;
      await this.store.set(d).catch(() => {});
      return 'picked';
    } catch (e) {
      return (e as { name?: string })?.name === 'AbortError' ? 'cancelled' : 'failed';
    }
  }

  /** Volta para Downloads. */
  async clear(): Promise<void> {
    this.dir = null;
    await this.store.set(null).catch(() => {});
  }

  /** Grava na pasta. 'none' = sem pasta escolhida; 'denied' = sem permissão ou falhou (quem chama baixa). */
  async save(blob: Blob, name: string): Promise<FolderSave> {
    const d = this.dir;
    if (!d) return 'none';
    try {
      let p: Perm = (await d.queryPermission?.({ mode: 'readwrite' })) ?? 'granted';
      if (p === 'prompt' && d.requestPermission) p = await d.requestPermission({ mode: 'readwrite' });
      if (p !== 'granted') return 'denied';
      const w = await (await d.getFileHandle(name, { create: true })).createWritable();
      await w.write(blob);
      await w.close();
      return 'saved';
    } catch {
      return 'denied';
    }
  }
}
