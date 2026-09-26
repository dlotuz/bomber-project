import type { ObjEntry } from '../ppu';
import type { RomBattleBuilder } from '../battle-layers';

/** Desempate de sprites com o mesmo Y: menor na frente (jogadores antes dos objetos, [ANI §1.4]). */
export const ORDER_PLAYER = 0;     // + slot
export const ORDER_OBJ = 100;      // + ordem de criação
export const ORDER_PRESSURE = 300; // + 2·i (bloco) / + 2·i + 1 (sombra)
export const ORDER_LAYER = 1000;   // sugestão para as camadas dos planos 8 e 9

interface Spr { e: ObjEntry; sortY: number; order: number; seq: number }

export class FrameBuilder implements RomBattleBuilder {
  readonly bg1 = new Uint16Array(1024);
  readonly bg2 = new Uint16Array(1024);
  readonly cg = new Uint16Array(256);
  hofs1 = 8;
  private readonly spr: Spr[] = [];

  constructor(bg1: Uint16Array, bg2: Uint16Array, cgram: Uint16Array) {
    this.bg1.set(bg1.subarray(0, 1024));
    this.bg2.set(bg2.subarray(0, 1024));
    this.cg.set(cgram.subarray(0, 256));
  }
  setBg2(col: number, lin: number, word: number): void {
    if (col >= 0 && col < 32 && lin >= 0 && lin < 32) this.bg2[lin * 32 + col] = word & 0xffff;
  }
  setBg1(col: number, lin: number, word: number): void {
    if (col >= 0 && col < 32 && lin >= 0 && lin < 32) this.bg1[lin * 32 + col] = word & 0xffff;
  }
  sprite(e: ObjEntry, sortY: number, order: number): void {
    this.spr.push({ e, sortY, order, seq: this.spr.length });
  }
  cgram(index: number, bgr555: number): void {
    if (index >= 0 && index < 256) this.cg[index] = bgr555 & 0x7fff;
  }
  bg1Scroll(hofs: number): void { this.hofs1 = hofs; }
  /** OAM: maior sortY na frente; empate → menor order; empate → quem chegou antes. Índice 0 = frente. */
  oam(): ObjEntry[] {
    return [...this.spr].sort((a, b) => b.sortY - a.sortY || a.order - b.order || a.seq - b.seq).map(s => s.e);
  }
}
