// Saída do som original (o nó do APU no AudioContext atual), para quem quiser ouvir junto — o CLIPE grava daqui.
// O cliente (client.ts) publica ao nascer e tira ao fechar (troca de ROM recria o AudioContext).

export interface AudioOutput { ctx: AudioContext; node: AudioNode }
type Listener = (o: AudioOutput | null) => void;

let current: AudioOutput | null = null;
const listeners = new Set<Listener>();

export function audioOutput(): AudioOutput | null { return current; }

export function setAudioOutput(o: AudioOutput | null): void {
  current = o;
  for (const f of listeners) f(o);
}

/** Avisa a cada saída nova (ou null, quando o som fecha); devolve a função que cancela. */
export function onAudioOutput(f: Listener): () => void {
  listeners.add(f);
  return () => { listeners.delete(f); };
}
