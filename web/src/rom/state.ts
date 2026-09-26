// Estado global da ROM (spec §2.3): assets atuais, avisos de troca e abertura do painel.
import type { RomAssets } from './types';
import { validateRom, mensagemDe, type ValidateResult } from './validate';
import { loadStoredRom, saveRom, forgetRom } from './store';
import { createRomAssets } from './assets';

export type RomStatus = 'vazio' | 'verificando' | 'ok' | 'erro';
export interface RomState { assets: RomAssets | null; status: RomStatus; erro: string | null }

export const romState: RomState = { assets: null, status: 'vazio', erro: null };
const listeners = new Set<(s: RomState) => void>();
let dialog: (() => void) | null = null;

/** Avisa a cada mudança de `romState`. Devolve a função que cancela a inscrição. */
export function onRomChange(cb: (s: RomState) => void): () => void { listeners.add(cb); return () => { listeners.delete(cb); }; }
function emit(): void { for (const cb of [...listeners]) cb(romState); }

/** O painel (rom/ui.ts) se registra aqui; as telas chamam openRomDialog() sem conhecer o DOM. */
export function registerRomDialog(open: (() => void) | null): void { dialog = open; }
export function openRomDialog(): void { dialog?.(); }

/** Valida e troca a ROM. Com erro (motivo conhecido OU falha inesperada ao validar/criar os assets — ex.:
 *  crypto.subtle indefinido fora de HTTPS/localhost), mantém a ROM anterior (se houver), grava a mensagem em
 *  PT-BR em `erro` e nunca deixa `status` parado em 'verificando'. Falha inesperada rejeita (quem chama —
 *  `ui.ts` `ctl.file` — decide a mensagem exibida no painel). */
export async function useRomBytes(bytes: Uint8Array | ArrayBuffer, opts: { persist?: boolean } = {}): Promise<ValidateResult> {
  romState.status = 'verificando'; romState.erro = null; emit();
  try {
    const r = await validateRom(bytes);
    if (!r.ok) {
      romState.status = romState.assets ? 'ok' : 'erro'; romState.erro = r.mensagem; emit();
      return r;
    }
    romState.assets = createRomAssets(r.rom); romState.status = 'ok'; romState.erro = null;
    if (opts.persist ?? true) {
      try { await saveRom(r.rom); } catch { romState.erro = 'A ROM vale só nesta sessão: o navegador não deixou guardá-la.'; }
    }
    emit();
    return r;
  } catch (e) {
    romState.status = romState.assets ? 'ok' : 'erro'; romState.erro = mensagemDe('falha'); emit();
    throw e;
  }
}

/** No boot: usa a ROM guardada, se houver e for válida (senão a apaga). Nunca rejeita (IndexedDB e
 *  `useRomBytes` podem falhar de forma inesperada; o painel precisa poder abrir mesmo assim). Devolve se
 *  ficou com ROM. */
export async function bootRom(): Promise<boolean> {
  try {
    const stored = await loadStoredRom();
    if (!stored) return false;
    const r = await useRomBytes(stored.bytes, { persist: false });
    if (r.ok) return true;
    await forgetRom();
    romState.status = 'vazio'; romState.erro = null; emit();
    return false;
  } catch {
    try { await forgetRom(); } catch { /* ROM guardada não confiável; segue vazio mesmo se o delete falhar */ }
    romState.status = 'vazio'; romState.erro = null; emit();
    return false;
  }
}

/** "Esquecer ROM" (Opções): apaga do IndexedDB e volta para a arte por código. Sempre limpa o estado em
 *  memória; se o delete do IndexedDB falhar, marca `erro` em PT-BR (mas o jogo já está sem a ROM). */
export async function forgetStoredRom(): Promise<void> {
  let erro: string | null = null;
  try { await forgetRom(); } catch { erro = 'Não foi possível apagar a ROM guardada neste navegador.'; }
  romState.assets = null; romState.status = 'vazio'; romState.erro = erro;
  emit();
}
