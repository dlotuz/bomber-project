// RomAssets. STUB da onda 1: só `rom` funciona; a T13 troca este arquivo pela implementação com cache.
import type { RomAssets } from './types';
import { RomView } from './view';

export function createRomAssets(bytes: Uint8Array): RomAssets {
  const rom = new RomView(bytes);
  const todo = (): never => { throw new Error('RomAssets ainda não implementado (plano 5, tarefa 13)'); };
  return { rom, arena: todo, character: todo, anim: todo, playerAnim: todo, bombScript: todo, scene: todo, mode7Draw: todo, audioData: todo };
}
