// Tipos do motor de texto (plano 10, "Contratos compartilhados"). Um estilo por fonte da ROM.
import type { SceneId } from '../../app/rom-api';

export type TextStyleId = 'titleMenu' | 'menuTitle' | 'menuItem' | 'ascii8' | 'banner' | 'spriteBlue'
  | 'bigBattle' | 'bigScore' | 'bigVictory' | 'bigDraw';
export type Tone = 'default' | 'gray' | 'green' | 'red' | 'blue' | 'white' | 'orange' | 'yellow';
export type StripSource =
  | { kind: 'raw'; rows: readonly number[]; tiles: number; bpp: 2 | 4 }          // 1 endereço por faixa de 8 px; tiles 8×8 lado a lado
  | { kind: 'zte'; block: number; offset: number; rows: number; tiles: number; rowStride: number }   // 4bpp; offset e rowStride em bytes
  | { kind: 'vram'; scene: SceneId; region: 'bg' | 'bg3' | 'obj'; tile: number; rows: number; tiles: number; rowStride: number } // rowStride em tiles
  | { kind: 'mode7'; x: number; y: number; w: number; h: number }                // recorte da textura do DRAW GAME (8 bits)
  // Mosaico de blocos 16×16 da VRAM da cena, como nos mapas de BG com tiles 16×16 e nos OBJ 16×16: cada célula t ocupa
  // os tiles t, t+1, t+16 e t+17 da região; −1 = bloco vazio. Serve para títulos montados por mapa (SCORE BOARD,
  // VICTORY!) e para frases em OBJ (BATTLE START!).
  | { kind: 'grid16'; scene: SceneId; region: 'bg' | 'bg3' | 'obj'; cells: readonly (readonly number[])[] };
/** `seeds` (x, y na faixa) + `def.mask`: o glifo fica só com a letra das sementes (letras encostadas ou sobrepostas). */
export interface GlyphCut { ch: string; strip: string; x: number; w: number; y?: number; h?: number; seeds?: readonly (readonly [number, number])[] }
/** Máscara por sementes: inundação 4-vizinha pelos índices `fill` a partir das sementes, depois `grow` camadas
 *  8-vizinhas pelos índices `edge` (contorno); o resto do retângulo do recorte vira 0. */
export interface GlyphMask { fill: readonly number[]; edge: readonly number[]; grow: number }
export interface StyleRomDef {
  strips: Record<string, StripSource>; cuts: readonly GlyphCut[];
  height: number; spacing: number; spaceWidth: number;
  palette: { kind: 'scene'; scene: SceneId; row: number; size: 4 | 16 | 256 } | { kind: 'rom'; addr: number; size: 4 | 16 | 256 };
  tones?: Partial<Record<Tone, number>>;    // linha de paleta (na mesma origem) para cada tom
  meta?: Record<string, number>;           // ex.: timeUpWidth (T17)
  mask?: GlyphMask;                        // usada pelos recortes com `seeds`
}
/** '.' = 0; padrão: hex. Com `base`, o glifo é o glifo `base` já recortado da ROM (montado em tempo de execução) com os
 *  pixels não-'.' deste desenho por cima (acentos sobre letras da ROM, sem guardar os pixels dela). */
export interface ExtraGlyph { ch: string; rows: readonly string[]; legend?: Readonly<Record<string, number>>; base?: string }
export interface IndexedImage { w: number; h: number; px: Uint8Array }

export const TEXT_STYLES: readonly TextStyleId[] = ['titleMenu', 'menuTitle', 'menuItem', 'ascii8', 'banner', 'spriteBlue',
  'bigBattle', 'bigScore', 'bigVictory', 'bigDraw'];
