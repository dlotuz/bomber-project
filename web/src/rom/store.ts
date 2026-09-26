// ROM guardada no IndexedDB do navegador (spec §2.3). Nada sai do navegador; nenhuma chamada de rede.
import { sha1Hex } from './validate';

export const DB_NAME = 'crown-blast', STORE = 'rom', KEY = 'sb4';
export interface StoredRom { bytes: ArrayBuffer; sha1: string; salvaEm: number }

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode), req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result as T);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

/** A ROM guardada, ou null. Sem IndexedDB (modo privado restrito etc.), devolve null. */
export async function loadStoredRom(): Promise<StoredRom | null> {
  if (typeof indexedDB === 'undefined') return null;
  try { return (await run<StoredRom | undefined>('readonly', s => s.get(KEY))) ?? null; }
  catch { return null; }
}

/** Guarda uma cópia dos bytes (já validados por quem chama). */
export async function saveRom(bytes: Uint8Array): Promise<void> {
  const copy = bytes.slice();
  const rec: StoredRom = { bytes: copy.buffer, sha1: await sha1Hex(copy), salvaEm: Date.now() };
  await run('readwrite', s => s.put(rec, KEY));
}

export async function forgetRom(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await run('readwrite', s => s.delete(KEY));
}
