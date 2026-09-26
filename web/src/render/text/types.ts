// Tipos do motor de texto (plano 10, "Contratos compartilhados"). Um estilo por fonte da ROM.
import type { SceneId } from '../../app/rom-api';

export type TextStyleId = 'titleMenu' | 'menuTitle' | 'menuItem' | 'ascii8' | 'banner' | 'spriteBlue'
  | 'bigBattle' | 'bigScore' | 'bigVictory' | 'bigDraw';
export type Tone = 'default' | 'gray' | 'green' | 'red' | 'blue' | 'white' | 'orange' | 'yellow';
export type StripSource =
  | { kind: 'raw'; rows: readonly number[]; tiles: number; bpp: 2 | 4 }          // 1 endereço por faixa de 8 px; tiles 8×8 lado a lado
  | { kind: 'zte'; block: number; offset: number; rows: number; tiles: number; rowStride: number }   // 4bpp; offset e rowStride em bytes
  | { kind: 'vram'; scene: SceneId; region: 'bg' | 'bg3' | 'obj'; tile: number; rows: number; tiles: number; rowStride: number } // rowStride em tiles
  | { kind: 'mode7'; x: number; y: number; w: number; h: number };               // recorte da textura do DRAW GAME (8 bits)
export interface GlyphCut { ch: string; strip: string; x: number; w: number; y?: number; h?: number }
export interface StyleRomDef {
  strips: Record<string, StripSource>; cuts: readonly GlyphCut[];
  height: number; spacing: number; spaceWidth: number;
  palette: { kind: 'scene'; scene: SceneId; row: number; size: 4 | 16 | 256 } | { kind: 'rom'; addr: number; size: 4 | 16 | 256 };
  tones?: Partial<Record<Tone, number>>;    // linha de paleta (na mesma origem) para cada tom
  meta?: Record<string, number>;           // ex.: timeUpWidth (T17)
}
export interface ExtraGlyph { ch: string; rows: readonly string[]; legend?: Readonly<Record<string, number>> }  // '.' = 0; padrão: hex
export interface IndexedImage { w: number; h: number; px: Uint8Array }

export const TEXT_STYLES: readonly TextStyleId[] = ['titleMenu', 'menuTitle', 'menuItem', 'ascii8', 'banner', 'spriteBlue',
  'bigBattle', 'bigScore', 'bigVictory', 'bigDraw'];
