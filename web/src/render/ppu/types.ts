// Contratos da PPU de software (spec §2.4). Subconjunto do SNES: modo 1 (BG3 com prioridade alta) + modo 7 mínimo.
import type { Tiles } from '../../rom/types';

/** Camada de BG. `map` linear, linha a linha, `mapW` entradas por linha (altura = map.length / mapW);
 *  entradas `vhopppcc cccccccc`. `hofs`/`vofs` = valores dos registradores: a linha y da imagem mostra
 *  a linha `y + vofs + 1` do BG (o SNES começa a exibir na linha 1) e a coluna x mostra `x + hofs`. */
export interface BgLayer { map: Uint16Array; mapW: 32 | 64; tiles: Tiles; tile16: boolean; hofs: number; vofs: number }

/** Faixa de linhas [y0, y1) com registradores próprios (HDMA). Máscaras: BG1=1 BG2=2 BG3=4 OBJ=16 (fundo=32 só em mathLayers).
 *  `bg1Tile16` vale para o BG1 nesta faixa (o `tile16` do BgLayer vale para BG2/BG3). `bg1`/`bg2` = [hofs, vofs] da faixa.
 *  `mathLayers` (extensão do plano 5; padrão 1 = só BG1): camadas da tela principal que recebem o color math. */
export interface ScanBand {
  y0: number; y1: number;
  bg1Tile16: boolean; bg1?: [number, number]; bg2?: [number, number];
  main: number; sub: number; math: 'none' | 'half' | 'add'; mathLayers?: number;
}

/** Sprite. `x`, `y` = canto superior esquerdo na imagem (y = valor da OAM). `pal` 0..7 → CGRAM 128+16·pal.
 *  `src.tile` = número do tile em `objTiles` (32×32 usa as linhas n, n+16, n+32, n+48); `src.px` = size² índices prontos. */
export interface ObjEntry {
  x: number; y: number; size: 16 | 32; pal: number; prio: 0 | 1 | 2 | 3;
  hflip: boolean; vflip: boolean; src: { tile: number } | { px: Uint8Array };
}

/** Modo 7 mínimo: plano de 1024×1024 (mapa 128×128 de bytes, `chr` = 256 tiles 8×8 de 1 byte por pixel = índice da CGRAM).
 *  Matriz em 8.8 com centro (cx, cy): u = ((a·(x+hofs−cx) + b·(y+vofs−cy)) >> 8) + cx, v = ((c·(x+hofs−cx) + d·(y+vofs−cy)) >> 8) + cy.
 *  Fora do plano: 'wrap' repete; 'transparent' não desenha. Aqui y é a linha da imagem (sem o +1). */
export interface Mode7Layer {
  chr: Uint8Array; map: Uint8Array;
  a: number; b: number; c: number; d: number; cx: number; cy: number; hofs: number; vofs: number;
  outside: 'wrap' | 'transparent';
}

/** Quadro completo. `oam`: índice menor fica na frente (entre sprites). Com `mode7`, o BG1 é o plano do modo 7
 *  (ordem OBJ3 > OBJ2 > OBJ1 > BG1 > OBJ0) e BG2/BG3 são ignorados. Linhas fora das faixas = fundo. */
export interface PpuFrame {
  cgram: Uint16Array /* 256 cores BGR555 */; bg1?: BgLayer; bg2?: BgLayer; bg3?: BgLayer;
  bands: ScanBand[]; objTiles?: Tiles; oam: ObjEntry[]; mode7?: Mode7Layer; backdrop?: number /* BGR555; padrão cgram[0] */;
}
