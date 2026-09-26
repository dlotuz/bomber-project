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
/** `seeds` (x, y na faixa) + `def.mask`: o glifo fica só com a letra das sementes (letras encostadas ou sobrepostas).
 *  `remap`: troca índices de cor do recorte (índice da faixa → índice do estilo), para letras de uma frase da ROM
 *  pintada com outra família de índices da mesma linha de paleta (ex.: PUSH START BUTTON! na tela-título). */
export interface GlyphCut {
  ch: string; strip: string; x: number; w: number; y?: number; h?: number; seeds?: readonly (readonly [number, number])[];
  remap?: Readonly<Record<number, number>>;
}
/** Máscara por sementes: inundação 4-vizinha pelos índices `fill` a partir das sementes, depois `grow` camadas
 *  8-vizinhas pelos índices `edge` (contorno); o resto do retângulo do recorte vira 0. `conn: 8` inunda `fill` também
 *  na diagonal (traço de 1 px de fonte cursiva, que só se liga pelos cantos); padrão 4. */
export interface GlyphMask { fill: readonly number[]; edge: readonly number[]; grow: number; conn?: 4 | 8 }
export interface StyleRomDef {
  strips: Record<string, StripSource>; cuts: readonly GlyphCut[];
  height: number; spacing: number; spaceWidth: number;
  palette: { kind: 'scene'; scene: SceneId; row: number; size: 4 | 16 | 256 } | { kind: 'rom'; addr: number; size: 4 | 16 | 256 };
  tones?: Partial<Record<Tone, number>>;    // linha de paleta (na mesma origem) para cada tom
  meta?: Record<string, number>;           // ex.: timeUpWidth (T17)
  mask?: GlyphMask;                        // usada pelos recortes com `seeds`
  kern?: Readonly<Record<string, number>>; // ajuste por par de caracteres ('TÓ'), somado ao `spacing`
  /** Cada recorte mantém só estes índices (o corpo/brilho da letra) e zera o resto — em fontes cursivas onde só
   *  o contorno encosta letras vizinhas (não o corpo), isso evita que um recorte por retângulo simples pegue o
   *  contorno compartilhado. Usado com `outline` pra redesenhar o contorno depois de montar a frase inteira. */
  bodyOnly?: readonly number[];
  /** `layoutText` redesenha o contorno depois de montar a frase inteira: todo pixel 0 vizinho de um pixel do
   *  corpo vira `index` (o resto do contorno) ou `below` (ver adiante), repetido `width` vezes (padrão 1).
   *  `conn` escolhe 4 ou 8 vizinhos — teste contra a faixa original (`conn: 4` bateu mais pixel a pixel na
   *  fonte cursiva de `vsmode`; padrão 8). `below`: índice usado só quando o pixel novo tem um pixel do corpo
   *  em cima dele (achado medindo a faixa original de `vsmode`: o contorno PRETO fica quase só embaixo do
   *  corpo — sombra —, e o aro colorido no resto — luz —, como um bisel simples). Sem `below`, todo contorno
   *  novo usa `index`. Sem `bodyOnly`, `outline` não tem efeito visível (os recortes já trazem o próprio
   *  contorno da ROM, então não sobra pixel 0 junto do corpo pra virar contorno). Sem `index`, só o caso `below`
   *  desenha. A frase ganha `width` colunas livres à direita, para a sombra da última letra não ser cortada. */
  outline?: { index?: number; width?: number; conn?: 4 | 8; below?: number };
  /** Tons listados aqui saem em cinza: a linha de `tones[tom]` é lida da mesma origem e cada cor vira a luma dela
   *  (BT.601), para estados sem cor própria na ROM (item desabilitado). */
  grayscale?: readonly Tone[];
  /** Índices de contorno que, na montagem da frase, não cobrem um pixel já desenhado por outra letra (o miolo da
   *  vizinha vence o contorno desta onde as letras se encostam, como na arte original). */
  under?: readonly number[];
}
/** '.' = 0; padrão: hex. Com `base`, o glifo é o glifo `base` já recortado da ROM (montado em tempo de execução) com os
 *  pixels não-'.' deste desenho por cima (acentos sobre letras da ROM, sem guardar os pixels dela). */
export interface ExtraGlyph { ch: string; rows: readonly string[]; legend?: Readonly<Record<string, number>>; base?: string }
export interface IndexedImage { w: number; h: number; px: Uint8Array }

export const TEXT_STYLES: readonly TextStyleId[] = ['titleMenu', 'menuTitle', 'menuItem', 'ascii8', 'banner', 'spriteBlue',
  'bigBattle', 'bigScore', 'bigVictory', 'bigDraw'];
