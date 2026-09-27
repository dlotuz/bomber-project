/**
 * Main thread: cria o AudioContext (de preferência a 32 kHz, a taxa do DSP; senão, a do aparelho e o
 * worklet reamostra), carrega o worklet (chunk separado, que contém o módulo LGPL do DSP) e envia
 * a imagem da ROM uma vez. Só pode ser chamado depois de um gesto do usuário.
 * Falha no meio da criação fecha o contexto (I3). O `resume()` não é esperado: sem permissão ele fica
 * pendente até um gesto (Safari/iOS, toque), então o jogo chama `resume()` de novo a cada gesto.
 */
import workletUrl from './worklet?worker&url';
import type { AudioCmd, WorkletIn, WorkletOut } from './engine/commands';
import type { AudioSlices } from './host/image';

/** O que o resto do jogo usa do cliente (a fábrica da Tarefa 11 recebe isto, e os testes, um falso). */
export interface AudioClientLike { send(cmd: AudioCmd): void; resume?(): void; close(): Promise<void> }

/** Construtores do Web Audio (injetáveis nos testes). */
export interface AudioEnv {
  AudioContext: new (o?: AudioContextOptions) => AudioContext;
  AudioWorkletNode: new (ctx: BaseAudioContext, name: string, o?: AudioWorkletNodeOptions) => AudioWorkletNode;
}

export class AudioClient implements AudioClientLike {
  private readonly ctx: AudioContext;
  private readonly node: AudioWorkletNode;
  private constructor(ctx: AudioContext, node: AudioWorkletNode) { this.ctx = ctx; this.node = node; }

  static async create(s: AudioSlices, onMessage?: (m: WorkletOut) => void, env: AudioEnv = globalThis as unknown as AudioEnv): Promise<AudioClient> {
    let ctx: AudioContext;
    try { ctx = new env.AudioContext({ sampleRate: 32000, latencyHint: 'interactive' }); }
    catch { ctx = new env.AudioContext({ latencyHint: 'interactive' }); }
    try {
      await ctx.audioWorklet.addModule(workletUrl);
      const node = new env.AudioWorkletNode(ctx, 'crown-apu', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
      if (onMessage) node.port.onmessage = e => onMessage(e.data as WorkletOut);
      node.connect(ctx.destination);                         // volume: comando 'volume' ao worklet (M5)
      const c0 = s.c0.slice(), data = s.data.slice();
      const msg: WorkletIn = { t: 'image', c0, data };
      node.port.postMessage(msg, [c0.buffer, data.buffer]);
      const client = new AudioClient(ctx, node);
      client.resume();
      return client;
    } catch (e) {
      ctx.close().catch(() => undefined);
      throw e;
    }
  }

  send(cmd: AudioCmd): void { this.node.port.postMessage(cmd); }
  /** Pede para o contexto rodar (sem esperar); chamado na criação e a cada gesto do usuário. */
  resume(): void { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => undefined); }
  async close(): Promise<void> { this.node.disconnect(); await this.ctx.close(); }
}
