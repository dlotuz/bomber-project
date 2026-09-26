import type { SceneId, RomAssets } from '../../app/rom-api';
import type { SceneMaps } from './scene';
import { descriptorMap, rawMap, keepPalette, setPriority } from './map-decode';

/** Origem dos mapas de BG na ROM (A14), achada pela T19. Cena ausente = geometria do nosso código.
 *
 *  Como a ROM monta as telas: `$C1:BF88` lê um descritor (ver `readDescriptor`) e decodifica o BG1 em `$7E:5000`
 *  e o BG2 em `$7E:2000` com `$C4:08D3` (formato [ARN §2.3]). Depois disso, nos menus e na seleção de personagem, a
 *  rotina da tradução troca o BG1 inteiro por um mapa cru de 2048 B, já com o texto em inglês. Texto (paletas ≠ 5,
 *  a da corda) vira casa vazia, porque o texto é nosso.
 *
 *  Conteúdo dinâmico **não** está aqui: retratos da seleção de personagem, prévias das fases (`$C1:A209`, blocos 7×7)
 *  e coroas do placar e da vitória. A tela desenha tudo isso por cima. */

const TITLE = 0xc1c00e;       // $C1:950C → $70
const MENU = 0xc1c044;        // VS/FFA/jogadores/regras (script $C1:C1B2)
const CHARSEL = 0xc1c0d4;     // script $C1:C1E2
const STAGESEL = 0xc1c0ef;    // $C1:A29A → $70
const SCOREBOARD = 0xc29c17;  // $C2:903F → $70 (placar e VICTORY!; $C2:9C26 quando $01A4 = $C0:0B40)
const ROPE_PAL = 5;

/** BG1 cru da tradução (copiado para `$7E:5000` pelas rotinas citadas). */
const PATCH_BG1 = {
  vsmode: 0xe11327,   // $E1:0018
  ffa: 0xe142b5,      // $E1:3326
  players: 0xe0e91c,  // $E0:D58D
  rules: 0xe06880,    // $E0:41F1
  charsel: 0xe1c159,  // $E1:B64A
} as const;

const menu = (scene: keyof typeof PATCH_BG1, desc: number) => (a: RomAssets): SceneMaps => ({
  bg1: keepPalette(rawMap(a.rom, PATCH_BG1[scene]), ROPE_PAL),
  bg2: descriptorMap(a.rom, desc, 'bg2'),
});
const fromDescriptor = (desc: number) => (a: RomAssets): SceneMaps => ({
  bg1: descriptorMap(a.rom, desc, 'bg1'),
  bg2: descriptorMap(a.rom, desc, 'bg2'),
});

export const MAP_SOURCES: Partial<Record<SceneId, (a: RomAssets) => SceneMaps>> = {
  // Logo no BG1; `$C1:951A` e `$C1:952E` ligam a prioridade nas linhas 0–15 (duas metades de 16 colunas).
  title: a => ({ bg1: setPriority(descriptorMap(a.rom, TITLE, 'bg1'), 0, 0, 32, 16), bg2: descriptorMap(a.rom, TITLE, 'bg2') }),
  vsmode: menu('vsmode', MENU),
  ffa: menu('ffa', MENU),
  players: menu('players', MENU),
  rules: menu('rules', MENU),
  charsel: menu('charsel', CHARSEL),
  stagesel: fromDescriptor(STAGESEL),
  scoreboard: fromDescriptor(SCOREBOARD),
  victory: fromDescriptor(SCOREBOARD),
};
