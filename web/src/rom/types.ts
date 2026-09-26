// Contratos do carregador da ROM (spec §2.3). Só tipos: nada aqui lê a ROM.
import type { RomView } from './view';

/** Tiles já decodificados: `count·64` índices de cor (0 = transparente), 8×8 por tile, linha a linha. */
export interface Tiles { bpp: 2 | 4; count: number; px: Uint8Array }

/** Peça de metasprite [ANI §2.2]. `tile` = índice de gráfico (bits 0–8 do atributo). */
export interface Piece { dx: number; dy: number; tile: number; hflip: boolean; vflip: boolean; big: boolean; palAdd: number }
/** Quadro de animação [ANI §2.1]. `dur` 255 = congela; `mx`/`my` = deslocamento (só visual). */
export interface AnimFrame { dur: number; mx: number; my: number; pieces: Piece[] }
export type Anim = AnimFrame[];

/** Comando do script de animação de tiles `rec+$12` [ARN §3.1]. `vram` = palavra de VRAM; `src` = endereço 24 bits no buffer `$7F:8000`. */
export type TileAnimCmd =
  | { kind: 'wait'; frames: number }
  | { kind: 'dma'; vram: number; src: number }
  | { kind: 'loop' }
  | { kind: 'end' };

/** Animação de paleta [ARN §3.2]: a partir de `first` na CGRAM, troca pelo quadro `frames[k]` a cada `period` ticks. */
export interface PalAnim { first: number; frames: Uint16Array[]; period: number }

export interface ArenaAssets {
  stage: number;                  // 1..10
  record: number;                 // endereço do registro de $22 bytes
  bgTiles: Tiles;                 // 1024 tiles depois de composite (+arena9) + tiles 46/47/62/63 de $C5:FE5C
  bgCgram: Uint16Array;           // 128 cores depois da correção $C4:4E2F
  bg1: Uint16Array; bg2Base: Uint16Array; floor: Uint16Array;   // 32×32 palavras vhopppcc cccccccc
  logicBase: Uint16Array;         // 32×32 códigos lógicos do mapa da ROM (soft em todas as casas "1")
  removeN: number;                // rec+$1E: soft blocks removidos na carga
  tileAnim: TileAnimCmd[] | null; palAnim: PalAnim[]; colorMath: 'none' | 'half' | 'add';
  hudMap: Uint16Array;            // 32×3 (mapa $D6:8EEC, tabela $D6:8F72, +$2200)
  bg3Font: Tiles; bg3Banners: Tiles;  // $D1:BC16, $D0:F57B (2bpp crus, 64 tiles cada)
  objCommon: Tiles;               // OBJ $6000–$7FFF (512 tiles) montado conforme CAT §3; vagas dos jogadores zeradas
  objCgram: Uint16Array;          // 128 cores OBJ; só a paleta 7 (112..127) = $D7:E6DC, o resto 0
}

export interface CharacterAssets {
  char: number;
  frame(g: number): Uint8Array;         // 32×32 índices; addr = p24($C2:0730+3c) + (g&3)·$80 + (g>>2)·$800, linhas a cada $200
  palettes: Uint16Array[];              // 5 × 16 cores, p24($C2:779D + 32c + 4slot)
  victoryFrame(g: number): Uint8Array;  // folha p24($C2:8EBF+3c), mesmo layout
  hudHead(slot: number): Tiles;         // 6 tiles 8×8 (2 × 3) do rosto do HUD, entrada (6+c)·5+slot de $C4:617F
}

export type SceneId = 'title' | 'vsmode' | 'ffa' | 'players' | 'rules' | 'charsel' | 'stagesel' | 'scoreboard' | 'victory' | 'draw1' | 'draw2';
export const SCENE_IDS: readonly SceneId[] = ['title', 'vsmode', 'ffa', 'players', 'rules', 'charsel', 'stagesel', 'scoreboard', 'victory', 'draw1', 'draw2'];

export interface SceneAssets {
  id: SceneId;
  vram: Uint8Array;               // 64 KB montados pelos segmentos do CAT, na ordem; o resto = 0
  written: Uint8Array;            // 64 KB: 1 onde algum segmento escreveu
  cgram: Uint16Array;             // 256 cores (16 linhas do CAT)
  bgTiles: Tiles;                 // VRAM bytes $0000–$7FFF, 4bpp (1024 tiles)
  bg3Tiles: Tiles;                // VRAM bytes $A000–$BFFF, 2bpp (512 tiles)
  objTiles: Tiles;                // VRAM bytes $C000–$FFFF, 4bpp (512 tiles)
}

/** Fatias da ROM que o áudio (plano 11) manda para o AudioWorklet [AUD §1.1]. Intervalos meio-abertos. */
export interface AudioRomSlices {
  cpu: { base: number; bytes: Uint8Array };   // [$C0:0190, $C0:07EA)
  data: { base: number; bytes: Uint8Array };  // [$D9:0000, $DE:9C94)
}

export interface RomAssets {
  rom: RomView;
  arena(stage: number): ArenaAssets;
  character(c: number): CharacterAssets;
  anim(addr: number): Anim;
  playerAnim(tab1: number, char: number, dirIdx: number): Anim;   // p24(p24(tab1+3c)+3·dirIdx) [ANI §2.6]
  bombScript(type: number): { word: number; dur: number }[];
  scene(id: SceneId): SceneAssets;
  mode7Draw(): { chr: Uint8Array; map: Uint8Array };
  audioData(): AudioRomSlices;
}
