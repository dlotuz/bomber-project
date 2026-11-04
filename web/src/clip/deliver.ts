// Destino do CLIPE: no computador, baixa o arquivo; no celular (tela de toque), abre o compartilhar do sistema (Web
// Share API com arquivo) e, se não houver ou falhar (ex.: botão de controle físico, que não conta como gesto), baixa.
import { isTouchDevice } from '../input/touch';

export interface DeliverEnv {
  touch: boolean;
  canShare?: (d: { files: File[] }) => boolean;
  share(d: { files: File[]; title: string }): Promise<void>;
  download(blob: Blob, name: string): void;
}

/** Baixa pelo navegador (um <a download> temporário). */
export function downloadBlob(blob: Blob, name: string, doc: Document = document): void {
  const a = doc.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.style.display = 'none';
  doc.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}

export function browserDeliverEnv(): DeliverEnv {
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  return {
    touch: isTouchDevice(),
    canShare: typeof nav.canShare === 'function' ? d => nav.canShare!(d) : undefined,
    share: d => nav.share(d),
    download: (b, n) => downloadBlob(b, n),
  };
}

export async function deliverClip(blob: Blob, name: string, env: DeliverEnv = browserDeliverEnv()): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (env.touch && env.canShare) {
    const file = new File([blob], name, { type: blob.type });
    let can = false;
    try { can = env.canShare({ files: [file] }); } catch { can = false; }
    if (can) {
      try {
        await env.share({ files: [file], title: 'Crown Blast' });
        return 'shared';
      } catch (e) {
        if ((e as { name?: string })?.name === 'AbortError') return 'cancelled';
      }
    }
  }
  env.download(blob, name);
  return 'downloaded';
}
