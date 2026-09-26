/**
 * Main thread: cria o AudioContext (de preferência a 32 kHz, a taxa do DSP; senão, a do aparelho e o
 * worklet reamostra), carrega o worklet (chunk separado, que contém o módulo LGPL do DSP) e envia
 * a imagem da ROM uma vez. Só pode ser chamado depois de um gesto do usuário.
 */
import workletUrl from './worklet?worker&url';
import type { AudioCmd, WorkletIn, WorkletOut } from './engine/commands';
import type { AudioSlices } from './host/image';

/** O que o resto do jogo usa do cliente (a fábrica da Tarefa 11 recebe isto, e os testes, um falso). */
export interface AudioClientLike { send(cmd: AudioCmd): void; setGain(g: number): void; close(): Promise<void> }

export class AudioClient implements AudioClientLike {
  private readonly ctx: AudioContext;
  private readonly node: AudioWorkletNode;
  private readonly gain: GainNode;
  private constructor(ctx: AudioContext, node: AudioWorkletNode, gain: GainNode) { this.ctx = ctx; this.node = node; this.gain = gain; }

  static async create(s: AudioSlices, onMessage?: (m: WorkletOut) => void): Promise<AudioClient> {
    let ctx: AudioContext;
    try { ctx = new AudioContext({ sampleRate: 32000, latencyHint: 'interactive' }); }
    catch { ctx = new AudioContext({ latencyHint: 'interactive' }); }
    await ctx.audioWorklet.addModule(workletUrl);
    const node = new AudioWorkletNode(ctx, 'crown-apu', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
    if (onMessage) node.port.onmessage = e => onMessage(e.data as WorkletOut);
    const gain = ctx.createGain();
    node.connect(gain).connect(ctx.destination);
    const c0 = s.c0.slice(), data = s.data.slice();
    const msg: WorkletIn = { t: 'image', c0, data };
    node.port.postMessage(msg, [c0.buffer, data.buffer]);
    await ctx.resume();
    return new AudioClient(ctx, node, gain);
  }

  send(cmd: AudioCmd): void { this.node.port.postMessage(cmd); }
  setGain(g: number): void { this.gain.gain.value = g; }
  async close(): Promise<void> { this.node.disconnect(); await this.ctx.close(); }
}
