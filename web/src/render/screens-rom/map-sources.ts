import type { SceneId, RomAssets } from '../../app/rom-api';
import type { SceneMaps } from './scene';
import { decodeSceneMap, descriptorMap, rawMap, keepPalette, setPriority } from './map-decode';

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
// DRAW GAME (T19 §"draw2 fica fora do MAP_SOURCES"): layout de VRAM diferente (BG12NBA=$44, BG2SC=$5C, TM=$12 → BG1
// desligado). `$C2:D7F0` decodifica o BG2 de $D6:489D (fluxo) / $D6:4A16 (tabela) para $7E:2000 → VRAM $5C00
// (conferido: 480/480 palavras iguais à captura). T14 (EMPATE) usa esta entrada; ela não tem `bg1`.
const DRAW2_BG2 = [0xd6489d, 0xd64a16] as const;

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

// --- charsel (Task 10, revisão): oposto de `keepPalette` — zera só a paleta do texto em inglês, mantém o resto. ---
const TEXT_PAL = 1;   // medido: `rawMap(a.rom, PATCH_BG1.charsel)` só tem palavras de paleta 0 (vazio), 1 (texto
                       // em inglês, 10 casas: colunas 6–10 das linhas 2–3) e 5 (corda, 33 casas) — nada mais.
/** Oposto de `keepPalette` (map-decode.ts): zera só as casas da paleta `pal`, mantém o resto como está. Para
 *  `charsel` isso é mais correto que "só ficar com a paleta da corda" (`menu()`/`keepPalette`, usado pelas
 *  outras 4 cenas de menu): tira exatamente o texto, sem presumir que "corda" é a única paleta válida. */
const blankPalette = (m: Uint16Array, pal: number): Uint16Array => m.map(w => (((w >> 10) & 7) === pal ? 0 : w));
/**
 * `charsel` tem um ícone decorativo visível à esquerda da corda na captura (`charsel.vram`/`.png`, dump-capture:
 * colunas 1–2, linhas 2–11, paletas 0/2/3/4/7) que `keepPalette(…, 5)` descartaria por engano se estivesse
 * nesta tabela — só que, conferido diretamente (`rawMap(a.rom, PATCH_BG1.charsel)`, histograma de paletas),
 * **não está**: a tabela crua de 1024 palavras só tem as 43 células citadas acima (texto + corda), o resto é
 * zero, inclusive nas colunas do ícone. O BG1 original (pré-tradução, `descriptorMap(a.rom, CHARSEL, 'bg1')`)
 * também não tem o ícone ali (preenchimento genérico `$0400` nas mesmas colunas). Ou esse ícone vem de uma
 * rotina separada ainda não mapeada (fora do escopo desta tarefa), ou é sobra de VRAM de outra cena na captura
 * (a sequência de paletas por linha — 2, 2, 3, 3, 4, 4, 0, 0, 7, 7 — não bate com nada documentado nem com um
 * efeito óbvio, tipo arco-íris). Por isso ele continua fora do `sceneMaps`/`MAP_SOURCES.charsel`: com ele
 * ignorado no teste (`CHARSEL_ICON_PX`), a comparação com a captura bate 100 %; sem ignorar, cai a 87,5 %
 * (medido) — abaixo dos 97 % pedidos. `blankPalette` troca o filtro por um mais correto (tira só o texto), mas
 * não muda o resultado numérico desta tabela específica (que só tem {0, 1, 5}); preservei mesmo assim, porque
 * é a semântica certa e não discartaria o ícone se um dia aparecer aí de verdade.
 */
const charselBg1 = (a: RomAssets): Uint16Array => blankPalette(rawMap(a.rom, PATCH_BG1.charsel), TEXT_PAL);

export const MAP_SOURCES: Partial<Record<SceneId, (a: RomAssets) => SceneMaps>> = {
  // Logo no BG1; `$C1:951A` e `$C1:952E` ligam a prioridade nas linhas 0–15 (duas metades de 16 colunas).
  title: a => ({ bg1: setPriority(descriptorMap(a.rom, TITLE, 'bg1'), 0, 0, 32, 16), bg2: descriptorMap(a.rom, TITLE, 'bg2') }),
  vsmode: menu('vsmode', MENU),
  ffa: menu('ffa', MENU),
  players: menu('players', MENU),
  rules: menu('rules', MENU),
  charsel: a => ({ bg1: charselBg1(a), bg2: descriptorMap(a.rom, CHARSEL, 'bg2') }),
  stagesel: fromDescriptor(STAGESEL),
  scoreboard: fromDescriptor(SCOREBOARD),
  victory: fromDescriptor(SCOREBOARD),
  // Sem bg1 (BG1 desligado nessa cena — spec T19); os tiles do BG2 também não estão no lugar padrão (T14 monta um
  // `SceneGfx` próprio com `bgTiles` de $8000, onde o BG12NBA=$44 desta cena realmente os coloca). O mapa fica cru
  // (= captura); as letras em inglês "DRAW GAME" (paletas 0–2, linhas 2–9) saem em `stageOnlyBg2` (draw.ts).
  draw2: a => ({ bg2: decodeSceneMap(a.rom, ...DRAW2_BG2) }),
};
