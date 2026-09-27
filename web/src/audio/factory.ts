/**
 * Fábrica do sink real para o `registerAudioFactory` do plano 10 (chamada depois do 1º gesto e a cada
 * mudança de ROM). Sem ROM: NoopSink. Mesma ROM: o mesmo sink. ROM nova: fecha o cliente antigo e cria
 * outro (os samples vêm da ROM). Chamadas sobrepostas são serializadas.
 */
import { NoopSink, type AudioSink } from './sink';
import { RomAudioSink } from './rom-sink';
import { slicesFromView, type AudioSlices } from './host/image';
import type { AudioClientLike } from './client';

export interface RomBytes { bytes(addr: number, n: number): Uint8Array }
export interface AudioFactoryDeps {
  currentRom(): RomBytes | null;
  createClient(s: AudioSlices): Promise<AudioClientLike>;
  /** chamado 1× por tick de jogo pelo RomAudioSink (atrasos do BattleAudio) */
  onTick?(): void;
  onError?(e: unknown): void;
}

export function createAudioFactory(d: AudioFactoryDeps): () => Promise<AudioSink> {
  let cur: { rom: RomBytes; client: AudioClientLike; sink: RomAudioSink } | null = null;
  let chain: Promise<unknown> = Promise.resolve();
  const make = async (): Promise<AudioSink> => {
    const rom = d.currentRom();
    if (cur && cur.rom === rom) return cur.sink;
    if (cur) { const old = cur; cur = null; await old.client.close(); }
    if (!rom) return new NoopSink();
    try {
      const client = await d.createClient(slicesFromView(rom));
      client.send({ t: 'boot' });
      const sink = new RomAudioSink(client, { onTick: d.onTick });
      cur = { rom, client, sink };
      return sink;
    } catch (e) {
      d.onError?.(e);
      return new NoopSink();
    }
  };
  return () => { const p = chain.then(make); chain = p.catch(() => undefined); return p; };
}
