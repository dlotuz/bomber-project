# Crown Blast: Plano 10, Telas e usabilidade

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refazer todas as telas do Battle Mode com o fluxo, os tempos, os sons e o visual do Super Bomberman 4 (spec §6). Isso inclui fades, repetição ao segurar, título, menus, personagens, equipes, fase, intro da rodada, faixas RÁPIDO!!/TEMPO ESGOTADO!, pausa, fim de rodada, placar, EMPATE, placar final, VITÓRIA e Corrida Bônus. Os textos saem em PT-BR com os glifos da ROM e glifos próprios. Há ainda a tela de Opções (controles, remapeamento de teclado e gamepad, spawns aleatórios, volume e ROM) e a pausa por controle desconectado. Tudo funciona com a ROM, pela PPU de software, e sem ela, com a arte por código.

**Architecture:** O `App` ganha **transições** com tabela de brilho por frame, *cues* (áudio e mudanças de estado agendadas por frame), o overlay de brilho da §2.4 e um `AudioDirector` que envolve o `AudioSink`. Cada tela é um `Screen` com relógio próprio (`S` = frames desde o 1º frame do fade-in), e todos os números de tempo ficam em `game/timeline.ts`. A partida vira uma `MatchSession` compartilhada por batalha, placar, empate, vitória e corrida. Cada uma dessas é um `Screen` separado, e elas se ligam por transições. O desenho com ROM monta um `PpuFrame` por cena (VRAM/CGRAM do CAT §5 via `assets.scene`, mapas de BG por geometria medida ou pela origem na ROM quando a A14 fechar, OBJ por tabela de números) e depois sobrepõe o texto. O texto passa por `render/text/`: um estilo por fonte da ROM, glifos recortados de faixas da ROM (fatos `{char, faixa, x, largura}`) mais glifos próprios, e fallback para a fonte atual. O núcleo e o `rom/` são acessados por duas portas (`game/core-api.ts` e `app/rom-api.ts`), que a Task 1 alinha aos nomes reais dos planos 5 e 6.

**Tech Stack:** TypeScript, Vite, Vitest (Node, sem DOM nos testes), Canvas 2D, Gamepad API, `playwright-core` (screenshots).

**Spec:** `docs/superpowers/specs/2026-09-25-crown-blast-fidelidade-design.md`: §1.2 (item 3), §2.3 (painel `rom/ui.ts` e `romState`), §2.4 (PPU e brilho), §2.5 (`AudioSink`), §2.6 (entrada), §6 inteira, §7.5, §10, §11 (linha do plano 10 e aceite), §12 (A1, A2, A14, A15, A18). Fontes: [MNT] `analise/investigacao/montarias-e-telas/RELATORIO.md` (Parte B, tabela B.13 com 26 diferenças), [CAT] `analise/investigacao/graficos-formato/catalogo.md` §5 + `catalogo.json → cenas`, [GFX] `analise/investigacao/graficos-formato/RELATORIO.md`, [AUD] `analise/investigacao/audio/RELATORIO.md` §2.

---

## Ondas

| Onda | Tarefas (em paralelo dentro da onda) | Depende de |
|---|---|---|
| **1** | T1 Sincronização com os planos 5 e 6 (portas + divisão dos testes antigos) | merge dos planos 5 e 6 |
| **2** (fundação) | T2 Casca do app (transições, brilho, áudio) · T3 Entrada e configurações v2 · T4 Motor de texto e strings PT-BR · T5 Base das cenas da ROM e ferramentas de captura · T6 Contratos do fluxo da partida (timeline, `MatchSession`, config, telas-esqueleto) · T7 Kit de menus | onda 1 |
| **3** (telas) | T8 Título, VS e modo · T9 Jogadores e regras · T10 Personagens e equipes · T11 Seleção de fase e "BATALHA!" · T12 Partida (intro, faixas, pausa, desconexão, fim de rodada) · T13 Placar · T14 EMPATE · T15 Opções e remapeamento · T16 Glifos dos menus · T17 Glifos ASCII, faixas e sprite azul · T18 Glifos grandes · T19 Origem dos mapas de BG (A14) · T20 Placar final e VITÓRIA · T21 Corrida Bônus | onda 2 |
| **4** | T22 Integração: `main.ts`, boot, gesto de áudio, limpeza, fluxo completo, cobertura de glifos, screenshots | onda 3 |

Tarefas da mesma onda mexem em arquivos disjuntos. Cada tarefa lista o que **possui**. Quando duas tarefas da onda 3 precisam uma da outra, a função já existe como **esqueleto com a assinatura final**, criado na onda 2 (T6). A tarefa dona só troca o corpo.

---

## Global Constraints

- **Worktree:** `/Users/dlotuz/Projetos Claude/Bomber Project/.worktrees/fidelity` (branch `feat/fidelity`). Cada tarefa roda numa worktree própria derivada dela e é mesclada ao fim da onda.
- **Posse (spec §11):** este plano só edita `web/src/screens/**`, `web/src/app/**`, `web/src/input/**`, `web/src/game/**`, `web/src/render/text/**`, `web/src/render/screens-rom/**`, `web/src/render/draw-screens.ts`, `web/src/main.ts`, `web/tests/client/**`, `web/tests/screens/**`, `web/scripts/screens/**`, `web/scripts/snapshots.mjs` e fixtures novas `web/tests/fixtures/rom/{glyphs-*,screens-*}.json`. **Não** edita `src/core/**`, `src/rom/**`, `src/render/ppu/**`, `src/render/rom/**`, `src/render/art/**`, `src/render/{draw-game,view,sprite-bank}.ts`, `src/audio/**`.
- O núcleo e o `rom/` só são importados pelas portas `web/src/game/core-api.ts` e `web/src/app/rom-api.ts` (T1). A exceção são os tipos e funções de render do fallback (`render/draw-game.ts`, `render/view.ts`, `render/sprite-bank.ts`, `render/art/*`), importados direto. Se um nome dos planos 5 ou 6 mudar, só as portas mudam.
- **Nada da ROM no repositório:** nem tiles, nem paletas, nem mapas capturados, nem PNG. Entram no código só **números**: endereços, índices de tile e paleta, posições e retângulos, e hashes. Mapas de BG vêm da origem na ROM (T19) ou são **descritos por geometria** (retângulos e padrões com os números de tile). **É proibido transcrever um mapa capturado como tabela 32×32.**
- **Capturas do emulador** (VRAM/CGRAM/OAM/WRAM das cenas) ficam em `SB4_CAPTURES="/Users/dlotuz/Projetos Claude/Bomber Project/analise/extraido/graficos-formato/cenas"` (arquivos `<cena>.vram|.cgram|.oam|.ppu|.wram|.png`, cenas `title vsmode ffa players rules charsel stagesel scoreboard victory vict1 after_victory draw draw1 draw2 arena01..10`). Quadros de referência: `…/analise/extraido/montarias-e-telas/g_*.png`. Os testes que usam capturas pulam sem `SB4_CAPTURES`, e os que usam a ROM pulam sem `SB4_ROM`.
- ROM: `SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc"`.
- Ao fim de **cada** tarefa: `cd web && npx tsc --noEmit && npx vitest run` verdes na worktree da tarefa. Com a ROM e as capturas: `SB4_ROM=… SB4_CAPTURES=… npx vitest run tests/screens` verde.
- Testes rodam em Node, sem `document`. Lógica de tela, tempos, fontes e montagem de `PpuFrame` são funções puras testáveis. O que cria canvas só roda no navegador (screenshots da T22).
- Textos: todo texto desenhado sai de `render/text/strings.ts` (T4), que as tarefas da onda 3 **não editam**. Uma string que faltar é definida no módulo da própria tarefa e listada no teste de cobertura dela, e a T22 a move para `strings.ts`.
- SFX de menu: `$01` mover/alterar, `$02` confirmar, `$03` voltar/recusar, `$04` pausa. Música `$01` título, `$12` menus, `$13` "BATALHA!", `$14` partida, `$15` placar, `$16` vitória, `$18` empate. Banco `$30` nas telas e `$2F` na partida (spec §8.2).
- Commits em PT-BR no estilo `feat(telas): …`, `test(telas): …`, terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## Decisões sobre lacunas da spec (valem para todas as tarefas)

| # | Lacuna | Decisão |
|---|---|---|
| R1 | Quando a tela nova recebe entrada numa transição | A tela nova é criada no 1º frame do fade-in (S = 0) e recebe `update` **ocioso** durante o fade-in: anima, mas ignora botões. A entrada real chega no 1º frame depois do fade-in. Sem fade-in (`in: []`), a entrada real chega já no frame em que ela é criada. |
| R2 | Fade de brilho em números | `FADE_OUT_1` = 14,13,…,0 (15 f). `FADE_IN_1` = 1,…,15 (15 f). `FADE_OUT_2` = 14,14,13,13,…,1,1,0 (29 valores; preto no frame 28 = "28 f, 2 f por passo"). `FADE_IN_2` = 1,1,…,14,14,15 (29 valores). `FADE_OUT_12` = 14,13,11,10,9,8,6,5,4,3,1,0 (B do VS). A entrada de toda troca de menu começa no **f58** depois do botão: preto = 58 − duração da saída. |
| R3 | Música ao trocar de menu | A música nova toca no 1º frame da tela nova (cue no início do fade-in): `$12` ao entrar no VS vindo do título e `$01` ao voltar ao título. Em Opções continua a `$01`. |
| R4 | Fim de rodada com vencedor (áudio) | Pelos ganchos da [AUD §2] (SFX `$17` = `over` − 97): FADE em `over`+0, banco `$30` em +16 e `$15` em +57. Fade-out em `over`+0…14, preto de 48 f, coroa +1 (`finishRound`) no 1º frame do preto (+15) e fade-in do placar em +63. |
| R5 | EMPATE por TIME UP | Pela [AUD §2] (0:00 = `over` − 160) e pelo "pular a partir de f345" da [MNT §B.12]: FADE em `over`+1, banco `$30` em +58, `$18` em +68 e fade-in da tela EMPATE em `over`+166 (preto de **151 f**). A voz `$0E` sai no S = 100 da tela (= `over`+266 = 0:00 + 426 ✓). |
| R6 | EMPATE com todos mortos | Preto de 48 f (spec 🟡 A17), FADE em `over`+0, banco `$30` em +16 e `$18` em +26. |
| R7 | "4 f depois do fim do fade-in" | S ≥ **18** (o fade-in ocupa S = 0…14). O avanço automático do placar vem em S = 14 + 497 = **511**. |
| R8 | Próxima rodada (áudio) | Na saída do placar ou do EMPATE: fade-out de 15 f e preto de 288 f (placar) ou 385 f (EMPATE). O banco `$2F` toca no frame 31 da transição e a `$14` no frame 43, a mesma distância de 12 f da §6.7. A `$13` não se repete. Os 10 ticks pretos do intro do núcleo vêm depois do preto (288 + 10 = 298 da [MNT §B.10] ✓). |
| R9 | Última coroa: música e voz da vitória | `$16` no S = 511 do placar final (= `$17` + 671 da AUD) e voz `$0A` no S = 795 (= +955). A descida começa em S = 557 (f954 da MNT com o fade-in em f397). |
| R10 | Quadro final da coroa | A animação vem da ROM (`assets.anim(0xC3DA94)`) e para no último quadro dela. A spec diz tile `$106`, a MNT diz `$148`: vale o que a ROM tiver. O teste com ROM confere 32 quadros e 104 f. |
| R11 | Fase: título some e "BATALHA!" | O título sobe 2 px/f de f48 a f64. "BATALHA!" fica no lugar do título, centrado em x = 128, a não ser que `g_st2bt*.png` mostre outra posição (a T11 mede e anota). Visível em f65–207 quando `(f − 65)` é par, fixo de f208 a f277. |
| R12 | B na seleção de fase no modo Em Equipes | Volta para "Escolha as equipes!", a tela anterior no fluxo. |
| R13 | Quem escolhe pelas CPUs | O **primeiro humano com dispositivo** (o P1 no caso normal), depois de confirmar o próprio, escolhe em ordem de slot pelas CPUs e pelos humanos sem dispositivo. Sem nenhum humano com dispositivo, qualquer controle escolhe por todos. |
| R14 | Tela "Escolha as equipes!" (A1) | Mesma cena da seleção de personagem. Retrato de cada slot ativo em x = 16, y = 32 + 32·slot. Marcador do jogador em x = 64 (equipe 0) ou x = 176 (equipe 1) e "VS" centrado em (128, 96). ← vai para a equipe 0 e → para a 1. A confirma e B (qualquer controle) volta aos personagens. As outras vagas seguem R13. Se o último A deixar uma equipe vazia, toca `$03` e a vaga continua sem confirmar. |
| R15 | Nomes dos jogadores | Saem da interface (o original não tem). O campo `names` fica nas configurações, sem uso. |
| R16 | L, R e SELECT no teclado | P1: L = `KeyQ`, R = `KeyE`, SELECT = `KeyF`. P2: L = `Numpad7`, R = `Numpad9`, SELECT = `Numpad0`. O resto segue a §2.6. |
| R17 | Gesto de sair da pausa | Com SELECT segurado, o START não despausa. SELECT+START (qualquer controle, `inp.any`) ou Esc seguidos por **60 f** com a partida pausada levam à seleção de fase: FADE no áudio em +0, banco `$30` em +16, `$12` no início da tela nova e coroas zeradas. |
| R18 | Pausa no intro, no `won` e no `timeUp` | É permitida. O núcleo não roda, e as faixas e o brilho do intro também param. |
| R19 | Desconexão | Só a **transição** conectado → desconectado de um gamepad atribuído a um humano ativo pausa a partida. Um controle que já estava desligado no início não pausa. |
| R20 | Corrida Bônus (A2) | Pista de 4096 unidades. Cada B soma 24 à velocidade (teto 64), o atrito tira 1 por frame e a posição avança `velocidade/8` por frame. A corrida acaba ao chegar ou em 900 f. O prêmio é `rnd(17)` com o **RNG do jogo** que atravessa as partidas (§3.2) e fica na tela 180 f ou até A/B/START. Depois vem um fade de menu até a fase. |
| R21 | EMPATE: crescimento e cores | A escala do Modo 7 vai de 0 a 1 **linear** entre S = 34 e 148. Depois as letras alternam vermelho, amarelo e verde **a cada 8 f** (🟡). Não há troca para o BG2: o Modo 7 fica em escala 1. |
| R22 | Título | O menu e "APERTE START!" aparecem juntos. "APERTE START!" fica aceso quando `⌊S/64⌋` é par. Não há animação de montagem do logo (A14): o logo já montado entra com o fade-in de 15 f, e a entrada vale depois dele. As transições Título ↔ Opções usam as mesmas do Título ↔ VS. |
| R23 | Semente | A sessão começa em `$0012`, como o boot. `?seed=N` troca. O RNG continua de uma partida para a outra (`MatchCarry.seed`). |
| R24 | Estilos de fonte | Os "grandes" da spec viram 4 estilos: `bigBattle` (BATTLE START!), `bigScore` (SCORE BOARD), `bigVictory` (VICTORY!) e `bigDraw` (DRAW GAME, textura Modo 7). A tela de Opções usa `menuTitle` no título e `ascii8` (maiúsculas) no resto. |
| R25 | Volume | Não entra no `AudioSink` (contrato da §2.5). O `AudioDirector` repassa `setVolume(música, efeitos)` (0..1) ao sink só se ele implementar a interface opcional `VolumeControl`, que o plano 11 pode implementar. |
| R26 | Som dos eventos da partida | O plano 10 repassa os `GameEvent` de cada passo a `app.audio.playEvents(ev)`. O mapeamento evento → SFX/voz (§3.15) é do plano 11, que o registra com `setGameEventAudio(f)`, uma linha acrescentada ao `main.ts` no merge dele. |
| R27 | TEMPO ESGOTADO! × TEMPO! | Com ROM, usa "TEMPO ESGOTADO!" se a largura no estilo `banner` for ≤ 1,25 × a largura de "TIME UP!" na faixa original (`meta.timeUpWidth`, medida na T17). Caso contrário, "TEMPO!". Sem ROM, sempre "TEMPO ESGOTADO!". |
| R28 | Faixas | RÁPIDO!!: borda esquerda em `x = 256 − 2t` e topo em y = 120 (centro ≈ 128), visível para t ∈ [0, 192) ticks desde o `hurry`. TEMPO ESGOTADO!: topo em `y = round(−16 + 120·min(t,16)/16)`, de −16 até 104, e depois fica parado. As duas contam ticks do núcleo e congelam na pausa. |
| R29 | Miniaturas da fase | Se a T11 não conseguir reconstruir as prévias de `$C1:A901` para as 10 fases, a miniatura provisória é a arena da ROM (BG1+BG2 da 1ª imagem, sem sprites) reduzida por vizinho mais próximo para 112 px de largura. |
| R30 | Relógio ∞ no HUD (A18) | Nada a fazer aqui: com `sec = 1801` o HUD (planos 6 e 7) mostra 30:01 parado. A tela de regras mostra "∞", com glifo próprio. |
| R31 | Lista vertical com um só item ativo | ↑/↓ tocam `$01` e o cursor fica onde está (VS: só "Battle Royale" é selecionável). |
| R32 | Repetição na seleção de personagem | Repetição 20/5 por jogador, com o direcional do próprio controle. |

---

## Contratos compartilhados

Os blocos abaixo são a referência de nomes e tipos. As tarefas que criam cada arquivo copiam o código, e as outras importam dele.

```ts
// web/src/game/core-api.ts (T1): única porta do plano 10 para o núcleo (plano 6)
// Nomes do plano 6 (docs/superpowers/plans/2026-09-26-crown-blast-6-core-fiel.md): createMatch(rules, stage, seed, chars),
// setRacerPrize(m, slot, prize), finishRound(m, s) → {winners, matchOver, champions}, RACER_PRIZES = 17,
// drawRacerPrize(rng), INTRO_TICKS = 62 (o 62º passo já põe a fase em 'play').
export { BTN, startRound, step, finishRound, createAi, aiInputs, defaultRules, rnd, drawRacerPrize } from '../core';
export type { MatchState, RoundState, GameEvent, Rules, RoundResult, Rng16, AiState, Phase } from '../core';
export interface RacerPrize { slot: number; prize: number }          // prize = índice na tabela $C2:08F4 (0..16)
export interface MatchCarry { seed: number | null; racerPrize: RacerPrize | null }
export const RACER_PRIZE_COUNT: number;                                // 17
export function racerPrizeKey(i: number): RacerPrizeKey;               // chave estável → nome PT-BR (strings.ts)
export type RacerPrizeKey = 'bomb+1' | 'pierce' | 'fire+1' | 'fullFire' | 'speed+1' | 'remote+glove' | 'glove' | 'kick'
  | 'none' | 'passBomb' | 'passSoft' | 'speed-1' | 'punch' | 'heart' | 'p';
export function newMatch(rules: Rules, stage: number, seed: number, prize: RacerPrize | null, chars?: readonly number[]): MatchState;
export function finishRoundInfo(m: MatchState, s: RoundState): { winners: number[]; matchOver: boolean; champions: number[] };
export function phaseElapsed(r: RoundState): number;                   // ticks desde o início da fase atual
export function crownsOf(m: MatchState): readonly number[];
export function matchGoal(m: MatchState): number;                      // Coroas (1..5)
export function matchRngState(m: MatchState): number;                  // estado de 16 bits do RNG
export function isDraw(r: RoundResult): boolean;
export function drawReason(r: RoundResult): 'time' | 'dead' | null;
export function roundWinnerSlots(m: MatchState, r: RoundResult): number[];   // [] no empate; equipes: todos do time
export function isMatchOver(m: MatchState): boolean;
export function championSlots(m: MatchState): number[];
export function eventType(e: GameEvent): string;                       // 'hurry', 'time_up', …
```

```ts
// web/src/app/rom-api.ts (T1): única porta para rom/, render/ppu, render/rom/battle.ts e audio/sink.ts (plano 5)
export { romState, onRomChange, openRomDialog } from '../rom/state';
export type { RomAssets, SceneId, Tiles, Anim, AnimFrame, Piece } from '../rom/assets';
export { renderPpu } from '../render/ppu';
export type { PpuFrame, BgLayer, ObjEntry, ScanBand, Mode7Layer } from '../render/ppu';
export { drawRomBattle } from '../render/rom/battle';
export { NoopSink, type AudioSink } from '../audio/sink';
export function sceneVramCgram(a: RomAssets, id: SceneId): { vram: Uint8Array; cgram: Uint16Array };  // 64 KiB + 256 cores
export function tilesFrom(bytes: Uint8Array, off: number, count: number, bpp: 2 | 4): Tiles;
export function readColors(a: RomAssets, addr: number, count: number): Uint16Array;   // BGR555 crus da ROM
export function bgr555ToRgba(c: number): [number, number, number];                    // c8 = c<<3 | c>>2
export function zteBlock(a: RomAssets, addr: number): Uint8Array;                     // bloco ZTE descomprimido
export function forgetStoredRom(): Promise<void>;                                     // forgetRom() + romState.assets = null + avisa
```

```ts
// web/src/app/app.ts (T2)
export interface Screen {
  id: string;
  update(inp: MenuInput): void;
  draw(ctx: CanvasRenderingContext2D, bank: SpriteBank, frame: number): void;
  brightness?(): number;   // 0..15 (padrão 15), fora das transições
  frozen?(): boolean;      // congela o contador de animação
}
export interface Cue { at: number; run(app: App): void }   // `at` = frame da transição (0 = 1º frame da saída)
export interface TransitionSpec { out: readonly number[]; black: number; in: readonly number[]; cues?: readonly Cue[] }
export class App {
  frame: number; tick: number; screen: Screen; settings: Settings; readonly audio: AudioDirector;
  go(next: Screen): void; transition(next: () => Screen, spec: TransitionSpec): void; get inTransition(): boolean;
  brightness(): number; update(inp: MenuInput): void; draw(ctx, bank): void; save(): void; applyKeymaps(): void; applyInput(): void;
}
// web/src/app/fade.ts (T2)
export const FADE_OUT_1, FADE_IN_1, FADE_OUT_2, FADE_IN_2, FADE_OUT_12: readonly number[];
export const MENU_ENTRY_AT = 58;
export function fadeSpec(out, inn, cues?, entryAt?): TransitionSpec;
export const FADE_MENU, FADE_FROM_TITLE, FADE_TO_TITLE: TransitionSpec;
// web/src/app/audio.ts (T2)
export const SFX = { move: 0x01, confirm: 0x02, back: 0x03, pause: 0x04 };
export const MUSIC = { title: 0x01, menus: 0x12, battleStart: 0x13, battle: 0x14, score: 0x15, victory: 0x16, draw: 0x18 };
export const BANK = { battle: 0x2f, menus: 0x30 } as const;
export const VOICE = { battleStart: 0x07, victory: 0x0a, draw: 0x0e };
export interface VolumeControl { setVolume(music: number, sfx: number): void }
export class AudioDirector implements AudioSink { current: { bank: number | null; music: number | null }; setSink(s): void;
  setVolume(m, s): void; playEvents(ev: readonly GameEvent[]): void; ensureMenus(music: number): void; /* + AudioSink */ }
export function setGameEventAudio(f: (sink: AudioSink, ev: readonly GameEvent[]) => void): void;
```

```ts
// web/src/input/input.ts (T3), acréscimos
export interface KeyMap { up; down; left; right; a; b; x; y; l; r; start; select: string }
export interface PadMap { up; down; left; right; a; b; x; y; l; r; start; select: number }   // índices de botão
export const DEFAULT_PADMAP: PadMap;   // A=1 B=0 Y=2 X=3 L=4 R=5 SELECT=8 START=9 ↑12 ↓13 ←14 →15
export interface MenuInput { pads: number[]; pressed: number[]; any: number; pressedAny: number; key: string | null;
  connected: boolean[];                            // o dispositivo de cada jogador está conectado
  esc: boolean;                                    // Esc segurado
  padButton: { pad: number; button: number } | null }  // botão bruto recém-apertado (remapeamento)
// web/src/input/repeat.ts (T3)
export const DIRS: number;
export class Repeater { constructor(first = 20, every = 5, mask = DIRS); step(held: number): number; reset(): void }
// web/src/app/settings.ts (T3)
export interface Options { randomSpawns: boolean; musicVol: number; sfxVol: number }   // volumes 0..10
export interface Settings { version: 2; names: string[]; devices: DeviceId[]; keymaps: KeyMap[]; padmaps: PadMap[]; options: Options; setup: Setup }
```

```ts
// web/src/game/match-session.ts (T6)
export interface MatchSession { cfg: GameConfig; match: MatchState; round: RoundState | null; ai: AiState;
  roundNo: number; lastWinners: number[]; champions: number[]; over: boolean }
export const carry: MatchCarry;                          // RNG e prêmio entre partidas (estado do módulo)
export function resetCarry(): void;
export function createMatchSession(cfg: GameConfig): MatchSession;
export function beginRound(ms: MatchSession): RoundState;
export function endRound(ms: MatchSession): void;        // finishRound + vencedores/campeões (cue do início do preto)
export function closeMatch(ms: MatchSession): void;      // carry.seed ← RNG da partida
// web/src/game/config.ts (T6)
export interface GameConfig { rules: Rules; stage: number; chars: number[]; humans: boolean[]; devices: DeviceId[]; seed: number | null; names: string[] /* sem uso, sai na T22 */ }
// Esqueletos com assinatura final (T6), que as tarefas da onda 3 preenchem:
export function battleScreen(app: App, ms: MatchSession): Screen & { readonly ms: MatchSession };      // screens/battle.ts (T12)
export function scoreboardScreen(app: App, ms: MatchSession): Screen;                                 // screens/scoreboard.ts (T13)
export function drawScoreboard(ctx, bank, ms: MatchSession, s: number, yOffset: number): void;        // idem, usado pela descida (T20)
export function drawScreen(app: App, ms: MatchSession): Screen;                                       // screens/draw.ts (T14)
export function victoryScreen(app: App, ms: MatchSession, startS: number): Screen;                    // screens/victory.ts (T20)
export function racerScreen(app: App, ms: MatchSession): Screen;                                      // screens/racer.ts (T21)
export function teamsScreen(app: App): Screen;                                                        // screens/teams.ts (T10)
export function optionsScreen(app: App): Screen;                                                      // screens/options.ts (T15)
```

```ts
// web/src/render/text/types.ts (T4)
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
```

---

## Mapa de arquivos (dono entre parênteses)

```
web/src/game/core-api.ts                 (T1)  porta do núcleo
web/src/app/rom-api.ts                   (T1)  porta do rom/ppu/áudio
web/tests/screens/rom.ts                 (T1)  ASSETS (RomAssets com SB4_ROM) para os testes
web/tests/screens/core-helpers.ts        (T1)  forceWin/forceAllDead/forceClock/runUntil/setCrowns
web/tests/client/legacy/*.test.ts        (T1 cria; cada tarefa apaga o seu)
web/src/app/app.ts, fade.ts, audio.ts    (T2)
web/tests/screens/helpers.ts             (T2)  mkApp, RecordingSink, tap/press/hold/idle/settle/brightnessTrace
web/src/input/input.ts, repeat.ts        (T3)
web/src/app/settings.ts                  (T3)
web/src/render/text/**                   (T4; maps/<estilo>.ts e extra/<estilo>.ts preenchidos por T16–T18)
web/src/render/screens-rom/scene.ts      (T5)  cena → PpuFrame, geometria, moldura de menu, cursor
web/src/render/screens-rom/map-sources.ts(T5 esqueleto; T19 preenche)
web/tests/screens/captures.ts            (T5)  leitura das capturas do emulador
web/scripts/screens/{png,dump-capture}.ts (T5) ferramentas de pesquisa (não entram no build)
web/src/game/timeline.ts, match-session.ts, config.ts   (T6)
web/src/screens/{scoreboard,draw,victory,racer,teams,options}.ts  (T6 esqueleto; T13/T14/T20/T21/T10/T15 preenchem)
web/src/screens/menu.ts, ui.ts           (T7)
web/src/screens/title.ts, vs.ts + render/screens-rom/{title,vs}.ts          (T8)
web/src/screens/players.ts, rules.ts + render/screens-rom/{players,rules}.ts (T9)
web/src/screens/characters.ts, teams.ts + render/screens-rom/{charsel,teams}.ts (T10)
web/src/screens/stage.ts + render/screens-rom/stagesel.ts                   (T11)
web/src/screens/battle.ts + render/draw-screens.ts                          (T12)
web/src/screens/scoreboard.ts + render/screens-rom/scoreboard.ts            (T13)
web/src/screens/draw.ts + render/screens-rom/draw.ts                        (T14)
web/src/screens/options.ts, remap.ts + render/screens-rom/options.ts        (T15)
web/src/screens/victory.ts + render/screens-rom/victory.ts                  (T20)
web/src/screens/racer.ts + render/screens-rom/racer.ts                      (T21)
web/src/main.ts, web/scripts/snapshots.mjs                                  (T6: 1 linha; T22: reescreve)
```

---
## Onda 1

### Task 1: Sincronização com os planos 5 e 6 (portas e divisão dos testes antigos)

**Por quê:** os planos 5 e 6 foram escritos ao mesmo tempo que este. Esta tarefa, curta, confere os nomes e tipos reais, prende tudo em duas portas e deixa o resto do plano estável.

**Files:**
- Create: `web/src/game/core-api.ts`, `web/src/app/rom-api.ts`, `web/tests/screens/rom.ts`, `web/tests/screens/core-helpers.ts`, `web/tests/screens/compat.test.ts`
- Move (sem mudar o conteúdo dos `it`): `web/tests/client/screens.test.ts`, `menu.test.ts`, `session.test.ts` e o 2º `describe` de `settings.test.ts` → `web/tests/client/legacy/*` (tabela abaixo)
- Modify (só se não compilar depois dos planos 5 e 6): qualquer arquivo de `web/src/{screens,app,input,game}` e `web/src/render/draw-screens.ts`, com o mínimo para compilar

**Possui:** tudo acima. Nenhuma outra tarefa roda na onda 1.

**Interfaces:**
- Consumes: exports reais de `web/src/core/index.ts`, `web/src/core/tables/racer.ts`, `web/src/rom/{state,store,assets}.ts`, `web/src/rom/decode/{tiles,zte}.ts`, `web/src/render/ppu/*`, `web/src/render/rom/battle.ts`, `web/src/audio/sink.ts` e `web/tests/rom/helpers.ts`
- Produces: `game/core-api.ts` e `app/rom-api.ts` exatamente com as assinaturas da seção "Contratos compartilhados", mais `tests/screens/rom.ts` (`ASSETS`) e `tests/screens/core-helpers.ts`

**Divisão dos testes antigos** (cada arquivo `legacy` é apagado pela tarefa indicada, que o substitui por testes novos):

| Origem | Destino | Apagado por |
|---|---|---|
| `screens.test.ts` (helpers `mkApp`/`press`/`idle`) | `legacy/helpers.ts` | T22 |
| `screens.test.ts` › `título e modos` | `legacy/title-modes.test.ts` | T8 |
| `screens.test.ts` › `jogadores` | `legacy/players.test.ts` | T9 |
| `screens.test.ts` › `regras` | `legacy/rules.test.ts` | T9 |
| `screens.test.ts` › `personagens` | `legacy/characters.test.ts` | T10 |
| `screens.test.ts` › `fase e batalha` | `legacy/stage-battle.test.ts` | T11 **e** T12 (os dois apagam; o merge de duas deleções não conflita) |
| `screens.test.ts` › `configurações`, `remap não se dispara…` | `legacy/settings-screen.test.ts` | T15 |
| `menu.test.ts` › `MenuList` | `legacy/menulist.test.ts` | T22 |
| `menu.test.ts` › `App` | `legacy/app.test.ts` | T2 |
| `session.test.ts` › `parseConfig` | `legacy/parse-config.test.ts` | T6 |
| `session.test.ts` › `sessão` | `legacy/session.test.ts` | T12 |
| `settings.test.ts` › `da escolha dos menus para a partida` | `legacy/config.test.ts` | T6 |
| `tick.test.ts` | fica onde está | T12 |

- [ ] **Step 1: Ler as APIs reais.** Abrir `web/src/core/index.ts`, `web/src/core/types.ts`, `web/src/core/racer.ts`, `web/src/core/match.ts`, `web/src/rom/state.ts`, `web/src/rom/store.ts`, `web/src/rom/assets.ts`, `web/src/rom/decode/tiles.ts`, `web/src/rom/decode/zte.ts`, `web/src/render/ppu/` (índice e tipos), `web/src/render/rom/battle.ts`, `web/src/audio/sink.ts`, `web/tests/rom/helpers.ts`, e ler os planos `docs/superpowers/plans/2026-09-26-crown-blast-5-rom-loader.md` e `…-6-core-fiel.md` (seções de contratos). Anotar, **na mensagem do commit**, cada nome que diferir dos contratos deste plano.

- [ ] **Step 2: Escrever o teste de compatibilidade** `web/tests/screens/compat.test.ts`:

```ts
import * as core from '../../src/game/core-api';
import * as rom from '../../src/app/rom-api';
import { forceWin, forceAllDead, forceClock, runUntil, skipIntro, setCrowns, IDLE } from './core-helpers';

const rules5 = () => ({ ...core.defaultRules(), active: [true, true, true, true, true] });
const rules2 = () => ({ ...core.defaultRules(), active: [true, true, false, false, false] });

describe('porta do núcleo (plano 6)', () => {
  it('exporta tudo o que o plano 10 usa', () => {
    const names = ['BTN', 'startRound', 'step', 'finishRound', 'createAi', 'aiInputs', 'defaultRules', 'rnd', 'newMatch',
      'phaseElapsed', 'crownsOf', 'matchGoal', 'matchRngState', 'isDraw', 'drawReason', 'roundWinnerSlots', 'isMatchOver',
      'championSlots', 'eventType', 'racerPrizeKey', 'RACER_PRIZE_COUNT', 'finishRoundInfo', 'drawRacerPrize'] as const;
    for (const n of names) expect((core as Record<string, unknown>)[n], n).toBeDefined();
  });
  it('BTN tem os 12 botões da §2.6', () => {
    expect(core.BTN).toMatchObject({ UP: 1, DOWN: 2, LEFT: 4, RIGHT: 8, A: 16, B: 32, Y: 64, START: 128, X: 256, L: 512, R: 1024, SELECT: 2048 });
  });
  it('intro: 62 passos (10 + 52); o 62º já põe play (INTRO_TICKS do plano 6); phaseElapsed conta os passos', () => {
    const r = core.startRound(core.newMatch(rules2(), 1, 0x0012, null));
    expect(r.phase).toBe('intro');
    for (let i = 1; i <= 61; i++) {
      core.step(r, IDLE);
      expect(r.phase, `passo ${i}`).toBe('intro');
      expect(core.phaseElapsed(r)).toBe(i);
    }
    core.step(r, IDLE);
    expect(r.phase).toBe('play');
    expect(core.phaseElapsed(r)).toBe(0);
  });
  it('racerPrizeKey segue a tabela $C2:08F4 (decisão 18 do plano 6)', () => {
    expect(Array.from({ length: 17 }, (_, i) => core.racerPrizeKey(i))).toEqual(['bomb+1', 'pierce', 'fire+1', 'fullFire',
      'speed+1', 'remote+glove', 'glove', 'glove', 'kick', 'none', 'none', 'passBomb', 'passSoft', 'speed-1', 'punch', 'heart', 'p']);
  });
  it('finishRoundInfo devolve vencedores, fim de partida e campeões', () => {
    const m = core.newMatch(rules2(), 1, 0x0012, null);
    const r = core.startRound(m);
    runUntil(r, x => x.phase !== 'intro');
    forceWin(r, 0);
    runUntil(r, x => x.phase === 'over');
    expect(core.finishRoundInfo(m, r)).toEqual({ winners: [0], matchOver: false, champions: [] });
  });
  it('newMatch guarda a semente de 16 bits e a partida começa sem coroas', () => {
    const m = core.newMatch(rules5(), 1, 0xbeef, null);
    expect(core.matchRngState(m)).toBe(0xbeef);
    expect(core.crownsOf(m)).toEqual([0, 0, 0, 0, 0]);
    expect(core.matchGoal(m)).toBe(3);
  });
  it('17 prêmios do Racer, cada um com chave conhecida', () => {
    expect(core.RACER_PRIZE_COUNT).toBe(17);
    const keys = new Set(['bomb+1', 'pierce', 'fire+1', 'fullFire', 'speed+1', 'remote+glove', 'glove', 'kick', 'none',
      'passBomb', 'passSoft', 'speed-1', 'punch', 'heart', 'p']);
    for (let i = 0; i < 17; i++) expect(keys.has(core.racerPrizeKey(i)), `prêmio ${i}`).toBe(true);
  });
});

describe('ajudantes de teste do núcleo', () => {
  it('forceWin → over com vencedor; finishRound dá +1 coroa', () => {
    const m = core.newMatch(rules5(), 1, 0x0012, null);
    const r = core.startRound(m);
    skipIntro(r);
    forceWin(r, 2);
    runUntil(r, x => x.phase === 'over');
    expect(r.result && core.isDraw(r.result)).toBe(false);
    expect(core.roundWinnerSlots(m, r.result!)).toEqual([2]);
    core.finishRound(m, r);
    expect(core.crownsOf(m)[2]).toBe(1);
  });
  it('forceAllDead → EMPATE por mortes', () => {
    const r = core.startRound(core.newMatch(rules5(), 1, 0x0012, null));
    skipIntro(r);
    forceAllDead(r);
    runUntil(r, x => x.phase === 'over');
    expect(core.drawReason(r.result!)).toBe('dead');
  });
  it('forceClock(1) → time_up, 160 ticks de TIME UP e EMPATE por tempo', () => {
    const r = core.startRound(core.newMatch(rules5(), 1, 0x0012, null));
    skipIntro(r);
    forceClock(r, 1);
    const ev = core.step(r, IDLE);
    expect(ev.map(core.eventType)).toContain('time_up');
    const n = runUntil(r, x => x.phase === 'over');
    expect(n).toBeGreaterThanOrEqual(159);
    expect(n).toBeLessThanOrEqual(161);
    expect(core.drawReason(r.result!)).toBe('time');
  });
  it('forceClock(62) → hurry no passo seguinte', () => {
    const r = core.startRound(core.newMatch(rules5(), 1, 0x0012, null));
    skipIntro(r);
    forceClock(r, 62);
    expect(core.step(r, IDLE).map(core.eventType)).toContain('hurry');
  });
  it('setCrowns + vitória na meta → partida acabada, campeão', () => {
    const m = core.newMatch(rules2(), 1, 0x0012, null);
    setCrowns(m, 1, 2);
    const r = core.startRound(m);
    skipIntro(r);
    forceWin(r, 1);
    runUntil(r, x => x.phase === 'over');
    core.finishRound(m, r);
    expect(core.isMatchOver(m)).toBe(true);
    expect(core.championSlots(m)).toEqual([1]);
  });
});

describe('porta do rom/ppu/áudio (plano 5)', () => {
  it('exporta estado, PPU, desenho da partida e sink', () => {
    expect(rom.romState).toHaveProperty('assets');
    for (const f of [rom.onRomChange, rom.openRomDialog, rom.renderPpu, rom.drawRomBattle, rom.sceneVramCgram, rom.tilesFrom,
      rom.readColors, rom.bgr555ToRgba, rom.zteBlock, rom.forgetStoredRom]) expect(typeof f).toBe('function');
    const s = new rom.NoopSink();
    for (const m of ['bank', 'music', 'sfx', 'voice', 'stop', 'fade', 'tick'] as const) expect(typeof s[m]).toBe('function');
  });
  it('BGR555 → RGB com c8 = c<<3 | c>>2', () => {
    expect(rom.bgr555ToRgba(0x7fff)).toEqual([255, 255, 255]);
    expect(rom.bgr555ToRgba(0x001f)).toEqual([255, 0, 0]);
    expect(rom.bgr555ToRgba(0x0400)).toEqual([0, 0, 8]);
  });
  it('tilesFrom decodifica 2bpp planar', () => {
    const b = new Uint8Array(16); b[0] = 0x80; b[1] = 0x80;   // pixel (0,0) = cor 3
    const t = rom.tilesFrom(b, 0, 1, 2);
    expect(t.count).toBe(1);
    expect(t.px[0]).toBe(3);
    expect(t.px[1]).toBe(0);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar** (`cd web && npx vitest run tests/screens/compat.test.ts`). Esperado: FAIL, os módulos não existem.

- [ ] **Step 4: Criar `web/src/game/core-api.ts`.** Forma de referência (ajustar o lado direito de cada linha à API real do plano 6; a assinatura exportada **não muda**):

```ts
import * as core from '../core';
import type { MatchState, RoundState, RoundResult, GameEvent, Rules } from '../core';

export { BTN, startRound, step, finishRound, createAi, aiInputs, defaultRules, rnd, drawRacerPrize } from '../core';
export type { MatchState, RoundState, GameEvent, Rules, RoundResult, Rng16, AiState, Phase } from '../core';

export interface RacerPrize { slot: number; prize: number }
export interface MatchCarry { seed: number | null; racerPrize: RacerPrize | null }
export type RacerPrizeKey = 'bomb+1' | 'pierce' | 'fire+1' | 'fullFire' | 'speed+1' | 'remote+glove' | 'glove' | 'kick'
  | 'none' | 'passBomb' | 'passSoft' | 'speed-1' | 'punch' | 'heart' | 'p';

export const RACER_PRIZE_COUNT: number = core.RACER_PRIZES;   // 17 (número, no plano 6)
/** Tabela `$C2:08F4` por índice (decisão 18 do plano 6). */
const RACER_KEYS: readonly RacerPrizeKey[] = ['bomb+1', 'pierce', 'fire+1', 'fullFire', 'speed+1', 'remote+glove', 'glove',
  'glove', 'kick', 'none', 'none', 'passBomb', 'passSoft', 'speed-1', 'punch', 'heart', 'p'];
export function racerPrizeKey(i: number): RacerPrizeKey { return RACER_KEYS[i]; }

export function newMatch(rules: Rules, stage: number, seed: number, prize: RacerPrize | null,
  chars: readonly number[] = [0, 1, 2, 3, 4]): MatchState {
  const m = core.createMatch(rules, stage, seed, chars);
  if (prize) core.setRacerPrize(m, prize.slot, prize.prize);
  return m;
}
export const finishRoundInfo = (m: MatchState, s: RoundState): { winners: number[]; matchOver: boolean; champions: number[] } =>
  core.finishRound(m, s);
export const phaseElapsed = (r: RoundState): number => r.tick - r.phaseT0;
export const crownsOf = (m: MatchState): readonly number[] => m.crowns;
export const matchGoal = (m: MatchState): number => m.rules.matches;
export const matchRngState = (m: MatchState): number => m.rng.seed;
export const isDraw = (r: RoundResult): boolean => r.kind === 'draw';
export const drawReason = (r: RoundResult): 'time' | 'dead' | null =>
  (r.kind !== 'draw' ? null : r.reason === 'time' ? 'time' : 'dead');
const teamOf = (m: MatchState, slot: number): number[] =>
  m.rules.active.flatMap((on, i) => (on && m.rules.teams[i] === m.rules.teams[slot] ? [i] : []));
export function roundWinnerSlots(m: MatchState, r: RoundResult): number[] {
  if (r.kind !== 'win' || r.winner === null) return [];
  return m.rules.mode === 'team' ? teamOf(m, r.winner) : [r.winner];
}
export const isMatchOver = (m: MatchState): boolean => m.crowns.some(c => c >= m.rules.matches);
export function championSlots(m: MatchState): number[] {
  const first = m.crowns.findIndex(c => c >= m.rules.matches);
  if (first < 0) return [];
  return m.rules.mode === 'team' ? teamOf(m, first) : [first];
}
export const eventType = (e: GameEvent): string => e.type;
```

- [ ] **Step 5: Criar `web/src/app/rom-api.ts`** (mesma regra: a assinatura exportada é a dos contratos):

```ts
import { romState } from '../rom/state';
import { forgetRom } from '../rom/store';
import { decodeTiles } from '../rom/decode/tiles';
import { decodeZte } from '../rom/decode/zte';
import type { RomAssets, SceneId, Tiles } from '../rom/assets';

export { romState, onRomChange, openRomDialog } from '../rom/state';
export type { RomAssets, SceneId, Tiles, Anim, AnimFrame, Piece } from '../rom/assets';
export { renderPpu } from '../render/ppu';
export type { PpuFrame, BgLayer, ObjEntry, ScanBand, Mode7Layer } from '../render/ppu';
export { drawRomBattle } from '../render/rom/battle';
export { NoopSink, type AudioSink } from '../audio/sink';

export function sceneVramCgram(a: RomAssets, id: SceneId): { vram: Uint8Array; cgram: Uint16Array } {
  const s = a.scene(id);
  return { vram: s.vram, cgram: s.cgram };
}
export function tilesFrom(bytes: Uint8Array, off: number, count: number, bpp: 2 | 4): Tiles {
  return decodeTiles(bytes.subarray(off, off + count * 8 * bpp), bpp);
}
export function readColors(a: RomAssets, addr: number, count: number): Uint16Array {
  const out = new Uint16Array(count);
  for (let i = 0; i < count; i++) out[i] = a.rom.u16(addr + 2 * i);
  return out;
}
export function bgr555ToRgba(c: number): [number, number, number] {
  const f = (v: number) => (v << 3) | (v >> 2);
  return [f(c & 31), f((c >> 5) & 31), f((c >> 10) & 31)];
}
export function zteBlock(a: RomAssets, addr: number): Uint8Array { return decodeZte(a.rom, addr).data; }
export async function forgetStoredRom(): Promise<void> {
  await forgetRom();
  romState.setAssets(null);   // ajustar ao nome real que zera o estado e dispara onRomChange
}
```

- [ ] **Step 6: Criar os ajudantes de teste.** `web/tests/screens/rom.ts`:

```ts
import { ROM } from '../rom/helpers';
import { createRomAssets } from '../../src/rom/assets';   // ajustar ao construtor real do plano 5
import type { RomAssets } from '../../src/app/rom-api';

/** RomAssets da ROM de SB4_ROM, ou null (testes com ROM usam describe.skipIf(!ASSETS)). */
export const ASSETS: RomAssets | null = ROM ? createRomAssets(ROM) : null;
```

`web/tests/screens/core-helpers.ts`:

```ts
import { step, type MatchState, type RoundState } from '../../src/game/core-api';

export const IDLE: readonly number[] = [0, 0, 0, 0, 0];
/** Tira de jogo todos os presentes menos `winner` (a regra de fim da §3.12 decide 2 ticks depois). */
export function forceWin(r: RoundState, winner: number): void {
  r.players.forEach((p, i) => { if (p.present && i !== winner) p.state = 'out'; });
}
export function forceAllDead(r: RoundState): void { r.players.forEach(p => { if (p.present) p.state = 'out'; }); }
/** Põe o relógio em `sec` com `sub = 1`: o próximo tick de relógio passa para `sec − 1`. */
export function forceClock(r: RoundState, sec: number): void { r.clock.sec = sec; r.clock.sub = 1; }
export function runUntil(r: RoundState, pred: (r: RoundState) => boolean, max = 4000, pads: readonly number[] = IDLE): number {
  let n = 0;
  while (!pred(r) && n < max) { step(r, [...pads]); n++; }
  if (!pred(r)) throw new Error(`runUntil: condição não atingida em ${max} passos`);
  return n;
}
export const skipIntro = (r: RoundState): number => runUntil(r, x => x.phase !== 'intro');
export function setCrowns(m: MatchState, slot: number, n: number): void { (m.crowns as number[])[slot] = n; }
```

Se o plano 6 marca a saída de outro jeito (ex.: `alive = false`, `state = 'dead'`), ajuste **só** os ajudantes, até os testes do Step 2 passarem.

- [ ] **Step 7: Dividir os testes antigos** conforme a tabela. Cada arquivo `legacy/*.test.ts` importa os ajudantes de `./helpers` e mantém os `it` **idênticos**. `legacy/app.test.ts` e `legacy/menulist.test.ts` saem de `menu.test.ts`. `legacy/parse-config.test.ts` e `legacy/session.test.ts` saem de `session.test.ts` (copiar as constantes e ajudantes do topo nos dois). Depois apagar `tests/client/screens.test.ts`, `tests/client/menu.test.ts` e `tests/client/session.test.ts`.

- [ ] **Step 8: Compilar e rodar tudo.** `cd web && npx tsc --noEmit && npx vitest run`. Esperado: verde. O número de testes é o de antes, mais os novos de `compat.test.ts`. Se algum teste antigo quebrou por causa dos planos 5 e 6 (não por esta tarefa), o plano 6 deveria tê-lo adaptado: corrija o mínimo no código de telas (posse deste plano) e registre no commit.

- [ ] **Step 9: Commit**

```bash
cd web && git add -A src/game/core-api.ts src/app/rom-api.ts tests/screens tests/client
git commit -m "chore(telas): portas do núcleo e da ROM para o plano 10; testes antigos divididos em legacy/

Nomes reais que diferiram dos contratos do plano 10: <lista>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

#### Notas de sincronização (T1 executada sobre P5 + P6, base `53d5ed8`)

As assinaturas exportadas pelas duas portas são as de "Contratos compartilhados". As tarefas seguintes importam só das portas e não precisam destas notas, a não ser para saber o que existe **além** do contrato.

**Núcleo (`game/core-api.ts`):** todos os nomes do plano 6 conferem (`createMatch(rules, stage, seed: number | Rng16 = BOOT_SEED, chars)`, `setRacerPrize`, `finishRound → {winners, matchOver, champions}`, `RACER_PRIZES = 17`, `drawRacerPrize(rng)`, `INTRO_TICKS = 62` em `core/constants.ts`, `RoundResult.reason: 'last' | 'dead' | 'time'`). Diferenças:
- O Racer fica em `src/core/racer.ts` (não em `src/core/tables/racer.ts`). A tabela de chaves bate com `applyRacerPrize`: 6 e 7 = luva, 9 e 10 = nada.
- `MatchState` real também tem `over`, `roundNo`, `racerPrize`, `spawnSeed` e `chars`. O núcleo tem ainda `clearRacerPrize`. `isMatchOver`/`championSlots` da porta recalculam pelas coroas (o `m.over` do núcleo só muda em `finishRound`; com `setCrowns` + `finishRound` os dois dão o mesmo).
- `Player.state` é `'alive' | 'dying' | 'out' | 'bad'`: os ajudantes usam `'out'`, sem ajuste.

**ROM (`app/rom-api.ts`):**
- Os tipos `RomAssets`, `SceneId`, `Tiles`, `Anim`, `AnimFrame` e `Piece` vêm de `rom/types.ts`. `rom/assets.ts` só exporta `createRomAssets(bytes)` (o construtor que `tests/screens/rom.ts` usa) e `BOMB_SCRIPTS`.
- `forgetStoredRom` **já existe** em `rom/state.ts` (plano 5), e a porta o reexporta. Não há `romState.setAssets`. A versão real apaga do IndexedDB, põe `assets = null`, `status = 'vazio'` e chama `onRomChange`. Se o delete falhar, **não rejeita**: grava `erro` em PT-BR.
- `romState` é um objeto simples `{ assets, status: RomStatus, erro: string | null }` com `RomStatus = 'vazio' | 'verificando' | 'ok' | 'erro'`. `onRomChange(cb: (s: RomState) => void)` devolve a função que cancela a inscrição.
- Extras exportados pela porta, além do contrato: `useRomBytes(bytes, { persist? })` e os tipos `RomState` e `RomStatus`. `RomMotivo` (`rom/validate.ts`) ganhou `'falha'`, mas não passa pela porta porque o plano 10 não o usa.
- `decodeTiles(bytes, bpp, off = 0, count)` recebe `off` e `count` e trata bytes além do fim como 0, e `tilesFrom` o chama direto. `decodeZte(rom: Uint8Array, addr)` recebe os bytes crus, então `zteBlock` passa `a.rom.data`. `a.rom` é um `RomView`, com `u16` por endereço SNES.
- `drawRomBattle(ctx, round, vis: ViewState, assets, frame): boolean` ainda é o esboço do plano 5 (devolve `false`) até o plano 7. `AudioSink.bank` recebe `0x2f | 0x30` (tipo literal). `render/ppu` exporta também `createImage` (fora da porta).
- O `main.ts` ainda importa `startRomUi` direto de `rom/ui.ts`: essa é a "linha do painel da ROM do plano 5" que a T22 preserva.

**Testes antigos:** nenhum quebrou com P5 + P6, e não houve mudança em `src/screens`/`src/app`/`src/game`. Os 13 `describe` foram movidos literalmente (55 `it`). A única edição dentro de um `it` foi um `import('../../src/render/sprite-bank')` inline em `legacy/settings-screen.test.ts`, que virou `../../../`. Os `legacy/*` ainda importam `BTN`/`INTRO_TICKS` direto de `src/core`, porque saem com as tarefas que os apagam.

---

## Onda 2 (fundação)

### Task 2: Casca do app: transições, brilho, cues e AudioDirector

**Files:**
- Create: `web/src/app/fade.ts`, `web/src/app/audio.ts`, `web/tests/screens/helpers.ts`, `web/tests/screens/app-shell.test.ts`
- Replace: `web/src/app/app.ts`
- Delete: `web/tests/client/legacy/app.test.ts`

**Possui:** `src/app/app.ts`, `src/app/fade.ts`, `src/app/audio.ts`, `tests/screens/helpers.ts`, `tests/screens/app-shell.test.ts`, `tests/client/legacy/app.test.ts`.

**Interfaces:**
- Consumes: `MenuInput`, `idleInput` (`input/input.ts`, atual); `Settings` (`app/settings.ts`, atual, só `keymaps`); `AudioSink`, `NoopSink` (`app/rom-api.ts`); `GameEvent` (`game/core-api.ts`)
- Produces: `Screen`, `Cue`, `TransitionSpec`, `App`, `AppHooks`, as tabelas de fade, `AudioDirector`, `SFX`/`MUSIC`/`BANK`/`VOICE`, `VolumeControl`, `setGameEventAudio`, e os ajudantes de teste (usados por todas as tarefas seguintes)

- [ ] **Step 1: Criar os ajudantes de teste** `web/tests/screens/helpers.ts`:

```ts
import { App } from '../../src/app/app';
import { defaultSettings, type Settings } from '../../src/app/settings';
import { idleInput, type MenuInput } from '../../src/input/input';
import type { AudioSink } from '../../src/app/rom-api';

export type AudioOp = 'bank' | 'music' | 'sfx' | 'voice' | 'stop' | 'fade';
export interface AudioCall { t: number; op: AudioOp; id?: number }

/** Sink que grava cada chamada com o `app.tick` do momento. */
export class RecordingSink implements AudioSink {
  calls: AudioCall[] = [];
  ticks = 0;
  now: () => number = () => 0;
  private rec(op: AudioOp, id?: number): void { this.calls.push(id === undefined ? { t: this.now(), op } : { t: this.now(), op, id }); }
  bank(id: number): void { this.rec('bank', id); }
  music(id: number): void { this.rec('music', id); }
  sfx(id: number): void { this.rec('sfx', id); }
  voice(id: number): void { this.rec('voice', id); }
  stop(): void { this.rec('stop'); }
  fade(): void { this.rec('fade'); }
  tick(): void { this.ticks++; }
  of(op: AudioOp): AudioCall[] { return this.calls.filter(c => c.op === op); }
  /** Chamadas a partir do tick `t0` (inclusive), com `t` relativo a ele. */
  since(t0: number): AudioCall[] { return this.calls.filter(c => c.t >= t0).map(c => ({ ...c, t: c.t - t0 })); }
  clear(): void { this.calls = []; }
}

export function mkApp(settings: Settings = defaultSettings()) {
  const sink = new RecordingSink();
  let saves = 0;
  const app = new App(settings, { save: () => { saves++; }, setKeymaps: () => {}, seed: () => 1 }, sink);
  sink.now = () => app.tick;
  return { app, sink, saves: () => saves };
}

/** Entrada de 1 tick: `held` segurados e `edge` recém-apertados em qualquer dispositivo; com `slot`, também no do jogador. */
export function inputOf(held: number, edge: number, slot?: number, extra: Partial<MenuInput> = {}): MenuInput {
  const i = idleInput();
  i.any = held; i.pressedAny = edge;
  if (slot !== undefined) { i.pads[slot] = held; i.pressed[slot] = edge; }
  return { ...i, ...extra };
}
/** 1 tick com o botão recém-apertado (sem soltar). */
export const tap = (app: App, btn: number, slot?: number): void => app.update(inputOf(btn, btn, slot));
/** Aperta num tick e solta no seguinte (2 ticks). */
export const press = (app: App, btn: number, slot?: number): void => { tap(app, btn, slot); app.update(idleInput()); };
/** Segura por `n` ticks (borda só no 1º) e solta no tick seguinte (n + 1 ticks). */
export function hold(app: App, btn: number, n: number, slot?: number): void {
  for (let k = 0; k < n; k++) app.update(inputOf(btn, k === 0 ? btn : 0, slot));
  app.update(idleInput());
}
export const idle = (app: App, n: number): void => { for (let k = 0; k < n; k++) app.update(idleInput()); };
/** Roda ticks ociosos até a transição em curso acabar. Devolve quantos rodou. */
export function settle(app: App, max = 3000): number {
  let n = 0;
  while (app.inTransition && n < max) { app.update(idleInput()); n++; }
  if (app.inTransition) throw new Error('settle: transição não acabou');
  return n;
}
/** Brilho observado depois de cada um de `n` ticks ociosos. */
export function brightnessTrace(app: App, n: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < n; k++) { app.update(idleInput()); out.push(app.brightness()); }
  return out;
}
export const range = (a: number, b: number): number[] => {
  const s = a <= b ? 1 : -1; const r: number[] = [];
  for (let v = a; v !== b + s; v += s) r.push(v);
  return r;
};
/** Tela mínima para testes: conta updates e guarda a última entrada. */
export function probe(id: string, extra: Partial<{ brightness: () => number; frozen: () => boolean }> = {}) {
  const s = { id, updates: 0, last: null as MenuInput | null, update(i: MenuInput) { s.updates++; s.last = i; }, draw() {}, ...extra };
  return s;
}
```

- [ ] **Step 2: Escrever o teste** `web/tests/screens/app-shell.test.ts`:

```ts
import { App, type TransitionSpec } from '../../src/app/app';
import { FADE_OUT_1, FADE_IN_1, FADE_OUT_2, FADE_IN_2, FADE_OUT_12, FADE_MENU, FADE_FROM_TITLE, FADE_TO_TITLE, fadeSpec, MENU_ENTRY_AT } from '../../src/app/fade';
import { AudioDirector, setGameEventAudio, SFX, MUSIC, BANK } from '../../src/app/audio';
import { BTN } from '../../src/game/core-api';
import { mkApp, probe, brightnessTrace, range, RecordingSink, inputOf, idle } from './helpers';
import { defaultSettings } from '../../src/app/settings';
import { idleInput } from '../../src/input/input';

describe('tabelas de fade (spec §6, R2)', () => {
  it('menus: 15 f de saída (14→0) e 15 f de entrada (1→15)', () => {
    expect(FADE_OUT_1).toEqual(range(14, 0));
    expect(FADE_IN_1).toEqual(range(1, 15));
  });
  it('título: 2 f por passo; preto no frame 28', () => {
    expect(FADE_OUT_2).toHaveLength(29);
    expect(FADE_OUT_2.slice(0, 4)).toEqual([14, 14, 13, 13]);
    expect(FADE_OUT_2[27]).toBe(1);
    expect(FADE_OUT_2[28]).toBe(0);
    expect(FADE_IN_2.slice(0, 3)).toEqual([1, 1, 2]);
    expect(FADE_IN_2[28]).toBe(15);
  });
  it('B do VS: 12 f de saída', () => {
    expect(FADE_OUT_12).toHaveLength(12);
    expect(FADE_OUT_12[0]).toBe(14);
    expect(FADE_OUT_12[11]).toBe(0);
  });
  it('a entrada começa sempre no f58', () => {
    for (const s of [FADE_MENU, FADE_FROM_TITLE, FADE_TO_TITLE]) expect(s.out.length + s.black).toBe(MENU_ENTRY_AT);
    expect(FADE_MENU.black).toBe(43);
  });
});

describe('transição', () => {
  it('menu: brilho 14..0, preto até f57, 1..15 de f58 a f72; tela nova criada em f58, entrada real em f73', () => {
    const { app } = mkApp();
    const a = probe('a'); const b = probe('b');
    app.go(a);
    let created = -1;
    app.transition(() => { created = app.tick; return b; }, FADE_MENU);
    expect(app.brightness()).toBe(14);                       // f0 = o frame do botão
    const t0 = app.tick;
    const trace = brightnessTrace(app, 73);                   // f1..f73
    expect(trace.slice(0, 14)).toEqual(range(13, 0));        // f1..f14
    expect(trace.slice(14, 57).every(v => v === 0)).toBe(true); // f15..f57
    expect(trace.slice(57, 72)).toEqual(range(1, 15));       // f58..f72
    expect(trace[72]).toBe(15);                              // f73
    expect(created - t0).toBe(58);
    expect(a.updates).toBe(0);                               // a tela velha não recebe update durante a saída
    expect(b.updates).toBe(16);                              // 15 ociosos (fade-in) + 1 real (f73)
    expect(app.inTransition).toBe(false);
  });
  it('durante o fade-in a tela nova só recebe entrada ociosa', () => {
    const { app } = mkApp();
    const b = probe('b');
    app.go(probe('a'));
    app.transition(() => b, FADE_MENU);
    for (let k = 0; k < 60; k++) app.update(inputOf(BTN.A, BTN.A));
    expect(b.last!.pressedAny).toBe(0);
  });
  it('sem fade-in: a tela nova é criada e recebe a entrada real no mesmo frame', () => {
    const { app } = mkApp();
    const b = probe('b');
    app.go(probe('a'));
    const spec: TransitionSpec = { out: FADE_OUT_1, black: 353, in: [] };
    app.transition(() => b, spec);
    idle(app, 367);
    expect(app.screen.id).toBe('a');
    app.update(inputOf(BTN.A, BTN.A));                        // frame 368 = 15 + 353
    expect(app.screen.id).toBe('b');
    expect(b.updates).toBe(1);
    expect(b.last!.pressedAny).toBe(BTN.A);
    expect(app.brightness()).toBe(15);
  });
  it('só entrada (boot): tela criada na hora, brilho 1..15', () => {
    const { app } = mkApp();
    const b = probe('b');
    app.transition(() => b, { out: [], black: 0, in: FADE_IN_1 });
    expect(app.screen.id).toBe('b');
    expect(app.brightness()).toBe(1);
    expect(brightnessTrace(app, 15)).toEqual([...range(2, 15), 15]);
  });
  it('cues rodam no frame certo, contado do frame do botão', () => {
    const { app } = mkApp();
    app.go(probe('a'));
    const hits: [string, number][] = [];
    const t0 = app.tick;
    app.transition(() => probe('b'), fadeSpec(FADE_OUT_1, FADE_IN_1, [
      { at: 0, run: () => hits.push(['zero', app.tick - t0]) },
      { at: 15, run: () => hits.push(['preto', app.tick - t0]) },
      { at: 58, run: a => hits.push([a.screen.id, app.tick - t0]) },
    ]));
    idle(app, 80);
    expect(hits).toEqual([['zero', 0], ['preto', 15], ['a', 58]]);   // o cue roda antes de criar a tela nova
  });
  it('fora da transição o brilho vem da tela (padrão 15, limitado a 0..15)', () => {
    const { app } = mkApp();
    app.go(probe('a', { brightness: () => 7 }));
    expect(app.brightness()).toBe(7);
    app.go(probe('b', { brightness: () => 99 }));
    expect(app.brightness()).toBe(15);
    app.go(probe('c'));
    expect(app.brightness()).toBe(15);
  });
  it('go() cancela a transição em curso', () => {
    const { app } = mkApp();
    app.go(probe('a'));
    app.transition(() => probe('b'), FADE_MENU);
    app.go(probe('c'));
    expect(app.inTransition).toBe(false);
    idle(app, 100);
    expect(app.screen.id).toBe('c');
  });
});

describe('contadores e desenho', () => {
  it('tick conta todo update; frame para quando a tela congela', () => {
    const { app } = mkApp();
    let fz = false;
    app.go(probe('a', { frozen: () => fz }));
    idle(app, 3); fz = true; idle(app, 4);
    expect(app.tick).toBe(7);
    expect(app.frame).toBe(3);
  });
  it('overlay preto com alfa 1 − b/15, só quando b < 15', () => {
    const { app } = mkApp();
    const fills: string[] = [];
    const ctx = { fillStyle: '', fillRect() { fills.push(String(this.fillStyle)); } } as unknown as CanvasRenderingContext2D;
    app.go(probe('a', { brightness: () => 15 }));
    app.draw(ctx, {} as never);
    expect(fills).toEqual([]);
    app.go(probe('b', { brightness: () => 5 }));
    app.draw(ctx, {} as never);
    expect(fills).toHaveLength(1);
    expect(fills[0]).toBe(`rgba(0,0,0,${1 - 5 / 15})`);
  });
  it('audio.tick() uma vez por update', () => {
    const { app, sink } = mkApp();
    app.go(probe('a'));
    idle(app, 5);
    expect(sink.ticks).toBe(5);
  });
});

describe('AudioDirector', () => {
  it('bloco faz STOP (música atual some); lembra banco e música e repete no sink novo', () => {
    const d = new AudioDirector(new RecordingSink());
    d.bank(BANK.menus); d.music(MUSIC.title);
    expect(d.current).toEqual({ bank: 0x30, music: 0x01 });
    d.bank(BANK.battle);
    expect(d.current).toEqual({ bank: 0x2f, music: null });
    d.music(MUSIC.battle);
    const real = new RecordingSink();
    d.setSink(real);
    expect(real.calls.map(c => [c.op, c.id])).toEqual([['bank', 0x2f], ['music', 0x14]]);
  });
  it('stop e fade esquecem a música; sfx e voz passam direto', () => {
    const s = new RecordingSink();
    const d = new AudioDirector(s);
    d.music(0x15); d.fade();
    expect(d.current.music).toBeNull();
    d.music(0x18); d.stop();
    expect(d.current.music).toBeNull();
    d.sfx(SFX.confirm); d.voice(0x07);
    expect(s.calls.map(c => c.op)).toEqual(['music', 'fade', 'music', 'stop', 'sfx', 'voice']);
  });
  it('ensureMenus: sobe o banco $30 e a música só se ainda não estiverem', () => {
    const s = new RecordingSink();
    const d = new AudioDirector(s);
    d.ensureMenus(MUSIC.title);
    d.ensureMenus(MUSIC.title);
    expect(s.calls.map(c => [c.op, c.id])).toEqual([['bank', 0x30], ['music', 0x01]]);
    d.ensureMenus(MUSIC.menus);
    expect(s.calls.map(c => [c.op, c.id]).slice(2)).toEqual([['music', 0x12]]);
  });
  it('volume só chega a sinks que implementam VolumeControl, também depois de trocar o sink', () => {
    const d = new AudioDirector(new RecordingSink());
    d.setVolume(0.5, 0.25);
    const got: number[][] = [];
    const vc = Object.assign(new RecordingSink(), { setVolume: (m: number, s: number) => got.push([m, s]) });
    d.setSink(vc);
    expect(got).toEqual([[0.5, 0.25]]);
    d.setVolume(1, 0);
    expect(got).toEqual([[0.5, 0.25], [1, 0]]);
  });
  it('playEvents repassa ao mapeador registrado (plano 11)', () => {
    const s = new RecordingSink();
    const d = new AudioDirector(s);
    const seen: unknown[] = [];
    setGameEventAudio((sink, ev) => { seen.push(...ev); sink.sfx(0x07); });
    d.playEvents([{ type: 'explosion' } as never]);
    expect(seen).toHaveLength(1);
    expect(s.of('sfx')).toHaveLength(1);
    setGameEventAudio(() => {});
  });
});

describe('App com configurações', () => {
  it('applyInput usa o gancho applyInput quando existe, senão setKeymaps', () => {
    const maps: unknown[] = []; const whole: unknown[] = [];
    const a1 = new App(defaultSettings(), { save() {}, setKeymaps: m => maps.push(m), seed: () => 1 });
    a1.applyInput();
    expect(maps).toHaveLength(1);
    const a2 = new App(defaultSettings(), { save() {}, setKeymaps: m => maps.push(m), seed: () => 1, applyInput: s => whole.push(s) });
    a2.applyInput();
    expect(whole).toHaveLength(1);
    expect(maps).toHaveLength(1);
  });
  it('sem sink, usa o NoopSink', () => {
    const a = new App(defaultSettings(), { save() {}, setKeymaps() {}, seed: () => 1 });
    a.go(probe('x'));
    a.update(idleInput());
    expect(a.audio.current).toEqual({ bank: null, music: null });
  });
});
```

- [ ] **Step 3: Rodar e ver falhar** (`npx vitest run tests/screens/app-shell.test.ts`). Esperado: FAIL (módulos inexistentes).

- [ ] **Step 4: Criar `web/src/app/fade.ts`:**

```ts
import type { Cue, TransitionSpec } from './app';

const range = (a: number, b: number): number[] => {
  const s = a <= b ? 1 : -1; const r: number[] = [];
  for (let v = a; v !== b + s; v += s) r.push(v);
  return r;
};
const twice = (v: number[]): number[] => v.flatMap(x => [x, x]);

/** Saída padrão dos menus: brilho 14→0, 1 passo por frame (15 f). */
export const FADE_OUT_1: readonly number[] = range(14, 0);
export const FADE_IN_1: readonly number[] = range(1, 15);
/** Saída do título: 2 f por passo, preto no frame 28. */
export const FADE_OUT_2: readonly number[] = [...twice(range(14, 1)), 0];
export const FADE_IN_2: readonly number[] = [...twice(range(1, 14)), 15];
/** B na tela VS (volta ao título): 12 f. */
export const FADE_OUT_12: readonly number[] = [14, 13, 11, 10, 9, 8, 6, 5, 4, 3, 1, 0];
/** A entrada das trocas de menu começa 58 f depois do botão [MNT §B.0]. */
export const MENU_ENTRY_AT = 58;

export function fadeSpec(out: readonly number[], inn: readonly number[], cues: readonly Cue[] = [], entryAt = MENU_ENTRY_AT): TransitionSpec {
  return { out, black: Math.max(0, entryAt - out.length), in: inn, cues };
}
export const FADE_MENU: TransitionSpec = fadeSpec(FADE_OUT_1, FADE_IN_1);
export const FADE_FROM_TITLE: TransitionSpec = fadeSpec(FADE_OUT_2, FADE_IN_1);
export const FADE_TO_TITLE: TransitionSpec = fadeSpec(FADE_OUT_12, FADE_IN_2);
```

- [ ] **Step 5: Criar `web/src/app/audio.ts`:**

```ts
import { NoopSink, type AudioSink } from './rom-api';
import type { GameEvent } from '../game/core-api';

export const SFX = { move: 0x01, confirm: 0x02, back: 0x03, pause: 0x04 } as const;
export const MUSIC = { title: 0x01, menus: 0x12, battleStart: 0x13, battle: 0x14, score: 0x15, victory: 0x16, draw: 0x18 } as const;
export const BANK = { battle: 0x2f, menus: 0x30 } as const;
export const VOICE = { battleStart: 0x07, victory: 0x0a, draw: 0x0e } as const;

/** Interface opcional: o sink real (plano 11) pode aceitar volume (0..1). */
export interface VolumeControl { setVolume(music: number, sfx: number): void }
const hasVolume = (s: AudioSink): s is AudioSink & VolumeControl =>
  typeof (s as Partial<VolumeControl>).setVolume === 'function';

type EventAudio = (sink: AudioSink, ev: readonly GameEvent[]) => void;
let eventAudio: EventAudio = () => {};
/** O plano 11 registra aqui o mapeamento GameEvent → SFX/voz (§3.15). */
export function setGameEventAudio(f: EventAudio): void { eventAudio = f; }

/** Envolve o sink: lembra banco e música (para repetir quando o sink real chega depois do gesto), volume e eventos. */
export class AudioDirector implements AudioSink {
  current: { bank: number | null; music: number | null } = { bank: null, music: null };
  private vol: [number, number] | null = null;

  constructor(private sink: AudioSink = new NoopSink()) {}

  setSink(s: AudioSink): void {
    this.sink = s;
    if (this.vol && hasVolume(s)) s.setVolume(this.vol[0], this.vol[1]);
    if (this.current.bank !== null) s.bank(this.current.bank as 0x2f | 0x30);
    if (this.current.music !== null) s.music(this.current.music);
  }
  bank(id: 0x2f | 0x30): void { this.current = { bank: id, music: null }; this.sink.bank(id); }
  music(id: number): void { this.current.music = id; this.sink.music(id); }
  sfx(id: number): void { this.sink.sfx(id); }
  voice(id: number): void { this.sink.voice(id); }
  stop(): void { this.current.music = null; this.sink.stop(); }
  fade(): void { this.current.music = null; this.sink.fade(); }
  tick(): void { this.sink.tick(); }
  setVolume(music: number, sfx: number): void {
    this.vol = [music, sfx];
    if (hasVolume(this.sink)) this.sink.setVolume(music, sfx);
  }
  playEvents(ev: readonly GameEvent[]): void { if (ev.length) eventAudio(this, ev); }
  /** Garante o banco das telas ($30) e a música pedida, sem reiniciar o que já toca. */
  ensureMenus(music: number): void {
    if (this.current.bank !== BANK.menus) this.bank(BANK.menus);
    if (this.current.music !== music) this.music(music);
  }
}
```

Se a assinatura de `bank` no `AudioSink` real for `bank(id: number)`, use a mesma.

- [ ] **Step 6: Substituir `web/src/app/app.ts`:**

```ts
import { idleInput, type KeyMap, type MenuInput } from '../input/input';
import type { SpriteBank } from '../render/sprite-bank';
import type { Settings } from './settings';
import type { AudioSink } from './rom-api';
import { AudioDirector } from './audio';

export interface Screen {
  id: string;
  update(inp: MenuInput): void;
  draw(ctx: CanvasRenderingContext2D, bank: SpriteBank, frame: number): void;
  /** Brilho 0..15 fora das transições (padrão 15). A partida usa para o intro. */
  brightness?(): number;
  frozen?(): boolean;
}

/** Ação agendada numa transição; `at` conta do 1º frame da saída (0). */
export interface Cue { at: number; run(app: App): void }
/** Saída (brilho por frame, a tela velha parada), preto, entrada (a tela nova criada no 1º frame dela). */
export interface TransitionSpec { out: readonly number[]; black: number; in: readonly number[]; cues?: readonly Cue[] }

export interface AppHooks {
  save(s: Settings): void;
  setKeymaps(maps: readonly KeyMap[]): void;
  seed(): number;
  /** Aplica toda a configuração de entrada (teclas, botões de gamepad). Se ausente, usa setKeymaps. */
  applyInput?(s: Settings): void;
}

interface Running { spec: TransitionSpec; next: () => Screen; k: number; created: boolean }
const NONE: Screen = { id: 'none', update() {}, draw() {} };
const clampB = (b: number): number => Math.max(0, Math.min(15, Math.round(b)));

export class App {
  /** Contador de animação (para quando a tela congela). */
  frame = 0;
  /** Updates desde o boot, inclusive transições. */
  tick = 0;
  screen: Screen = NONE;
  readonly audio: AudioDirector;
  private run: Running | null = null;

  constructor(public settings: Settings, private hooks: AppHooks, sink?: AudioSink) {
    this.audio = new AudioDirector(sink);
  }

  go(next: Screen): void { this.run = null; this.screen = next; }

  transition(next: () => Screen, spec: TransitionSpec): void {
    this.run = { spec, next, k: 0, created: false };
    this.cues(0);
    this.createIfDue();
  }

  get inTransition(): boolean { return this.run !== null; }

  brightness(): number {
    const r = this.run;
    if (!r) return clampB(this.screen.brightness?.() ?? 15);
    const { out, black } = r.spec;
    if (r.k < out.length) return out[r.k];
    if (r.k < out.length + black) return 0;
    return r.spec.in[r.k - out.length - black] ?? 15;
  }

  save(): void { this.hooks.save(this.settings); }
  applyKeymaps(): void { this.hooks.setKeymaps(this.settings.keymaps); }
  applyInput(): void {
    if (this.hooks.applyInput) this.hooks.applyInput(this.settings);
    else this.hooks.setKeymaps(this.settings.keymaps);
  }
  seed(): number { return this.hooks.seed(); }

  update(inp: MenuInput): void {
    this.tick++;
    this.audio.tick();
    const r = this.run;
    if (r) {
      r.k++;
      this.cues(r.k);
      this.createIfDue();
      const inStart = r.spec.out.length + r.spec.black;
      if (r.k < inStart + r.spec.in.length) {
        if (r.k >= inStart) { this.screen.update(idleInput()); this.frame++; }
        return;
      }
      this.run = null;   // acabou: este update já é da tela nova, com a entrada real
    }
    this.screen.update(inp);
    if (!this.screen.frozen?.()) this.frame++;
  }

  draw(ctx: CanvasRenderingContext2D, bank: SpriteBank): void {
    this.screen.draw(ctx, bank, this.frame);
    const b = this.brightness();
    if (b < 15) {
      ctx.fillStyle = `rgba(0,0,0,${1 - b / 15})`;
      ctx.fillRect(0, 0, 256, 224);
    }
  }

  private cues(k: number): void {
    const r = this.run;
    if (!r) return;
    for (const c of r.spec.cues ?? []) if (c.at === k) c.run(this);
  }

  private createIfDue(): void {
    const r = this.run;
    if (!r || r.created) return;
    if (r.k >= r.spec.out.length + r.spec.black) { this.screen = r.next(); r.created = true; }
  }
}
```

- [ ] **Step 7: Apagar `tests/client/legacy/app.test.ts`**, que foi substituído. Rodar `npx vitest run tests/screens/app-shell.test.ts` (PASS) e depois `npx tsc --noEmit && npx vitest run` (tudo verde: as telas antigas continuam usando `go()`).

- [ ] **Step 8: Commit**

```bash
git add -A web/src/app/app.ts web/src/app/fade.ts web/src/app/audio.ts web/tests/screens/helpers.ts web/tests/screens/app-shell.test.ts web/tests/client/legacy/app.test.ts
git commit -m "feat(telas): transições com brilho e cues, overlay da §2.4 e AudioDirector

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Entrada (12 botões, gamepad remapeável, conexão, Esc) e configurações v2

**Files:**
- Replace: `web/src/input/input.ts`, `web/tests/client/input-loop.test.ts`, `web/tests/client/settings.test.ts`
- Create: `web/src/input/repeat.ts`, `web/tests/screens/repeat.test.ts`
- Modify: `web/src/app/settings.ts` (v2), `web/src/screens/rules.ts` (remover **só** a linha `toggle('SPAWN ALEATÓRIO', 'randomSpawns')`, que passou para Opções)

**Possui:** `src/input/**`, `src/app/settings.ts`, `tests/client/input-loop.test.ts`, `tests/client/settings.test.ts`, `tests/screens/repeat.test.ts` e a linha de `screens/rules.ts` acima (nenhuma outra tarefa da onda 2 toca `rules.ts`).

**Interfaces:**
- Consumes: `BTN` (`game/core-api.ts`); `defaultRules` (`game/core-api.ts`)
- Produces: os contratos de entrada e configurações (seção "Contratos"). `buildInput(cur, prev, assign, key?, extra?)` continua compatível com o `main.ts` atual. Os campos novos de `MenuInput` têm padrão em `idleInput()` e `buildInput`.

- [ ] **Step 1: Escrever `web/tests/screens/repeat.test.ts`:**

```ts
import { Repeater, DIRS } from '../../src/input/repeat';
import { BTN } from '../../src/game/core-api';

const pulses = (r: Repeater, held: number, n: number): number[] => {
  const at: number[] = [];
  for (let f = 0; f < n; f++) if (r.step(held) & held) at.push(f);
  return at;
};

describe('repetição ao segurar (spec §6)', () => {
  it('menus: 1º passo no frame 0, repete aos 20 f e depois a cada 5 f', () => {
    expect(pulses(new Repeater(), BTN.DOWN, 41)).toEqual([0, 20, 25, 30, 35, 40]);
  });
  it('fase: 36 f e depois a cada 21 f', () => {
    expect(pulses(new Repeater(36, 21), BTN.RIGHT, 80)).toEqual([0, 36, 57, 78]);
  });
  it('botões fora da máscara só dão a borda', () => {
    expect(pulses(new Repeater(), BTN.A, 60)).toEqual([0]);
    expect(DIRS).toBe(BTN.UP | BTN.DOWN | BTN.LEFT | BTN.RIGHT);
  });
  it('soltar zera a contagem daquele botão', () => {
    const r = new Repeater();
    for (let f = 0; f < 19; f++) r.step(BTN.UP);
    r.step(0);
    expect(r.step(BTN.UP)).toBe(BTN.UP);
    expect(r.step(BTN.UP)).toBe(0);
  });
  it('cada bit conta separado', () => {
    const r = new Repeater();
    for (let f = 0; f < 10; f++) r.step(BTN.UP);
    expect(r.step(BTN.UP | BTN.LEFT)).toBe(BTN.LEFT);
  });
  it('reset esquece tudo', () => {
    const r = new Repeater();
    r.step(BTN.UP); r.reset();
    expect(r.step(BTN.UP)).toBe(BTN.UP);
  });
});
```

- [ ] **Step 2: Substituir `web/tests/client/input-loop.test.ts`:**

```ts
import {
  readKeyMap, readGamepad, readDevices, buildInput, emptyDevices, keyLabel, InputManager, DEFAULT_KEYMAPS, DEFAULT_PADMAP,
  withEscapeAsBack, idleInput, padLabel, type GamepadLike, type KeyTarget,
} from '../../src/input/input';
import { stepsFor, STEP_MS, MAX_STEPS } from '../../src/app/loop';
import { BTN } from '../../src/game/core-api';

const pad = (pressed: number[], axes: number[] = [0, 0], connected = true): GamepadLike => ({
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })), axes, connected,
});

describe('teclado (spec §2.6, R16)', () => {
  it('P1: WASD + J(A) K(B) L(Y) I(X) Enter(START) Q(L) E(R) F(SELECT)', () => {
    const m = DEFAULT_KEYMAPS[0];
    expect([m.up, m.down, m.left, m.right, m.a, m.b, m.y, m.x, m.start, m.l, m.r, m.select])
      .toEqual(['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyJ', 'KeyK', 'KeyL', 'KeyI', 'Enter', 'KeyQ', 'KeyE', 'KeyF']);
  });
  it('P2: setas + Numpad1(A) 2(B) 3(Y) 5(X) Enter(START) 7(L) 9(R) 0(SELECT)', () => {
    const m = DEFAULT_KEYMAPS[1];
    expect([m.up, m.down, m.left, m.right, m.a, m.b, m.y, m.x, m.start, m.l, m.r, m.select])
      .toEqual(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad5', 'NumpadEnter', 'Numpad7', 'Numpad9', 'Numpad0']);
  });
  it('lê os 12 botões', () => {
    const down = new Set(['KeyW', 'KeyJ', 'KeyI', 'KeyQ', 'KeyE', 'KeyF']);
    expect(readKeyMap(down, DEFAULT_KEYMAPS[0])).toBe(BTN.UP | BTN.A | BTN.X | BTN.L | BTN.R | BTN.SELECT);
  });
  it('nome legível das teclas', () => {
    expect(['KeyW', 'Digit7', 'Numpad2', 'ArrowUp', 'Space', 'Semicolon'].map(keyLabel))
      .toEqual(['W', '7', 'NUM 2', 'SETA CIMA', 'ESPAÇO', 'SEMICOLON']);
  });
});

describe('gamepad (standard, remapeável)', () => {
  it('padrão: A=1 B=0 Y=2 X=3 L=4 R=5 SELECT=8 START=9, direcional 12–15', () => {
    expect(DEFAULT_PADMAP).toEqual({ a: 1, b: 0, y: 2, x: 3, l: 4, r: 5, select: 8, start: 9, up: 12, down: 13, left: 14, right: 15 });
    expect(readGamepad(pad([1, 12]))).toBe(BTN.A | BTN.UP);
    expect(readGamepad(pad([0, 2, 3, 9]))).toBe(BTN.B | BTN.Y | BTN.X | BTN.START);
    expect(readGamepad(pad([4, 5, 8]))).toBe(BTN.L | BTN.R | BTN.SELECT);
  });
  it('mapa trocado: A no botão 0 e B no 1', () => {
    expect(readGamepad(pad([0]), { ...DEFAULT_PADMAP, a: 0, b: 1 })).toBe(BTN.A);
  });
  it('analógico com zona morta 0,5 continua valendo como direcional', () => {
    expect(readGamepad(pad([], [0.9, 0]))).toBe(BTN.RIGHT);
    expect(readGamepad(pad([], [0.3, 0.3]))).toBe(0);
  });
  it('rótulo de botão', () => { expect(padLabel(9)).toBe('BOTÃO 9'); });
});

describe('dispositivos, conexão e atribuição', () => {
  it('buildInput: por jogador, qualquer dispositivo, conexão por jogador, Esc e botão bruto', () => {
    const cur = { ...emptyDevices(), kb0: BTN.A, gp1: BTN.START };
    const inp = buildInput(cur, emptyDevices(), ['kb0', 'gp1', 'gp0', 'none', 'kb1'], 'KeyJ',
      { connected: { gp0: false, gp1: true }, esc: true, padButton: { pad: 1, button: 9 } });
    expect(inp.pads).toEqual([BTN.A, BTN.START, 0, 0, 0]);
    expect(inp.connected).toEqual([true, true, false, false, true]);   // teclados sempre; 'none' nunca
    expect(inp.esc).toBe(true);
    expect(inp.padButton).toEqual({ pad: 1, button: 9 });
  });
  it('sem extra: todos os gamepads contam como conectados (compatível com o main.ts atual)', () => {
    const inp = buildInput(emptyDevices(), emptyDevices(), ['gp0', 'gp1', 'gp2', 'gp3', 'none']);
    expect(inp.connected).toEqual([true, true, true, true, false]);
    expect(inp.esc).toBe(false);
    expect(inp.padButton).toBeNull();
  });
  it('idleInput tem os campos novos', () => {
    expect(idleInput()).toMatchObject({ connected: [true, true, true, true, true], esc: false, padButton: null });
  });
  it('readDevices usa os mapas de gamepad', () => {
    const d = readDevices(new Set(), DEFAULT_KEYMAPS, [pad([0])], [{ ...DEFAULT_PADMAP, a: 0 }]);
    expect(d.gp0).toBe(BTN.A);
  });
});

describe('withEscapeAsBack', () => {
  it('Escape vira B em qualquer dispositivo', () => {
    const i = { ...idleInput(), key: 'Escape' };
    expect(withEscapeAsBack(i).pressedAny & BTN.B).toBe(BTN.B);
  });
});

function fakeTarget() {
  const fns = new Map<string, EventListener>();
  const t: KeyTarget & { fire(type: string, code: string, repeat?: boolean): void } = {
    addEventListener: (ty, fn) => { fns.set(ty, fn); },
    removeEventListener: ty => { fns.delete(ty); },
    fire: (ty, code, repeat = false) => fns.get(ty)?.({ code, repeat, preventDefault() {} } as unknown as Event),
  };
  return t;
}

describe('InputManager', () => {
  it('poll lê teclas e gamepads com os mapas; connected() e escHeld()', () => {
    const gps: (GamepadLike | null)[] = [pad([1]), null, pad([], [0, 0], false)];
    const t = fakeTarget();
    const im = new InputManager(t, DEFAULT_KEYMAPS, () => gps);
    t.fire('keydown', 'KeyJ'); t.fire('keydown', 'Escape');
    expect(im.poll().kb0).toBe(BTN.A);
    expect(im.poll().gp0).toBe(BTN.A);
    expect(im.connected()).toMatchObject({ kb0: true, kb1: true, gp0: true, gp1: false, gp2: false, none: false });
    expect(im.escHeld()).toBe(true);
    t.fire('keyup', 'Escape');
    expect(im.escHeld()).toBe(false);
  });
  it('takePadButton: primeiro botão bruto recém-apertado desde a última leitura', () => {
    let gps: (GamepadLike | null)[] = [pad([]), pad([])];
    const im = new InputManager(fakeTarget(), DEFAULT_KEYMAPS, () => gps);
    im.poll();
    gps = [pad([]), pad([7])];
    im.poll();
    expect(im.takePadButton()).toEqual({ pad: 1, button: 7 });
    expect(im.takePadButton()).toBeNull();
    im.poll();                                  // continua segurado: não é novo
    expect(im.takePadButton()).toBeNull();
  });
  it('setPadmaps troca o mapa usado no poll', () => {
    const im = new InputManager(fakeTarget(), DEFAULT_KEYMAPS, () => [pad([0])]);
    im.setPadmaps([{ ...DEFAULT_PADMAP, a: 0, b: 1 }]);
    expect(im.poll().gp0).toBe(BTN.A);
  });
});

describe('loop de passo fixo', () => {
  it('passos por frame e teto', () => {
    expect(stepsFor(0, STEP_MS).steps).toBe(1);
    expect(stepsFor(0, 1000).steps).toBe(MAX_STEPS);
  });
});
```

- [ ] **Step 3: Substituir `web/tests/client/settings.test.ts`:**

```ts
import {
  defaultSettings, loadSettings, saveSettings, normalizeSettings, STORAGE_KEY, type StorageLike,
} from '../../src/app/settings';
import { DEFAULT_KEYMAPS, DEFAULT_PADMAP } from '../../src/input/input';

const mem = (): StorageLike & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); } };
};

describe('configurações v2', () => {
  it('padrão: versão 2, P1 Teclado 1, P2 Teclado 2, P3–P5 Controles 1–3, 4 mapas de gamepad, opções', () => {
    const s = defaultSettings();
    expect(s.version).toBe(2);
    expect(s.devices).toEqual(['kb0', 'kb1', 'gp0', 'gp1', 'gp2']);
    expect(s.padmaps).toHaveLength(4);
    expect(s.padmaps[3]).toEqual(DEFAULT_PADMAP);
    expect(s.options).toEqual({ randomSpawns: false, musicVol: 8, sfxVol: 8 });
    expect(s.setup.rules).not.toHaveProperty('randomSpawns');
  });
  it('salva e carrega de volta', () => {
    const st = mem();
    const s = defaultSettings();
    s.options.musicVol = 3; s.padmaps[1].a = 7; s.keymaps[0].select = 'KeyZ';
    saveSettings(st, s);
    const back = loadSettings(st);
    expect(back.options.musicVol).toBe(3);
    expect(back.padmaps[1].a).toBe(7);
    expect(back.keymaps[0].select).toBe('KeyZ');
  });
  it('migra a v1: teclas novas com o padrão, randomSpawns vai para Opções e vale Não (original)', () => {
    const v1 = { version: 1, devices: ['gp0', 'kb0', 'kb1', 'none', 'gp1'], keymaps: [{ up: 'KeyT', down: 'KeyG', left: 'KeyF', right: 'KeyH', a: 'KeyZ', b: 'KeyX', y: 'KeyC', start: 'Space' }],
      setup: { mode: 'team', rules: { matches: 5, randomSpawns: true } } };
    const st = mem();
    st.setItem(STORAGE_KEY, JSON.stringify(v1));
    const s = loadSettings(st);
    expect(s.version).toBe(2);
    expect(s.devices).toEqual(['gp0', 'kb0', 'kb1', 'none', 'gp1']);
    expect(s.keymaps[0]).toMatchObject({ up: 'KeyT', a: 'KeyZ', x: 'KeyI', l: 'KeyQ', r: 'KeyE', select: 'KeyF' });
    expect(s.keymaps[1]).toEqual(DEFAULT_KEYMAPS[1]);
    expect(s.setup.mode).toBe('team');
    expect(s.setup.rules.matches).toBe(5);
    expect(s.options.randomSpawns).toBe(false);
  });
  it('valores inválidos caem no padrão', () => {
    const s = normalizeSettings({ padmaps: [{ a: -1, b: 99, x: 'q' }], options: { musicVol: 11, sfxVol: 2.5, randomSpawns: 'sim' } });
    expect(s.padmaps[0]).toEqual(DEFAULT_PADMAP);
    expect(s.options).toEqual({ randomSpawns: false, musicVol: 8, sfxVol: 8 });
  });
  it('JSON corrompido → padrão; falha ao gravar não derruba', () => {
    const st = mem();
    st.setItem(STORAGE_KEY, '{nope');
    expect(loadSettings(st)).toEqual(defaultSettings());
    const bad: StorageLike = { getItem: () => null, setItem: () => { throw new Error('cota'); } };
    expect(() => saveSettings(bad, defaultSettings())).not.toThrow();
  });
});
```

- [ ] **Step 4: Rodar e ver falhar** (`npx vitest run tests/screens/repeat.test.ts tests/client/input-loop.test.ts tests/client/settings.test.ts`).

- [ ] **Step 5: Criar `web/src/input/repeat.ts`:**

```ts
import { BTN } from '../game/core-api';

export const DIRS: number = BTN.UP | BTN.DOWN | BTN.LEFT | BTN.RIGHT;

/** Repetição ao segurar [MNT §B.0]: pulso no 1º frame, depois em `first` e a cada `every`. Fora de `mask`, só a borda. */
export class Repeater {
  private held = new Map<number, number>();
  constructor(readonly first = 20, readonly every = 5, readonly mask: number = DIRS) {}

  step(held: number): number {
    let out = 0;
    for (let bit = 1; bit <= 0x800; bit <<= 1) {
      if (!(held & bit)) { this.held.delete(bit); continue; }
      const f = this.held.get(bit) ?? 0;
      this.held.set(bit, f + 1);
      const rep = (this.mask & bit) !== 0;
      if (f === 0 || (rep && f >= this.first && (f - this.first) % this.every === 0)) out |= bit;
    }
    return out;
  }

  reset(): void { this.held.clear(); }
}
```

- [ ] **Step 6: Reescrever `web/src/input/input.ts`.** Parta do arquivo atual e mude o seguinte (o resto fica igual):
  1. `import { BTN } from '../game/core-api';`
  2. `KeyMap` ganha `x, l, r, select`. `KEY_FIELDS = ['up','down','left','right','a','b','x','y','l','r','start','select']`. `DEFAULT_KEYMAPS` conforme R16 e o teste.
  3. `readKeyMap` lê os 12 campos (`x → BTN.X`, `l → BTN.L`, `r → BTN.R`, `select → BTN.SELECT`).
  4. `PadMap`, `PAD_FIELDS` (mesmos 12 nomes) e `DEFAULT_PADMAP` (teste). `readGamepad(gp, map = DEFAULT_PADMAP)` troca os índices fixos por `map.<campo>`. O analógico (eixos 0/1, zona morta 0,5) continua somando no direcional.
  5. `GamepadLike` ganha `connected?: boolean`. `readDevices(down, maps, gps, padmaps = [])` passa `padmaps[i] ?? DEFAULT_PADMAP`.
  6. `MenuInput` ganha `connected: boolean[]`, `esc: boolean` e `padButton: {pad:number;button:number}|null`. `idleInput()` preenche `[true×5]`, `false` e `null`.
  7. `buildInput(cur, prev, assign, key = null, extra: { connected?: Partial<Record<DeviceId, boolean>>; esc?: boolean; padButton?: {pad:number;button:number}|null } = {})`: `connected[i] = assign[i] === 'none' ? false : assign[i].startsWith('kb') ? true : (extra.connected?.[assign[i]] ?? true)`.
  8. `padLabel(i) => \`BOTÃO ${i}\``.
  9. `InputManager`: guarda `padmaps: PadMap[]` (`setPadmaps(maps)`) e passa para `readDevices`. O `poll()` também guarda o estado bruto dos botões de cada gamepad e registra em `lastPad` o **primeiro** `{pad, button}` que passou de solto para apertado (varre pads 0..3 e botões 0..31 em ordem). `takePadButton()` devolve e limpa. `connected()` devolve `kb0/kb1: true`, `gpN: !!gp && gp.connected !== false` e `none: false`. `escHeld()` devolve `down.has('Escape')`.

- [ ] **Step 7: Atualizar `web/src/app/settings.ts` para a v2.**
  - `RuleChoices` perde `randomSpawns`. Novo `Options { randomSpawns; musicVol; sfxVol }` com `defaultOptions() = { randomSpawns: false, musicVol: 8, sfxVol: 8 }`.
  - `Settings { version: 2; names; devices; keymaps; padmaps: PadMap[] /* 4 */; options: Options; setup }`.
  - `defaultSetup().rules` não lê mais `randomSpawns` de `defaultRules()`.
  - `normalizeKeyMap` percorre `KEY_FIELDS`, que agora tem 12 campos: campos ausentes (v1) ficam com o padrão daquele teclado. Novo `normalizePadMap(v)`: cada campo inteiro em 0..31, senão o padrão.
  - `normalizeSettings` monta `padmaps` (4), `options` (`randomSpawns` só aceita boolean; volumes inteiros 0..10) e `version: 2`. `migrate(raw)`: se `version` for 1 ou ausente, apaga `setup.rules.randomSpawns` e devolve `raw`.
  - O resto (`sanitizeName`, `NAME_*`, `loadSettings`, `saveSettings`, `browserStorage`) fica igual.

- [ ] **Step 8: Tirar a linha `toggle('SPAWN ALEATÓRIO', 'randomSpawns')` de `web/src/screens/rules.ts`** (o tipo `toggle` passa a aceitar só `'suddenDeath' | 'badBomber' | 'racer'`).

- [ ] **Step 9: Rodar tudo.** `npx tsc --noEmit && npx vitest run`. Esperado: verde. Os `legacy/*` que dependem de `randomSpawns` em `configFromSetup` ficam para a T6: se `legacy/config.test.ts` quebrar por causa do campo, ajuste a expectativa **dele** (é da T6, mas só é apagado lá) e registre no commit.

- [ ] **Step 10: Commit**

```bash
git add -A web/src/input web/src/app/settings.ts web/src/screens/rules.ts web/tests/client/input-loop.test.ts web/tests/client/settings.test.ts web/tests/screens/repeat.test.ts
git commit -m "feat(entrada): 12 botões, gamepad remapeável, conexão, Esc segurado, repetição 20/5 e configurações v2

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Motor de texto, strings PT-BR e fonte do fallback

**Files:**
- Create: `web/src/render/text/types.ts`, `strings.ts`, `text.ts`, `fallback-font.ts`, `glyph-maps.ts`, `extra-glyphs.ts`, e para cada estilo `S ∈ {titleMenu, menuTitle, menuItem, ascii8, banner, spriteBlue, bigBattle, bigScore, bigVictory, bigDraw}`: `web/src/render/text/maps/S.ts` e `web/src/render/text/extra/S.ts` (esqueletos)
- Create: `web/tests/screens/text.test.ts`

**Possui:** `src/render/text/**` (depois desta tarefa, `maps/*` e `extra/*` passam para T16–T18), `tests/screens/text.test.ts`.

**Interfaces:**
- Consumes: `RomAssets`, `SceneId`, `romState`, `tilesFrom`, `sceneVramCgram`, `zteBlock`, `readColors`, `bgr555ToRgba` (`app/rom-api.ts`); `textPix`, `hasGlyph`, `GLYPH_ADVANCE`, `LINE_HEIGHT` (`render/art/font.ts`); `SpriteBank`, `pixToCanvas` (`render/sprite-bank.ts`); `Pix`, `makePix`, `setPx` (`render/art/pix.ts`)
- Produces: tipos do texto (Contratos), `S`, `STAGE_NAMES_PT`, `RACER_PRIZE_NAMES`, `STRING_USES`, `GLYPH_MAPS`, `EXTRA_GLYPHS`, `decodeStrip`, `parseExtra`, `fontFromParts`, `buildRomFont`, `layoutText`, `glyphChars`, `missingGlyphs`, `fallbackMissing`, `indexedToRgba`, `timeUpLabel`, `drawText`, `textWidth`, `TONE_COLORS`

**Regras:**
- Um glifo recortado da ROM (`cuts`) tem preferência sobre um glifo próprio (`extra`) do mesmo caractere. O espaço não precisa de glifo: avança `spaceWidth`.
- Todos os glifos de um estilo têm a altura `def.height`. `layoutText` põe os glifos lado a lado com `spacing` px entre eles. O índice 0 é transparente.
- Em faixas 2bpp, `palette.row` é o grupo de 4 cores (`cgram[row·4 …]`). Em 4bpp é a linha de 16 (`cgram[row·16 …]`). No Modo 7 é a CGRAM inteira. `tones[t]` troca a linha (tipo `scene`) ou o endereço (tipo `rom`).
- No modo ROM, `drawText` só usa o estilo se `GLYPH_MAPS[style]` não for `null`. Senão cai no fallback: a fonte atual, em maiúsculas, com a cor do tom ou do estilo e escala 2 nos estilos `big*`.

- [ ] **Step 1: Escrever o teste** `web/tests/screens/text.test.ts`:

```ts
import { S, STRING_USES, STAGE_NAMES_PT, RACER_PRIZE_NAMES } from '../../src/render/text/strings';
import { GLYPH_MAPS } from '../../src/render/text/glyph-maps';
import { EXTRA_GLYPHS } from '../../src/render/text/extra-glyphs';
import { TEXT_STYLES, type StyleRomDef, type IndexedImage, type TextStyleId } from '../../src/render/text/types';
import {
  parseExtra, fontFromParts, layoutText, glyphChars, missingGlyphs, fallbackMissing, indexedToRgba, timeUpLabel, drawText,
  buildRomFont, textWidth,
} from '../../src/render/text/text';
import { ASSETS } from './rom';

const img = (w: number, h: number, fill = 1): IndexedImage => ({ w, h, px: new Uint8Array(w * h).fill(fill) });
const def = (cuts: StyleRomDef['cuts'], extra: Partial<StyleRomDef> = {}): StyleRomDef => ({
  strips: { a: { kind: 'raw', rows: [0], tiles: 4, bpp: 4 } }, cuts, height: 8, spacing: 1, spaceWidth: 4,
  palette: { kind: 'rom', addr: 0, size: 16 }, ...extra,
});

describe('strings PT-BR (spec §6)', () => {
  it('nomes das 10 fases', () => {
    expect(STAGE_NAMES_PT).toEqual(['O Clássico', 'Rápido e Devagar', 'Bombardeio Orbital', 'Não Me Empurre', 'Escola de Choques',
      'Piso Traiçoeiro', 'Esconde-Explode', 'Caça-Níquel', 'Gangorra', 'Alfaiataria']);
  });
  it('textos da spec, na caixa do original', () => {
    expect([S.title.normal, S.title.battle, S.title.options, S.title.pressStart]).toEqual(['JOGO NORMAL', 'JOGO DE BATALHA', 'OPÇÕES', 'APERTE START!']);
    expect([S.vs.title, S.vs.royale, S.vs.champ, S.vs.mania, S.vs.ffa, S.vs.team])
      .toEqual(['Escolha o modo VS!', 'Battle Royale', 'Campeonato', 'Bombermania', 'Todos contra Todos', 'Em Equipes']);
    expect(S.players.row).toEqual(['1º Jogador', '2º Jogador', '3º Jogador', '4º Jogador', '5º Jogador']);
    expect([S.players.human, S.players.cpu, S.players.off]).toEqual(['Humano', 'CPU', 'Nenhum']);
    expect(S.rules.labels).toEqual(['Nível da CPU', 'Coroas', 'Tempo', 'Morte Súbita', 'Bomber Vingador', 'Corrida Bônus']);
    expect(S.rules.time).toEqual(['1:00', '2:00', '3:00', '5:00', '∞']);
    expect([S.stage.title, S.stage.stage(7), S.stage.battle]).toEqual(['Escolha a fase!', 'Fase 7', 'BATALHA!']);
    expect([S.battle.pause, S.battle.hurry, S.battle.timeUp, S.battle.timeUpShort, S.battle.disconnected(3)])
      .toEqual(['PAUSA!', 'RÁPIDO!!', 'TEMPO ESGOTADO!', 'TEMPO!', 'CONTROLE 3 DESCONECTADO']);
    expect([S.score.title, S.draw.title, S.victory.title, S.racer.press]).toEqual(['PLACAR', 'EMPATE', 'VITÓRIA!', 'APERTE B!']);
    expect([S.chars.title, S.teams.title]).toEqual(['Escolha um personagem!', 'Escolha as equipes!']);
  });
  it('nome PT-BR para cada chave de prêmio do Racer', () => {
    expect(Object.keys(RACER_PRIZE_NAMES).sort()).toEqual(['bomb+1', 'fire+1', 'fullFire', 'glove', 'heart', 'kick', 'none', 'p',
      'passBomb', 'passSoft', 'pierce', 'punch', 'remote+glove', 'speed+1', 'speed-1'].sort());
  });
  it('STRING_USES cobre cada estilo e não repete pares', () => {
    for (const st of TEXT_STYLES) expect(STRING_USES.some(u => u.style === st), st).toBe(true);
    const keys = STRING_USES.map(u => `${u.style}|${u.text}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('fallback: todo texto do jogo tem glifo (sem ROM)', () => {
    const miss = STRING_USES.flatMap(u => fallbackMissing(u.text).map(c => `${u.text} → ${c}`));
    expect(miss).toEqual([]);
  });
});

describe('registros de estilo', () => {
  it('um mapa e uma lista de glifos próprios por estilo', () => {
    expect(Object.keys(GLYPH_MAPS).sort()).toEqual([...TEXT_STYLES].sort());
    expect(Object.keys(EXTRA_GLYPHS).sort()).toEqual([...TEXT_STYLES].sort());
  });
  it('glifos próprios bem formados: linhas do mesmo tamanho, altura do estilo, caracteres válidos', () => {
    for (const st of TEXT_STYLES) {
      const d = GLYPH_MAPS[st];
      for (const g of EXTRA_GLYPHS[st]) {
        const w = g.rows[0].length;
        expect(g.rows.every(r => r.length === w), `${st} ${g.ch}`).toBe(true);
        if (d) expect(g.rows.length, `${st} ${g.ch} altura`).toBe(d.height);
        const legal = new Set(['.', ...(g.legend ? Object.keys(g.legend) : '0123456789abcdef'.split(''))]);
        expect(g.rows.join('').split('').every(c => legal.has(c)), `${st} ${g.ch} caracteres`).toBe(true);
      }
    }
  });
});

describe('motor (puro, sem ROM)', () => {
  it('parseExtra: hex por padrão, "." = 0, legenda opcional', () => {
    expect(Array.from(parseExtra({ ch: 'X', rows: ['1.', '.f'] }).px)).toEqual([1, 0, 0, 15]);
    const g = parseExtra({ ch: 'P', rows: ['#+'], legend: { '#': 0x41, '+': 0x42 } });
    expect([g.w, g.h, ...g.px]).toEqual([2, 1, 0x41, 0x42]);
  });
  it('fontFromParts recorta pela x/largura da faixa; o recorte da ROM vence o glifo próprio', () => {
    const strip: IndexedImage = { w: 8, h: 8, px: new Uint8Array(64).map((_, i) => (i % 8) + 1) };
    const f = fontFromParts('menuItem', def([{ ch: 'A', strip: 'a', x: 2, w: 3 }]), { a: strip },
      [{ ch: 'A', rows: Array(8).fill('9') }, { ch: 'B', rows: Array(8).fill('77') }]);
    expect(f.glyphs.get('A')!.w).toBe(3);
    expect(f.glyphs.get('A')!.px[0]).toBe(3);                 // coluna x = 2 → índice 3
    expect(f.glyphs.get('B')!.w).toBe(2);
  });
  it('layoutText: glifos + espaçamento + espaço', () => {
    const f = fontFromParts('menuItem', def([]), {}, [{ ch: 'A', rows: Array(8).fill('11') }, { ch: 'B', rows: Array(8).fill('222') }]);
    const t = layoutText(f, 'A B');
    expect([t.w, t.h]).toEqual([2 + 1 + 4 + 1 + 3, 8]);
    expect(t.px[0]).toBe(1);
    expect(t.px[2]).toBe(0);                                   // espaçamento transparente
  });
  it('glyphChars e missingGlyphs (sem ROM: só os fatos)', () => {
    const maps = { ...GLYPH_MAPS, menuItem: def([{ ch: 'A', strip: 'a', x: 0, w: 2 }]) } as typeof GLYPH_MAPS;
    const extras = { ...EXTRA_GLYPHS, menuItem: [{ ch: 'Ç', rows: Array(8).fill('1') }] } as typeof EXTRA_GLYPHS;
    expect([...glyphChars('menuItem', maps, extras)].sort()).toEqual(['A', 'Ç']);
    expect(missingGlyphs('menuItem', 'AÇ AB', maps, extras)).toEqual(['B']);
  });
  it('indexedToRgba: 0 transparente, índices pela paleta', () => {
    const rgba = indexedToRgba({ w: 2, h: 1, px: new Uint8Array([0, 1]) }, new Uint16Array([0, 0x001f]));
    expect(Array.from(rgba)).toEqual([0, 0, 0, 0, 255, 0, 0, 255]);
  });
  it('TEMPO ESGOTADO! sem ROM', () => { expect(timeUpLabel()).toBe('TEMPO ESGOTADO!'); });
});

describe('drawText no fallback', () => {
  const bank = { text: (s: string, c: string) => ({ width: s.length * 6 - 1 + 2, height: 12, tag: `${s}|${c}` }) };
  const calls: { tag: string; x: number; y: number; w: number }[] = [];
  const ctx = { drawImage: (im: { tag: string; width: number }, x: number, y: number, w?: number) => calls.push({ tag: im.tag, x, y, w: w ?? im.width }) };
  beforeEach(() => { calls.length = 0; });
  it('centraliza e usa a cor do tom', () => {
    const w = drawText(ctx as never, bank as never, 'menuItem', 'CPU', 100, 50, { align: 'center', tone: 'red' });
    expect(calls).toHaveLength(1);
    expect(calls[0].x).toBe(100 - Math.floor(w / 2));
    expect(calls[0].tag.endsWith('#e8402a')).toBe(true);
  });
  it('estilos grandes com escala 2', () => {
    const w = drawText(ctx as never, bank as never, 'bigVictory', 'VITÓRIA!', 0, 0);
    expect(calls[0].w).toBe(w);
    expect(w).toBe(2 * (8 * 6 - 1 + 2));
  });
  it('textWidth no fallback bate com o desenho', () => {
    expect(textWidth('ascii8', 'ABC')).toBe(3 * 6 - 1 + 2);
  });
});

describe.skipIf(!ASSETS)('estilos com ROM', () => {
  it.each(TEXT_STYLES as unknown as TextStyleId[])('%s: cada glifo tem a altura do estilo e pixels não nulos', st => {
    const d = GLYPH_MAPS[st];
    if (!d) return;
    const f = buildRomFont(st, ASSETS!)!;
    expect(f).not.toBeNull();
    for (const [ch, g] of f.glyphs) {
      expect(g.h, `${st} ${ch}`).toBe(d.height);
      expect(g.px.some(v => v !== 0), `${st} ${ch} vazio`).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** (`npx vitest run tests/screens/text.test.ts`).

- [ ] **Step 3: Criar `web/src/render/text/types.ts`** com os tipos da seção "Contratos" (inclusive `size` no `palette`) e mais:

```ts
export const TEXT_STYLES: readonly TextStyleId[] = ['titleMenu', 'menuTitle', 'menuItem', 'ascii8', 'banner', 'spriteBlue',
  'bigBattle', 'bigScore', 'bigVictory', 'bigDraw'];
```

- [ ] **Step 4: Criar `web/src/render/text/strings.ts`** (completo; as tarefas da onda 3 não o editam):

```ts
import type { TextStyleId } from './types';

export const STAGE_NAMES_PT = ['O Clássico', 'Rápido e Devagar', 'Bombardeio Orbital', 'Não Me Empurre', 'Escola de Choques',
  'Piso Traiçoeiro', 'Esconde-Explode', 'Caça-Níquel', 'Gangorra', 'Alfaiataria'] as const;

export const RACER_PRIZE_NAMES = {
  'bomb+1': 'BOMBA +1', pierce: 'BOMBA PERFURANTE', 'fire+1': 'FOGO +1', fullFire: 'FOGO TOTAL', 'speed+1': 'PATINS +1',
  'remote+glove': 'REMOTA + LUVA', glove: 'LUVA', kick: 'CHUTE', none: 'NADA', passBomb: 'ATRAVESSA BOMBA',
  passSoft: 'ATRAVESSA BLOCO', 'speed-1': 'PATINS -1', punch: 'SOCO', heart: 'CORAÇÃO', p: 'GOLPE P',
} as const;

const DEVICE_NAMES = { kb0: 'TECLADO 1', kb1: 'TECLADO 2', gp0: 'CONTROLE 1', gp1: 'CONTROLE 2', gp2: 'CONTROLE 3', gp3: 'CONTROLE 4', none: 'NENHUM' } as const;
const ACTIONS = { up: 'CIMA', down: 'BAIXO', left: 'ESQUERDA', right: 'DIREITA', a: 'A', b: 'B', x: 'X', y: 'Y', l: 'L', r: 'R', start: 'START', select: 'SELECT' } as const;

export const S = {
  title: { normal: 'JOGO NORMAL', battle: 'JOGO DE BATALHA', options: 'OPÇÕES', pressStart: 'APERTE START!' },
  vs: { title: 'Escolha o modo VS!', royale: 'Battle Royale', champ: 'Campeonato', mania: 'Bombermania', ffa: 'Todos contra Todos', team: 'Em Equipes' },
  players: { title: 'Defina os jogadores!', row: ['1º Jogador', '2º Jogador', '3º Jogador', '4º Jogador', '5º Jogador'], human: 'Humano', cpu: 'CPU', off: 'Nenhum' },
  rules: {
    title: 'Configure as regras!',
    labels: ['Nível da CPU', 'Coroas', 'Tempo', 'Morte Súbita', 'Bomber Vingador', 'Corrida Bônus'],
    cpu: ['Fraco', 'Normal', 'Forte'], crowns: ['1', '2', '3', '4', '5'], time: ['1:00', '2:00', '3:00', '5:00', '∞'], no: 'Não', yes: 'Sim',
  },
  chars: { title: 'Escolha um personagem!', tags: ['1P', '2P', '3P', '4P', '5P'] },
  teams: { title: 'Escolha as equipes!', vs: 'VS' },
  stage: { title: 'Escolha a fase!', stage: (n: number) => `Fase ${n}`, names: STAGE_NAMES_PT, battle: 'BATALHA!' },
  battle: { pause: 'PAUSA!', hurry: 'RÁPIDO!!', timeUp: 'TEMPO ESGOTADO!', timeUpShort: 'TEMPO!', disconnected: (n: number) => `CONTROLE ${n} DESCONECTADO` },
  score: { title: 'PLACAR', tags: ['1P', '2P', '3P', '4P', '5P'] },
  draw: { title: 'EMPATE' },
  victory: { title: 'VITÓRIA!' },
  racer: { press: 'APERTE B!', prize: 'PRÊMIO', names: RACER_PRIZE_NAMES },
  options: {
    title: 'Opções', player: (n: number) => `JOGADOR ${n}`, devices: DEVICE_NAMES,
    keys: (n: number) => `TECLAS DO TECLADO ${n}`, pad: (n: number) => `BOTÕES DO CONTROLE ${n}`,
    spawns: 'SPAWNS ALEATÓRIOS', music: 'VOLUME DA MÚSICA', sfx: 'VOLUME DOS EFEITOS',
    rom: 'ROM', romOk: 'CARREGADA ✓', romNo: 'NÃO CARREGADA', load: 'CARREGAR ROM...', forget: 'ESQUECER ROM',
    forgetAsk: 'ESQUECER A ROM? A: SIM  B: NÃO', reset: 'RESTAURAR PADRÃO', back: 'VOLTAR', no: 'NÃO', yes: 'SIM',
    pressKey: 'APERTE A NOVA TECLA (ESC CANCELA)', pressPad: 'APERTE O NOVO BOTÃO (ESC CANCELA)', actions: ACTIONS,
    button: (n: number) => `BOTÃO ${n}`,
  },
} as const;

type Use = { style: TextStyleId; text: string };
const as = (style: TextStyleId, list: readonly string[]): Use[] => list.map(text => ({ style, text }));
const uniq = (u: Use[]): Use[] => [...new Map(u.map(x => [`${x.style}|${x.text}`, x])).values()];

/** Todo par (estilo, texto) que o jogo desenha. Base dos testes de cobertura (T4, T16–T18, T22). */
export const STRING_USES: readonly Use[] = uniq([
  ...as('titleMenu', [S.title.normal, S.title.battle, S.title.options, S.title.pressStart]),
  ...as('menuTitle', [S.vs.title, S.players.title, S.rules.title, S.chars.title, S.teams.title, S.options.title]),
  ...as('menuItem', [S.vs.royale, S.vs.champ, S.vs.mania, S.vs.ffa, S.vs.team, ...S.players.row, S.players.human, S.players.cpu,
    S.players.off, ...S.rules.labels, ...S.rules.cpu, ...S.rules.crowns, ...S.rules.time, S.rules.no, S.rules.yes, S.teams.vs]),
  ...as('spriteBlue', [S.stage.title, ...Array.from({ length: 10 }, (_, i) => S.stage.stage(i + 1)), ...STAGE_NAMES_PT]),
  ...as('banner', [S.battle.pause, S.battle.hurry, S.battle.timeUp, S.battle.timeUpShort, S.racer.press]),
  ...as('ascii8', [
    ...[1, 2, 3, 4].map(S.battle.disconnected), ...S.score.tags, ...S.chars.tags, S.racer.prize, ...Object.values(RACER_PRIZE_NAMES),
    ...[1, 2, 3, 4, 5].map(S.options.player), ...Object.values(DEVICE_NAMES), S.options.keys(1), S.options.keys(2),
    ...[1, 2, 3, 4].map(S.options.pad), S.options.spawns, S.options.music, S.options.sfx, S.options.rom, S.options.romOk,
    S.options.romNo, S.options.load, S.options.forget, S.options.forgetAsk, S.options.reset, S.options.back, S.options.no,
    S.options.yes, S.options.pressKey, S.options.pressPad, ...Object.values(ACTIONS),
    ...Array.from({ length: 32 }, (_, i) => S.options.button(i)),
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789 -+.:!?', 'ESPAÇO', '0 1 2 3 4 5 6 7 8 9 10',
  ]),
  ...as('bigBattle', [S.stage.battle]),
  ...as('bigScore', [S.score.title]),
  ...as('bigVictory', [S.victory.title]),
  ...as('bigDraw', [S.draw.title]),
]);
```

- [ ] **Step 5: Criar os esqueletos por estilo.** Para cada estilo `S`: `web/src/render/text/maps/S.ts` com

```ts
import type { StyleRomDef } from '../types';
/** Preenchido pela T16/T17/T18 (glifos recortados da ROM). null = estilo ainda sem mapa (usa o fallback). */
export const DEF: StyleRomDef | null = null;
```

e `web/src/render/text/extra/S.ts` com

```ts
import type { ExtraGlyph } from '../types';
export const EXTRA: readonly ExtraGlyph[] = [];
```

Os agregadores são `web/src/render/text/glyph-maps.ts` e `extra-glyphs.ts`:

```ts
import type { StyleRomDef, TextStyleId } from './types';
import { DEF as titleMenu } from './maps/titleMenu';
import { DEF as menuTitle } from './maps/menuTitle';
import { DEF as menuItem } from './maps/menuItem';
import { DEF as ascii8 } from './maps/ascii8';
import { DEF as banner } from './maps/banner';
import { DEF as spriteBlue } from './maps/spriteBlue';
import { DEF as bigBattle } from './maps/bigBattle';
import { DEF as bigScore } from './maps/bigScore';
import { DEF as bigVictory } from './maps/bigVictory';
import { DEF as bigDraw } from './maps/bigDraw';
export const GLYPH_MAPS: Record<TextStyleId, StyleRomDef | null> =
  { titleMenu, menuTitle, menuItem, ascii8, banner, spriteBlue, bigBattle, bigScore, bigVictory, bigDraw };
```

(`extra-glyphs.ts` segue o mesmo formato, com `EXTRA` e `Record<TextStyleId, readonly ExtraGlyph[]>`.)

- [ ] **Step 6: Criar `web/src/render/text/fallback-font.ts`:**

```ts
import { hasGlyph, textPix, GLYPH_ADVANCE, LINE_HEIGHT } from '../art/font';
import { makePix, setPx, type Pix } from '../art/pix';

/** Caracteres que a fonte atual não tem (5×7; mesmo avanço de 6 px). */
export const FALLBACK_EXTRA: Record<string, readonly string[]> = {
  '∞': ['.....', '.....', '.#.#.', '#.#.#', '#.#.#', '.#.#.', '.....'],
  '✓': ['.....', '....#', '...#.', '#.#..', '.#...', '.....', '.....'],
  '[': ['.###.', '.#...', '.#...', '.#...', '.#...', '.#...', '.###.'],
  ']': ['.###.', '...#.', '...#.', '...#.', '...#.', '...#.', '.###.'],
};

export function fallbackMissing(text: string): string[] {
  return [...new Set([...text].filter(ch => ch !== ' ' && !hasGlyph(ch.toUpperCase()) && !(ch in FALLBACK_EXTRA)))];
}

/** Igual a `textPix` (contorno de 1 px), aceitando também os caracteres de FALLBACK_EXTRA. */
export function fallbackPix(text: string, color: string, shadow = '#0b0b14'): Pix {
  const up = text.toUpperCase();
  if (![...up].some(ch => ch in FALLBACK_EXTRA)) return textPix(up, color, shadow);
  const p = makePix(Math.max(0, up.length * GLYPH_ADVANCE - 1) + 2, LINE_HEIGHT + 2);
  [...up].forEach((ch, i) => {
    const x0 = i * GLYPH_ADVANCE;
    if (ch in FALLBACK_EXTRA) {
      FALLBACK_EXTRA[ch].forEach((r, y) => [...r].forEach((c, x) => { if (c === '#') setPx(p, x0 + x + 1, y + 3, color); }));
    } else {
      const g = textPix(ch, color, shadow);
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
        const k = (y * g.w + x) * 4;
        if (g.data[k + 3]) p.data.set(g.data.subarray(k, k + 4), ((y) * p.w + x0 + x) * 4);
      }
    }
  });
  return p;
}
```

- [ ] **Step 7: Criar `web/src/render/text/text.ts`.** Código completo das partes puras e as regras do resto:

```ts
import type { SpriteBank } from '../sprite-bank';
import { pixToCanvas } from '../sprite-bank';
import { romState, tilesFrom, sceneVramCgram, zteBlock, readColors, bgr555ToRgba, type RomAssets } from '../../app/rom-api';
import type { ExtraGlyph, IndexedImage, StripSource, StyleRomDef, TextStyleId, Tone } from './types';
import { GLYPH_MAPS } from './glyph-maps';
import { EXTRA_GLYPHS } from './extra-glyphs';
import { fallbackMissing, fallbackPix } from './fallback-font';
import { S } from './strings';
export { fallbackMissing } from './fallback-font';

export interface RomFont { style: TextStyleId; def: StyleRomDef; glyphs: Map<string, IndexedImage> }

const HEX = '0123456789abcdef';
export function parseExtra(g: ExtraGlyph): IndexedImage {
  const w = g.rows[0]?.length ?? 0, h = g.rows.length;
  const px = new Uint8Array(w * h);
  g.rows.forEach((r, y) => [...r].forEach((c, x) => { px[y * w + x] = c === '.' ? 0 : g.legend ? (g.legend[c] ?? 0) : HEX.indexOf(c); }));
  return { w, h, px };
}

function crop(src: IndexedImage, x: number, y: number, w: number, h: number): IndexedImage {
  const px = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px[j * w + i] = src.px[(y + j) * src.w + x + i] ?? 0;
  return { w, h, px };
}

export function fontFromParts(style: TextStyleId, def: StyleRomDef, strips: Record<string, IndexedImage>, extras: readonly ExtraGlyph[]): RomFont {
  const glyphs = new Map<string, IndexedImage>();
  for (const g of extras) glyphs.set(g.ch, parseExtra(g));
  for (const c of def.cuts) {
    const s = strips[c.strip];
    if (s) glyphs.set(c.ch, crop(s, c.x, c.y ?? 0, c.w, c.h ?? def.height));   // recorte da ROM vence
  }
  return { style, def, glyphs };
}

export function layoutText(f: RomFont, text: string): IndexedImage {
  const parts = [...text].map(ch => (ch === ' ' ? null : f.glyphs.get(ch) ?? null));
  const ws = parts.map((g, i) => (g ? g.w : [...text][i] === ' ' ? f.def.spaceWidth : 0));
  const w = Math.max(0, ws.reduce((a, b) => a + b, 0) + f.def.spacing * (parts.length - 1));
  const h = f.def.height;
  const px = new Uint8Array(w * h);
  let x = 0;
  parts.forEach((g, i) => {
    if (g) for (let y = 0; y < Math.min(h, g.h); y++) for (let k = 0; k < g.w; k++) px[y * w + x + k] = g.px[y * g.w + k];
    x += ws[i] + f.def.spacing;
  });
  return { w, h, px };
}

export function glyphChars(style: TextStyleId, maps = GLYPH_MAPS, extras = EXTRA_GLYPHS): Set<string> {
  return new Set([...(maps[style]?.cuts ?? []).map(c => c.ch), ...extras[style].map(g => g.ch)]);
}
export function missingGlyphs(style: TextStyleId, text: string, maps = GLYPH_MAPS, extras = EXTRA_GLYPHS): string[] {
  const have = glyphChars(style, maps, extras);
  return [...new Set([...text].filter(ch => ch !== ' ' && !have.has(ch)))];
}

export function indexedToRgba(img: IndexedImage, colors: Uint16Array): Uint8ClampedArray {
  const out = new Uint8ClampedArray(img.w * img.h * 4);
  img.px.forEach((v, i) => {
    if (!v) return;
    const [r, g, b] = bgr555ToRgba(colors[v] ?? 0);
    out.set([r, g, b, 255], i * 4);
  });
  return out;
}
```

  Regras para completar `text.ts`:
  - `decodeStrip(src: StripSource, a: RomAssets): IndexedImage`. `raw`: para cada endereço de `rows`, `a.rom.bytes(addr, tiles·8·bpp)`, `tilesFrom(…, 0, tiles, bpp)`, com os tiles lado a lado (tile `t`, pixel `(x, y)` em `px[t·64 + y·8 + x]`). `zte`: bytes de `zteBlock(a, block)` a partir de `offset + r·rowStride`, 4bpp. `vram`: `sceneVramCgram(a, scene).vram` com base `bg = 0x0000` (4bpp), `bg3 = 0xA000` (2bpp) e `obj = 0xC000` (4bpp); o tile `(r, c)` é `tile + r·rowStride + c`. `mode7`: `a.mode7Draw()`, com pixel `(X, Y) = chr[map[(Y>>3)·128 + (X>>3)]·64 + (Y&7)·8 + (X&7)]`, recortado em `x, y, w, h`.
  - `buildRomFont(style, a, maps = GLYPH_MAPS, extras = EXTRA_GLYPHS): RomFont | null`. Devolve `null` se `maps[style]` for `null`. Decodifica cada faixa uma vez e guarda o resultado em `WeakMap<RomAssets, Map<TextStyleId, RomFont>>`.
  - `styleColors(def, a, tone): Uint16Array`. `scene`: a CGRAM da cena, a partir de `row·size` (ou `tones[tone]·size`), com `size` cores. `rom`: `readColors(a, tones[tone] ?? addr, size)`.
  - `TONE_COLORS: Record<Tone, string>` = `{ default: '', gray: '#8a8a8a', green: '#3fb24a', red: '#e8402a', blue: '#3a6ae0', white: '#ffffff', orange: '#ff8c1a', yellow: '#ffd23f' }` e `STYLE_COLOR: Record<TextStyleId, string>` = `{ titleMenu: '#ffffff', menuTitle: '#4a8cff', menuItem: '#e8402a', ascii8: '#ffffff', banner: '#3fd84a', spriteBlue: '#4a8cff', bigBattle: '#ffd23f', bigScore: '#ffd23f', bigVictory: '#ff8c1a', bigDraw: '#e8402a' }`. A escala do fallback é 2 em `big*` e 1 no resto.
  - `export interface TextOpts { align?: 'left' | 'center' | 'right'; tone?: Tone; color?: string; scale?: number }`.
  - `drawText(ctx, bank, style, text, x, y, o = {}): number`. Com `romState.assets` e `buildRomFont` não nulo: `layoutText`, depois `indexedToRgba` com `styleColors`, depois um canvas guardado em cache por `style|text|tom` (e pelo objeto `assets`), desenhado com `ctx.drawImage`. Sem isso, o fallback: `img = FALLBACK_EXTRA necessário ? pixToCanvas(fallbackPix(text, cor)) : bank.text(text, cor)`, com `cor = o.color ?? (TONE_COLORS[o.tone] || STYLE_COLOR[style])`, desenhado com `ctx.drawImage(img, x', y, img.width·escala, img.height·escala)`. `x'` depende de `align`: `left` → x; `center` → `x − ⌊w/2⌋`; `right` → `x − w`. Devolve `w` (largura final).
  - `textWidth(style, text)`: a mesma conta, sem desenhar. No fallback, `(n·6 − 1 + 2)·escala`.
  - `timeUpLabel()`: com ROM, `GLYPH_MAPS.banner?.meta?.timeUpWidth` e fonte `banner` → `layoutText(…, S.battle.timeUp).w ≤ 1.25·timeUpWidth ? S.battle.timeUp : S.battle.timeUpShort`. Sem isso, `S.battle.timeUp`.

- [ ] **Step 8: Rodar** `npx vitest run tests/screens/text.test.ts` (PASS; o bloco com ROM passa sem nada a conferir enquanto os mapas são `null`) e `npx tsc --noEmit && npx vitest run` (verde).

- [ ] **Step 9: Commit**

```bash
git add -A web/src/render/text web/tests/screens/text.test.ts
git commit -m "feat(texto): motor de fontes por estilo (ROM + glifos próprios + fallback) e todos os textos PT-BR

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Base das cenas da ROM, moldura dos menus e ferramentas de captura

**Files:**
- Create: `web/src/render/screens-rom/scene.ts`, `web/src/render/screens-rom/map-sources.ts`, `web/tests/screens/captures.ts`, `web/tests/screens/scene.test.ts`, `web/scripts/screens/png.ts`, `web/scripts/screens/dump-capture.ts`

**Possui:** esses arquivos. Depois desta tarefa, `map-sources.ts` passa para a T19.

**Interfaces:**
- Consumes: `RomAssets`, `SceneId`, `Tiles`, `PpuFrame`, `ObjEntry`, `BgLayer`, `renderPpu`, `sceneVramCgram`, `tilesFrom` (`app/rom-api.ts`)
- Produces: `SceneGfx`, `gfxFromVram`, `sceneGfx`, `newMap`, `tileWord`, `put`, `fill`, `pattern`, `box`, `BoxParts`, `SceneMaps`, `MapBuilder`, `sceneMaps`, `sceneFrame`, `obj`, `PpuCanvas`, `MENU_GEO`, `menuMaps`, `handCursor`, `MAP_SOURCES`; ajudantes de captura para os testes; `dump-capture` para as tarefas de pesquisa

**Pesquisa (parte desta tarefa):** descobrir, nas capturas `vsmode`, `ffa`, `players` e `rules`, os números de tile do fundo de quebra-cabeça e da moldura de corda (cantos, bordas, bolas), a camada de cada um (BG1 ou BG2), o scroll e o tile/paleta OBJ da mão (`$000` nos menus e `$0C8` no título, [MNT §B.0]). Isso vai para `MENU_GEO` **como números**, nunca como mapa copiado. Use `dump-capture` (Step 6) para ver os mapas em hex e as folhas de tiles em PNG no scratchpad.

- [ ] **Step 1: Criar `web/tests/screens/captures.ts`:**

```ts
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const CAPTURES: string | null = process.env.SB4_CAPTURES ?? null;
export interface Capture { vram: Uint8Array; cgram: Uint16Array; oam: Uint8Array; ppu: Uint8Array }

export function loadCapture(name: string): Capture | null {
  if (!CAPTURES) return null;
  const p = (ext: string) => join(CAPTURES, `${name}.${ext}`);
  if (!existsSync(p('vram'))) return null;
  const cg = readFileSync(p('cgram'));
  return {
    vram: new Uint8Array(readFileSync(p('vram'))),
    cgram: new Uint16Array(cg.buffer.slice(cg.byteOffset, cg.byteOffset + 512)),
    oam: new Uint8Array(readFileSync(p('oam'))),
    ppu: new Uint8Array(readFileSync(p('ppu'))),
  };
}
/** Mapa de BG a partir de um endereço de palavra da VRAM (BG1 = $4000, BG2 = $4400, BG3 = $5400). */
export function capturedMap(c: Capture, wordAddr: number, w = 32, h = 32): Uint16Array {
  const out = new Uint16Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = c.vram[(wordAddr + i) * 2] | (c.vram[(wordAddr + i) * 2 + 1] << 8);
  return out;
}
export interface OamRow { i: number; x: number; y: number; tile: number; pal: number; prio: number; h: boolean; v: boolean; big: boolean }
/** OAM padrão do SNES: 128 × 4 bytes + tabela alta de 32 bytes (bit 0 = x8, bit 1 = tamanho). */
export function parseOam(oam: Uint8Array): OamRow[] {
  const rows: OamRow[] = [];
  for (let i = 0; i < 128; i++) {
    const hi = (oam[512 + (i >> 2)] >> ((i & 3) * 2)) & 3;
    let x = oam[i * 4] | ((hi & 1) << 8); if (x >= 256) x -= 512;
    const attr = oam[i * 4 + 3];
    rows.push({ i, x, y: oam[i * 4 + 1], tile: oam[i * 4 + 2] | ((attr & 1) << 8), pal: (attr >> 1) & 7, prio: (attr >> 4) & 3,
      h: (attr & 0x40) !== 0, v: (attr & 0x80) !== 0, big: (hi & 2) !== 0 });
  }
  return rows.filter(r => r.y < 224 || r.y >= 240);   // y 224..239 = escondido
}
export interface Rect { x0: number; y0: number; x1: number; y1: number }   // px, inclusivo
/** Fração de casas 16×16 iguais entre dois mapas, ignorando as casas que tocam algum retângulo (texto). */
export function mapMatch(a: Uint16Array, b: Uint16Array, ignore: readonly Rect[] = [], hofs = 0, vofs = 0): number {
  let same = 0, total = 0;
  for (let lin = 0; lin < 14; lin++) for (let col = 0; col < 16; col++) {
    const x = col * 16 - hofs, y = lin * 16 - vofs;
    if (ignore.some(r => x + 15 >= r.x0 && x <= r.x1 && y + 15 >= r.y0 && y <= r.y1)) continue;
    total++;
    if (a[lin * 32 + col] === b[lin * 32 + col]) same++;
  }
  return total ? same / total : 1;
}
```

- [ ] **Step 2: Escrever o teste** `web/tests/screens/scene.test.ts`:

```ts
import { tileWord, newMap, put, fill, pattern, box, sceneFrame, obj, gfxFromVram, menuMaps, MENU_GEO, handCursor, sceneMaps } from '../../src/render/screens-rom/scene';
import { MAP_SOURCES } from '../../src/render/screens-rom/map-sources';
import { loadCapture, capturedMap, parseOam, mapMatch, type Rect } from './captures';

describe('geometria de mapas (pura)', () => {
  it('tileWord: vhopppcc cccccccc', () => {
    expect(tileWord(0x123, 5)).toBe(0x1523);
    expect(tileWord(0x3ff, 7, 1, true, true)).toBe(0xffff);
  });
  it('put/fill/pattern com volta em 32', () => {
    const m = newMap();
    put(m, 33, 0, 7);
    expect(m[1]).toBe(7);
    fill(m, 2, 3, 2, 2, 9);
    expect([m[3 * 32 + 2], m[3 * 32 + 3], m[4 * 32 + 3], m[5 * 32 + 3]]).toEqual([9, 9, 9, 0]);
    pattern(m, 0, 10, 4, 2, [[1, 2], [3, 4]]);
    expect(Array.from(m.subarray(10 * 32, 10 * 32 + 4))).toEqual([1, 2, 1, 2]);
    expect(Array.from(m.subarray(11 * 32, 11 * 32 + 4))).toEqual([3, 4, 3, 4]);
  });
  it('box: cantos, bordas e miolo', () => {
    const m = newMap();
    box(m, 1, 1, 4, 3, { tl: 1, tr: 2, bl: 3, br: 4, top: 5, bottom: 6, left: 7, right: 8, fill: 9 });
    const row = (l: number) => Array.from(m.subarray(l * 32 + 1, l * 32 + 5));
    expect(row(1)).toEqual([1, 5, 5, 2]);
    expect(row(2)).toEqual([7, 9, 9, 8]);
    expect(row(3)).toEqual([3, 6, 6, 4]);
  });
  it('sceneFrame: modo 1 com tiles 16×16 em BG1/BG2, uma faixa, OAM e CGRAM da cena', () => {
    const g = gfxFromVram(new Uint8Array(0x10000), new Uint16Array(256));
    const f = sceneFrame(g, { bg1: newMap(), bg2: newMap() }, { oam: [obj(10, 20, 0, 0)], bg2: [0, 8] });
    expect(f.bg1!.tile16).toBe(true);
    expect(f.bg2!.vofs).toBe(8);
    expect(f.bands).toEqual([{ y0: 0, y1: 224, bg1Tile16: true, main: 1 | 2 | 16, sub: 0, math: 'none' }]);
    expect(f.oam).toHaveLength(1);
    expect(g.bgTiles.count).toBe(1024);
    expect(g.objTiles.count).toBe(512);
  });
  it('sem origem na ROM, sceneMaps usa a geometria', () => {
    const geo = () => ({ bg2: newMap() });
    expect(sceneMaps({} as never, 'vsmode', geo)).toEqual(geo());
    expect(typeof MAP_SOURCES).toBe('object');
  });
  it('handCursor: OBJ 16×16 parado com o tile dos menus ou do título', () => {
    expect(handCursor(56, 80)).toMatchObject({ x: 56, y: 80, size: 16, src: { tile: MENU_GEO.hand.tile } });
    expect(handCursor(56, 148, true).src).toEqual({ tile: MENU_GEO.titleHand.tile });
  });
});

/** Molduras medidas [MNT §B.2–B.4] e áreas de texto (ignoradas: o texto é nosso). */
const CASES: { scene: string; frame: Rect; text: Rect[] }[] = [
  { scene: 'vsmode', frame: { x0: 7, y0: 51, x1: 248, y1: 186 }, text: [{ x0: 60, y0: 44, x1: 194, y1: 62 }, { x0: 76, y0: 76, x1: 176, y1: 158 }] },
  { scene: 'ffa', frame: { x0: 7, y0: 67, x1: 248, y1: 170 }, text: [{ x0: 60, y0: 44, x1: 194, y1: 62 }, { x0: 80, y0: 90, x1: 200, y1: 142 }] },
  { scene: 'players', frame: { x0: 7, y0: 19, x1: 248, y1: 218 }, text: [{ x0: 46, y0: 12, x1: 208, y1: 32 }, { x0: 40, y0: 44, x1: 232, y1: 190 }] },
  { scene: 'rules', frame: { x0: 7, y0: 27, x1: 248, y1: 210 }, text: [{ x0: 52, y0: 20, x1: 202, y1: 40 }, { x0: 28, y0: 52, x1: 232, y1: 190 }] },
];

describe.each(CASES)('moldura de menu × captura $scene', ({ scene, frame, text }) => {
  const cap = loadCapture(scene);
  it.skipIf(!cap)('BG1 e BG2 montados pela geometria batem ≥ 97 % fora do texto', () => {
    const built = menuMaps(frame);
    for (const [layer, addr] of [['bg1', 0x4000], ['bg2', 0x4400]] as const) {
      const ours = built[layer];
      if (!ours) continue;
      expect(mapMatch(ours, capturedMap(cap!, addr), text, MENU_GEO.scroll[layer][0], MENU_GEO.scroll[layer][1]), `${scene} ${layer}`)
        .toBeGreaterThanOrEqual(0.97);
    }
  });
  it.skipIf(!cap)('a mão da captura usa o tile e a paleta de MENU_GEO', () => {
    const hands = parseOam(cap!.oam).filter(r => r.tile === MENU_GEO.hand.tile);
    expect(hands.length).toBeGreaterThan(0);
    expect(hands[0].pal).toBe(MENU_GEO.hand.pal);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar.**

- [ ] **Step 4: Criar `web/src/render/screens-rom/map-sources.ts`:**

```ts
import type { SceneId, RomAssets } from '../../app/rom-api';
import type { SceneMaps } from './scene';
/** Origem dos mapas de BG na ROM (A14), preenchida pela T19. Cena ausente = geometria do nosso código. */
export const MAP_SOURCES: Partial<Record<SceneId, (a: RomAssets) => SceneMaps>> = {};
```

- [ ] **Step 5: Criar `web/src/render/screens-rom/scene.ts`.** Código completo das partes puras:

```ts
import { tilesFrom, sceneVramCgram, renderPpu, type RomAssets, type SceneId, type Tiles, type PpuFrame, type ObjEntry } from '../../app/rom-api';
import { MAP_SOURCES } from './map-sources';

export interface SceneGfx { bgTiles: Tiles; bg3Tiles: Tiles; objTiles: Tiles; cgram: Uint16Array }
export interface SceneMaps { bg1?: Uint16Array; bg2?: Uint16Array; bg3?: Uint16Array }
export type MapBuilder = (a: RomAssets) => SceneMaps;
export interface BoxParts { tl: number; tr: number; bl: number; br: number; top: number; bottom: number; left: number; right: number; fill?: number }

/** Layout de VRAM das cenas [CAT §1]: BG 4bpp em $0000, BG3 2bpp em $5000 (palavra), OBJ 4bpp em $6000. */
export function gfxFromVram(vram: Uint8Array, cgram: Uint16Array): SceneGfx {
  return { bgTiles: tilesFrom(vram, 0x0000, 1024, 4), bg3Tiles: tilesFrom(vram, 0xa000, 256, 2), objTiles: tilesFrom(vram, 0xc000, 512, 4), cgram };
}
const cache = new WeakMap<RomAssets, Map<SceneId, SceneGfx>>();
export function sceneGfx(a: RomAssets, id: SceneId): SceneGfx {
  let m = cache.get(a); if (!m) { m = new Map(); cache.set(a, m); }
  let g = m.get(id);
  if (!g) { const s = sceneVramCgram(a, id); g = gfxFromVram(s.vram, s.cgram); m.set(id, g); }
  return g;
}

export const newMap = (): Uint16Array => new Uint16Array(32 * 32);
export const tileWord = (tile: number, pal: number, prio = 0, h = false, v = false): number =>
  ((v ? 1 : 0) << 15) | ((h ? 1 : 0) << 14) | ((prio & 1) << 13) | ((pal & 7) << 10) | (tile & 0x3ff);
export const put = (m: Uint16Array, col: number, lin: number, w: number): void => { m[(lin & 31) * 32 + (col & 31)] = w; };
export function fill(m: Uint16Array, col: number, lin: number, w: number, h: number, word: number): void {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(m, col + i, lin + j, word);
}
export function pattern(m: Uint16Array, col: number, lin: number, w: number, h: number, words: readonly (readonly number[])[]): void {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(m, col + i, lin + j, words[j % words.length][i % words[0].length]);
}
export function box(m: Uint16Array, c0: number, l0: number, c1: number, l1: number, p: BoxParts): void {
  for (let l = l0; l <= l1; l++) for (let c = c0; c <= c1; c++) {
    const top = l === l0, bot = l === l1, lef = c === c0, rig = c === c1;
    const w = top && lef ? p.tl : top && rig ? p.tr : bot && lef ? p.bl : bot && rig ? p.br
      : top ? p.top : bot ? p.bottom : lef ? p.left : rig ? p.right : p.fill;
    if (w !== undefined) put(m, c, l, w);
  }
}
export function sceneMaps(a: RomAssets, id: SceneId, geometry: MapBuilder): SceneMaps {
  return (MAP_SOURCES[id] ?? geometry)(a);
}

export interface FrameOpts { bg1?: [number, number]; bg2?: [number, number]; bg3?: [number, number]; oam?: ObjEntry[]; backdrop?: number }
export function sceneFrame(g: SceneGfx, maps: SceneMaps, o: FrameOpts = {}): PpuFrame {
  const layer = (map: Uint16Array | undefined, tiles: Tiles, tile16: boolean, sc: [number, number] = [0, 0]) =>
    (map ? { map, mapW: 32 as const, tiles, tile16, hofs: sc[0], vofs: sc[1] } : undefined);
  const main = (maps.bg1 ? 1 : 0) | (maps.bg2 ? 2 : 0) | (maps.bg3 ? 4 : 0) | 16;
  return {
    cgram: g.cgram, bg1: layer(maps.bg1, g.bgTiles, true, o.bg1), bg2: layer(maps.bg2, g.bgTiles, true, o.bg2),
    bg3: layer(maps.bg3, g.bg3Tiles, false, o.bg3), bands: [{ y0: 0, y1: 224, bg1Tile16: true, main, sub: 0, math: 'none' }],
    objTiles: g.objTiles, oam: o.oam ?? [], backdrop: o.backdrop,
  };
}
export function obj(x: number, y: number, tile: number, pal: number, o: { big?: boolean; prio?: 0 | 1 | 2 | 3; h?: boolean; v?: boolean } = {}): ObjEntry {
  return { x, y, size: o.big ? 32 : 16, pal, prio: o.prio ?? 2, hflip: !!o.h, vflip: !!o.v, src: { tile } };
}

/** Só no navegador: um ImageData 256×224 reaproveitado, desenhado com putImageData. */
export class PpuCanvas {
  private img: ImageData | null = null;
  draw(ctx: CanvasRenderingContext2D, f: PpuFrame, dy = 0): void {
    this.img ??= new ImageData(256, 224);
    renderPpu(f, this.img);
    ctx.putImageData(this.img, 0, dy);
  }
}
```

  Complete com os números da pesquisa:
  - `export const MENU_GEO = { bgPattern: number[][] /* padrão do quebra-cabeça (palavras de BG) */, bgLayer: 'bg1' | 'bg2', rope: BoxParts /* palavras da corda */, ropeLayer: 'bg1' | 'bg2', scroll: { bg1: [hofs, vofs], bg2: [hofs, vofs] }, hand: { tile: number; pal: number }, titleHand: { tile: number; pal: number } }`, com os valores lidos das capturas. A mão dos menus é `$000` e a do título `$0C8` [MNT]. A paleta sai do OAM capturado.
  - `menuMaps(frame: Rect): SceneMaps`. Preenche a camada do fundo inteira com `bgPattern` (32×32). Converte o retângulo da moldura em casas pelo scroll: `c0 = ⌊(x0 + hofs)/16⌋`, `l0 = ⌊(y0 + vofs)/16⌋`, e o mesmo para `x1`/`y1`. Desenha `box(…, rope)` na camada da corda. A corda e o fundo podem estar na mesma camada: então o miolo do `box` fica sem `fill`, para o fundo continuar aparecendo.
  - `handCursor(x, y, title = false): ObjEntry = obj(x, y, geo.tile, geo.pal)`.

- [ ] **Step 6: Criar as ferramentas de pesquisa** (rodam com `node` 24, que tira os tipos sozinho; não importam nada de `src/`):
  - `web/scripts/screens/png.ts`: `export function encodePng(w: number, h: number, rgba: Uint8Array): Buffer`. É um PNG RGBA 8 bits com filtro 0 por linha, IDAT via `zlib.deflateSync`, CRC32 próprio (tabela de 256) e chunks `IHDR`, `IDAT` e `IEND`.
  - `web/scripts/screens/dump-capture.ts`. Uso: `SB4_CAPTURES=… OUT=<scratchpad> node scripts/screens/dump-capture.ts <cena> [linhaPaleta]`. Escreve em `OUT`: `<cena>-bg1.txt`, `-bg2.txt` e `-bg3.txt` (mapas em hex, 32 palavras por linha), `-oam.txt` (linhas de `parseOam`, com a lógica copiada), `-bg-tiles.png` (1024 tiles 8×8 4bpp em 32 colunas, na linha de paleta pedida, padrão 0), `-obj-tiles.png` (512 tiles, paleta OBJ 8 + linha) e `-bg3-tiles.png` (2bpp). **Nunca** escreve dentro do repositório: aborta se `OUT` estiver sob `web/` ou `docs/`.

- [ ] **Step 7: Pesquisar e preencher `MENU_GEO`.** Rode o `dump-capture` em `vsmode`, `ffa`, `players` e `rules`. Compare os mapas com os quadros `…/analise/extraido/montarias-e-telas/g_title2vs*.png` e ache o padrão do fundo (período, palavras), as palavras da corda e o scroll (o `.ppu` só guarda o último byte de cada escrita dupla de HOFS/VOFS; confirme pelo alinhamento da moldura medida). Rode `SB4_CAPTURES=… npx vitest run tests/screens/scene.test.ts` até os 4 casos passarem com ≥ 97 %.

- [ ] **Step 8: Rodar tudo** (`npx tsc --noEmit && npx vitest run`, com e sem `SB4_CAPTURES`).

- [ ] **Step 9: Commit**

```bash
git add -A web/src/render/screens-rom web/tests/screens/captures.ts web/tests/screens/scene.test.ts web/scripts/screens
git commit -m "feat(telas-rom): base das cenas (VRAM/CGRAM → PpuFrame), moldura dos menus por geometria medida e ferramentas de captura

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Contratos do fluxo da partida: timeline, MatchSession, config e telas-esqueleto

**Files:**
- Create: `web/src/game/timeline.ts`, `web/src/game/match-session.ts`, `web/tests/screens/timeline.test.ts`, `web/tests/screens/match-session.test.ts`, `web/tests/screens/config.test.ts`
- Create (esqueletos): `web/src/screens/scoreboard.ts`, `draw.ts`, `victory.ts`, `racer.ts`, `teams.ts`, `options.ts`
- Replace: `web/src/game/config.ts`
- Modify: `web/src/screens/battle.ts` (só a assinatura), `web/src/screens/stage.ts` (só a chamada de `battleScreen`), `web/src/main.ts` (só a linha do `?quick`)
- Delete: `web/tests/client/legacy/parse-config.test.ts`, `web/tests/client/legacy/config.test.ts`

**Possui:** todos os arquivos acima.

**Interfaces:**
- Consumes: `game/core-api.ts` (`newMatch`, `startRound`, `finishRoundInfo`, `createAi`, `matchRngState`, `defaultRules`, tipos); `DeviceId` (`input/input.ts`)
- Produces: `timeline.ts` (todos os tempos), `MatchSession` e as funções dela, `carry`/`resetCarry`, `GameConfig`, `configFromSetup`, `parseConfig`, `canStart`, `activeCount`, e os esqueletos com a assinatura final

- [ ] **Step 1: Escrever `web/tests/screens/timeline.test.ts`:**

```ts
import * as T from '../../src/game/timeline';

describe('tempos da spec §6 e decisões R4–R11, R20–R21, R28', () => {
  it('fase → partida (§6.7)', () => {
    expect(T.STAGE).toMatchObject({ musicAt: 48, titleHideFrom: 48, titleHideTo: 64, blinkFrom: 65, blinkTo: 207, steadyFrom: 208,
      steadyTo: 277, voiceAt: 208, fadeOutAt: 278, audioFadeAt: 310, bankAt: 511, battleMusicAt: 523, roundAt: 646 });
    expect(T.STAGE.fadeOutAt + 15 + T.STAGE_BLACK).toBe(T.STAGE.roundAt);
  });
  it('rolagem da fase: 8 px/f por 16 f, começando 1 f depois do botão', () => {
    expect([0, 1, 2, 15, 16, 17].map(T.stageScrollOffset)).toEqual([0, 8, 16, 120, 128, 128]);
  });
  it('"BATALHA!": pisca a cada frame de f65 a f207, fixo de f208 a f277', () => {
    expect([64, 65, 66, 67, 207, 208, 277, 278].map(T.battleTextVisible)).toEqual([false, true, false, true, true, true, true, false]);
  });
  it('título da fase sobe 2 px/f de f48 a f64', () => {
    expect([47, 48, 56, 64, 70].map(T.stageTitleDy)).toEqual([0, 0, -16, -32, -32]);
  });
  it('intro: 10 pretos, 15 de fade-in, depois 15', () => {
    expect(Array.from({ length: 27 }, (_, i) => T.introBrightness(i + 1)))
      .toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 15, 15]);
  });
  it('faixas: RÁPIDO!! e TEMPO ESGOTADO!', () => {
    expect([0, 10, 191].map(T.hurryX)).toEqual([256, 236, -126]);
    expect([T.hurryVisible(-1), T.hurryVisible(0), T.hurryVisible(191), T.hurryVisible(192)]).toEqual([false, true, true, false]);
    expect([0, 8, 16, 40].map(T.timeUpY)).toEqual([-16, 44, 104, 104]);
  });
  it('fim de rodada (R4–R6) e próxima rodada (R8)', () => {
    expect(T.WIN_END).toEqual({ black: 48, audioFadeAt: 0, crownAt: 15, bankAt: 16, musicAt: 57 });
    expect(T.DRAW_TIME_END).toEqual({ black: 151, audioFadeAt: 1, crownAt: 15, bankAt: 58, musicAt: 68 });
    expect(T.DRAW_DEAD_END).toEqual({ black: 48, audioFadeAt: 0, crownAt: 15, bankAt: 16, musicAt: 26 });
    expect(T.NEXT_ROUND).toEqual({ afterScore: 288, afterDraw: 385, bankAt: 31, musicAt: 43 });
  });
  it('placar (R7, R9) e giro da coroa: 32 quadros, 104 f', () => {
    expect(T.SCORE).toMatchObject({ spinAt: 4, skipFrom: 18, autoAt: 511, victoryMusicAt: 511, descentAt: 557, descentFrames: 128, descentSpeed: 2 });
    expect(T.CROWN_SPIN).toHaveLength(32);
    expect(T.CROWN_SPIN.reduce((a, b) => a + b, 0)).toBe(104);
    expect([0, 9, 10, 27, 103, 104, 500].map(T.crownSpinFrame)).toEqual([0, 9, 10, 18, 31, 31, 31]);
  });
  it('EMPATE (R21) e VITÓRIA', () => {
    expect(T.DRAW_SCENE).toEqual({ skipFrom: 18, growFrom: 34, growTo: 148, colorEvery: 8, voiceAt: 100 });
    expect([33, 34, 91, 148, 200].map(T.drawScale)).toEqual([0, 0, 0.5, 1, 1]);
    expect([148, 155, 156, 164, 172].map(T.drawColor)).toEqual([0, 0, 1, 2, 0]);
    expect(T.VICTORY).toEqual({ buttonsFrom: 557, textFrom: 693, textTo: 703, runFrom: 723, runTo: 763, confettiFrom: 763, jumpAt: 783, voiceAt: 795, outBlack: 123 });
  });
  it('título pisca 64/64; corrida (R20)', () => {
    expect([0, 63, 64, 127, 128].map(T.pressStartVisible)).toEqual([true, true, false, false, true]);
    expect(T.RACER).toEqual({ length: 4096, push: 24, maxSpeed: 64, drag: 1, timeout: 900, showPrize: 180 });
  });
});
```

- [ ] **Step 2: Escrever `web/tests/screens/config.test.ts`:**

```ts
import { configFromSetup, parseConfig, canStart, activeCount } from '../../src/game/config';

const setup = {
  mode: 'team' as const, slots: ['human', 'cpu', 'off', 'human', 'cpu'] as const, teams: [0, 1, 0, 1, 0],
  rules: { cpuLevel: 2 as const, matches: 4, timeIdx: 4, suddenDeath: true, badBomber: true, racer: false }, chars: [5, 4, 3, 2, 1], stage: 7,
};

describe('configuração da partida', () => {
  it('configFromSetup: regras, ativos, humanos, equipes, personagens, dispositivos e spawns aleatórios', () => {
    const c = configFromSetup(setup, true, ['kb0', 'gp0', 'none', 'kb1', 'gp1']);
    expect(c.rules).toMatchObject({ cpuLevel: 2, matches: 4, timeIdx: 4, suddenDeath: true, badBomber: true, racer: false,
      randomSpawns: true, mode: 'team', teams: [0, 1, 0, 1, 0], active: [true, true, false, true, true] });
    expect(c.humans).toEqual([true, false, false, true, false]);
    expect([c.stage, c.chars, c.devices, c.seed]).toEqual([7, [5, 4, 3, 2, 1], ['kb0', 'gp0', 'none', 'kb1', 'gp1'], null]);
  });
  it('parseConfig (?quick): padrões, spawns aleatórios desligados (original)', () => {
    const c = parseConfig('');
    expect([c.stage, c.rules.matches, c.rules.timeIdx, c.rules.randomSpawns, c.rules.mode]).toEqual([1, 3, 2, false, 'ffa']);
    expect(c.rules.active).toEqual([true, true, true, true, true]);
    expect(parseConfig('?spawns=1&seed=42&players=3&humans=1').rules.randomSpawns).toBe(true);
    const d = parseConfig('?seed=42&players=3&humans=1');
    expect([d.seed, d.rules.active, d.humans]).toEqual([42, [true, true, true, false, false], [true, false, false, false, false]]);
  });
  it('canStart exige 2 ativos (A15)', () => {
    expect(activeCount(['human', 'off', 'off', 'off', 'cpu'])).toBe(2);
    expect(canStart(['human', 'off', 'off', 'off', 'off'])).toBe(false);
    expect(canStart(['off', 'cpu', 'cpu', 'off', 'off'])).toBe(true);
  });
});
```

- [ ] **Step 3: Escrever `web/tests/screens/match-session.test.ts`:**

```ts
import { createMatchSession, beginRound, endRound, closeMatch, carry, resetCarry } from '../../src/game/match-session';
import { parseConfig } from '../../src/game/config';
import { crownsOf, matchRngState } from '../../src/game/core-api';
import { forceWin, runUntil, skipIntro, setCrowns } from './core-helpers';

beforeEach(() => resetCarry());

describe('MatchSession', () => {
  it('semente: ?seed, senão a que veio da partida anterior, senão $0012 (R23)', () => {
    expect(matchRngState(createMatchSession(parseConfig('')).match)).toBe(0x0012);
    carry.seed = 0x4321;
    expect(matchRngState(createMatchSession(parseConfig('')).match)).toBe(0x4321);
    expect(matchRngState(createMatchSession(parseConfig('?seed=7')).match)).toBe(7);
  });
  it('beginRound cria a rodada em intro e conta', () => {
    const ms = createMatchSession(parseConfig('?players=2'));
    const r = beginRound(ms);
    expect([r.phase, ms.roundNo, ms.round === r]).toEqual(['intro', 1, true]);
  });
  it('endRound: +1 coroa, vencedores; na meta, partida acabada e campeões', () => {
    const ms = createMatchSession(parseConfig('?players=2&matches=2'));
    let r = beginRound(ms); skipIntro(r); forceWin(r, 1); runUntil(r, x => x.phase === 'over');
    endRound(ms);
    expect([crownsOf(ms.match)[1], ms.lastWinners, ms.over, ms.champions]).toEqual([1, [1], false, []]);
    r = beginRound(ms); skipIntro(r); forceWin(r, 1); runUntil(r, x => x.phase === 'over');
    endRound(ms);
    expect([ms.over, ms.champions]).toEqual([true, [1]]);
  });
  it('closeMatch leva o RNG adiante e zera o prêmio do Racer', () => {
    const ms = createMatchSession(parseConfig('?players=2'));
    const r = beginRound(ms); skipIntro(r); forceWin(r, 0); runUntil(r, x => x.phase === 'over'); endRound(ms);
    carry.racerPrize = { slot: 0, prize: 8 };
    closeMatch(ms);
    expect(carry.seed).toBe(matchRngState(ms.match));
    expect(carry.racerPrize).toBeNull();
  });
  it('o prêmio só entra na partida com Corrida Bônus ligada e Todos contra Todos', () => {
    carry.racerPrize = { slot: 1, prize: 8 };
    expect(createMatchSession(parseConfig('?racer=1')).match.racerPrize).toEqual({ slot: 1, prize: 8 });
    expect(createMatchSession(parseConfig('')).match.racerPrize).toBeNull();
    expect(createMatchSession(parseConfig('?racer=1&mode=team')).match.racerPrize).toBeNull();
  });
  it('setCrowns funciona pela sessão (usado pelos testes das telas)', () => {
    const ms = createMatchSession(parseConfig('?players=2'));
    setCrowns(ms.match, 0, 2);
    expect(crownsOf(ms.match)[0]).toBe(2);
  });
});
```

- [ ] **Step 4: Rodar e ver falhar.**

- [ ] **Step 5: Criar `web/src/game/timeline.ts`:**

```ts
/** Tempos de tela do Battle (spec §6; "f" = frames de vídeo) e as decisões R4–R11, R20–R21 e R28 do plano 10. */
export const TITLE = { cursorX: 56, rowsY: [148, 164, 180], blink: 64 } as const;
export const STAGE = {
  repeatFirst: 36, repeatEvery: 21, scrollPx: 8, scrollFrames: 16,
  musicAt: 48, titleHideFrom: 48, titleHideTo: 64, blinkFrom: 65, blinkTo: 207, steadyFrom: 208, steadyTo: 277,
  voiceAt: 208, fadeOutAt: 278, audioFadeAt: 310, bankAt: 511, battleMusicAt: 523, roundAt: 646,
} as const;
/** Preto entre o fim do fade-out (f292) e a criação da rodada (f646). */
export const STAGE_BLACK = STAGE.roundAt - STAGE.fadeOutAt - 15;   // 353
export const INTRO = { black: 10, fade: 15, hold: 37 } as const;
export const BANNER = { hurryTop: 120, hurrySpeed: 2, hurryTicks: 192, timeUpFall: 16, timeUpY0: -16, timeUpY1: 104 } as const;
export const PAUSE = { quitHold: 60 } as const;
export const WIN_END = { black: 48, audioFadeAt: 0, crownAt: 15, bankAt: 16, musicAt: 57 } as const;
export const DRAW_TIME_END = { black: 151, audioFadeAt: 1, crownAt: 15, bankAt: 58, musicAt: 68 } as const;
export const DRAW_DEAD_END = { black: 48, audioFadeAt: 0, crownAt: 15, bankAt: 16, musicAt: 26 } as const;
export const NEXT_ROUND = { afterScore: 288, afterDraw: 385, bankAt: 31, musicAt: 43 } as const;
export const SCORE = {
  spinAt: 4, skipFrom: 18, autoAt: 511, victoryMusicAt: 511, descentAt: 557, descentFrames: 128, descentSpeed: 2,
  rowY0: 56, rowStep: 32, headX: 48, crownX: [80, 112, 144, 176, 208],
} as const;
/** Durações da animação C3:DA94 [spec §6.10]: 1×10, 2×9, 3×4, 4, 5×3, 6, 7, 8, 10, 14. */
export const CROWN_SPIN: readonly number[] = [...Array(10).fill(1), ...Array(9).fill(2), ...Array(4).fill(3), 4, 5, 5, 5, 6, 7, 8, 10, 14];
export const DRAW_SCENE = { skipFrom: 18, growFrom: 34, growTo: 148, colorEvery: 8, voiceAt: 100 } as const;
export const VICTORY = { buttonsFrom: 557, textFrom: 693, textTo: 703, runFrom: 723, runTo: 763, confettiFrom: 763, jumpAt: 783, voiceAt: 795, outBlack: 123 } as const;
export const RACER = { length: 4096, push: 24, maxSpeed: 64, drag: 1, timeout: 900, showPrize: 180 } as const;

export const pressStartVisible = (s: number): boolean => Math.floor(s / TITLE.blink) % 2 === 0;
export const stageScrollOffset = (f: number): number => Math.max(0, Math.min(STAGE.scrollPx * STAGE.scrollFrames, STAGE.scrollPx * f));
export function battleTextVisible(f: number): boolean {
  if (f >= STAGE.blinkFrom && f <= STAGE.blinkTo) return (f - STAGE.blinkFrom) % 2 === 0;
  return f >= STAGE.steadyFrom && f <= STAGE.steadyTo;
}
export function stageTitleDy(f: number): number {
  const d = Math.max(0, Math.min(f, STAGE.titleHideTo) - STAGE.titleHideFrom);
  return d === 0 ? 0 : -2 * d;   // evita -0 nos testes
}
/** Brilho do intro pelos passos já dados (1 = 1º passo). */
export const introBrightness = (steps: number): number => (steps <= INTRO.black ? 0 : Math.min(15, steps - INTRO.black));
export const hurryX = (t: number): number => 256 - BANNER.hurrySpeed * t;
export const hurryVisible = (t: number): boolean => t >= 0 && t < BANNER.hurryTicks;
export function timeUpY(t: number): number {
  const k = Math.max(0, Math.min(t, BANNER.timeUpFall));
  return Math.round(BANNER.timeUpY0 + ((BANNER.timeUpY1 - BANNER.timeUpY0) * k) / BANNER.timeUpFall);
}
/** Quadro da coroa girando `t` frames depois do início do giro (fica no último). */
export function crownSpinFrame(t: number): number {
  let acc = 0;
  for (let i = 0; i < CROWN_SPIN.length; i++) { acc += CROWN_SPIN[i]; if (t < acc) return i; }
  return CROWN_SPIN.length - 1;
}
export function drawScale(s: number): number {
  if (s <= DRAW_SCENE.growFrom) return 0;
  if (s >= DRAW_SCENE.growTo) return 1;
  return (s - DRAW_SCENE.growFrom) / (DRAW_SCENE.growTo - DRAW_SCENE.growFrom);
}
/** 0 vermelho, 1 amarelo, 2 verde; troca a cada 8 f depois do crescimento. */
export const drawColor = (s: number): number => (s < DRAW_SCENE.growTo ? 0 : Math.floor((s - DRAW_SCENE.growTo) / DRAW_SCENE.colorEvery) % 3);
```

- [ ] **Step 6: Substituir `web/src/game/config.ts`:**

```ts
import { defaultRules, type Rules } from './core-api';
import type { DeviceId } from '../input/input';

export type SlotKind = 'human' | 'cpu' | 'off';
/** Formato estrutural de `Setup` (app/settings.ts), para não depender da ordem de merge. */
export interface SetupLike {
  mode: 'ffa' | 'team'; slots: readonly SlotKind[]; teams: readonly number[];
  rules: { cpuLevel: 0 | 1 | 2; matches: number; timeIdx: number; suddenDeath: boolean; badBomber: boolean; racer: boolean };
  chars: readonly number[]; stage: number;
}
export interface GameConfig {
  rules: Rules; stage: number; chars: number[]; humans: boolean[]; devices: DeviceId[]; seed: number | null;
  /** Sem uso (R15); sai na T22. */
  names: string[];
}
const DEFAULT_DEVICES: DeviceId[] = ['kb0', 'kb1', 'gp0', 'gp1', 'gp2'];

export const activeCount = (slots: readonly SlotKind[]): number => slots.filter(k => k !== 'off').length;
export const canStart = (slots: readonly SlotKind[]): boolean => activeCount(slots) >= 2;

export function configFromSetup(setup: SetupLike, randomSpawns: boolean, devices: readonly DeviceId[], seed: number | null = null): GameConfig {
  const r = setup.rules;
  const rules: Rules = {
    ...defaultRules(), cpuLevel: r.cpuLevel, matches: r.matches, timeIdx: r.timeIdx, suddenDeath: r.suddenDeath,
    badBomber: r.badBomber, racer: r.racer, randomSpawns, mode: setup.mode, teams: [...setup.teams],
    active: setup.slots.map(k => k !== 'off'),
  };
  return { rules, stage: setup.stage, chars: [...setup.chars], humans: setup.slots.map(k => k === 'human'),
    devices: [...devices], seed, names: ['', '', '', '', ''] };
}

const int = (v: string | null, def: number, min: number, max: number): number => {
  const n = v === null ? NaN : Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
/** Partida rápida pela URL (?quick): stage, players, matches, time, level, mode, sd, bad, racer, spawns, chars, seed, humans. */
export function parseConfig(search: string): GameConfig {
  const q = new URLSearchParams(search);
  const players = int(q.get('players'), 5, 2, 5);
  const humansN = int(q.get('humans'), 5, 0, 5);
  const raw = (q.get('chars') ?? '').split(',').map(s => Number.parseInt(s, 10));
  const setup: SetupLike = {
    mode: q.get('mode') === 'team' ? 'team' : 'ffa',
    slots: [0, 1, 2, 3, 4].map(i => (i >= players ? 'off' : i < humansN ? 'human' : 'cpu')),
    teams: [0, 1, 0, 1, 0],
    rules: { cpuLevel: int(q.get('level'), 1, 0, 2) as 0 | 1 | 2, matches: int(q.get('matches'), 3, 1, 5), timeIdx: int(q.get('time'), 2, 0, 4),
      suddenDeath: q.get('sd') === '1', badBomber: q.get('bad') === '1', racer: q.get('racer') === '1' },
    chars: [0, 1, 2, 3, 4].map(i => (Number.isInteger(raw[i]) && raw[i] >= 0 && raw[i] <= 5 ? raw[i] : i)),
    stage: int(q.get('stage'), 1, 1, 10),
  };
  return configFromSetup(setup, q.get('spawns') === '1', DEFAULT_DEVICES, q.has('seed') ? int(q.get('seed'), 0, 0, 0xffff) : null);
}

/** Compatibilidade com as telas antigas até a onda 3; sai na T22. */
export function displayName(names: readonly string[], slot: number): string { return names[slot]?.trim() || `P${slot + 1}`; }
export function validateSetup(mode: 'ffa' | 'team', slots: readonly SlotKind[], teams: readonly number[]): string | null {
  const on = [0, 1, 2, 3, 4].filter(i => slots[i] !== 'off');
  if (on.length < 2) return 'PRECISA DE 2 JOGADORES';
  if (mode === 'team' && new Set(on.map(i => teams[i])).size < 2) return 'CADA TIME PRECISA DE 1 JOGADOR';
  return null;
}
```

  Se `app/settings.ts` exportar `SlotKind` (hoje exporta), mantenha o tipo local: os dois são iguais, e a T22 unifica.

- [ ] **Step 7: Criar `web/src/game/match-session.ts`:**

```ts
import { newMatch, startRound, finishRoundInfo, createAi, matchRngState, type MatchState, type RoundState, type AiState, type MatchCarry } from './core-api';
import type { GameConfig } from './config';

export interface MatchSession {
  cfg: GameConfig; match: MatchState; round: RoundState | null; ai: AiState;
  roundNo: number; lastWinners: number[]; champions: number[]; over: boolean;
}

/** Estado que atravessa partidas na sessão do navegador: RNG (§3.2) e prêmio da Corrida Bônus (§3.14). */
export const carry: MatchCarry = { seed: null, racerPrize: null };
export function resetCarry(): void { carry.seed = null; carry.racerPrize = null; }

export function createMatchSession(cfg: GameConfig): MatchSession {
  const seed = cfg.seed ?? carry.seed ?? 0x0012;
  const prize = cfg.rules.racer && cfg.rules.mode === 'ffa' ? carry.racerPrize : null;
  return { cfg, match: newMatch(cfg.rules, cfg.stage, seed, prize, cfg.chars), round: null, ai: createAi(),
    roundNo: 0, lastWinners: [], champions: [], over: false };
}
export function beginRound(ms: MatchSession): RoundState {
  ms.round = startRound(ms.match);
  ms.ai = createAi();
  ms.roundNo++;
  return ms.round;
}
/** Cue do 1º frame do preto depois do `over`: soma a coroa (§6.10) e decide o fim da partida. */
export function endRound(ms: MatchSession): void {
  if (!ms.round) return;
  const info = finishRoundInfo(ms.match, ms.round);
  ms.lastWinners = info.winners;
  ms.over = info.matchOver;
  ms.champions = info.champions;
}
/** Fim da partida (botão da VITÓRIA ou saída pela pausa): o RNG segue para a próxima. */
export function closeMatch(ms: MatchSession): void {
  carry.seed = matchRngState(ms.match);
  carry.racerPrize = null;
}
```

- [ ] **Step 8: Criar os esqueletos** (corpo mínimo e assinatura final; as tarefas da onda 3 trocam o corpo):

```ts
// web/src/screens/scoreboard.ts
import type { App, Screen } from '../app/app';
import type { SpriteBank } from '../render/sprite-bank';
import type { MatchSession } from '../game/match-session';
export function scoreboardScreen(_app: App, _ms: MatchSession): Screen { return { id: 'scoreboard', update() {}, draw() {} }; }
/** Desenha o placar com o relógio `s` deslocado `yOffset` px (a descida da vitória usa). */
export function drawScoreboard(_ctx: CanvasRenderingContext2D, _bank: SpriteBank, _ms: MatchSession, _s: number, _yOffset: number): void {}
```

  Os outros seguem o mesmo molde: `drawScreen(app, ms)` com id `'draw'` em `screens/draw.ts`; `victoryScreen(app, ms, startS)` com id `'victory'`; `racerScreen(app, ms)` com id `'racer'`; `teamsScreen(app)` com id `'teams'`; `optionsScreen(app)` com id `'options'`.

- [ ] **Step 9: Ajustar as assinaturas.**
  - `screens/battle.ts`: `export function battleScreen(app: App, ms: MatchSession): Screen & { readonly ms: MatchSession; readonly session: Session }`. O corpo antigo continua e só troca a criação para `createSession(ms.cfg, ms.cfg.seed ?? 0x0012, [0, 0, 0, 0, 0])`. A troca de verdade é da T12.
  - `screens/stage.ts`: a chamada vira `battleScreen(app, createMatchSession(configFromSetup(setup, (app.settings as { options?: { randomSpawns: boolean } }).options?.randomSpawns ?? false, app.settings.devices)))`.
  - `main.ts`: `battleScreen(app, createMatchSession(parseConfig(search)))` no `?quick`.

- [ ] **Step 10: Apagar** `tests/client/legacy/parse-config.test.ts` e `tests/client/legacy/config.test.ts`. Rodar `npx tsc --noEmit && npx vitest run` (verde) e commit:

```bash
git add -A web/src/game web/src/screens web/src/main.ts web/tests/screens/timeline.test.ts web/tests/screens/config.test.ts web/tests/screens/match-session.test.ts web/tests/client/legacy
git commit -m "feat(fluxo): timeline das telas, MatchSession com RNG entre partidas, config e esqueletos das telas de resultado

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Kit de menus (lista com repetição e SFX, fallback parado)

**Files:**
- Modify: `web/src/screens/menu.ts` (acrescenta `Menu`; o `MenuList` antigo fica até a T22), `web/src/screens/ui.ts` (acrescenta os pintores parados; os antigos ficam até a T22)
- Create: `web/tests/screens/menu-kit.test.ts`

**Possui:** `src/screens/menu.ts`, `src/screens/ui.ts`, `tests/screens/menu-kit.test.ts`.

**Interfaces:**
- Consumes: `Repeater`, `DIRS` (`input/repeat.ts`, T3). **Mesma onda:** para compilar sozinha, esta tarefa importa `Repeater` de `../input/repeat`. Se a T3 ainda não foi mesclada na worktree, crie o arquivo com o conteúdo **idêntico** ao do Step 5 da T3. O merge das duas versões iguais não conflita. `SFX`, `AudioSink` (`app/audio.ts` e `app/rom-api.ts`, T1/T2; a mesma regra vale para `SFX`: se faltar, use os literais `1, 2, 3`).
- Produces: `MenuRow`, `MenuEvent`, `Menu`, `drawStaticBackground`, `drawStaticCursor`, `drawFallbackFrame`, `FB_TONE` (cores do fallback por tom)

- [ ] **Step 1: Escrever `web/tests/screens/menu-kit.test.ts`:**

```ts
import { Menu, type MenuRow } from '../../src/screens/menu';
import { drawStaticBackground, drawStaticCursor, drawFallbackFrame } from '../../src/screens/ui';
import { Repeater } from '../../src/input/repeat';
import { BTN } from '../../src/game/core-api';
import { RecordingSink } from './helpers';

const rows = (n: number, extra: Partial<MenuRow>[] = []): MenuRow[] => Array.from({ length: n }, (_, i) => ({ id: `r${i}`, ...extra[i] }));
const step = (m: Menu, s: RecordingSink, held: number, edge = held) => m.update(held, edge, s);

describe('Menu (spec §6: volta, limites, SFX, repetição)', () => {
  it('↑/↓ dão a volta e pulam desativados; SFX $01 a cada movimento', () => {
    const s = new RecordingSink();
    const m = new Menu(rows(3, [{ disabled: true }]));
    expect(m.cursor).toBe(1);
    expect(step(m, s, BTN.DOWN)).toBe('moved'); step(m, s, 0);
    expect(m.cursor).toBe(2);
    step(m, s, BTN.DOWN); step(m, s, 0);
    expect(m.cursor).toBe(1);
    step(m, s, BTN.UP); step(m, s, 0);
    expect(m.cursor).toBe(2);
    expect(s.of('sfx').map(c => c.id)).toEqual([1, 1, 1]);
  });
  it('um só item ativo: ↑/↓ tocam $01 e o cursor fica (R31)', () => {
    const s = new RecordingSink();
    const m = new Menu(rows(3, [{}, { disabled: true }, { disabled: true }]));
    step(m, s, BTN.DOWN);
    expect([m.cursor, s.of('sfx').length]).toEqual([0, 1]);
  });
  it('←/→ mudam o valor; no limite devolve "limit" e o SFX toca igual', () => {
    const s = new RecordingSink();
    let v = 1;
    const m = new Menu([{ id: 'v', left: () => (v > 0 ? (v--, true) : false), right: () => (v < 2 ? (v++, true) : false) }]);
    expect(step(m, s, BTN.RIGHT)).toBe('changed'); step(m, s, 0);
    expect(step(m, s, BTN.RIGHT)).toBe('limit'); step(m, s, 0);
    expect(v).toBe(2);
    expect(s.of('sfx').map(c => c.id)).toEqual([1, 1]);
  });
  it('A ou START selecionam ($02); select → false recusa ($03); B volta ($03)', () => {
    const s = new RecordingSink();
    let ok = true; let n = 0;
    const m = new Menu([{ id: 'x', select: () => { n++; return ok; } }]);
    expect(step(m, s, BTN.A)).toBe('selected'); step(m, s, 0);
    expect(step(m, s, BTN.START)).toBe('selected'); step(m, s, 0);
    ok = false;
    expect(step(m, s, BTN.A)).toBe('refused'); step(m, s, 0);
    expect(step(m, s, BTN.B)).toBe('back');
    expect([n, ...s.of('sfx').map(c => c.id)]).toEqual([3, 2, 2, 3, 3]);
  });
  it('B tem prioridade sobre A no mesmo frame; X, Y, L, R e SELECT não fazem nada', () => {
    const s = new RecordingSink();
    const m = new Menu([{ id: 'x', select: () => true }]);
    expect(step(m, s, BTN.A | BTN.B)).toBe('back'); step(m, s, 0);
    expect(step(m, s, BTN.X | BTN.Y | BTN.L | BTN.R | BTN.SELECT)).toBeNull();
  });
  it('segurar ↓: move no frame 0, 20, 25, 30…', () => {
    const s = new RecordingSink();
    const m = new Menu(rows(10));
    for (let f = 0; f < 31; f++) m.update(BTN.DOWN, f === 0 ? BTN.DOWN : 0, s);
    expect(m.cursor).toBe(4);
  });
  it('repetição configurável e cursor inicial', () => {
    const m = new Menu(rows(10), { repeat: new Repeater(36, 21), cursor: 3 });
    const s = new RecordingSink();
    for (let f = 0; f < 58; f++) m.update(BTN.DOWN, f === 0 ? BTN.DOWN : 0, s);
    expect(m.cursor).toBe(6);
  });
});

describe('fallback parado (spec §6.14)', () => {
  const rec = () => {
    const calls: string[] = [];
    const ctx = { fillStyle: '', fillRect(x: number, y: number, w: number, h: number) { calls.push(`${this.fillStyle}:${x},${y},${w},${h}`); } };
    return { calls, ctx: ctx as unknown as CanvasRenderingContext2D };
  };
  it('fundo e cursor não dependem do tempo', () => {
    const a = rec(), b = rec();
    drawStaticBackground(a.ctx); drawStaticBackground(b.ctx);
    expect(a.calls).toEqual(b.calls);
    const c = rec();
    drawStaticCursor(c.ctx, 56, 80);
    expect(c.calls.every(k => k.includes(':56,') || k.includes(':57,') || k.includes(':58,') || k.includes(':59,'))).toBe(true);
  });
  it('moldura de fallback cobre o retângulo medido', () => {
    const r = rec();
    drawFallbackFrame(r.ctx, { x0: 7, y0: 51, x1: 248, y1: 186 });
    expect(r.calls.some(k => k.endsWith(':7,51,242,136'))).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Acrescentar a `web/src/screens/menu.ts`:**

```ts
import { Repeater, DIRS } from '../input/repeat';
import type { AudioSink } from '../app/rom-api';
import { SFX } from '../app/audio';

export interface MenuRow {
  id: string;
  disabled?: boolean;                 // cinza, pulado pelo cursor
  left?(): boolean;                   // false = já no limite (o SFX toca igual)
  right?(): boolean;
  select?(): boolean | void;          // false = recusado ($03)
}
export type MenuEvent = 'moved' | 'changed' | 'limit' | 'selected' | 'refused' | 'back' | null;

/** Lista vertical dos menus do original [MNT §B.0]: ↑/↓ com volta (repetição 20/5), ←/→ sem volta, A/START, B. */
export class Menu {
  cursor: number;
  private rep: Repeater;
  constructor(public rows: MenuRow[], o: { repeat?: Repeater; cursor?: number } = {}) {
    this.rep = o.repeat ?? new Repeater();
    const c = o.cursor ?? rows.findIndex(r => !r.disabled);
    this.cursor = Math.max(0, rows[c]?.disabled ? rows.findIndex(r => !r.disabled) : c);
  }
  /** `held`: segurados em qualquer controle; `pressed`: recém-apertados. */
  update(held: number, pressed: number, sink: AudioSink): MenuEvent {
    const pulse = this.rep.step(held & DIRS);
    const row = this.rows[this.cursor];
    if (pressed & 0x20 /* B */) { sink.sfx(SFX.back); return 'back'; }
    if (pressed & (0x10 | 0x80) /* A | START */) {
      if (!row.select || row.disabled) return null;
      if (row.select() === false) { sink.sfx(SFX.back); return 'refused'; }
      sink.sfx(SFX.confirm);
      return 'selected';
    }
    if (pulse & (1 | 2) /* UP | DOWN */) { this.move(pulse & 1 ? -1 : 1); sink.sfx(SFX.move); return 'moved'; }
    if (pulse & (4 | 8) /* LEFT | RIGHT */) {
      const f = pulse & 4 ? row.left : row.right;
      if (!f || row.disabled) return null;
      const ok = f.call(row);
      sink.sfx(SFX.move);
      return ok ? 'changed' : 'limit';
    }
    return null;
  }
  private move(d: number): void {
    const n = this.rows.length;
    for (let k = 1; k <= n; k++) {
      const i = (((this.cursor + d * k) % n) + n) % n;
      if (!this.rows[i].disabled) { this.cursor = i; return; }
    }
  }
}
```

(Troque os literais de bit por `BTN.*` importado de `../game/core-api`; os valores são os da §2.6.)

- [ ] **Step 4: Acrescentar a `web/src/screens/ui.ts`:**

```ts
/** Fundo do fallback, fixo (o xadrez atual sem deslizar; spec §6.14). */
export function drawStaticBackground(ctx: CanvasRenderingContext2D): void { drawBackground(ctx, 0); }
/** Cursor do fallback, parado (a setinha atual, sem balançar), com a ponta em (x+3, y+3) como a mão 16×16. */
export function drawStaticCursor(ctx: CanvasRenderingContext2D, x: number, y: number, color = COLORS.title): void {
  ctx.fillStyle = color;
  for (let i = 0; i < 4; i++) ctx.fillRect(x + i, y + 4 + i, 1, 7 - 2 * i);
}
/** Moldura do fallback no retângulo medido do original (px inclusivos). */
export function drawFallbackFrame(ctx: CanvasRenderingContext2D, r: { x0: number; y0: number; x1: number; y1: number }): void {
  drawPanel(ctx, r.x0, r.y0, r.x1 - r.x0 + 1, r.y1 - r.y0 + 1);
}
```

- [ ] **Step 5: Rodar tudo e commit**

```bash
git add -A web/src/screens/menu.ts web/src/screens/ui.ts web/tests/screens/menu-kit.test.ts
git commit -m "feat(menus): lista com volta, limites, SFX \$01/\$02/\$03 e repetição 20/5; fallback parado

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
## Onda 3 (telas, em paralelo)

**Receita comum das telas** (vale para T8–T15, T20 e T21):
- **Relógio da tela:** `s` começa em −1 e cada `update` faz `s++`. O 1º update, que é o 1º frame do fade-in quando a tela vem de uma transição, tem `s = 0`.
- **Música:** a tela chama `app.audio.ensureMenus(MUSIC.x)` **ao ser criada**. Com isso a música nova toca no f58 das trocas de menu (R3). O título usa `MUSIC.title`, e as telas de menu, de personagens e de fase usam `MUSIC.menus`.
- **Com ROM** (`romState.assets`): `sceneGfx(a, cena)`, os mapas pela `sceneMaps(a, cena, geometria)` (geometria da T5 ou própria), `sceneFrame(...)` desenhado com um `PpuCanvas` por tela, e por cima `drawText(...)` e os OBJ. **Sem ROM:** `drawStaticBackground`, `drawFallbackFrame(retângulo medido)`, `drawText(...)` nas **mesmas posições** e `drawStaticCursor(x, y)` no lugar da mão (spec §6.14).
- **Pesquisa de geometria:** mapas e OBJ que não vêm da T5 são medidos com `scripts/screens/dump-capture.ts` nas capturas da cena. Vão para o código como números (retângulos, padrões, listas `[x, y, tile, pal]` de OBJ), nunca como mapa copiado. Cada tarefa com ROM tem um teste `skipIf(!ASSETS || !captura)` que compara os mapas montados com os capturados (≥ 97 % fora dos textos) e os OBJ com o OAM capturado.
- Cada tarefa apaga os arquivos `tests/client/legacy/*` que substitui.

### Task 8: Título, VS e modo

**Files:**
- Replace: `web/src/screens/title.ts`, `web/src/screens/vs.ts`
- Create: `web/src/render/screens-rom/title.ts`, `web/src/render/screens-rom/vs.ts`, `web/tests/screens/title-vs.test.ts`
- Delete: `web/tests/client/legacy/title-modes.test.ts`

**Possui:** esses arquivos.

**Interfaces:**
- Consumes: `Menu` (T7), `FADE_FROM_TITLE`, `FADE_TO_TITLE`, `FADE_MENU` (T2), `MUSIC`, `SFX` (T2), `TITLE`, `pressStartVisible` (T6), `S` e `drawText` (T4), `menuMaps`, `handCursor`, `MENU_GEO`, `sceneGfx`, `sceneFrame` (T5), `optionsScreen` (esqueleto da T6; a T15 preenche), `playersScreen` (atual; a T9 troca)
- Produces: `titleScreen(app, o?: { cursor?: 0 | 1 | 2 }): Screen & { readonly cursor: number; pressStartVisible(): boolean }`, `vsModeScreen(app): Screen & { readonly cursor: number }`, `modeScreen(app): Screen & { readonly cursor: number }`, `buildTitleScene(a): { maps: SceneMaps; scroll: { bg1: [number, number]; bg2: [number, number] }; logo: ObjEntry[] }`, `TITLE_TEXT_RECTS`

**Regras (§6.2, §6.3, R3, R22, R31):**
- **Título:** linhas "JOGO NORMAL" (desativada, tom `gray`), "JOGO DE BATALHA" e "OPÇÕES". A mão fica em x = 56 e y = 148/164/180, com o tile do título. O texto começa em x = 72 (confirmar na captura `title`). O cursor inicial é 1. ↑/↓ dão a volta pela `Menu`. B, ←, → e os outros botões não fazem nada. A/START em "JOGO DE BATALHA": `$02` (pela `Menu`) e `app.transition(() => vsModeScreen(app), FADE_FROM_TITLE)`. Em "OPÇÕES": `$02` e `app.transition(() => optionsScreen(app), FADE_FROM_TITLE)`. "APERTE START!" aparece quando `pressStartVisible(s)` é verdadeiro, centrado em x = 128 e y = 200 (confirmar em `title.png`). Na criação: `ensureMenus(MUSIC.title)`.
- **Logo (A14):** OBJ do CAT `title`, montado pela lista de OAM medida na captura `title.oam` (`TITLE_LOGO: [x, y, tile, pal, big, h, v][]`). Sem animação de montagem. Sem ROM, desenhar o logo atual (coroa + "CROWN BLAST", como hoje).
- **VS:** título "Escolha o modo VS!" (`menuTitle`, centrado em x = 127, topo y = 47). Itens em x = 80 e y = 79/111/143, sendo "Campeonato" e "Bombermania" desativados (tom `gray`). Mão em (56, 80/112/144). Moldura (7,51)–(248,186). A → `FADE_MENU` → `modeScreen`. B → `$03` e `FADE_TO_TITLE` → `titleScreen(app, { cursor: 1 })`. Na criação: `ensureMenus(MUSIC.menus)`.
- **Modo:** mesma cena (`ffa`), moldura (7,67)–(248,170), itens "Todos contra Todos" / "Em Equipes" em x = 85 e y = 95/127, mão em (61, 96/128). O cursor inicial vem de `setup.mode`. A grava `setup.mode`, chama `app.save()` e faz `FADE_MENU` → `playersScreen`. B → `FADE_MENU` → `vsModeScreen`.

- [ ] **Step 1: Escrever o teste** `web/tests/screens/title-vs.test.ts`:

```ts
import { titleScreen } from '../../src/screens/title';
import { vsModeScreen, modeScreen } from '../../src/screens/vs';
import { buildTitleScene, TITLE_TEXT_RECTS } from '../../src/render/screens-rom/title';
import { BTN } from '../../src/game/core-api';
import { FADE_OUT_2, FADE_OUT_12 } from '../../src/app/fade';
import { mkApp, press, tap, idle, settle, brightnessTrace } from './helpers';
import { ASSETS } from './rom';
import { loadCapture, capturedMap, parseOam, mapMatch } from './captures';

type Title = ReturnType<typeof titleScreen>;
const calls = (sink: { since(t: number): { t: number; op: string; id?: number }[] }, t0: number) => sink.since(t0).map(c => [c.t, c.op, c.id]);

describe('título (§6.2, R22)', () => {
  it('ao entrar: banco $30 e música $01; cursor em "Jogo de Batalha"', () => {
    const { app, sink } = mkApp();
    app.go(titleScreen(app));
    expect(sink.calls.map(c => [c.op, c.id])).toEqual([['bank', 0x30], ['music', 0x01]]);
    expect((app.screen as Title).cursor).toBe(1);
  });
  it('↑/↓ com volta, pulando "Jogo Normal"; SFX $01', () => {
    const { app, sink } = mkApp();
    const t = titleScreen(app); app.go(t); sink.clear();
    press(app, BTN.DOWN); expect(t.cursor).toBe(2);
    press(app, BTN.DOWN); expect(t.cursor).toBe(1);
    press(app, BTN.UP); expect(t.cursor).toBe(2);
    expect(sink.of('sfx').map(c => c.id)).toEqual([1, 1, 1]);
  });
  it('B, ←, →, X, Y, L, R e SELECT não fazem nada', () => {
    const { app, sink } = mkApp();
    const t = titleScreen(app); app.go(t); sink.clear();
    for (const b of [BTN.B, BTN.LEFT, BTN.RIGHT, BTN.X, BTN.Y, BTN.L, BTN.R, BTN.SELECT]) press(app, b);
    expect([t.cursor, sink.calls.length, app.inTransition]).toEqual([1, 0, false]);
  });
  it('A em "Jogo de Batalha": $02, saída de 2 f por passo, VS no f58 com a música $12', () => {
    const { app, sink } = mkApp();
    app.go(titleScreen(app)); sink.clear();
    tap(app, BTN.A);
    const t0 = app.tick;
    expect(app.brightness()).toBe(14);
    expect(brightnessTrace(app, 28)).toEqual(FADE_OUT_2.slice(1));
    settle(app);
    expect(app.screen.id).toBe('vs');
    expect(calls(sink, t0)).toEqual([[0, 'sfx', 2], [58, 'music', 0x12]]);
  });
  it('START em "Opções" abre as opções sem trocar a música', () => {
    const { app, sink } = mkApp();
    app.go(titleScreen(app)); press(app, BTN.DOWN); sink.clear();
    tap(app, BTN.START); settle(app);
    expect(app.screen.id).toBe('options');
    expect(sink.of('music')).toEqual([]);
  });
  it('"APERTE START!" pisca 64 f aceso / 64 f apagado', () => {
    const { app } = mkApp();
    const t = titleScreen(app); app.go(t);
    idle(app, 1); expect(t.pressStartVisible()).toBe(true);
    idle(app, 64); expect(t.pressStartVisible()).toBe(false);
    idle(app, 64); expect(t.pressStartVisible()).toBe(true);
  });
  it('cursor inicial configurável (Opções → título volta em "Opções")', () => {
    const { app } = mkApp();
    app.go(titleScreen(app, { cursor: 2 }));
    expect((app.screen as Title).cursor).toBe(2);
  });
});

describe('VS e modo (§6.3, R31)', () => {
  it('VS: só "Battle Royale" é selecionável; ↓ toca $01 e o cursor fica', () => {
    const { app, sink } = mkApp();
    const v = vsModeScreen(app); app.go(v); sink.clear();
    press(app, BTN.DOWN);
    expect([v.cursor, sink.of('sfx').map(c => c.id)]).toEqual([0, [1]]);
  });
  it('VS → B: $03, saída de 12 f, título com cursor em "Jogo de Batalha" e música $01 no f58', () => {
    const { app, sink } = mkApp();
    app.go(vsModeScreen(app)); sink.clear();
    tap(app, BTN.B);
    const t0 = app.tick;
    expect(brightnessTrace(app, 11)).toEqual(FADE_OUT_12.slice(1));
    settle(app);
    expect([app.screen.id, (app.screen as Title).cursor]).toEqual(['title', 1]);
    expect(calls(sink, t0)).toEqual([[0, 'sfx', 3], [58, 'music', 0x01]]);
  });
  it('VS → A → modo, que lembra "Em Equipes"; A grava o modo e vai a jogadores', () => {
    const { app, saves } = mkApp();
    app.settings.setup.mode = 'team';
    app.go(vsModeScreen(app));
    press(app, BTN.A); settle(app);
    expect([app.screen.id, (app.screen as ReturnType<typeof modeScreen>).cursor]).toEqual(['mode', 1]);
    press(app, BTN.UP); press(app, BTN.A); settle(app);
    expect([app.screen.id, app.settings.setup.mode]).toEqual(['players', 'ffa']);
    expect(saves()).toBeGreaterThan(0);
  });
  it('modo → B volta ao VS com $03', () => {
    const { app, sink } = mkApp();
    app.go(modeScreen(app)); sink.clear();
    press(app, BTN.B); settle(app);
    expect([app.screen.id, sink.of('sfx')[0].id]).toEqual(['vs', 3]);
  });
});

describe.skipIf(!ASSETS || !loadCapture('title'))('título com ROM × captura', () => {
  it('BG ≥ 97 % fora dos textos; cada OBJ do logo existe no OAM capturado', () => {
    const cap = loadCapture('title')!;
    const sc = buildTitleScene(ASSETS!);
    for (const [layer, addr] of [['bg1', 0x4000], ['bg2', 0x4400]] as const) {
      const m = sc.maps[layer];
      if (m) expect(mapMatch(m, capturedMap(cap, addr), TITLE_TEXT_RECTS, ...sc.scroll[layer]), layer).toBeGreaterThanOrEqual(0.97);
    }
    const rows = parseOam(cap.oam);
    for (const o of sc.logo) {
      const tile = (o.src as { tile: number }).tile;
      expect(rows.some(r => r.x === o.x && r.y === o.y && r.tile === tile && r.pal === o.pal), `OBJ ${o.x},${o.y}`).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** `title.ts` e `vs.ts` com a `Menu` (`update(inp.any, inp.pressedAny, app.audio)`) e as regras acima. Os desativados são `disabled: true`. `select()` chama `app.transition(...)`. O `'back'` do VS chama a transição para o título, e o do título é ignorado: o título não tem `onBack`, e a `Menu` devolve `'back'` com SFX, então o título **não** passa B para a `Menu` (filtre com `pressed & ~BTN.B`).
- [ ] **Step 4: Pesquisar e implementar `render/screens-rom/title.ts` e `vs.ts`.** Rode `dump-capture` em `title`, `vsmode` e `ffa`. A partir da captura `title`, monte `TITLE_LOGO` com as linhas do OAM que formam o logo (excluindo a mão) e a geometria dos BG do título. Defina `TITLE_TEXT_RECTS`: a área dos itens (x 64–200, y 144–196) e a de "PUSH START BUTTON!", medida em `title.png`. `vs.ts` usa `menuMaps` com as molduras das regras.
- [ ] **Step 5: Rodar tudo** (com e sem `SB4_ROM`/`SB4_CAPTURES`) e **apagar** `tests/client/legacy/title-modes.test.ts`.
- [ ] **Step 6: Commit** — `feat(telas): título, VS e modo com fades do original, mão parada, SFX e cena da ROM`.

---

### Task 9: Jogadores e regras

**Files:**
- Replace: `web/src/screens/players.ts`, `web/src/screens/rules.ts`
- Create: `web/src/render/screens-rom/players.ts`, `web/src/render/screens-rom/rules.ts`, `web/tests/screens/players-rules.test.ts`
- Delete: `web/tests/client/legacy/players.test.ts`, `web/tests/client/legacy/rules.test.ts`

**Possui:** esses arquivos.

**Interfaces:**
- Consumes: `Menu` (T7), `FADE_MENU` (T2), `canStart` (T6), `carry` (T6), `S`, `drawText` (T4), `menuMaps`, `handCursor` (T5), `modeScreen` (T8), `charactersScreen` (atual; a T10 troca)
- Produces: `playersScreen(app): Screen & { readonly cursor: number; value(i: number): { text: string; tone: Tone } }`, `rulesScreen(app): Screen & { readonly cursor: number; values(): string[] }`

**Regras (§6.4, §6.5, A15):**
- **Jogadores:** moldura (7,19)–(248,218), título "Defina os jogadores!". Rótulos `S.players.row[i]` em x = 48, y = 47 + 32·i. Valor em x = 160 (tons: Humano `green`, CPU `red`, Nenhum `blue`). Mão em (24, 48 + 32·i). A ordem é `KINDS = ['human', 'cpu', 'off']`: ← avança o índice e → recua, os dois limitados (`left`/`right` devolvem `false` no limite). Cada mudança chama `app.save()`. ↑/↓ dão a volta. A/START em qualquer linha: com `canStart(slots)`, `$02` e `FADE_MENU` → regras. Senão, `select()` devolve `false` (a `Menu` toca `$03`) e a tela não avança. B → `FADE_MENU` → `modeScreen`.
- **Regras:** moldura (7,27)–(248,210), título "Configure as regras!". Seis linhas em y = 55 + 24·i, rótulos em x = 32, valor alinhado à direita em x = 232 e mão em (16, 56 + 24·i). Valores: `cpuLevel` 0..2 (Fraco/Normal/Forte), `matches` 1..5, `timeIdx` 0..4 (`S.rules.time`), e `suddenDeath`, `badBomber` e `racer` (← = Não, → = Sim). Nenhum dá a volta. Ligar `racer` faz `carry.racerPrize = null` (§3.14). Cada mudança chama `app.save()`. A/START → `FADE_MENU` → personagens. B → `FADE_MENU` → jogadores.

- [ ] **Step 1: Escrever o teste** `web/tests/screens/players-rules.test.ts`:

```ts
import { playersScreen } from '../../src/screens/players';
import { rulesScreen } from '../../src/screens/rules';
import { carry, resetCarry } from '../../src/game/match-session';
import { BTN } from '../../src/game/core-api';
import { mkApp, press, settle } from './helpers';

beforeEach(() => resetCarry());

describe('jogadores (§6.4, A15)', () => {
  it('← vai de Humano a CPU a Nenhum e para; → volta; $01 mesmo no limite; grava', () => {
    const { app, sink, saves } = mkApp();
    const s = app.settings.setup;
    app.go(playersScreen(app)); sink.clear();
    press(app, BTN.LEFT); expect(s.slots[0]).toBe('cpu');
    press(app, BTN.LEFT); expect(s.slots[0]).toBe('off');
    press(app, BTN.LEFT); expect(s.slots[0]).toBe('off');
    press(app, BTN.RIGHT); press(app, BTN.RIGHT); press(app, BTN.RIGHT);
    expect(s.slots[0]).toBe('human');
    expect(sink.of('sfx').map(c => c.id)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(saves()).toBeGreaterThanOrEqual(4);
  });
  it('↑/↓ dão a volta nas 5 linhas', () => {
    const { app } = mkApp();
    const p = playersScreen(app); app.go(p);
    press(app, BTN.UP); expect(p.cursor).toBe(4);
    press(app, BTN.DOWN); expect(p.cursor).toBe(0);
  });
  it('valores e tons', () => {
    const { app } = mkApp();
    app.settings.setup.slots = ['human', 'cpu', 'off', 'cpu', 'cpu'];
    const p = playersScreen(app); app.go(p);
    expect([0, 1, 2].map(i => p.value(i))).toEqual([{ text: 'Humano', tone: 'green' }, { text: 'CPU', tone: 'red' }, { text: 'Nenhum', tone: 'blue' }]);
  });
  it('A ou START em qualquer linha → regras com $02', () => {
    const { app, sink } = mkApp();
    app.go(playersScreen(app)); press(app, BTN.DOWN); press(app, BTN.DOWN); sink.clear();
    press(app, BTN.START); settle(app);
    expect([app.screen.id, sink.of('sfx')[0].id]).toEqual(['rules', 2]);
  });
  it('menos de 2 ativos: A toca $03 e não avança', () => {
    const { app, sink } = mkApp();
    app.settings.setup.slots = ['human', 'off', 'off', 'off', 'off'];
    app.go(playersScreen(app)); sink.clear();
    press(app, BTN.A);
    expect([app.inTransition, app.screen.id, sink.of('sfx')[0].id]).toEqual([false, 'players', 3]);
  });
  it('B → modo com $03', () => {
    const { app, sink } = mkApp();
    app.go(playersScreen(app)); sink.clear();
    press(app, BTN.B); settle(app);
    expect([app.screen.id, sink.of('sfx')[0].id]).toEqual(['mode', 3]);
  });
});

describe('regras (§6.5)', () => {
  it('padrões: Normal, 3, 3:00, Não, Não, Não', () => {
    const { app } = mkApp();
    const r = rulesScreen(app); app.go(r);
    expect(r.values()).toEqual(['Normal', '3', '3:00', 'Não', 'Não', 'Não']);
  });
  it('←/→ param nos limites (sem volta) e tocam $01 sempre', () => {
    const { app, sink } = mkApp();
    const r = rulesScreen(app); app.go(r); sink.clear();
    press(app, BTN.DOWN);
    for (let k = 0; k < 3; k++) press(app, BTN.RIGHT);
    expect(r.values()[1]).toBe('5');
    press(app, BTN.DOWN);
    for (let k = 0; k < 3; k++) press(app, BTN.RIGHT);
    expect(r.values()[2]).toBe('∞');
    press(app, BTN.DOWN); press(app, BTN.LEFT);
    expect(r.values()[3]).toBe('Não');
    press(app, BTN.RIGHT); press(app, BTN.RIGHT);
    expect(r.values()[3]).toBe('Sim');
    expect(sink.of('sfx').filter(c => c.id === 1)).toHaveLength(12);
  });
  it('ligar a Corrida Bônus zera o prêmio guardado (§3.14)', () => {
    const { app } = mkApp();
    carry.racerPrize = { slot: 0, prize: 8 };
    const r = rulesScreen(app); app.go(r);
    for (let k = 0; k < 5; k++) press(app, BTN.DOWN);
    press(app, BTN.RIGHT);
    expect([r.values()[5], carry.racerPrize]).toEqual(['Sim', null]);
    expect(app.settings.setup.rules.racer).toBe(true);
  });
  it('A → personagens; B → jogadores', () => {
    const a = mkApp();
    a.app.go(rulesScreen(a.app)); press(a.app, BTN.A); settle(a.app);
    expect(a.app.screen.id).toBe('characters');
    const b = mkApp();
    b.app.go(rulesScreen(b.app)); press(b.app, BTN.B); settle(b.app);
    expect(b.app.screen.id).toBe('players');
  });
});
```

(12 = 3 movimentos ↓ + 3 no Coroas + 3 no Tempo + 3 na Morte Súbita, contando os do limite.)

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** as duas telas com a `Menu` e as regras acima, e os desenhos ROM/fallback (`screens-rom/players.ts` e `rules.ts` com `menuMaps` da T5; o texto por `drawText`).
- [ ] **Step 4: Teste com captura.** Acrescentar ao arquivo de teste um `describe.skipIf(!ASSETS)` que desenha o `PpuFrame` de cada tela, via `buildPlayersScene(ASSETS, setup)` e `buildRulesScene(ASSETS)`, e confere que a mão sai com `MENU_GEO.hand` nas posições da regra.
- [ ] **Step 5: Rodar tudo, apagar** os dois `legacy` e **commit** — `feat(telas): jogadores e regras do original (sem volta nos valores, A em qualquer linha, A15)`.

---

### Task 10: Personagens e equipes

**Files:**
- Replace: `web/src/screens/characters.ts`, `web/src/screens/teams.ts` (esqueleto da T6)
- Create: `web/src/render/screens-rom/charsel.ts`, `web/src/render/screens-rom/teams.ts`, `web/tests/screens/characters-teams.test.ts`
- Delete: `web/tests/client/legacy/characters.test.ts`

**Possui:** esses arquivos.

**Interfaces:**
- Consumes: `Repeater` (T3), `FADE_MENU` (T2), `SFX`, `MUSIC` (T2), `S`, `drawText` (T4), `sceneGfx`, `sceneFrame`, `obj`, `PpuCanvas` (T5), `rulesScreen` (T9), `stageScreen` (T11)
- Produces: `charactersScreen(app): Screen & { charOf(i: number): number; readonly confirmed: readonly boolean[]; readonly controlling: number | null; readonly controller: number | null }` e `teamsScreen(app): Screen & { sideOf(i: number): 0 | 1; readonly confirmed: readonly boolean[]; readonly controlling: number | null }`

**Regras (§6.6, R13, R14, R32):**
- Slots ativos = `setup.slots[i] !== 'off'`. **Escolhem sozinhos** os humanos cujo `devices[i] !== 'none'`. O **controlador** é o primeiro deles, ou `null` se não houver nenhum. A **fila** tem os outros ativos (CPUs e humanos sem dispositivo), em ordem de slot.
- Cada humano que escolhe sozinho lê `inp.pads[i]` / `inp.pressed[i]` com um `Repeater(20, 5)` próprio. ←/→ dão a volta nas 3 colunas (`col = c % 3`) e ↑/↓ trocam a linha (`c = ((row + 1) % 2)·3 + col`). Cada movimento toca `$01`. A ou START confirma (`$02`) e o cursor some.
- Depois de o controlador confirmar, `controlling` = 1º da fila ainda não confirmado. As entradas do controlador passam a mover e confirmar esse slot. Sem controlador, `controlling` começa no 1º da fila e **qualquer** controle (`inp.any`/`inp.pressedAny`) o controla.
- Quando todos os ativos confirmam: grava `setup.chars` e chama `app.save()`. Vai para `teamsScreen` (Em Equipes) ou `stageScreen` com `FADE_MENU`, disparado no mesmo frame do último A.
- B de **qualquer** controle (`inp.pressedAny & B`), a qualquer momento: `$03` e `FADE_MENU` → `rulesScreen`.
- ROM: cena `charsel`. Retratos na coluna esquerda (x ≈ 24–56, y 36 + 32·i), grade nas colunas x = 80/128/176 e linhas y = 88/136, cursores "[ ]" com etiqueta nP na cor do jogador (OBJ do CAT `charsel`: `$CE:53D7`, `$CE:5BBB`, `$CE:60F5`). Tudo medido em `charsel.oam` e na geometria da captura. Fallback: a moldura (27,35)–(224,188), `bank.bomber(k, 2, 0)` 32×40 na grade, `bank.head(c)` na coluna e cantos "[ ]" desenhados com `fillRect` na cor do jogador, mais a etiqueta nP (`ascii8`).
- **Equipes (R14):** `sideOf(i) = setup.teams[i]`. ← põe 0 e → põe 1 (`$01`), com o mesmo esquema de escolha sozinho/fila/controlador. O último A com uma equipe vazia toca `$03` e **não** confirma aquela vaga. Com as duas equipes ocupadas: grava e `FADE_MENU` → `stageScreen`. B de qualquer controle → `FADE_MENU` → `charactersScreen`. Desenho: cena `charsel` (ROM) com retratos em x = 16, y = 32 + 32·slot, marcador em x = 64 ou 176 e "VS" (`menuItem`) centrado em (128, 96). Título "Escolha as equipes!".

- [ ] **Step 1: Escrever o teste** `web/tests/screens/characters-teams.test.ts`:

```ts
import { charactersScreen } from '../../src/screens/characters';
import { teamsScreen } from '../../src/screens/teams';
import { BTN } from '../../src/game/core-api';
import { mkApp, press, hold, settle } from './helpers';

describe('personagens (§6.6, R13, R32)', () => {
  it('cada humano move o próprio cursor: ←/→ com volta nas 3 colunas, ↑/↓ trocam a linha', () => {
    const { app } = mkApp();
    const c = charactersScreen(app); app.go(c);
    press(app, BTN.LEFT, 0); expect(c.charOf(0)).toBe(2);
    press(app, BTN.DOWN, 0); expect(c.charOf(0)).toBe(5);
    press(app, BTN.RIGHT, 1); expect(c.charOf(1)).toBe(2);
    press(app, BTN.UP, 1); expect(c.charOf(1)).toBe(5);          // dois no mesmo personagem
  });
  it('A confirma ($02); o P1 escolhe as CPUs em ordem depois do próprio; o último A leva à fase', () => {
    const { app, sink } = mkApp();
    const c = charactersScreen(app); app.go(c); sink.clear();
    press(app, BTN.A, 1);
    expect(c.confirmed).toEqual([false, true, false, false, false]);
    expect(c.controlling).toBeNull();
    press(app, BTN.A, 0);
    expect([c.controller, c.controlling]).toEqual([0, 2]);
    press(app, BTN.RIGHT, 1);                                    // P2 já confirmou: não mexe em nada
    press(app, BTN.RIGHT, 0); expect(c.charOf(2)).toBe(0);
    press(app, BTN.A, 0); expect(c.controlling).toBe(3);
    press(app, BTN.A, 0); press(app, BTN.A, 0);
    expect(app.inTransition).toBe(true);
    settle(app);
    expect(app.screen.id).toBe('stage');
    expect(sink.of('sfx').filter(x => x.id === 2)).toHaveLength(5);
    expect(app.settings.setup.chars).toEqual([0, 1, 0, 3, 4]);
  });
  it('B de qualquer controle, mesmo depois de confirmar, volta às regras com $03', () => {
    const { app, sink } = mkApp();
    app.go(charactersScreen(app));
    press(app, BTN.A, 0); sink.clear();
    press(app, BTN.B); settle(app);
    expect([app.screen.id, sink.of('sfx')[0].id]).toEqual(['rules', 3]);
  });
  it('humano sem dispositivo entra na fila do P1', () => {
    const { app } = mkApp();
    app.settings.devices[1] = 'none';
    const c = charactersScreen(app); app.go(c);
    press(app, BTN.A, 0);
    expect(c.controlling).toBe(1);
  });
  it('sem humano com dispositivo, qualquer controle escolhe por todos', () => {
    const { app } = mkApp();
    app.settings.setup.slots = ['cpu', 'cpu', 'off', 'cpu', 'off'];
    const c = charactersScreen(app); app.go(c);
    expect([c.controller, c.controlling]).toEqual([null, 0]);
    press(app, BTN.RIGHT); expect(c.charOf(0)).toBe(1);
    press(app, BTN.A); press(app, BTN.A); press(app, BTN.A);
    settle(app);
    expect(app.screen.id).toBe('stage');
  });
  it('Em Equipes: depois dos personagens vem "Escolha as equipes!"', () => {
    const { app } = mkApp();
    app.settings.setup.mode = 'team';
    app.go(charactersScreen(app));
    press(app, BTN.A, 1); for (let k = 0; k < 4; k++) press(app, BTN.A, 0);
    settle(app);
    expect(app.screen.id).toBe('teams');
  });
  it('repetição 20/5 pelo direcional do próprio jogador', () => {
    const { app } = mkApp();
    const c = charactersScreen(app); app.go(c);
    hold(app, BTN.RIGHT, 21, 0);                                 // pulsos nos frames 0 e 20
    expect(c.charOf(0)).toBe(2);
  });
});

describe('equipes (A1, R14)', () => {
  const teamApp = () => {
    const env = mkApp();
    Object.assign(env.app.settings.setup, { mode: 'team', slots: ['human', 'human', 'cpu', 'cpu', 'off'], teams: [0, 1, 0, 1, 0] });
    const t = teamsScreen(env.app); env.app.go(t); env.sink.clear();
    return { ...env, t };
  };
  it('cada humano escolhe o lado com ←/→ ($01)', () => {
    const { app, t, sink } = teamApp();
    press(app, BTN.RIGHT, 0); expect(t.sideOf(0)).toBe(1);
    press(app, BTN.LEFT, 1); expect(t.sideOf(1)).toBe(0);
    expect(sink.of('sfx').map(c => c.id)).toEqual([1, 1]);
  });
  it('o P1 decide as CPUs depois de confirmar; equipes válidas → fase', () => {
    const { app, t } = teamApp();
    press(app, BTN.A, 1); press(app, BTN.A, 0);
    expect(t.controlling).toBe(2);
    press(app, BTN.A, 0); press(app, BTN.A, 0);
    settle(app);
    expect(app.screen.id).toBe('stage');
    expect(app.settings.setup.teams.slice(0, 4)).toEqual([0, 1, 0, 1]);
  });
  it('último A com uma equipe vazia: $03 e a vaga continua sem confirmar', () => {
    const { app, t, sink } = teamApp();
    press(app, BTN.LEFT, 1); press(app, BTN.A, 1); press(app, BTN.A, 0);
    press(app, BTN.LEFT, 0); press(app, BTN.A, 0);               // CPU 2 → equipe 0
    press(app, BTN.LEFT, 0); sink.clear(); press(app, BTN.A, 0); // CPU 3 → equipe 0: todos na 0
    expect([t.confirmed[3], app.inTransition, sink.of('sfx')[0].id]).toEqual([false, false, 3]);
    press(app, BTN.RIGHT, 0); press(app, BTN.A, 0);
    expect(app.inTransition).toBe(true);
  });
  it('B de qualquer controle volta aos personagens', () => {
    const { app } = teamApp();
    press(app, BTN.B); settle(app);
    expect(app.screen.id).toBe('characters');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** as duas telas conforme as regras e os desenhos ROM/fallback. A geometria e o OAM vêm de `charsel` (`dump-capture`), com um teste `skipIf` comparando o mapa montado com o capturado (≥ 97 % fora do título e da grade).
- [ ] **Step 4: Rodar tudo, apagar** `legacy/characters.test.ts` e **commit** — `feat(telas): personagens simultâneos, P1 escolhe as CPUs, B de qualquer um volta; tela de equipes (A1)`.

---

### Task 11: Seleção de fase e sequência "BATALHA!"

**Files:**
- Replace: `web/src/screens/stage.ts`
- Create: `web/src/render/screens-rom/stagesel.ts`, `web/tests/screens/stage.test.ts`
- Delete: `web/tests/client/legacy/stage-battle.test.ts` (a T12 também apaga; ver T1)

**Possui:** esses arquivos.

**Interfaces:**
- Consumes: `Repeater` (T3), `STAGE`, `STAGE_BLACK`, `stageScrollOffset`, `battleTextVisible`, `stageTitleDy` (T6), `FADE_OUT_1`, `FADE_MENU` (T2), `MUSIC`, `VOICE`, `BANK`, `SFX` (T2), `createMatchSession`, `configFromSetup`, `canStart` (T6), `battleScreen` (T12; esqueleto da T6), `charactersScreen`, `teamsScreen` (T10), `S`, `drawText` (T4), cena `stagesel` (T5)
- Produces: `stageScreen(app): Screen & { readonly stage: number; scroll(): number; readonly seqF: number; battleVisible(): boolean; titleDy(): number }`

**Regras (§6.7, R11, R12, R29):**
- `stage` = `setup.stage`. ←/→ vêm de `Repeater(36, 21)` sobre `inp.any`, e o `step` é chamado **todo frame**. Um pulso com a faixa parada começa a rolagem: `dir = ±1`, `scrollT = 0`, `$01`. Durante a rolagem, `scrollT++` a cada frame. Em `scrollT = 16`, `stage = volta(stage + dir)` (1 ↔ 10), `app.save()` e fim. Pulsos, A e B no meio da rolagem são ignorados. `scroll()` = `0` parado, senão `−dir · stageScrollOffset(scrollT)` (sem −0). ↑/↓ não fazem nada.
- A/START com a faixa parada: `$02` e `seqF = 0`. Cada frame seguinte faz `seqF++`. Em `STAGE.musicAt` (48): `music($13)`. Em `voiceAt` (208): `voice($07)`. Em `fadeOutAt` (278): `app.transition(() => battleScreen(app, createMatchSession(cfg)), { out: FADE_OUT_1, black: STAGE_BLACK, in: [], cues: [{ at: 32, fade }, { at: 233, bank($2F) }, { at: 245, music($14) }] })`, com `cfg = configFromSetup(setup, settings.options.randomSpawns, settings.devices)`. A partida é criada no f646. Durante a sequência, toda entrada é ignorada. Se `!canStart(slots)` (não deveria acontecer), `$03` e nada.
- B: `$03` e `FADE_MENU` → `charactersScreen`, ou `teamsScreen` no modo Em Equipes (R12).
- Desenho: título "Escolha a fase!" (`spriteBlue`, centrado em x = 126, topo em y = 8 + `stageTitleDy(seqF)`). Miniatura central em x 72–183 e vizinhas a ±128 px, todas deslocadas por `scroll()`. "Fase N" (`spriteBlue`) em y = 152 e o nome em y = 184, trocados no fim da rolagem. "BATALHA!" (`bigBattle`) no lugar do título quando `battleTextVisible(seqF)` (R11). ROM: cena `stagesel`. As prévias vêm de `$C1:A901` (8 blocos, carregados por `$C1:A262`). A T11 tenta reconstruir o mapa de cada prévia: capturar as 10 fases com `analise/investigacao/montarias-e-telas/stage_scroll.py` + `graficos-formato/scenes.py` e comparar. Sem isso, vale a R29 (a arena da ROM reduzida para 112 px). Registrar na mensagem do commit qual caminho ficou. Fallback: `drawMiniArena` atual, sem alpha, nas mesmas posições.

- [ ] **Step 1: Escrever o teste** `web/tests/screens/stage.test.ts`:

```ts
import { stageScreen } from '../../src/screens/stage';
import { BTN } from '../../src/game/core-api';
import type { MatchSession } from '../../src/game/match-session';
import { idleInput } from '../../src/input/input';
import { mkApp, press, tap, idle, hold, settle } from './helpers';

describe('seleção de fase (§6.7)', () => {
  it('→: $01 no botão, faixa rola 8 px/f por 16 f, o número troca no fim, com volta 10 → 1', () => {
    const { app, sink } = mkApp();
    app.settings.setup.stage = 10;
    const st = stageScreen(app); app.go(st); sink.clear();
    tap(app, BTN.RIGHT);
    expect([st.scroll(), st.stage]).toEqual([0, 10]);
    idle(app, 1); expect(st.scroll()).toBe(-8);
    idle(app, 14); expect([st.scroll(), st.stage]).toEqual([-120, 10]);
    idle(app, 1); expect([st.scroll(), st.stage]).toEqual([0, 1]);
    expect([app.settings.setup.stage, sink.of('sfx').map(c => c.id)]).toEqual([1, [1]]);
  });
  it('← anda para o outro lado, com volta 1 → 10', () => {
    const { app } = mkApp();
    const st = stageScreen(app); app.go(st);
    tap(app, BTN.LEFT); idle(app, 1);
    expect(st.scroll()).toBe(8);
    idle(app, 15);
    expect(st.stage).toBe(10);
  });
  it('segurar: 36 f e depois a cada 21 f', () => {
    const { app } = mkApp();
    const st = stageScreen(app); app.go(st);
    hold(app, BTN.RIGHT, 100);                     // pulsos em 0, 36, 57 e 78
    expect(st.stage).toBe(5);
  });
  it('↑/↓ não fazem nada', () => {
    const { app, sink } = mkApp();
    const st = stageScreen(app); app.go(st); sink.clear();
    press(app, BTN.UP); press(app, BTN.DOWN);
    expect([st.stage, st.scroll(), sink.calls.length]).toEqual([1, 0, 0]);
  });
  it('A: $02 f0, $13 f48, voz $07 f208, fade-out f278, FADE f310, $2F f511, $14 f523 e partida em f646', () => {
    const { app, sink } = mkApp();
    app.settings.setup.stage = 3;
    app.go(stageScreen(app)); sink.clear();
    tap(app, BTN.A);
    const t0 = app.tick;
    idle(app, 277);
    expect(app.inTransition).toBe(false);
    idle(app, 1);
    expect([app.inTransition, app.brightness()]).toEqual([true, 14]);
    while (app.screen.id !== 'battle') app.update(idleInput());
    expect(app.tick - t0).toBe(646);
    expect(sink.since(t0).filter(c => c.t < 646).map(c => [c.t, c.op, c.id])).toEqual([
      [0, 'sfx', 2], [48, 'music', 0x13], [208, 'voice', 0x07], [310, 'fade', undefined], [511, 'bank', 0x2f], [523, 'music', 0x14]]);
    expect((app.screen as unknown as { ms: MatchSession }).ms.cfg.stage).toBe(3);
  });
  it('"BATALHA!" pisca de f65 a f207 e fica de f208 a f277; o título sobe de f48 a f64; entradas ignoradas', () => {
    const { app } = mkApp();
    const st = stageScreen(app); app.go(st);
    tap(app, BTN.A);
    idle(app, 56); expect(st.titleDy()).toBe(-16);
    idle(app, 9); expect([st.seqF, st.battleVisible()]).toEqual([65, true]);
    idle(app, 1); expect(st.battleVisible()).toBe(false);
    press(app, BTN.B); press(app, BTN.RIGHT);
    expect([app.inTransition, st.stage]).toEqual([false, 1]);
    idle(app, 150); expect(st.battleVisible()).toBe(true);
  });
  it('B → personagens com $03; em Equipes → equipes (R12)', () => {
    const a = mkApp();
    a.app.go(stageScreen(a.app)); a.sink.clear();
    press(a.app, BTN.B); settle(a.app);
    expect([a.app.screen.id, a.sink.of('sfx')[0].id]).toEqual(['characters', 3]);
    const b = mkApp();
    b.app.settings.setup.mode = 'team';
    b.app.go(stageScreen(b.app)); press(b.app, BTN.B); settle(b.app);
    expect(b.app.screen.id).toBe('teams');
  });
});
```

(Contagem do 2º teste de "BATALHA!": `tap` = seqF 0, 56 ociosos = seqF 56, mais 9 = 65, mais 1 = 66. `press` são 2 frames cada, e mais 150 ociosos = seqF 220.)

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** `stage.ts` e o desenho (ROM e fallback) conforme as regras.
- [ ] **Step 4: Pesquisa das prévias e teste com captura.** Acrescentar ao teste um `describe.skipIf(!ASSETS || !loadCapture('stagesel'))` que monta a cena da fase 1 (`buildStageScene(ASSETS, 1, 0)`) e compara os mapas com a captura `stagesel`, ignorando os textos: (60,0)–(196,28) e (40,146)–(216,200). Se as prévias vierem de `$C1:A901`, a faixa das miniaturas também precisa bater (≥ 97 %). Com R29, ignore também a faixa (0,36)–(255,160).
- [ ] **Step 5: Rodar tudo, apagar** `legacy/stage-battle.test.ts` e **commit** — `feat(telas): seleção de fase com rolagem 8×16, repetição 36/21 e a sequência BATALHA! de 646 f`.

---

### Task 12: Partida: intro, faixas, pausa, desconexão e fim de rodada

**Files:**
- Replace: `web/src/screens/battle.ts`, `web/src/render/draw-screens.ts`
- Create: `web/tests/screens/battle.test.ts`
- Delete: `web/src/game/session.ts`, `web/src/app/tick.ts`, `web/tests/client/tick.test.ts`, `web/tests/client/legacy/session.test.ts`, `web/tests/client/legacy/stage-battle.test.ts`

**Possui:** esses arquivos.

**Interfaces:**
- Consumes: `beginRound`, `endRound`, `closeMatch` (T6), `step`, `aiInputs`, `phaseElapsed`, `eventType`, `isDraw`, `drawReason` (`core-api`), `introBrightness`, `hurryX`, `hurryVisible`, `timeUpY`, `BANNER`, `PAUSE`, `WIN_END`, `DRAW_TIME_END`, `DRAW_DEAD_END` (T6), `FADE_OUT_1`, `FADE_IN_1`, `fadeSpec` (T2), `SFX`, `MUSIC`, `BANK` (T2), `timeUpLabel`, `drawText`, `S` (T4), `createView`, `updateView`, `drawRound` (render do fallback, plano 6), `drawRomBattle`, `romState` (`rom-api`), `scoreboardScreen` (T13), `drawScreen` (T14), `stageScreen` (T11)
- Produces: `battleScreen(app, ms): Screen & { readonly ms: MatchSession; readonly round: RoundState; readonly paused: boolean; readonly disconnected: number | null; banners(): { hurry: { x: number; y: number } | null; timeUp: { y: number; text: string } | null } }` e `drawBattleOverlays(ctx, bank, st: OverlayState)` com `OverlayState = { paused: boolean; disconnected: number | null; hurry: {x, y} | null; timeUp: {y, text} | null }`

- [ ] **Step 1: Escrever o teste** `web/tests/screens/battle.test.ts`:

```ts
import { battleScreen } from '../../src/screens/battle';
import { drawBattleOverlays } from '../../src/render/draw-screens';
import { createMatchSession, carry, resetCarry } from '../../src/game/match-session';
import { parseConfig } from '../../src/game/config';
import { setGameEventAudio } from '../../src/app/audio';
import { BTN, crownsOf, eventType, matchRngState } from '../../src/game/core-api';
import { FADE_OUT_1 } from '../../src/app/fade';
import { idleInput } from '../../src/input/input';
import { forceWin, forceAllDead, forceClock } from './core-helpers';
import { mkApp, tap, idle, inputOf, brightnessTrace, range, settle } from './helpers';
import type { App } from '../../src/app/app';

beforeEach(() => resetCarry());

function start(q = '?players=3&humans=1') {
  const env = mkApp();
  const ms = createMatchSession(parseConfig(q));
  const b = battleScreen(env.app, ms);
  env.app.go(b);
  return { ...env, ms, b };
}
const toPlay = (app: App, b: ReturnType<typeof battleScreen>) => { while (b.round.phase === 'intro') app.update(idleInput()); };
function untilTransition(app: App): number {
  for (let n = 0; n < 4000 && !app.inTransition; n++) app.update(idleInput());
  expect(app.inTransition).toBe(true);
  return app.tick;
}
function untilScreen(app: App, id: string): number {
  for (let n = 0; n < 4000 && app.screen.id !== id; n++) app.update(idleInput());
  expect(app.screen.id).toBe(id);
  return app.tick;
}
const calls = (sink: ReturnType<typeof mkApp>['sink'], t0: number, until = Infinity) =>
  sink.since(t0).filter(c => c.t < until).map(c => [c.t, c.op, c.id]);

describe('intro (§6.8)', () => {
  it('10 frames pretos, fade-in de 15; o 62º passo põe play', () => {
    const { app, b } = start();
    expect(brightnessTrace(app, 27)).toEqual([...Array(10).fill(0), ...range(1, 15), 15, 15]);
    idle(app, 34);
    expect(b.round.phase).toBe('intro');
    idle(app, 1);
    expect(b.round.phase).toBe('play');
  });
});

describe('pausa (§6.9, R17, R18)', () => {
  it('START de qualquer controle pausa e despausa com $04; núcleo e animação param; nada escurece', () => {
    const { app, sink, b } = start();
    toPlay(app, b); sink.clear();
    const tick = b.round.tick, frame = app.frame;
    tap(app, BTN.START);
    expect(b.paused).toBe(true);
    idle(app, 30);
    expect([b.round.tick, app.frame, app.brightness()]).toEqual([tick, frame, 15]);
    tap(app, BTN.START);
    expect(b.paused).toBe(false);
    expect(sink.of('sfx').map(c => c.id)).toEqual([4, 4]);
  });
  it('pausa também no intro: o brilho e os passos param', () => {
    const { app, b } = start();
    idle(app, 12);
    tap(app, BTN.START);
    const br = app.brightness(), tick = b.round.tick;
    idle(app, 10);
    expect([app.brightness(), b.round.tick]).toEqual([br, tick]);
  });
  it('SELECT+START por 60 f volta à fase; com SELECT segurado o START não despausa', () => {
    const { app, sink, b, ms } = start();
    toPlay(app, b); tap(app, BTN.START); sink.clear();
    const combo = BTN.SELECT | BTN.START;
    for (let k = 0; k < 59; k++) app.update(inputOf(combo, k === 0 ? combo : 0));
    app.update(idleInput());
    expect([b.paused, app.inTransition]).toEqual([true, false]);
    for (let k = 0; k < 60; k++) app.update(inputOf(combo, k === 0 ? combo : 0));
    expect(app.inTransition).toBe(true);
    const t0 = app.tick;
    settle(app);
    expect(app.screen.id).toBe('stage');
    expect(calls(sink, t0).filter(c => c[1] !== 'sfx')).toEqual([[0, 'fade', undefined], [16, 'bank', 0x30], [58, 'music', 0x12]]);
    expect(carry.seed).toBe(matchRngState(ms.match));
  });
  it('Esc segurado 60 f na pausa também sai', () => {
    const { app, b } = start();
    toPlay(app, b); tap(app, BTN.START);
    for (let k = 0; k < 60; k++) app.update(inputOf(0, 0, undefined, { esc: true }));
    expect(app.inTransition).toBe(true);
  });
});

describe('controle desconectado (§6.9, R19)', () => {
  it('gamepad de humano desconecta: pausa com $04 e "CONTROLE 1"; START de outro controle volta', () => {
    const { app, sink, b, ms } = start();
    ms.cfg.devices[0] = 'gp0';
    toPlay(app, b); sink.clear();
    app.update(inputOf(0, 0, undefined, { connected: [false, true, true, true, true] }));
    expect([b.paused, b.disconnected]).toEqual([true, 1]);
    tap(app, BTN.START);
    expect([b.paused, b.disconnected]).toEqual([false, null]);
    expect(sink.of('sfx').map(c => c.id)).toEqual([4, 4]);
  });
  it('já desconectado no início não pausa; slot de CPU com gamepad também não', () => {
    const { app, b, ms } = start();
    ms.cfg.devices[0] = 'gp0';
    const off = { connected: [false, true, false, true, true] };
    for (let k = 0; k < 5; k++) app.update(inputOf(0, 0, undefined, off));
    expect(b.paused).toBe(false);
  });
});

describe('faixas (§6.9, R27, R28)', () => {
  it('RÁPIDO!!: entra pela direita a 2 px/f por 192 ticks e congela na pausa', () => {
    const { app, b } = start();
    toPlay(app, b);
    forceClock(b.round, 62);
    idle(app, 1);
    expect(b.banners().hurry).toEqual({ x: 256, y: 120 });
    idle(app, 10);
    expect(b.banners().hurry!.x).toBe(236);
    tap(app, BTN.START); idle(app, 20); tap(app, BTN.START);
    expect(b.banners().hurry!.x).toBe(236);
    idle(app, 181);
    expect(b.banners().hurry).not.toBeNull();
    idle(app, 1);
    expect(b.banners().hurry).toBeNull();
  });
  it('TEMPO ESGOTADO!: cai de −16 a 104 em 16 f e fica', () => {
    const { app, b } = start();
    toPlay(app, b);
    forceClock(b.round, 1);
    idle(app, 1);
    expect(b.banners().timeUp).toEqual({ y: -16, text: 'TEMPO ESGOTADO!' });
    idle(app, 16); expect(b.banners().timeUp!.y).toBe(104);
    idle(app, 50); expect(b.banners().timeUp!.y).toBe(104);
  });
  it('os eventos de cada passo vão para o mapeador de áudio (R26)', () => {
    const seen: string[] = [];
    setGameEventAudio((_s, ev) => { seen.push(...ev.map(eventType)); });
    const { app, b } = start();
    toPlay(app, b);
    forceClock(b.round, 62);
    idle(app, 1);
    expect(seen).toContain('hurry');
    setGameEventAudio(() => {});
  });
});

describe('fim de rodada (§6.10, §6.11, R4–R6)', () => {
  it('vitória: FADE, fade-out 15, +1 coroa no 1º frame do preto, $30 +16, $15 +57 e placar em +63', () => {
    const { app, sink, b, ms } = start();
    toPlay(app, b); forceWin(b.round, 0); sink.clear();
    const t0 = untilTransition(app);
    expect(b.round.phase).toBe('over');
    expect(brightnessTrace(app, 14)).toEqual(FADE_OUT_1.slice(1));
    expect(crownsOf(ms.match)[0]).toBe(0);
    idle(app, 1);
    expect(crownsOf(ms.match)[0]).toBe(1);
    expect(untilScreen(app, 'scoreboard') - t0).toBe(63);
    expect(calls(sink, t0)).toEqual([[0, 'fade', undefined], [16, 'bank', 0x30], [57, 'music', 0x15]]);
  });
  it('EMPATE por tempo: FADE +1, $30 +58, $18 +68 e a tela EMPATE em +166', () => {
    const { app, sink, b } = start();
    toPlay(app, b); forceClock(b.round, 1); sink.clear();
    const t0 = untilTransition(app);
    expect(untilScreen(app, 'draw') - t0).toBe(166);
    expect(calls(sink, t0)).toEqual([[1, 'fade', undefined], [58, 'bank', 0x30], [68, 'music', 0x18]]);
  });
  it('EMPATE com todos mortos: FADE +0, $30 +16, $18 +26 e EMPATE em +63', () => {
    const { app, sink, b } = start();
    toPlay(app, b); forceAllDead(b.round); sink.clear();
    const t0 = untilTransition(app);
    expect(untilScreen(app, 'draw') - t0).toBe(63);
    expect(calls(sink, t0)).toEqual([[0, 'fade', undefined], [16, 'bank', 0x30], [26, 'music', 0x18]]);
  });
});

describe('camadas por cima da partida (fallback)', () => {
  const env = () => {
    const tags: string[] = []; let fills = 0;
    const ctx = { drawImage: (im: { tag: string }) => tags.push(im.tag), fillRect: () => { fills++; }, fillStyle: '' };
    const bank = { text: (s: string, c: string) => ({ width: s.length * 6 + 1, height: 12, tag: `${s}|${c}` }) };
    return { tags, fills: () => fills, ctx: ctx as never, bank: bank as never };
  };
  it('pausa: só "PAUSA!" e nenhum escurecimento', () => {
    const e = env();
    drawBattleOverlays(e.ctx, e.bank, { paused: true, disconnected: null, hurry: null, timeUp: null });
    expect([e.tags, e.fills()]).toEqual([['PAUSA!|#3fd84a'], 0]);
  });
  it('desconexão acrescenta a linha ASCII', () => {
    const e = env();
    drawBattleOverlays(e.ctx, e.bank, { paused: true, disconnected: 2, hurry: null, timeUp: null });
    expect(e.tags).toEqual(['PAUSA!|#3fd84a', 'CONTROLE 2 DESCONECTADO|#ffffff']);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar `web/src/screens/battle.ts`.** O `update` é o trecho traiçoeiro, então segue completo. O resto (getters, `draw`) é direto.

```ts
export function battleScreen(app: App, ms: MatchSession): BattleScreen {
  const round = beginRound(ms);
  const view = createView();
  let paused = false, ended = false, quitHold = 0;
  let disconnected: number | null = null;
  let prevConn: boolean[] | null = null;
  let hurryT0 = -1, timeUpT0 = -1;
  const humanGp = (i: number) => ms.cfg.humans[i] && ms.cfg.rules.active[i] && ms.cfg.devices[i].startsWith('gp');

  function endOfRound(): void {
    const res = round.result!;
    const draw = isDraw(res);
    const spec = !draw ? WIN_END : drawReason(res) === 'time' ? DRAW_TIME_END : DRAW_DEAD_END;
    ended = true;
    app.transition(() => (draw ? drawScreen(app, ms) : scoreboardScreen(app, ms)), {
      out: FADE_OUT_1, black: spec.black, in: FADE_IN_1, cues: [
        { at: spec.audioFadeAt, run: a => a.audio.fade() },
        { at: spec.crownAt, run: () => endRound(ms) },
        { at: spec.bankAt, run: a => a.audio.bank(BANK.menus) },
        { at: spec.musicAt, run: a => a.audio.music(draw ? MUSIC.draw : MUSIC.score) },
      ],
    });
  }
  function quit(): void {
    ended = true;
    closeMatch(ms);
    app.transition(() => stageScreen(app), fadeSpec(FADE_OUT_1, FADE_IN_1, [
      { at: 0, run: a => a.audio.fade() },
      { at: 16, run: a => a.audio.bank(BANK.menus) },
      { at: 58, run: a => a.audio.ensureMenus(MUSIC.menus) },
    ]));
  }

  return {
    id: 'battle', ms,
    get round() { return round; }, get paused() { return paused; }, get disconnected() { return disconnected; },
    banners: () => ({
      hurry: hurryT0 >= 0 && hurryVisible(round.tick - hurryT0) ? { x: hurryX(round.tick - hurryT0), y: BANNER.hurryTop } : null,
      timeUp: timeUpT0 >= 0 ? { y: timeUpY(round.tick - timeUpT0), text: timeUpLabel() } : null,
    }),
    brightness: () => (round.phase === 'intro' ? introBrightness(phaseElapsed(round)) : 15),
    frozen: () => paused,
    update(inp) {
      if (ended) return;
      if (prevConn) for (let i = 0; i < 5; i++) {
        if (humanGp(i) && prevConn[i] && !inp.connected[i]) {
          if (!paused) { paused = true; app.audio.sfx(SFX.pause); }
          disconnected = Number(ms.cfg.devices[i].slice(2)) + 1;
        }
      }
      prevConn = [...inp.connected];
      const selHeld = (inp.any & BTN.SELECT) !== 0;
      const startEdge = (inp.pressedAny & BTN.START) !== 0 && !selHeld;
      if (paused) {
        const combo = (inp.any & (BTN.SELECT | BTN.START)) === (BTN.SELECT | BTN.START) || inp.esc;
        quitHold = combo ? quitHold + 1 : 0;
        if (quitHold >= PAUSE.quitHold) { quit(); return; }
        if (startEdge) { paused = false; disconnected = null; quitHold = 0; app.audio.sfx(SFX.pause); }
        return;
      }
      if (startEdge) { paused = true; app.audio.sfx(SFX.pause); return; }
      const cpu = ms.cfg.humans.map((h, i) => !h && ms.cfg.rules.active[i]);
      const ai = aiInputs(round, ms.ai, cpu, ms.cfg.rules.cpuLevel);
      const pads = [0, 1, 2, 3, 4].map(i => (ms.cfg.humans[i] ? inp.pads[i] & ~(BTN.START | BTN.SELECT) : ai[i]));
      const ev = step(round, pads);
      updateView(view, round, ev);
      app.audio.playEvents(ev);
      for (const e of ev) {
        if (eventType(e) === 'hurry') hurryT0 = round.tick;
        if (eventType(e) === 'time_up') timeUpT0 = round.tick;
      }
      if (round.phase === 'over') endOfRound();
    },
    draw(ctx, bank, frame) {
      const a = romState.assets;
      if (!(a && drawRomBattle(ctx, round, view, a, frame))) drawRound(ctx, round, view, bank, ms.cfg.chars, frame, crownsOf(ms.match));
      drawBattleOverlays(ctx, bank, { paused, disconnected, ...this.banners() });
    },
  };
}
```

  (Ajuste a chamada de `drawRound` à assinatura que o plano 6 deixou em `render/draw-game.ts`, e o `aiInputs` à dele. O resto não muda.)

- [ ] **Step 4: Substituir `web/src/render/draw-screens.ts`:**

```ts
import type { SpriteBank } from './sprite-bank';
import { drawText } from './text/text';
import { S } from './text/strings';

export interface OverlayState {
  paused: boolean; disconnected: number | null;
  hurry: { x: number; y: number } | null; timeUp: { y: number; text: string } | null;
}
/** Por cima da partida (ROM ou fallback): RÁPIDO!!, TEMPO ESGOTADO!, PAUSA! (sem escurecer) e a linha de desconexão. */
export function drawBattleOverlays(ctx: CanvasRenderingContext2D, bank: SpriteBank, st: OverlayState): void {
  if (st.hurry) drawText(ctx, bank, 'banner', S.battle.hurry, st.hurry.x, st.hurry.y, { tone: 'green' });
  if (st.timeUp) drawText(ctx, bank, 'banner', st.timeUp.text, 128, st.timeUp.y, { align: 'center' });
  if (st.paused) drawText(ctx, bank, 'banner', S.battle.pause, 128, 110, { align: 'center' });
  if (st.paused && st.disconnected !== null) drawText(ctx, bank, 'ascii8', S.battle.disconnected(st.disconnected), 128, 130, { align: 'center' });
}
```

  O teste espera a cor padrão do estilo `banner` (`#3fd84a`) na PAUSA!. Com ROM, o estilo `banner` usa a paleta que a T17 mediu: PAUSA! verde com contorno branco e RÁPIDO!! verde.

- [ ] **Step 5: Apagar** `game/session.ts`, `app/tick.ts`, `tests/client/tick.test.ts`, `tests/client/legacy/session.test.ts` e `tests/client/legacy/stage-battle.test.ts`. Rodar `npx tsc --noEmit && npx vitest run`: nenhum outro arquivo deve importar `session.ts`/`tick.ts` depois das T8–T11. Se `main.ts` importar `Session` (gancho `__crown`), troque para `(app.screen as Partial<{ ms: MatchSession }>).ms ?? null`, uma linha, registrada no commit (a T22 reescreve o `main.ts`).
- [ ] **Step 6: Commit** — `feat(partida): intro por brilho, RÁPIDO!!/TEMPO ESGOTADO!, pausa do original, sair segurando, pausa por desconexão e fim de rodada com os tempos e sons medidos`.

---

### Task 13: Placar

**Files:**
- Replace: `web/src/screens/scoreboard.ts` (esqueleto da T6)
- Create: `web/src/render/screens-rom/scoreboard.ts`, `web/tests/screens/scoreboard.test.ts`

**Possui:** esses arquivos.

**Interfaces:**
- Consumes: `SCORE`, `CROWN_SPIN`, `crownSpinFrame`, `NEXT_ROUND` (T6), `FADE_OUT_1` (T2), `MUSIC`, `BANK` (T2), `crownsOf` (`core-api`), `battleScreen` (T12), `victoryScreen` (T20), `S`, `drawText` (T4), cena `scoreboard` (T5), `assets.anim`, `assets.character` (`rom-api`)
- Produces: `scoreboardScreen(app, ms): Screen & { readonly s: number; rows(): { slot: number; y: number }[]; crownCell(slot: number, k: number): 'empty' | 'full' | \`spin:${number}\` }` e `drawScoreboard(ctx, bank, ms, s, yOffset)`

**Regras (§6.10, §6.12, §7.5, R7–R10, A15):**
- `rows()`: slots com `rules.active[i]`, em `y = 56 + 32·slot` (A15: posição do slot, só os ativos).
- `crownCell(slot, k)`: com `c = crowns[slot]`, `k ≥ c` → `'empty'`. É **nova** se `lastWinners` inclui o slot e `k === c − 1`. Nova: `s < 4` → `'empty'` (casa preta); `s − 4 < 104` → `'spin:' + crownSpinFrame(s − 4)`; depois `'full'`. As que não são novas → `'full'`.
- Normal: A, B ou START (`pressedAny`) com `s ≥ 18`, ou `s = 511` sem botão → `app.transition(() => battleScreen(app, ms), { out: FADE_OUT_1, black: 288, in: [], cues: [{ at: 31, bank($2F) }, { at: 43, music($14) }] })`.
- Final (`ms.over`): nenhum botão faz nada. Em `s = 511`, `music($16)`. Em `s = 557`, `app.go(victoryScreen(app, ms, 557))`, sem fade.
- Desenho com ROM: cena `scoreboard`. Céu e nuvens, painel verde (x 8–248) e faixa do título pela geometria da captura. "PLACAR" (`bigScore`) no lugar de SCORE BOARD (x ≈ 50–212, y ≈ 20–52). Rótulos nP em x ≈ 16. Cabeças são OBJ 32×32 (tiles `$80`, `$84`, `$88`, `$C4`, `$C8`, `attr $30…$38` [§7.5]). Como a VRAM da captura só tem as cabeças dos personagens padrão, a T13 procura na ROM a tabela de ponteiros das cabeças por personagem: buscar os ponteiros de 24 bits `$D3:E82B`, `$CB:B000` e `$CC:5900` vistos no CAT `scoreboard`. Sem isso, a cabeça é o quadro g6 do personagem (`character(c).frame(6)`, `src.px`). A coroa usa `assets.anim(0xC3DA94)` (R10): quadro `crownSpinFrame(s − 4)` nas casas x = 80/112/144/176/208. Fallback: fundo azul-céu com 3 nuvens fixas (retângulos brancos), painel verde, `bank.head(char)` e `bank.crown()` (a coroa girando vira uma largura que encolhe e cresce: `24·|cos(π·quadro/8)|`).
- `drawScoreboard(ctx, bank, ms, s, yOffset)` desenha a mesma cena deslocada `yOffset` px, para a descida da vitória (T20).

- [ ] **Step 1: Escrever o teste** `web/tests/screens/scoreboard.test.ts`:

```ts
import { scoreboardScreen } from '../../src/screens/scoreboard';
import { createMatchSession, beginRound, endRound, resetCarry } from '../../src/game/match-session';
import { parseConfig, configFromSetup } from '../../src/game/config';
import { BTN } from '../../src/game/core-api';
import { CROWN_SPIN } from '../../src/game/timeline';
import { idleInput } from '../../src/input/input';
import { forceWin, runUntil, skipIntro, setCrowns } from './core-helpers';
import { mkApp, tap, idle, inputOf } from './helpers';
import { defaultSetup } from '../../src/app/settings';
import { ASSETS } from './rom';

beforeEach(() => resetCarry());

function afterWin(cfg = parseConfig('?players=3&humans=1'), crownsBefore = 0) {
  const env = mkApp();
  const ms = createMatchSession(cfg);
  setCrowns(ms.match, 0, crownsBefore);
  const r = beginRound(ms); skipIntro(r); forceWin(r, 0); runUntil(r, x => x.phase === 'over'); endRound(ms);
  const sb = scoreboardScreen(env.app, ms); env.app.go(sb); env.sink.clear();
  return { ...env, ms, sb };
}

describe('placar (§6.10, R7, R8, A15)', () => {
  it('só as linhas dos slots ativos, na posição do slot', () => {
    const setup = { ...defaultSetup(), slots: ['human', 'off', 'cpu', 'off', 'cpu'] as const };
    const { sb } = afterWin(configFromSetup(setup, false, ['kb0', 'kb1', 'gp0', 'gp1', 'gp2']));
    expect(sb.rows()).toEqual([{ slot: 0, y: 56 }, { slot: 2, y: 120 }, { slot: 4, y: 184 }]);
  });
  it('coroa nova: casa preta até S=4, gira 104 f pela animação e para', () => {
    const { app, sb } = afterWin(undefined, 1);
    expect(sb.crownCell(0, 0)).toBe('full');
    idle(app, 4);  expect(sb.crownCell(0, 1)).toBe('empty');
    idle(app, 1);  expect(sb.crownCell(0, 1)).toBe('spin:0');
    idle(app, 103); expect(sb.crownCell(0, 1)).toBe(`spin:${CROWN_SPIN.length - 1}`);
    idle(app, 1);  expect(sb.crownCell(0, 1)).toBe('full');
    expect(sb.crownCell(1, 0)).toBe('empty');
  });
  it('pular: A/B/START a partir de S=18; próxima rodada depois de 15 + 288, com $2F +31 e $14 +43', () => {
    const { app, sink } = afterWin();
    idle(app, 17); tap(app, BTN.A);
    expect(app.inTransition).toBe(false);
    tap(app, BTN.B);
    expect(app.inTransition).toBe(true);
    const t0 = app.tick;
    while (app.screen.id !== 'battle') app.update(idleInput());
    expect(app.tick - t0).toBe(303);
    expect(sink.since(t0).map(c => [c.t, c.op, c.id])).toEqual([[31, 'bank', 0x2f], [43, 'music', 0x14]]);
  });
  it('sem botão: sai sozinho em S=511', () => {
    const { app } = afterWin();
    idle(app, 511); expect(app.inTransition).toBe(false);
    idle(app, 1); expect(app.inTransition).toBe(true);
  });
});

describe('placar final (§6.12, R9)', () => {
  it('não pula; $16 em S=511; a vitória assume em S=557 sem fade', () => {
    const { app, sink } = afterWin(parseConfig('?players=2&humans=1&matches=1'));
    for (let k = 0; k < 511; k++) app.update(inputOf(BTN.A | BTN.START, BTN.A | BTN.START));
    expect([app.inTransition, sink.of('music')]).toEqual([false, []]);
    idle(app, 1);
    expect(sink.of('music').map(c => c.id)).toEqual([0x16]);
    idle(app, 45); expect(app.screen.id).toBe('scoreboard');
    idle(app, 1);
    expect([app.screen.id, app.inTransition]).toEqual(['victory', false]);
  });
});

describe.skipIf(!ASSETS)('coroa da ROM (R10)', () => {
  it('C3:DA94 tem 32 quadros e 104 f, como a spec', () => {
    const anim = ASSETS!.anim(0xc3da94);
    expect(anim.map(f => f.dur)).toEqual([...CROWN_SPIN]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** a tela e os desenhos. Teste com captura (`skipIf(!ASSETS || !loadCapture('scoreboard'))`): mapas montados × capturados ≥ 97 %, ignorando (40,16)–(220,56).
- [ ] **Step 4: Rodar tudo e commit** — `feat(telas): placar com 5 casas, coroa girando pela ROM, pular desde S=18 e placar final que leva à vitória`.

---

### Task 14: EMPATE

**Files:**
- Replace: `web/src/screens/draw.ts` (esqueleto da T6)
- Create: `web/src/render/screens-rom/draw.ts`, `web/tests/screens/draw.test.ts`

**Possui:** esses arquivos.

**Interfaces:**
- Consumes: `DRAW_SCENE`, `drawScale`, `drawColor`, `NEXT_ROUND` (T6), `FADE_OUT_1` (T2), `VOICE`, `BANK`, `MUSIC` (T2), `battleScreen` (T12), `S`, `buildRomFont`, `layoutText`, `drawText` (T4), `assets.mode7Draw()`, `Mode7Layer`, `assets.character(c)` (`rom-api`), cenas `draw1`/`draw2` (T5)
- Produces: `drawScreen(app, ms): Screen & { readonly s: number; letters(): { scale: number; color: 0 | 1 | 2 } }`, `buildDrawTexture(img: IndexedImage): { chr: Uint8Array; map: Uint8Array }`, `m7Pixel(tex, X, Y): number`

**Regras (§6.11, §7.5, R5, R6, R21):**
- `s` conta a partir do 1º frame do fade-in. Em `s = 100`: `voice($0E)`. `letters()` = `{ scale: drawScale(s), color: drawColor(s) }`.
- **Só A ou B** (`pressedAny & (A | B)`) com `s ≥ 18` pulam, e START não pula. A transição é `{ out: FADE_OUT_1, black: 385, in: [], cues: [{ at: 31, bank($2F) }, { at: 43, music($14) }] }` → `battleScreen(app, ms)`. Sem botão, espera sem limite. Não mexe em coroas (o `endRound` já rodou no cue da T12, e o empate não dá coroa).
- `buildDrawTexture(img)`: plano Modo 7 de 1024×1024 (mapa 128×128 de bytes, `chr` com 256 tiles 8×8 de 8 bits), com a imagem centrada: canto em `(512 − ⌊w/2⌋, 512 − ⌊h/2⌋)`. O tile 0 fica vazio, e tiles de conteúdo idêntico são reaproveitados. `m7Pixel(tex, X, Y) = chr[map[(Y>>3)·128 + (X>>3)]·64 + (Y&7)·8 + (X&7)]`.
- Com ROM: a textura é `buildDrawTexture(layoutText(buildRomFont('bigDraw', a), 'EMPATE'))`. O estilo `bigDraw` (T18) recorta E, M e A da textura original (`mode7Draw()`) e desenha P e T. A escala do Modo 7 é `letters().scale`, centrada (o tipo exato de `Mode7Layer` vem do plano 5). Durante o ciclo, as cores trocam os índices da cor principal das letras pelas entradas vermelha, amarela e verde da CGRAM da cena `draw2`: a T14 identifica os índices na captura `draw2.cgram` e os anota como números. Personagens: os 5 ativos com o quadro **g54** (fase Modo 7) e depois **g52** (a partir de `s = 148`). Os endereços `$D2:6900`/`$D2:6800` do CAT `draw1`/`draw2` são a folha `$D2:0000` + `$6900` = g54 e + `$6800` = g52. Ficam lado a lado sobre o disco, nas posições do OAM capturado (`draw1.oam`/`draw2.oam`). Fundo e disco: BG2 pela geometria de `draw2`. Fallback: fundo `#0a0f3a`, disco (elipse clara em y ≈ 160), `bank.bomber(char, 2, 0)` dos 5 e "EMPATE" (`bigDraw`) com escala `2·letters().scale`, alternando `red`/`yellow`/`green`.

- [ ] **Step 1: Escrever o teste** `web/tests/screens/draw.test.ts`:

```ts
import { drawScreen } from '../../src/screens/draw';
import { buildDrawTexture, m7Pixel } from '../../src/render/screens-rom/draw';
import { createMatchSession, resetCarry } from '../../src/game/match-session';
import { parseConfig } from '../../src/game/config';
import { BTN, crownsOf } from '../../src/game/core-api';
import { idleInput } from '../../src/input/input';
import { mkApp, tap, idle } from './helpers';

beforeEach(() => resetCarry());
function drawEnv() {
  const env = mkApp();
  const ms = createMatchSession(parseConfig('?players=5&humans=1'));
  const d = drawScreen(env.app, ms); env.app.go(d); env.sink.clear();
  return { ...env, ms, d };
}

describe('EMPATE (§6.11, R21)', () => {
  it('voz $0E em S=100 e nenhuma coroa', () => {
    const { app, sink, ms } = drawEnv();
    idle(app, 100); expect(sink.of('voice')).toEqual([]);
    idle(app, 1); expect(sink.of('voice').map(c => c.id)).toEqual([0x0e]);
    expect(crownsOf(ms.match)).toEqual([0, 0, 0, 0, 0]);
  });
  it('letras: escala 0 até S=34, linear até 1 em S=148; depois trocam de cor a cada 8 f', () => {
    const { app, d } = drawEnv();
    idle(app, 35); expect(d.letters()).toEqual({ scale: 0, color: 0 });
    idle(app, 57); expect(d.letters().scale).toBe(0.5);
    idle(app, 57); expect(d.letters()).toEqual({ scale: 1, color: 0 });
    idle(app, 8); expect(d.letters().color).toBe(1);
    idle(app, 8); expect(d.letters().color).toBe(2);
  });
  it('só A ou B pulam, a partir de S=18; START não', () => {
    const { app } = drawEnv();
    idle(app, 17); tap(app, BTN.A); expect(app.inTransition).toBe(false);
    tap(app, BTN.START); expect(app.inTransition).toBe(false);
    tap(app, BTN.B); expect(app.inTransition).toBe(true);
  });
  it('pular: próxima rodada depois de 15 + 385, com $2F +31 e $14 +43', () => {
    const { app, sink } = drawEnv();
    idle(app, 20); tap(app, BTN.A);
    const t0 = app.tick;
    while (app.screen.id !== 'battle') app.update(idleInput());
    expect(app.tick - t0).toBe(400);
    expect(sink.since(t0).map(c => [c.t, c.op, c.id])).toEqual([[31, 'bank', 0x2f], [43, 'music', 0x14]]);
  });
  it('sem botão espera sem limite', () => {
    const { app } = drawEnv();
    idle(app, 5000);
    expect([app.screen.id, app.inTransition]).toEqual(['draw', false]);
  });
});

describe('textura Modo 7 do EMPATE (pura)', () => {
  it('centraliza no plano 1024×1024; tile 0 vazio; tiles iguais reaproveitados', () => {
    const tex = buildDrawTexture({ w: 20, h: 10, px: new Uint8Array(200).fill(5) });
    expect([tex.map.length, tex.chr.length]).toEqual([128 * 128, 256 * 64]);
    expect([m7Pixel(tex, 502, 507), m7Pixel(tex, 521, 516)]).toEqual([5, 5]);
    expect([m7Pixel(tex, 501, 507), m7Pixel(tex, 502, 517), m7Pixel(tex, 0, 0)]).toEqual([0, 0, 0]);
    expect(new Set(tex.map).size).toBeLessThanOrEqual(7);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** a tela, `buildDrawTexture`/`m7Pixel` e os desenhos. Com ROM: teste `skipIf(!ASSETS)` que confere que `buildRomFont('bigDraw', ASSETS)` tem E, M, A, P e T, e que a textura de "EMPATE" tem pixels não nulos no centro do plano.
- [ ] **Step 4: Rodar tudo e commit** — `feat(telas): EMPATE com letras em Modo 7 (E, M, A da ROM; P, T próprios), só A/B pulam`.

---

### Task 15: Opções e remapeamento

**Files:**
- Replace: `web/src/screens/options.ts` (esqueleto da T6)
- Create: `web/src/screens/remap.ts`, `web/src/render/screens-rom/options.ts`, `web/tests/screens/options.test.ts`
- Delete: `web/src/screens/settings-screen.ts`, `web/tests/client/legacy/settings-screen.test.ts`

**Possui:** esses arquivos.

**Interfaces:**
- Consumes: `Menu` (T7), `FADE_MENU`, `FADE_FROM_TITLE`, `FADE_TO_TITLE` (T2), `MUSIC` (T2), `DEVICE_IDS`, `KEY_FIELDS`, `PAD_FIELDS`, `keyLabel`, `padLabel` (T3), `defaultSettings`, `defaultOptions` (T3), `romState`, `openRomDialog`, `forgetStoredRom` (`rom-api`), `titleScreen` (T8), `S`, `drawText` (T4), `menuMaps` (T5, cena `rules`)
- Produces: `optionsScreen(app): Screen & { readonly menu: Menu; rowIds(): string[]; value(id: string): string; readonly asking: boolean }` e `remapScreen(app, dev: Exclude<DeviceId, 'none'>): Screen & { readonly menu: Menu; readonly capturing: string | null }`

**Regras (§6.13, R15, R25):**
- Linhas (ids): `p1..p5` (dispositivo, ←/→ com volta em `DEVICE_IDS`), `kb1`, `kb2` (→ `remapScreen(app, 'kb0'|'kb1')`), `gp1..gp4` (→ `remapScreen(app, 'gp0'..'gp3')`), `spawns` (← NÃO, → SIM), `music` e `sfx` (0..10, sem volta, e cada mudança chama `app.audio.setVolume(musicVol/10, sfxVol/10)`), `romStatus` (desativada: "CARREGADA ✓"/"NÃO CARREGADA", conforme `romState.assets`), `romLoad` (A → `openRomDialog()`), `romForget` (A → `asking = true`, depois A → `forgetStoredRom()` ou B → cancela), `reset` (dispositivos, teclas, botões e opções padrão; `applyInput()`, `setVolume`, `save()`) e `back` (= B → `FADE_TO_TITLE` → `titleScreen(app, { cursor: 2 })`). Cada mudança chama `app.save()`. Na criação: `ensureMenus(MUSIC.title)`.
- Sub-telas de remapeamento com `FADE_MENU` para entrar e sair. Linhas: `KEY_FIELDS` (valor `keyLabel`/`padLabel`) + `back`. A → `capturing = campo`. Nos ticks seguintes, teclado: `inp.key` (Escape cancela) grava `keymaps[k][campo]`; gamepad: `inp.padButton` **do próprio controle** grava `padmaps[n][campo]`, e Escape (`inp.key`) cancela. Depois de gravar ou cancelar: `app.applyInput()`, `app.save()` e `suppress` até soltar tudo (`inp.any === 0`).
- Desenho: cena `rules` (ROM) com a moldura (7,15)–(248,218). Título "Opções" (`menuTitle`) no topo. Linhas em `ascii8`, rótulo em x = 24, valor alinhado à direita em x = 232, passo de 10 px a partir de y = 28 e mão em (8, y). Fallback nas mesmas posições.

- [ ] **Step 1: Escrever o teste** `web/tests/screens/options.test.ts`:

```ts
vi.mock('../../src/app/rom-api', async orig => ({
  ...(await orig<typeof import('../../src/app/rom-api')>()), openRomDialog: vi.fn(), forgetStoredRom: vi.fn(async () => {}),
}));
import * as romApi from '../../src/app/rom-api';
import { optionsScreen } from '../../src/screens/options';
import { remapScreen } from '../../src/screens/remap';
import { KEY_FIELDS, DEFAULT_PADMAP } from '../../src/input/input';
import { defaultSettings } from '../../src/app/settings';
import { BTN } from '../../src/game/core-api';
import { idleInput } from '../../src/input/input';
import { mkApp, press, settle, inputOf, RecordingSink } from './helpers';

type Opt = ReturnType<typeof optionsScreen>;
const goRow = (o: Opt, id: string) => { o.menu.cursor = o.rowIds().indexOf(id); };
beforeEach(() => vi.clearAllMocks());

describe('opções (§6.13)', () => {
  it('linhas na ordem', () => {
    const { app } = mkApp();
    expect(optionsScreen(app).rowIds()).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'kb1', 'kb2', 'gp1', 'gp2', 'gp3', 'gp4',
      'spawns', 'music', 'sfx', 'romStatus', 'romLoad', 'romForget', 'reset', 'back']);
  });
  it('dispositivo por jogador com ←/→, com volta; grava', () => {
    const { app, saves } = mkApp();
    const o = optionsScreen(app); app.go(o); goRow(o, 'p1');
    press(app, BTN.RIGHT); expect(app.settings.devices[0]).toBe('kb1');
    press(app, BTN.LEFT); press(app, BTN.LEFT);
    expect([app.settings.devices[0], o.value('p1')]).toEqual(['none', 'NENHUM']);
    expect(saves()).toBeGreaterThanOrEqual(3);
  });
  it('spawns aleatórios: NÃO → SIM', () => {
    const { app } = mkApp();
    const o = optionsScreen(app); app.go(o); goRow(o, 'spawns');
    expect(o.value('spawns')).toBe('NÃO');
    press(app, BTN.RIGHT);
    expect([app.settings.options.randomSpawns, o.value('spawns')]).toEqual([true, 'SIM']);
  });
  it('volume 0..10 sem volta, repassado ao áudio', () => {
    const { app } = mkApp();
    const got: number[][] = [];
    app.audio.setSink(Object.assign(new RecordingSink(), { setVolume: (m: number, s: number) => { got.push([m, s]); } }));
    const o = optionsScreen(app); app.go(o); goRow(o, 'music');
    press(app, BTN.RIGHT); press(app, BTN.RIGHT); press(app, BTN.RIGHT);
    expect([app.settings.options.musicVol, got.at(-1)]).toEqual([10, [1, 0.8]]);
    goRow(o, 'sfx');
    for (let k = 0; k < 9; k++) press(app, BTN.LEFT);
    expect([app.settings.options.sfxVol, got.at(-1)]).toEqual([0, [1, 0]]);
  });
  it('ROM: estado; carregar abre o painel; esquecer pede confirmação', async () => {
    const { app } = mkApp();
    const o = optionsScreen(app); app.go(o);
    expect(o.value('romStatus')).toBe('NÃO CARREGADA');
    goRow(o, 'romLoad'); press(app, BTN.A);
    expect(romApi.openRomDialog).toHaveBeenCalledTimes(1);
    goRow(o, 'romForget'); press(app, BTN.A);
    expect([o.asking, (romApi.forgetStoredRom as ReturnType<typeof vi.fn>).mock.calls.length]).toEqual([true, 0]);
    press(app, BTN.B);
    expect([o.asking, app.screen.id]).toEqual([false, 'options']);
    press(app, BTN.A); press(app, BTN.A);
    expect(romApi.forgetStoredRom).toHaveBeenCalledTimes(1);
  });
  it('restaurar padrão', () => {
    const { app } = mkApp();
    Object.assign(app.settings, { devices: ['gp3', 'gp3', 'none', 'none', 'none'] });
    app.settings.options.musicVol = 2; app.settings.padmaps[0].a = 9; app.settings.keymaps[0].a = 'KeyZ';
    const o = optionsScreen(app); app.go(o); goRow(o, 'reset');
    press(app, BTN.A);
    const d = defaultSettings();
    expect([app.settings.devices, app.settings.options, app.settings.padmaps, app.settings.keymaps]).toEqual([d.devices, d.options, d.padmaps, d.keymaps]);
  });
  it('B volta ao título com o cursor em "Opções"', () => {
    const { app } = mkApp();
    app.go(optionsScreen(app));
    press(app, BTN.B); settle(app);
    expect([app.screen.id, (app.screen as unknown as { cursor: number }).cursor]).toEqual(['title', 2]);
  });
});

describe('remapeamento', () => {
  it('teclado: A na ação, depois a tecla nova; aplica e grava; Escape cancela', () => {
    const { app, saves } = mkApp();
    const applied = vi.spyOn(app, 'applyInput');
    const r = remapScreen(app, 'kb0'); app.go(r);
    r.menu.cursor = KEY_FIELDS.indexOf('a');
    press(app, BTN.A);
    expect(r.capturing).toBe('a');
    app.update(inputOf(0, 0, undefined, { key: 'KeyZ' }));
    expect([app.settings.keymaps[0].a, r.capturing, applied.mock.calls.length > 0, saves() > 0]).toEqual(['KeyZ', null, true, true]);
    app.update(inputOf(BTN.A, BTN.A));                        // a tecla nova ainda segurada: não reabre
    expect(r.capturing).toBeNull();
    app.update(idleInput());
    r.menu.cursor = KEY_FIELDS.indexOf('b');
    press(app, BTN.A);
    app.update(inputOf(0, 0, undefined, { key: 'Escape' }));
    expect([r.capturing, app.settings.keymaps[0].b]).toEqual([null, 'KeyK']);
  });
  it('gamepad: só aceita botão do próprio controle', () => {
    const { app } = mkApp();
    const r = remapScreen(app, 'gp1'); app.go(r);
    r.menu.cursor = KEY_FIELDS.indexOf('start');
    press(app, BTN.A);
    app.update(inputOf(0, 0, undefined, { padButton: { pad: 0, button: 3 } }));
    expect(r.capturing).toBe('start');
    app.update(inputOf(0, 0, undefined, { padButton: { pad: 1, button: 11 } }));
    expect([r.capturing, app.settings.padmaps[1].start, app.settings.padmaps[0]]).toEqual([null, 11, DEFAULT_PADMAP]);
  });
  it('B fora da captura volta às opções', () => {
    const { app } = mkApp();
    app.go(remapScreen(app, 'kb1'));
    press(app, BTN.B); settle(app);
    expect(app.screen.id).toBe('options');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** `options.ts`, `remap.ts` e o desenho. No modo "perguntando", A confirma e B cancela, e a `Menu` não recebe esses botões. A linha de pergunta (`S.options.forgetAsk`) aparece em `ascii8` no rodapé (y = 208). Na captura, o rótulo mostra `S.options.pressKey` ou `pressPad`.
- [ ] **Step 4: Apagar** `settings-screen.ts` e `legacy/settings-screen.test.ts`. Se o título antigo ainda o importar (só se a T8 não tiver sido mesclada antes), a T8 já aponta para `optionsScreen`: confira depois do merge.
- [ ] **Step 5: Rodar tudo e commit** — `feat(opções): controles por jogador, remapeamento de teclado e gamepad, spawns aleatórios, volume e ROM (carregar/esquecer)`.

---

### Tasks 16, 17 e 18: glifos da ROM e glifos próprios (pesquisa + fatos)

As três tarefas seguem o mesmo roteiro, cada uma com seu grupo de estilos:

| Tarefa | Estilos | Possui |
|---|---|---|
| **T16** Glifos dos menus | `titleMenu`, `menuTitle`, `menuItem` | `src/render/text/{maps,extra}/{titleMenu,menuTitle,menuItem}.ts`, `tests/screens/glyphs-menus.test.ts`, `tests/fixtures/rom/glyphs-menus.json` |
| **T17** ASCII, faixas e sprite azul | `ascii8`, `banner`, `spriteBlue` | `…/{ascii8,banner,spriteBlue}.ts`, `tests/screens/glyphs-small.test.ts`, `tests/fixtures/rom/glyphs-small.json` |
| **T18** Grandes | `bigBattle`, `bigScore`, `bigVictory`, `bigDraw` | `…/{bigBattle,bigScore,bigVictory,bigDraw}.ts`, `tests/screens/glyphs-big.test.ts`, `tests/fixtures/rom/glyphs-big.json` |

**Interfaces:** Consumes `StyleRomDef`, `ExtraGlyph`, `STRING_USES`, `GLYPH_MAPS`, `missingGlyphs`, `buildRomFont`, `layoutText` (T4); `dump-capture` (T5); `ASSETS` (T1). Produces o `DEF` e o `EXTRA` de cada estilo.

**Onde estão as fontes** (fatos do CAT §5 e da spec §6):
- **T16:** título: faixas cruas do patch `$E2:3F4F`, `$E2:3F8F`, `$E2:40AF`, `$E2:414F`, `$E2:418F`, `$E2:42AF`, `$E2:452F` (VRAM `$3410…$3700`) e `$E2:24AB` (`$3D30`) = NORMAL GAME / BATTLE GAME / PASSWORD / PUSH START BUTTON!. Títulos dos menus (2 faixas de 8 px cada): `$E1:0067`+`$E1:0267` (VS), `$E1:3575` (Battle Royale, na cena `ffa`), `$E0:D5DC`+`$E0:D7DC` (jogadores), `$E0:4240`+`$E0:4440` (regras) e `$E1:B699`+`$E1:B899` (personagem). Itens vermelhos: textos crus `$E1:0027`, `$E1:3335` e outros copiados para `$7F:8000` e o bloco ZTE `$CE:BE86`. Para achar exatamente quais, use o `.log` da captura (`_tmp_menus.log`) e a VRAM.
- **T17:** `ascii8` = `$D1:BC16`, 64 tiles 2bpp numa faixa (`raw`, `rows: [0xD1BC16]`, `tiles: 64`, `bpp: 2`). O mapa índice → caractere sai da VRAM/BG3 da captura de uma arena (`arena01`), onde o HUD e as mensagens usam a fonte. `banner` = `$D0:F57B`, 64 tiles 2bpp com PAUSE!, HURRY! e TIME UP! em 16 px de altura (2 linhas de tiles), vistos em `g3_HURRY*.png`, `g3_TIMEUP*.png` e `pause_p1*.png`. Grave `meta.timeUpWidth` = largura de "TIME UP!" na faixa (R27). `spriteBlue` = `$E0:0021`, `$E0:0819`, `$E0:1011`, `$E0:1809`, `$E0:2001`, `$E0:27F9`, `$E0:2FF1`, `$E0:37E9` (OBJ 4bpp crus da cena `stagesel`, com "Select a stage!", "Stage N" e os nomes das fases).
- **T18:** `bigBattle` = letras de BATTLE START! Aparecem depois do A na seleção de fase, **fora** da captura `stagesel`. Capture a VRAM entre f65 e f277 com o core instrumentado (`analise/investigacao/montarias-e-telas/flow_step.py tt_stage.bin tt_bs.bin "A:2" 120 bs 10`, depois o `capture()` de `graficos-formato/scenes.py`) e ache a origem pelo log de DMA. `bigScore` = SCORE BOARD (cena `scoreboard`, BG). `bigVictory` = VICTORY! (cena `victory`, OBJ laranja). `bigDraw` = DRAW GAME na textura Modo 7 (`mode7Draw()`, recortes `kind: 'mode7'`). Glifos próprios obrigatórios: `bigBattle` H; `bigScore` P e L; `bigVictory` A e Ó (O da ROM + acento próprio no mesmo estilo); `bigDraw` P e T.

**Regras dos glifos próprios** (spec §1.2 item 3, §6): mesma altura (`def.height`), mesma espessura de traço e **mesmos índices de cor** das letras vizinhas da ROM (contorno, preenchimento, brilho). Para acentos (Á Â Ã À É Ê Í Ó Ô Õ Ú Ç º), copie a letra-base da ROM **pixel a pixel** no `EXTRA` e desenhe o acento nas linhas de cima. Se a letra-base não couber com o acento na altura do estilo, encolha o miolo 1 px e registre isso no commit. Nada de fonte do sistema.

- [ ] **Step 1: Escrever o teste do grupo** (exemplo da T16; T17 e T18 trocam `STYLES`, o nome do fixture e os tons exigidos):

```ts
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { STRING_USES } from '../../src/render/text/strings';
import { GLYPH_MAPS } from '../../src/render/text/glyph-maps';
import { missingGlyphs, buildRomFont, type RomFont } from '../../src/render/text/text';
import { ASSETS } from './rom';

const STYLES = ['titleMenu', 'menuTitle', 'menuItem'] as const;          // T17: ['ascii8', 'banner', 'spriteBlue']; T18: os 4 big*
const TONES: Record<string, string[]> = { titleMenu: ['gray'], menuItem: ['gray', 'green', 'red', 'blue'] };  // T17: { banner: ['green'] }
const FIXTURE = join(__dirname, '../fixtures/rom/glyphs-menus.json');   // T17: glyphs-small; T18: glyphs-big

function glyphHash(f: RomFont): string {
  const h = createHash('sha1');
  for (const ch of [...f.glyphs.keys()].sort()) { const g = f.glyphs.get(ch)!; h.update(`${ch}:${g.w}x${g.h}:`); h.update(g.px); }
  return h.digest('hex');
}

describe('glifos: mapas e cobertura (sem ROM)', () => {
  it.each(STYLES)('%s tem mapa e cobre todo texto do jogo neste estilo', st => {
    expect(GLYPH_MAPS[st]).not.toBeNull();
    const miss = STRING_USES.filter(u => u.style === st).flatMap(u => missingGlyphs(st, u.text).map(c => `"${u.text}" → ${c}`));
    expect(miss).toEqual([]);
  });
  it.each(STYLES)('%s: tons usados pelas telas existem', st => {
    for (const t of TONES[st] ?? []) expect(GLYPH_MAPS[st]!.tones?.[t as never], `${st}.${t}`).toBeDefined();
  });
});

describe.skipIf(!ASSETS)('glifos com ROM', () => {
  it.each(STYLES)('%s: hash dos glifos decodificados = fixture', st => {
    const f = buildRomFont(st, ASSETS!)!;
    const got = { glyphs: f.glyphs.size, sha1: glyphHash(f) };
    const fx = existsSync(FIXTURE) ? JSON.parse(readFileSync(FIXTURE, 'utf8')) : { rom: '38f4394986bd39fcbe32a722a3fe103ee6177d9b', styles: {} };
    if (process.env.UPDATE_FIXTURES) { fx.styles[st] = got; writeFileSync(FIXTURE, JSON.stringify(fx, null, 2) + '\n'); }
    expect(fx.styles[st]).toEqual(got);
  });
});
```

  A T17 acrescenta: `it('banner: meta.timeUpWidth medido', () => expect(GLYPH_MAPS.banner!.meta!.timeUpWidth).toBeGreaterThan(0))` e, com ROM, `expect(['TEMPO ESGOTADO!', 'TEMPO!']).toContain(timeUpLabel())` (R27, anotando no commit qual saiu). A T18 acrescenta: com ROM, `buildRomFont('bigDraw', ASSETS)` tem `E`, `M` e `A` vindos de recortes `mode7` (não de `EXTRA`), e P e T vindos de `EXTRA`.

- [ ] **Step 2: Rodar e ver falhar** (os mapas ainda são `null`).
- [ ] **Step 3: Pesquisar.** Para cada faixa, gere um PNG com `dump-capture` (na cena certa) e identifique os caracteres. Meça `x` e `largura` de cada glifo: colunas sem pixel separam letras, e o kerning do original entra no `spacing`. Os caracteres repetidos em várias faixas usam o recorte mais limpo. Anote os tons: a linha de paleta (cena ou endereço na ROM) de cada cor usada pelas telas.
- [ ] **Step 4: Preencher `maps/<estilo>.ts`** (`strips`, `cuts`, `height`, `spacing`, `spaceWidth`, `palette`, `tones`, `meta`) **só com números** e **`extra/<estilo>.ts`** com os glifos que faltarem para cobrir `STRING_USES`.
- [ ] **Step 5: Gerar o fixture** (`SB4_ROM=… UPDATE_FIXTURES=1 npx vitest run tests/screens/glyphs-menus.test.ts`), conferir os PNGs de texto PT-BR renderizados (escreva um PNG de cada string do estilo com `layoutText` + `encodePng` no scratchpad e olhe) e rodar sem `UPDATE_FIXTURES`.
- [ ] **Step 6: Rodar tudo e commit** — `feat(texto): glifos <grupo> recortados da ROM e glifos próprios PT-BR no mesmo estilo`.

---

### Task 19: Origem dos mapas de BG das telas na ROM (A14)

**Files:**
- Modify: `web/src/render/screens-rom/map-sources.ts`
- Create: `web/src/render/screens-rom/map-decode.ts`, `web/scripts/screens/find-map-origin.ts`, `web/tests/screens/map-sources.test.ts`

**Possui:** esses arquivos.

**Objetivo:** fechar o 1º ponto da A14. Se a origem dos mapas de título, menus, placar, vitória e empate for encontrada na ROM, `MAP_SOURCES[cena]` passa a montar os mapas a partir dela, e as geometrias das T5, T8–T15 e T20 ficam como reserva. Se não for, a tarefa entrega a ferramenta, o teste e o resultado negativo documentado no commit, e `MAP_SOURCES` fica vazio.

**Procedimento** (timebox de 2 h):
1. Para cada captura, ler o mapa de BG1 (`$4000`) e BG2 (`$4400`) e o buffer `$7E:5000` da WRAM (`.wram`, offset `0x5000`, 960 B), que é a fonte do DMA de todo frame ([GFX §3]).
2. `find-map-origin.ts <cena>`: (a) busca crua dos 64 primeiros bytes de cada linha do buffer na ROM inteira; (b) busca de padrões de palavras sem o byte alto (paleta/flip variáveis); (c) decodifica com `rom/decode/tilemap.ts` do plano 5 (formato da ARN §2.3: 1 byte ignorado + tokens `código | rep<<10` + tabela código→entrada) a partir de cada ponteiro de 24 bits citado nos scripts `$C1:C182`, `$C1:C1B2`, `$C1:C1E2` e `$C2:9C35` (varrer ±`$100` bytes em volta de cada script atrás de ponteiros para bancos `$C0–$FF`) e compara com o buffer; (d) se nada bater, roda `graficos-formato/scenes.py` com um *watchpoint* de escrita em `$7E:5000–$7E:53BF` (o core instrumentado tem "último escritor") para achar a rotina e, dela, a tabela.
3. Encontrada a origem, `map-decode.ts` recebe o decodificador (se for novo) e `MAP_SOURCES[cena] = a => ({ bg1, bg2 })`. As casas de **texto original** (títulos e itens em inglês) são trocadas pela palavra de fundo daquela posição, porque o texto é nosso.

- [ ] **Step 1: Escrever `web/tests/screens/map-sources.test.ts`:**

```ts
import { MAP_SOURCES } from '../../src/render/screens-rom/map-sources';
import { ASSETS } from './rom';
import { loadCapture, capturedMap, mapMatch, type Rect } from './captures';

/** Áreas de texto original (ignoradas: viram fundo porque o texto é nosso). */
const TEXT: Record<string, Rect[]> = {
  title: [{ x0: 40, y0: 140, x1: 216, y1: 212 }],
  vsmode: [{ x0: 60, y0: 44, x1: 194, y1: 62 }, { x0: 76, y0: 76, x1: 176, y1: 158 }],
  ffa: [{ x0: 60, y0: 44, x1: 194, y1: 62 }, { x0: 80, y0: 90, x1: 200, y1: 142 }],
  players: [{ x0: 46, y0: 12, x1: 208, y1: 32 }, { x0: 40, y0: 44, x1: 232, y1: 190 }],
  rules: [{ x0: 52, y0: 20, x1: 202, y1: 40 }, { x0: 28, y0: 52, x1: 232, y1: 190 }],
  charsel: [{ x0: 40, y0: 4, x1: 216, y1: 30 }],
  stagesel: [{ x0: 60, y0: 0, x1: 196, y1: 28 }, { x0: 40, y0: 146, x1: 216, y1: 200 }],
  scoreboard: [{ x0: 40, y0: 16, x1: 220, y1: 56 }],
  victory: [],
  draw2: [],
};

describe('origens de mapa (A14)', () => {
  it('só cenas conhecidas', () => {
    for (const k of Object.keys(MAP_SOURCES)) expect(Object.keys(TEXT)).toContain(k);
  });
  describe.skipIf(!ASSETS)('com ROM e capturas', () => {
    it.each(Object.keys(TEXT))('%s: mapa da ROM = captura fora do texto (≥ 99 %)', scene => {
      const src = MAP_SOURCES[scene as keyof typeof MAP_SOURCES];
      const cap = loadCapture(scene);
      if (!src || !cap) return;
      const maps = src(ASSETS!);
      for (const [layer, addr] of [['bg1', 0x4000], ['bg2', 0x4400]] as const) {
        if (maps[layer]) expect(mapMatch(maps[layer]!, capturedMap(cap, addr), TEXT[scene]), `${scene} ${layer}`).toBeGreaterThanOrEqual(0.99);
      }
    });
  });
});
```

- [ ] **Step 2: Rodar a pesquisa** (procedimento acima) e preencher `MAP_SOURCES` com o que for encontrado.
- [ ] **Step 3: Rodar tudo e commit** — `feat(telas-rom): origem dos mapas de BG na ROM (A14): <cenas encontradas | resultado negativo e onde se procurou>`. O resultado, positivo ou negativo, vai para a mensagem, para o controlador atualizar a A14 na spec.

---

### Task 20: Placar final (descida) e VITÓRIA

**Files:**
- Replace: `web/src/screens/victory.ts` (esqueleto da T6)
- Create: `web/src/render/screens-rom/victory.ts`, `web/tests/screens/victory.test.ts`

**Possui:** esses arquivos.

**Interfaces:**
- Consumes: `VICTORY`, `SCORE` (T6), `FADE_OUT_1`, `FADE_IN_1`, `FADE_MENU`, `fadeSpec` (T2), `VOICE`, `MUSIC` (T2), `closeMatch` (T6), `drawScoreboard` (T13; esqueleto da T6), `racerScreen` (T21), `stageScreen` (T11), `S`, `drawText` (T4), cena `victory` (T5), `assets.anim(0xD82A81)`, `assets.anim(0xC3E7F7)`, `character(c).victoryFrame` (`rom-api`)
- Produces: `victoryScreen(app, ms, startS): Screen & { readonly s: number; cameraY(): number; textX(): number | null; runnerX(k: number): number | null; championOnTrophy(): boolean; confetti(): boolean }`

**Regras (§6.12, §7.4, §7.5, R9):**
- `s` começa em `startS − 1` e cada update faz `s++` (o 1º update tem `s = startS = 557`).
- `cameraY() = 2·min(128, max(0, s − 557))` (0 → 256). Desenho: `drawScoreboard(ctx, bank, ms, s, −cameraY())` e a cena da vitória em `y = 224 − cameraY()`.
- `textX()`: `null` antes de 693. Entre 693 e 703 vai linear de 256 até o alvo (centrado: `128 − ⌊largura de "VITÓRIA!"/2⌋`). Depois fica no alvo.
- Corredores: os slots ativos em ordem, `k` = índice entre eles. `runnerX(k)`: `null` antes de 723, linear de `256 + 24·k` até `alvo_k = 40 + 48·k` entre 723 e 763, e depois `alvo_k`. Com a ROM, animação `D8:2A81`. O campeão (`ms.champions[0]`; no modo Em Equipes todos os campeões, o primeiro por cima) sai da fila em `s ≥ 783` (`championOnTrophy`) e fica sobre o troféu com `C3:E7F7` e a folha `victoryFrame`.
- `confetti()` = `s ≥ 763` (partículas próprias de 2×2 px em 3 cores, determinísticas pelo `s`; A14).
- `s = 795`: `voice($0A)` (a música `$16` já veio do placar).
- Botões A, B ou START (`pressedAny`) a partir de `s ≥ 557`: `closeMatch(ms)`. Com `ms.cfg.rules.racer` e Todos contra Todos: `app.transition(() => racerScreen(app, ms), FADE_MENU)`. Senão: `app.transition(() => stageScreen(app), fadeSpec(FADE_OUT_1, FADE_IN_1, [{ at: 15 + 123, run: a => a.audio.ensureMenus(MUSIC.menus) }], 15 + 123))` (preto de 123 f). A fase é a mesma (`setup.stage` não muda) e as coroas zeram porque a próxima partida é nova. Sem botão, espera sem limite.
- ROM: cena `victory` (arquibancada, gramado, troféu dourado com asas no centro), geometria das capturas `victory`, `vict1` e `after_victory`; "VITÓRIA!" (`bigVictory`). Fallback: gramado verde, arquibancada em faixas, `bank.trophy()` 48×48 no centro, `bank.bomber` para os corredores e o campeão, e "VITÓRIA!" com escala 2 no tom `orange`.

- [ ] **Step 1: Escrever o teste** `web/tests/screens/victory.test.ts`:

```ts
import { victoryScreen } from '../../src/screens/victory';
import { createMatchSession, beginRound, endRound, carry, resetCarry } from '../../src/game/match-session';
import { parseConfig } from '../../src/game/config';
import { BTN, matchRngState } from '../../src/game/core-api';
import { forceWin, runUntil, skipIntro } from './core-helpers';
import { mkApp, tap, idle, settle } from './helpers';

beforeEach(() => resetCarry());
function champ(q = '?players=3&humans=1&matches=1') {
  const env = mkApp();
  const ms = createMatchSession(parseConfig(q));
  const r = beginRound(ms); skipIntro(r); forceWin(r, 1); runUntil(r, x => x.phase === 'over'); endRound(ms);
  const v = victoryScreen(env.app, ms, 557); env.app.go(v); env.sink.clear();
  return { ...env, ms, v };
}

describe('VITÓRIA (§6.12)', () => {
  it('descida de 2 px/f por 128 f a partir de S=557', () => {
    const { app, v } = champ();
    idle(app, 1); expect([v.s, v.cameraY()]).toEqual([557, 0]);
    idle(app, 64); expect(v.cameraY()).toBe(128);
    idle(app, 100); expect(v.cameraY()).toBe(256);
  });
  it('"VITÓRIA!" entra pela direita em 693–703; corredores em 723–763; confete em 763; campeão no troféu em 783', () => {
    const { app, v } = champ();
    idle(app, 136); expect([v.s, v.textX()]).toEqual([692, null]);
    idle(app, 1); expect(v.textX()).toBe(256);
    idle(app, 10); const tx = v.textX()!; idle(app, 5); expect(v.textX()).toBe(tx);
    expect(tx).toBeLessThan(128);
    idle(app, 15); expect([v.s, v.runnerX(0)]).toEqual([723, 256]);
    idle(app, 40); expect([v.runnerX(0), v.runnerX(1), v.confetti()]).toEqual([40, 88, true]);
    idle(app, 19); expect(v.championOnTrophy()).toBe(false);
    idle(app, 1); expect(v.championOnTrophy()).toBe(true);
  });
  it('voz $0A em S=795', () => {
    const { app, sink } = champ();
    idle(app, 238); expect(sink.of('voice')).toEqual([]);
    idle(app, 1); expect(sink.of('voice').map(c => c.id)).toEqual([0x0a]);
  });
  it('A, B ou START desde S=557: fade 15, preto 123, fase com a música $12; RNG levado adiante', () => {
    const { app, sink, ms } = champ();
    tap(app, BTN.START);
    const t0 = app.tick;
    expect(carry.seed).toBe(matchRngState(ms.match));
    settle(app);
    expect(app.screen.id).toBe('stage');
    expect(sink.since(t0).filter(c => c.op === 'music').map(c => [c.t, c.id])).toEqual([[138, 0x12]]);
  });
  it('Corrida Bônus ligada (Todos contra Todos): a corrida vem antes da fase', () => {
    const { app } = champ('?players=3&humans=1&matches=1&racer=1');
    tap(app, BTN.A); settle(app);
    expect(app.screen.id).toBe('racer');
  });
  it('espera sem limite', () => {
    const { app } = champ();
    idle(app, 3000);
    expect([app.screen.id, app.inTransition]).toEqual(['victory', false]);
  });
});
```

(Conta: o 1º update é `s = 557`. 136 updates → 692, +1 → 693, +10 → 703, +5 → 708, +15 → 723, +40 → 763, +19 → 782, +1 → 783. Voz: 238 updates → 794, +1 → 795. Corredores: slots ativos 0, 1, 2, então `k = 0` é o slot 0 e `k = 1` o slot 1.)

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** a tela e os desenhos, com o teste de captura (`skipIf`) na cena `victory` (≥ 97 % fora do texto).
- [ ] **Step 4: Rodar tudo e commit** — `feat(telas): placar final com descida da câmera e VITÓRIA (texto, corredores, campeão no troféu, confete, voz $0A)`.

---

### Task 21: Corrida Bônus (provisória, A2)

**Files:**
- Replace: `web/src/screens/racer.ts` (esqueleto da T6)
- Create: `web/src/render/screens-rom/racer.ts`, `web/tests/screens/racer.test.ts`

**Possui:** esses arquivos.

**Interfaces:**
- Consumes: `RACER` (T6), `carry` (T6), `drawRacerPrize`, `racerPrizeKey` (`core-api`), `FADE_MENU` (T2), `stageScreen` (T11), `S`, `RACER_PRIZE_NAMES`, `drawText` (T4), `character(c)` (`rom-api`)
- Produces: `racerScreen(app, ms): Screen & { readonly pos: number; readonly speed: number; readonly finished: boolean; readonly prize: number | null }`

**Regras (§3.14, §6.12, R20):**
- Campeão = `ms.champions[0]`. Por frame, enquanto não acabou: se `pressedAny & B` (o campeão pode usar qualquer controle, como nas telas compartilhadas), `speed = min(64, speed + 24)`. Depois `pos += speed / 8` e `speed = max(0, speed − 1)`. Acaba quando `pos ≥ 4096` ou no frame 900.
- Ao acabar: `const r = { seed: carry.seed ?? 0x0012 }`, `prize = drawRacerPrize(r)`, `carry.seed = r.seed` e `carry.racerPrize = { slot: campeão, prize }`. O prêmio fica na tela (ícone + `RACER_PRIZE_NAMES[racerPrizeKey(prize)]`) por 180 f ou até A/B/START (`pressedAny`, a partir do frame seguinte ao fim) → `FADE_MENU` → `stageScreen`.
- Desenho (sem gráficos da ROM catalogados): pista em gradiente (faixas horizontais de cor), o personagem do campeão (`character(c).frame(g)` com ROM, `bank.bomber` sem) andando em x proporcional a `pos`, "APERTE B!" (`banner`) piscando 32/32 até acabar e, depois, "PRÊMIO" + o nome (`ascii8`) + o ícone do item (`bank.item(id)`, com o mapeamento chave → item de `render/art/items.ts` do plano 6).

- [ ] **Step 1: Escrever o teste** `web/tests/screens/racer.test.ts`:

```ts
import { racerScreen } from '../../src/screens/racer';
import { createMatchSession, beginRound, endRound, carry, resetCarry } from '../../src/game/match-session';
import { parseConfig } from '../../src/game/config';
import { BTN } from '../../src/game/core-api';
import { forceWin, runUntil, skipIntro } from './core-helpers';
import { mkApp, tap, idle, settle } from './helpers';

beforeEach(() => resetCarry());
function race() {
  const env = mkApp();
  const ms = createMatchSession(parseConfig('?players=2&humans=1&matches=1&racer=1'));
  const r = beginRound(ms); skipIntro(r); forceWin(r, 0); runUntil(r, x => x.phase === 'over'); endRound(ms);
  const rc = racerScreen(env.app, ms); env.app.go(rc);
  return { ...env, rc };
}

describe('Corrida Bônus (R20)', () => {
  it('B acelera 24 (teto 64); atrito 1 por frame; posição += velocidade/8', () => {
    const { app, rc } = race();
    tap(app, BTN.B);
    expect([rc.speed, rc.pos]).toEqual([23, 3]);
    for (let k = 0; k < 5; k++) tap(app, BTN.B);
    expect(rc.speed).toBe(63);
  });
  it('sem B: acaba no frame 900; prêmio pelo RNG do jogo ($0012 → índice 4, semente $42B9)', () => {
    const { app, rc } = race();
    idle(app, 899); expect(rc.finished).toBe(false);
    idle(app, 1);
    expect([rc.finished, rc.pos, rc.prize]).toEqual([true, 0, 4]);
    expect(carry).toEqual({ seed: 0x42b9, racerPrize: { slot: 0, prize: 4 } });
  });
  it('apertando B toda hora chega antes do tempo', () => {
    const { app, rc } = race();
    let n = 0;
    while (!rc.finished && n < 900) { tap(app, BTN.B); n++; }
    expect(rc.finished).toBe(true);
    expect(n).toBeLessThan(900);
    expect(rc.pos).toBeGreaterThanOrEqual(4096);
  });
  it('prêmio na tela por 180 f ou até um botão; depois a fase', () => {
    const { app } = race();
    idle(app, 900); idle(app, 179);
    expect(app.inTransition).toBe(false);
    idle(app, 1);
    expect(app.inTransition).toBe(true);
    settle(app);
    expect(app.screen.id).toBe('stage');
    const b = race();
    idle(b.app, 900); tap(b.app, BTN.A);
    expect(b.app.inTransition).toBe(true);
  });
});
```

(Conta do 2º teste: `rnd` com semente `$0012` dá `((0x13·0x383) & 0xFFFF) = 0x42B9` e `(0x42B9·17) >>> 16 = 4`. O `forceWin`/`endRound` não toca `carry`, que continua `null` → `$0012`. O 1º tap: `speed = 24`, `pos += 3`, `speed = 23`.)

- [ ] **Step 2: Rodar e ver falhar.** — **Step 3: Implementar.** — **Step 4: Rodar tudo e commit** — `feat(telas): Corrida Bônus provisória (A2) com prêmio pelo RNG do jogo`.

---

## Onda 4

### Task 22: Integração, boot, gesto de áudio, limpeza, fluxo completo e screenshots

**Files:**
- Replace: `web/src/main.ts`, `web/scripts/snapshots.mjs`
- Modify: `web/src/app/audio.ts` (fábrica do sink real), `web/src/render/text/strings.ts` (recebe strings locais que as tarefas da onda 3 tenham criado), `web/src/screens/menu.ts`, `web/src/screens/ui.ts`, `web/src/game/config.ts` (limpeza)
- Create: `web/tests/screens/flow.test.ts`, `web/tests/screens/glyph-coverage.test.ts`
- Delete: `web/tests/client/legacy/` (o que sobrou: `helpers.ts`, `menulist.test.ts`)

**Possui:** esses arquivos (a onda 4 só tem esta tarefa).

**Interfaces:**
- Consumes: tudo das ondas 1–3; do plano 5, a linha do painel da ROM no `main.ts` (preservar) e `rom/ui.ts` (seletor do `<input type=file>` para as screenshots)
- Produces: `registerAudioFactory(f: () => Promise<AudioSink>)` e `startRealAudio(d: AudioDirector): Promise<boolean>` em `app/audio.ts`, e o `main.ts` final

- [ ] **Step 1: Escrever `web/tests/screens/flow.test.ts`:**

```ts
import { titleScreen } from '../../src/screens/title';
import type { battleScreen } from '../../src/screens/battle';
import { carry, resetCarry } from '../../src/game/match-session';
import { BTN } from '../../src/game/core-api';
import { idleInput } from '../../src/input/input';
import { forceWin, forceClock } from './core-helpers';
import { mkApp, press, tap, settle } from './helpers';
import type { App } from '../../src/app/app';

beforeEach(() => resetCarry());
const until = (app: App, id: string) => { for (let n = 0; n < 5000 && app.screen.id !== id; n++) app.update(idleInput()); expect(app.screen.id).toBe(id); };
const step = (app: App, btn: number, id: string, slot?: number) => { press(app, btn, slot); settle(app); expect(app.screen.id).toBe(id); };

describe('fluxo completo com entrada simulada (aceite do plano 10)', () => {
  it('título → VS → modo → jogadores → regras → personagens → fase → partida → placar final → vitória → fase', () => {
    const { app, sink } = mkApp();
    app.go(titleScreen(app));
    step(app, BTN.A, 'vs'); step(app, BTN.A, 'mode'); step(app, BTN.A, 'players'); step(app, BTN.A, 'rules');
    press(app, BTN.DOWN); press(app, BTN.LEFT); press(app, BTN.LEFT);            // Coroas 3 → 1
    step(app, BTN.A, 'characters');
    press(app, BTN.A, 1); for (let k = 0; k < 4; k++) press(app, BTN.A, 0);
    settle(app); expect(app.screen.id).toBe('stage');
    press(app, BTN.A); until(app, 'battle');
    const b = app.screen as ReturnType<typeof battleScreen>;
    while (b.round.phase === 'intro') app.update(idleInput());
    forceWin(b.round, 0);
    until(app, 'scoreboard'); until(app, 'victory');
    tap(app, BTN.A); settle(app);
    expect(app.screen.id).toBe('stage');
    expect(carry.seed).not.toBeNull();
    const musics = sink.of('music').map(c => c.id);
    for (const m of [0x01, 0x12, 0x13, 0x14, 0x15, 0x16]) expect(musics).toContain(m);
  });
  it('rodada empatada por tempo → EMPATE → A → próxima rodada', () => {
    const { app } = mkApp();
    app.settings.setup.stage = 1;
    app.go(titleScreen(app));
    step(app, BTN.A, 'vs'); step(app, BTN.A, 'mode'); step(app, BTN.A, 'players'); step(app, BTN.A, 'rules'); step(app, BTN.A, 'characters');
    press(app, BTN.A, 1); for (let k = 0; k < 4; k++) press(app, BTN.A, 0);
    settle(app);
    press(app, BTN.A); until(app, 'battle');
    let b = app.screen as ReturnType<typeof battleScreen>;
    while (b.round.phase === 'intro') app.update(idleInput());
    forceClock(b.round, 1);
    until(app, 'draw');
    for (let k = 0; k < 20; k++) app.update(idleInput());
    tap(app, BTN.A); until(app, 'battle');
    b = app.screen as ReturnType<typeof battleScreen>;
    expect(b.ms.roundNo).toBe(2);
  });
  it('partida só de CPU: START de qualquer controle pausa', () => {
    const { app } = mkApp();
    app.settings.setup.slots = ['cpu', 'cpu', 'off', 'off', 'off'];
    app.go(titleScreen(app));
    step(app, BTN.A, 'vs'); step(app, BTN.A, 'mode'); step(app, BTN.A, 'players'); step(app, BTN.A, 'rules'); step(app, BTN.A, 'characters');
    press(app, BTN.A); press(app, BTN.A); settle(app);
    press(app, BTN.A); until(app, 'battle');
    const b = app.screen as ReturnType<typeof battleScreen>;
    tap(app, BTN.START);
    expect(b.paused).toBe(true);
  });
});
```

- [ ] **Step 2: Escrever `web/tests/screens/glyph-coverage.test.ts`** (aceite: "todo texto PT-BR tem glifo em todos os estilos, com e sem ROM"):

```ts
import { STRING_USES } from '../../src/render/text/strings';
import { GLYPH_MAPS } from '../../src/render/text/glyph-maps';
import { TEXT_STYLES } from '../../src/render/text/types';
import { missingGlyphs, fallbackMissing, buildRomFont, layoutText } from '../../src/render/text/text';
import { ASSETS } from './rom';

describe('cobertura de glifos (aceite do plano 10)', () => {
  it.each([...TEXT_STYLES])('%s: tem mapa da ROM', st => { expect(GLYPH_MAPS[st]).not.toBeNull(); });
  it('com ROM (fatos): todo texto tem glifo no seu estilo', () => {
    expect(STRING_USES.flatMap(u => missingGlyphs(u.style, u.text).map(c => `${u.style} "${u.text}" → ${c}`))).toEqual([]);
  });
  it('sem ROM: todo texto tem glifo na fonte do fallback', () => {
    expect(STRING_USES.flatMap(u => fallbackMissing(u.text).map(c => `"${u.text}" → ${c}`))).toEqual([]);
  });
  it.skipIf(!ASSETS)('com a ROM de verdade: todo texto rende com largura > 0 e sem glifo vazio', () => {
    for (const u of STRING_USES) {
      const img = layoutText(buildRomFont(u.style, ASSETS!)!, u.text);
      expect(img.w, `${u.style} "${u.text}"`).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 3: Acrescentar a `web/src/app/audio.ts`:**

```ts
type AudioFactory = () => Promise<AudioSink>;
let factory: AudioFactory | null = null;
/** O plano 11 registra aqui como criar o sink real (AudioWorklet). Chamado só depois do 1º gesto (§6.1). */
export function registerAudioFactory(f: AudioFactory): void { factory = f; }
export async function startRealAudio(d: AudioDirector): Promise<boolean> {
  if (!factory) return false;
  d.setSink(await factory());
  return true;
}
```

- [ ] **Step 4: Substituir `web/src/main.ts`** (preservando a linha do painel da ROM do plano 5):

```ts
import { App } from './app/app';
import { browserStorage, defaultSettings, loadSettings, saveSettings } from './app/settings';
import { startLoop } from './app/loop';
import { FADE_IN_1 } from './app/fade';
import { startRealAudio } from './app/audio';
import { onRomChange } from './app/rom-api';
import { parseConfig } from './game/config';
import { createMatchSession, carry, type MatchSession } from './game/match-session';
import { InputManager, buildInput, emptyDevices, withEscapeAsBack } from './input/input';
import { createDisplay } from './render/display';
import { SpriteBank } from './render/sprite-bank';
import { titleScreen } from './screens/title';
import { battleScreen } from './screens/battle';
// <linha do plano 5 que monta o painel da ROM no boot — manter>

const store = browserStorage();
const params = new URLSearchParams(window.location.search);
const settings = params.has('reset') ? defaultSettings() : loadSettings(store);
if (params.has('reset')) saveSettings(store, settings);
if (params.has('seed')) carry.seed = Number.parseInt(params.get('seed')!, 10) & 0xffff;

const input = new InputManager(window, settings.keymaps);
input.setPadmaps(settings.padmaps);
const app = new App(settings, {
  save: s => saveSettings(store, s),
  setKeymaps: m => input.setKeymaps(m),
  applyInput: s => { input.setKeymaps(s.keymaps); input.setPadmaps(s.padmaps); },
  seed: () => 0x0012,
});
app.audio.setVolume(settings.options.musicVol / 10, settings.options.sfxVol / 10);

// Áudio só depois do 1º gesto (§6.1); trocar de ROM recria o sink (os samples vêm da ROM).
let audioOn = false;
const gesture = () => { if (!audioOn) void startRealAudio(app.audio).then(ok => { audioOn = ok; }); };
window.addEventListener('keydown', gesture);
window.addEventListener('pointerdown', gesture);
onRomChange(() => { if (audioOn) void startRealAudio(app.audio); });

const ctx = createDisplay(document.getElementById('screen') as HTMLCanvasElement);
const bank = new SpriteBank();
if (params.has('quick')) app.go(battleScreen(app, createMatchSession(parseConfig(window.location.search))));
else app.transition(() => titleScreen(app), { out: [], black: 0, in: FADE_IN_1 });

if (import.meta.env.DEV && params.has('debug')) {
  (window as unknown as { __crown: unknown }).__crown = {
    app, get ms(): MatchSession | null { return (app.screen as Partial<{ ms: MatchSession }>).ms ?? null; },
  };
}

let prev = emptyDevices();
startLoop(() => {
  const cur = input.poll();
  app.update(withEscapeAsBack(buildInput(cur, prev, app.settings.devices, input.takeLastKey(),
    { connected: input.connected(), esc: input.escHeld(), padButton: input.takePadButton() })));
  prev = cur;
}, () => app.draw(ctx, bank));
```

- [ ] **Step 5: Limpeza.** Remover o que ficou sem uso: `MenuList`, `cycle` e `clamp` de `screens/menu.ts` (se nada importar); de `screens/ui.ts`, `drawCursor`, `drawMenuPage`, `drawMenu`, `menuPanelRect`, `drawTitleBar`, `drawFooter`, `drawText` e `drawTextRight` (o `drawText` de `ui.ts` conflita no nome com o de `render/text`); de `game/config.ts`, `displayName`, `validateSetup` e `names`. Mover para `strings.ts` as strings locais das tarefas da onda 3 (registrando-as em `STRING_USES`). Apagar `tests/client/legacy/`. Conferir com `grep -rn "legacy\|session.ts\|settings-screen" web/src web/tests`: nada.

- [ ] **Step 6: Screenshots.** Reescrever `web/scripts/snapshots.mjs`. Duas passadas, `snapshots/fallback/` e, se `SB4_ROM` existir, `snapshots/rom/`. Na passada ROM, carregar o arquivo pelo `<input type="file">` do painel do plano 5: `page.setInputFiles(<seletor do rom/ui.ts>, process.env.SB4_ROM)`. Percorrer com o teclado, usando `window.__crown.app.screen.id` e `__crown.ms`: título, VS, modo, jogadores, regras, personagens, equipes, fase, fase durante "BATALHA!" (f100), intro (f5 e f20 da rodada), partida, pausa, RÁPIDO!! (via `?quick&time=0` com espera até 0:01, ou injetando `ms.round.clock.sec = 62`), TEMPO ESGOTADO!, placar (S = 60 e S = 200), EMPATE (S = 60 e S = 300), placar final na descida, VITÓRIA (S = 800), corrida, opções e remapeamento. Rodar `npm run snap` e **olhar** as imagens das duas passadas, comparando com os quadros `…/analise/extraido/montarias-e-telas/g_*.png`.

- [ ] **Step 7: Rodar o aceite** (seção abaixo) e commit — `feat(telas): integração do plano 10 (boot, gesto de áudio, fluxo completo, cobertura de glifos, screenshots)`.

---

## Aceite do plano (spec §11, linha 10)

Rodar na worktree integrada (`/Users/dlotuz/Projetos Claude/Bomber Project/.worktrees/fidelity/web`):

```bash
npx tsc --noEmit && npx vitest run && npm run build
SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc" \
SB4_CAPTURES="/Users/dlotuz/Projetos Claude/Bomber Project/analise/extraido/graficos-formato/cenas" npx vitest run
SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc" npm run snap
```

| Critério da §11 | Onde é verificado |
|---|---|
| Fluxo título → … → vitória → fase com entrada simulada | `tests/screens/flow.test.ts` (T22) |
| Fades de 15 e de 28 | `app-shell.test.ts` (T2), `title-vs.test.ts` (T8), `battle.test.ts` (T12) |
| Repetição 20/5 e 36/21 | `repeat.test.ts` (T3), `menu-kit.test.ts` (T7), `stage.test.ts` (T11), `characters-teams.test.ts` (T10) |
| Rolagem 8 × 16 | `timeline.test.ts` (T6), `stage.test.ts` (T11) |
| "BATALHA!" f65–277 (e a sequência de 646 f) | `timeline.test.ts`, `stage.test.ts` |
| Placar 497/4 (S = 511 / S = 18) | `scoreboard.test.ts` (T13) |
| EMPATE só com A ou B | `draw.test.ts` (T14) |
| Placar final sem pular e descida em f954 (S = 557) | `scoreboard.test.ts`, `victory.test.ts` (T20) |
| P1 escolhe as CPUs; B de qualquer um volta | `characters-teams.test.ts` (T10) |
| Pausa por qualquer controle, sem escurecer | `battle.test.ts` (T12) |
| Desconexão pausa | `battle.test.ts` (T12) |
| Remapeamento persiste | `options.test.ts` (T15), `settings.test.ts` (T3) |
| Todo texto PT-BR tem glifo em todos os estilos, com e sem ROM | `glyph-coverage.test.ts` (T22), `glyphs-*.test.ts` (T16–T18), `text.test.ts` (T4) |
| Screenshots | `npm run snap` (T22): `snapshots/fallback/*` e `snapshots/rom/*` revisados |
| Os testes antigos continuam ou foram substituídos conscientemente | tabela da T1: cada `legacy/*` é apagado pela tarefa que o substitui |

---

## Riscos

1. **Nomes dos planos 5 e 6.** O plano 6 já foi alinhado: `createMatch(rules, stage, seed, chars)`, `setRacerPrize`, `finishRound` com retorno, `RACER_PRIZES = 17`, `drawRacerPrize` e `INTRO_TICKS = 62`. O plano 5 ainda não existia quando este plano foi escrito. A T1 prende tudo nas duas portas, e se o `SceneAssets`, o `Mode7Layer` ou o `romState` tiverem outra forma, só `rom-api.ts` muda.
2. **Pesquisa nas tarefas de ROM** (T5, T8–T11, T13, T14, T16–T20). A geometria e os glifos saem das capturas e podem levar mais que 2 h por tarefa. Nada disso bloqueia a lógica: `drawText` cai no fallback enquanto um estilo não tiver mapa, e as telas funcionam sem ROM. A T22 exige os 10 mapas de glifo. Se algum ficar para trás, o controlador decide entre adiar o aceite e aceitar com o fallback naquele estilo, registrando a decisão.
3. **Mapas de BG (A14).** Se a T19 não achar a origem, ficam as geometrias medidas (≥ 97 % contra a captura). As diferenças que sobrarem aparecem nas screenshots.
4. **Tempos com ±1 frame de incerteza** (R2, R5, R7, R8, R9). As referências da MNT são frames de vídeo com "~". As regras deste plano fixam números exatos nos testes. Se uma verificação no emulador contradisser, muda-se `timeline.ts` e o teste da T6, e nada mais.
5. **Dependências na mesma onda.** A T7 usa o `repeat.ts` da T3 (cópia idêntica se preciso) e a T6 usa um `SetupLike` estrutural. A T11 chama `battleScreen` da T12, e a T13 chama `victoryScreen` da T20, pelos esqueletos da T6. Os testes de cada tarefa só dependem do **id** da tela de destino, que o esqueleto já tem.
6. **Integração com o plano 11.** O som dos eventos (`setGameEventAudio`) e a fábrica do sink real (`registerAudioFactory`) entram por registro. O plano 11 acrescenta **uma linha de import** no `main.ts` ao ser mesclado. Esse acordo fica registrado no PR (spec §11: interfaces só mudam com acordo). O volume usa a interface opcional `VolumeControl` (R25).
7. **Modo 7 do EMPATE.** Se a PPU do plano 5 não tiver escala no Modo 7 ("mínimo"), a T14 desenha a textura já escalada por conta própria (vizinho mais próximo, num canvas) e registra isso no commit.
8. **Seletor de arquivo.** `openRomDialog()` a partir da tecla A nas Opções depende da ativação transitória do navegador (o update roda no `requestAnimationFrame` logo depois do `keydown`). Se o navegador bloquear, o painel do plano 5 continua com o botão DOM "Escolher arquivo".
9. **Capturas fora do repositório.** Os testes que comparam com capturas pulam sem `SB4_CAPTURES`. O controlador precisa rodá-los localmente antes de aceitar cada tarefa de tela.

---

## Resultado da execução (2026-09-26)

**Concluído.** Branch `feat/p10` (com os planos 5–9 integrados): 1364 testes com `SB4_ROM` + `SB4_CAPTURES` (11 pulados),
`tsc` limpo, `npm run build` ok, `npm run snap` com e sem ROM revisado. 22 tarefas em 4 ondas, cada uma revisada (várias
com 2–3 rodadas de correção; T16 e T17 refeitas por um implementador novo); revisão final da branch com passada visual contra
as capturas + uma onda de correção em 4 partes paralelas (A–D) + a correção R1, re-revisada.

### Fidelidade conferida
- Mapas de BG das telas lidos da ROM em tempo de execução (A14, T19): título, VS/FFA/jogadores/regras, personagem, fase,
  placar, vitória, EMPATE (`draw2`); textos em inglês das faixas apagados; nenhum texto da ROM em inglês visível (só a linha
  "©1996 HUDSON SOFT", decisão abaixo).
- Glifos recortados da ROM: menus (cursiva, 96,5–100 % de tinta contra as faixas originais), grandes (BATALHA!, PLACAR,
  VITÓRIA!, EMPATE), ascii8, faixas de 16 px (PAUSA/RÁPIDO/TEMPO) e o azul da seleção de fase; glifos próprios só onde a ROM
  não tem a letra, no mesmo traço e índices.
- Prévias das 10 fases e paletas por slot da ROM (`$C1:A8D1`, `$C1:A92B`), iguais às capturas; retratos dos jogadores da ROM
  (`$CD:E585`, paletas `$C1:B3C3`) no placar e na seleção de personagem; coroas do placar (base `$100`, paleta 5, parada no
  tile `$106`); subtração de cor do SNES no miolo das molduras (CGADSUB `$82`).
- Tempos da §6 (fades, repetições 20/5 e 36/21, BATALHA! 646 f, placar 497/4, descida f954) conferidos pela revisão final;
  EMPATE com os tempos medidos no emulador (preto 104 f, voz S = 147 — aplicados pelo plano 11).

### Decisões tomadas durante a execução
- Título com ROM mostra o logo original (BG1 + OBJ do mesmo quadro); sem ROM, o logo próprio CROWN BLAST.
- "©1996 HUDSON SOFT" continua visível no título (aviso de direitos, igual em PT-BR).
- R27: com a ROM, `timeUpLabel()` = "TEMPO!" ("TEMPO ESGOTADO!" passa de 1,25 × a largura de "TIME UP!").
- Motor de texto ganhou opções aditivas (kern, grid16, máscara por sementes, `base`, `bodyOnly`, `outline`, `spans`, `remap`,
  `under`, `grayscale`, `shrinkTop`, `bare`); estilos sem elas saem idênticos.
- Tom cinza (item desabilitado) = luma de uma linha da ROM (não existe paleta cinza na ROM).
- `mirrorBlankLeftHalf` no BG1 do título 🟡: reproduz a captura a 100 %, mas o motivo de o hardware duplicar as linhas não foi
  achado.

### Pendências
- Coluna decorativa da seleção de personagem sem origem achada no mapa (os retratos vêm da ROM; a coluna fixa ao lado não).
- Acento agudo de Ó/Ú no ascii8 quase some sem o fundo cinza ("ALEATÓRIOS").
- Glifos próprios D, O, G, B das faixas são os mais fracos visualmente.
- Feixes do EMPATE com corte reto no topo entre as letras (o original os esconde atrás de "DRAW GAME" em duas linhas).
- M8 (largura de EMPATE), M9 (cursores da seleção de personagem como retângulos), M10 ("1P" encostando na corda nas equipes).
- Dois leitores de PNG nos testes (`capture-png.ts`, `png-read.ts`).
