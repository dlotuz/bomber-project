/** Processador do AudioWorklet ('crown-apu'). Só a casca; a lógica está em worklet-core.ts. */
import { WorkletCore } from './worklet-core';
import { Apu } from './apu/apu';
import type { WorkletIn, WorkletOut } from './engine/commands';

interface WorkletScope {
  sampleRate: number;
  registerProcessor(name: string, ctor: unknown): void;
  AudioWorkletProcessor: new () => { readonly port: MessagePort };
}
const g = globalThis as unknown as WorkletScope;

class CrownApuProcessor extends g.AudioWorkletProcessor {
  private readonly core: WorkletCore;
  constructor() {
    super();
    this.core = new WorkletCore(g.sampleRate, ring => new Apu(ring), (m: WorkletOut) => this.port.postMessage(m));
    this.port.onmessage = e => this.core.onMessage(e.data as WorkletIn);
  }
  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const o = outputs[0];
    this.core.process(o[0], o[1] ?? o[0], o[0].length);
    return true;
  }
}
g.registerProcessor('crown-apu', CrownApuProcessor);
