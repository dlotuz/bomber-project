/** Mensagens do main thread para o motor de áudio (AudioWorklet). */
export type AudioCmd =
  | { t: 'boot' }
  | { t: 'bank'; id: 0x2f | 0x30 }
  | { t: 'music'; id: number }
  | { t: 'sfx'; id: number }
  | { t: 'voice'; id: number }
  | { t: 'stop' }
  | { t: 'fade' };

/** Mensagens do main thread para o processador: a imagem da ROM vem 1 vez, antes de tudo. */
export type WorkletIn = { t: 'image'; c0: Uint8Array; data: Uint8Array } | AudioCmd;
/** Mensagens do processador para o main thread. */
export type WorkletOut =
  | { t: 'ready' }
  | { t: 'stats'; frames: number; nmis: number; droppedSfx: number; ignoredVoices: number; errors: number; lastError: string };
