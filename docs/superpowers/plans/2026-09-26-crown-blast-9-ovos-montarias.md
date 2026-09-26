# Crown Blast: Plano 9, Ovos e montarias

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ovos escondidos (item `$30`) e as 7 montarias do Battle (tipos 2, 3, A, C, D, E, F), iguais ao SB4: revelação com teto de 2, 43 ticks para montar, acerto absorvido (1 + 51 + 32; com reserva 1 + 44), as habilidades passivas e as de Y, o visual do traje da fase 10, as camadas de desenho (ROM e fallback) e as dicas de IA.

**Architecture:** Tudo entra pelos pontos de extensão da spec §2.5, sem mexer no núcleo do plano 6.
- `core/mounts/` implementa o `MountModule` (`revealEgg`, `stepOnEgg`, `onHit`, `onY`, `passes`, `bombType`, `kicks`, `tick`, `ai`). Por dentro, um **registro de habilidades** (`abilities.ts` → `abilities/typeX.ts`, um arquivo por tipo) deixa as 7 montarias serem feitas em paralelo.
- O estado do plano fica em `Player.mount` (`MountRider`) e `RoundState.mountState` (`MountState`: projéteis). Tudo em objetos e arrays simples, para o hash JSON continuar trivial.
- O teto `$1ED4` **não é um contador guardado**: é derivado do estado (ovos na grade + montarias + reservas + míssil D em voo). Assim ovo queimado, esmagado ou coberto pela pressão sai da conta sem gancho novo no core.
- Os projéteis (D, E, F) usam um motor único (`projectile.ts`), calibrado com as medições do emulador.
- Um **adaptador** (`core/mounts/core-api.ts`) é o único arquivo do plano que importa funções internas do core (colocar bomba, explodir, travar ação, tabela da cápsula). Ele já usa os nomes da Tarefa 1 do plano 6 (`units.ts`, `state.ts`, `bombs.ts`, `MOUNTS.current`, evento `{type:'mount', id}`); a Tarefa 1 deste plano só confere o que mudou no merge.
- **Convenção de casas (a do plano 6):** `cellOf(col, lin)` = índice; `cellAt(x, y)` = casa de um ponto em 1/256 px.
- Render: `render/rom/mounts/` (camada ROM + gancho do sprite do jogador) e `render/fallback/mounts/` (arte por código). Os endereços de animação e gráficos que a investigação não fechou são **medidos no emulador** (Tarefa 4) e viram fatos (`facts.ts` gerado + fixture de hashes).
- IA: `core/ai/mounts.ts` implementa `AiMountHints` (pegar ovo; quando usar o Y).

**Tech Stack:** TypeScript + Vite + Vitest (em `web/`). Python do venv das frentes para a medição no emulador.

**Spec:** `docs/superpowers/specs/2026-09-25-crown-blast-fidelidade-design.md` — §1, §2.5, §3 (ganchos), **§5**, §7, §9 item 9, §10, §11 (linha 9 + aceite), §12 A7/A8. Fonte: MNT Parte A (`analise/investigacao/montarias-e-telas/RELATORIO.md`), `mount_*.py`, `mount_battery_*.json`; ANI §1–§3 (`analise/investigacao/animacoes-sprites/RELATORIO.md`).

---

## Ondas e tarefas

O plano 9 roda na onda 2 global, **depois do merge dos planos 5 e 6**.

> **Alinhamento (26/09):** os nomes do core já seguem a Tarefa 1 do plano 6 (`MOUNTS.current`, `hooks.ts` com `init?`/`onStunLoss?`, `GameEvent` `{type:'mount', id}`, `units.ts`, `setAct`, `AiMountHints {useY, eggValue}`, `tests/core/kit.ts`, `createMatch(rules, stage, seed)`, API de `bombs.ts`). As tarefas 2–21 do plano 6 e o plano 5 ainda não tinham detalhe quando este plano foi escrito: a Tarefa 1 confere o comportamento (tabela do Step 1) e os nomes do plano 5 (`ObjEntry`, `RomAssets`, fábrica de assets, `tests/rom/helpers.ts`).

Internamente, 4 ondas:

| Onda | Tarefas (em paralelo dentro da onda) | Depende de |
|---|---|---|
| **1** | **T1** Sincronização com os planos 5/6 + esqueleto (tipos, adaptador, stubs, registros, helpers de teste) | planos 5 e 6 mesclados |
| **2** | **T2** Ciclo do ovo, montar e acerto · **T3** Motor de projéteis · **T4** Fatos de render (emulador → fixture + `facts.ts`) · **T5** Camada fallback · **T6** Dicas de IA | T1 |
| **3** | **T7** tipo 2 · **T8** tipo 3 · **T9** tipo A · **T10** tipo C · **T11** tipo D · **T12** tipo E · **T13** tipo F · **T14** Camada ROM · **T15** Traje (ROM + fallback) | T2 (T7–T13), T3 (T11–T13), T4 (T14, T15) |
| **4** | **T16** Integração, partidas de CPU e aceite | todas |

Posse de arquivos (todos sob `web/`, salvo indicação). Nenhum arquivo é tocado por duas tarefas da mesma onda.

| Tarefa | Possui |
|---|---|
| T1 | `src/core/mounts/{index,types,events,core-api,abilities,module}.ts`, `src/core/mounts/abilities/type{2,3,A,C,D,E,F}.ts` (stubs), `src/core/ai/mounts.ts` (stub), `src/render/rom/mounts/{index,layer,rider,costume}.ts` (stubs), `src/render/fallback/mounts/{index,layer,costume}.ts` (stubs), linhas acrescentadas em `src/core/mounts/index.ts` (`MOUNTS.current = mountModule`), `src/render/layers-index.ts` e (se faltar o contrato) `src/render/battle-layers.ts`, `tests/mounts/{helpers,rom-helpers,core-api.test}.ts` |
| T2 | `src/core/mounts/{module,eggs,rider}.ts`, `tests/mounts/{eggs,rider,module}.test.ts` |
| T3 | `src/core/mounts/projectile.ts`, `tests/mounts/projectile.test.ts` |
| T4 | `analise/investigacao/montarias-e-telas/mount_render_facts.py` (raiz do repo), `tests/fixtures/rom/mount-render.json`, `src/render/rom/mounts/facts.ts` (gerado), `tests/mounts/rom-facts.test.ts` |
| T5 | `src/render/fallback/mounts/{layer,art,sprites}.ts`, `tests/mounts/fallback.test.ts` |
| T6 | `src/core/ai/mounts.ts`, `tests/mounts/ai.test.ts` |
| T7–T13 | `src/core/mounts/abilities/typeX.ts` + `tests/mounts/typeX.test.ts` (X = 2, 3, A, C, D, E, F) |
| T14 | `src/render/rom/mounts/{layer,rider,sprites,gfx}.ts`, `tests/mounts/rom-layer.test.ts` |
| T15 | `src/render/rom/mounts/costume.ts`, `src/render/fallback/mounts/{costume,costume-art}.ts`, `tests/mounts/costume.test.ts` |
| T16 | `tests/mounts/{sim,acceptance,cpu}.test.ts`, `tests/mounts/sim.ts`; patch mínimo acordado no desenhista de jogadores do plano 7 se o gancho não estiver ligado (ver T16) |

## Global Constraints

- Worktree `/Users/dlotuz/Projetos Claude/Bomber Project/.worktrees/fidelity`, branch `feat/fidelity`. Rodar testes com `cd web && npx vitest run` e tipos com `npx tsc --noEmit`.
- ROM para testes locais: `SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc"`. Testes que usam a ROM: `describe.skipIf(!ROM)` / `describe.skipIf(!ASSETS)`. **Nunca** versionar bytes da ROM, imagens extraídas, paletas cruas ou áudio. Fixtures só com números, endereços e SHA-1.
- O núcleo (`src/core/**`) não importa nada de `render/`, `audio/`, `input/` nem `rom/`. Nada de `Math.random`, `Date` ou DOM no core. RNG do jogo só por `rnd(s.rng, n)`; a IA não consome o RNG.
- Arquivos compartilhados (`core/mounts/index.ts`, `render/layers-index.ts`, `render/battle-layers.ts`): **só acrescentar linhas**. O plano 9 não edita `core/types.ts` (usa a variante `{ type: 'mount' }` do `GameEvent`). Qualquer mudança de interface da §2.5 é registrada na descrição do PR ("Acordos de interface").
- Tempos em **ticks lógicos** (1/60 s, sem lag). Posições em 1/256 px, coordenadas de tela: centro da casa `X = 16·col − 1`, `Y = 16·(lin+2) − 1` (px).
- Códigos de grade: ovo = `0x0970 + tipo`; bloqueio de projétil = bit 15 do código (`EC40`, `CC80`, `C900`, `EDC0`, `EE80`).
- Commits em PT-BR, estilo `feat(mounts): ...`, terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Um commit por tarefa (no mínimo).
- Os valores marcados 🟡 são decisões provisórias deste plano (ver "Lacunas da spec decididas"). Cada um tem um passo de verificação no emulador quando a ferramenta existe; se a medição divergir, o implementador ajusta a constante **e** o teste, e registra no PR.

## Lacunas da spec decididas neste plano

| # | Lacuna | Decisão (provisória 🟡 salvo ✅) | Base |
|---|---|---|---|
| L1 | Acerto durante `mounting` / `dismount` | Imune: `onHit` devolve `true` sem efeito | a rotina `$C2:261E`/`$C2:10D5` não passa pelo teste de chama; T6_hit mostra o jogador vivo com a chama ainda na casa |
| L2 | Semântica de `$1ED4` | Derivado: ovos na grade (`0x097x`) + montadores em `mounting`/`riding` (+ `dismount` com reserva) + reservas + mísseis D em voo | MNT A.3 "ovos no chão + montarias ativas" |
| L3 | Vagas `$1ED5/$1ED6` | Menor vaga livre (1, depois 2). A vaga é liberada no início do desmonte sem reserva. O míssil D fica com a vaga da montaria lançada; se houver reserva, o jogador remonta na outra | MNT A.4 |
| L4 | 2º ovo quando montado | Decide o **tipo do ovo** (0–7 → reserva, até 3, fila; 8–F → fica na grade). Reserva remonta com o próprio tipo (A8) | `mount_follow.py` (`$32`), `mount_misc.py` (`$3A`) |
| L5 | Posição no desmonte | O pulo é só visual: X/Y lógicos não mudam. `inv = 32` é gravado ao fim do tick H+52 (sem reserva) / H+45 (com reserva) | `mount_battery` T6_hit: (31,47) antes e depois; `+$96 = 32` no quadro 178 = H+52 |
| L6 | Modelo dos projéteis D/E/F | Nasce na posição do montador no tick do Y (k = 0); a partir de k = 1 anda `v` por tick; no k = 1 acerta quem estiver a ≤ 16 px antes de andar; depois acerta com \|eixo\| ≤ alcance e \|transversal\| < 8 px. D: v = 2 px, alcance 12 px. E: v = 2 px, alcance 11 px. F: v = 0,5 px, alcance 0,5 px. Para ao passar do centro da casa se a próxima tem bit 15 | calibrado nos medidos: E acerta a 1/2/3/4 casas em k = 1/11/19/27; D explode em k = 34 a 5 casas; F acerta a 40 px em k = 79 |
| L7 | Vida dos projéteis | D: até bater. E: 28 ticks de voo (56 px ≈ 3,5 casas), depois nuvem por 16 ticks. F: 160 ticks de voo (80 px) | MNT "alcance ≈3 casas" e acerto a 4 casas |
| L8 | Explosão do D | Cruz na casa do míssil, alcance 2 (fogo 0), dono = montador (A8) | spec A8 |
| L9 | Recargas | E: 64 ticks (A8). F: uma nota por montador por vez. C: sem recarga (limitado pelas bombas) | spec A8 |
| L10 | Duração do lento (E) | `effect = {2, 64}`; a contagem é do core (1 a cada 4 ticks, §4.5) → 253–256 ticks; o teste aceita essa faixa (medido 255) | spec §5.2, §4.5 |
| L11 | Linha do C | Colocação instantânea no tick do Y; para em qualquer casa com código ≠ 0 (inclusive a própria); `$24`/`$25` consomem o Y sem efeito; o som sai pelos `bomb_placed` do core (SFX `$0C`) | MNT A.5 |
| L12 | Y com montaria passiva (2, 3, A) | `onY` devolve `false`: o Y segue para P/soco | `mount_battery` T5_Y: nada acontece |
| L13 | Eventos das montarias | Variante `{ type: 'mount'; id }` do `GameEvent` (reservada pelo plano 6) com campos extras (`mount`, `target`, `reserve`, `cause`) criados por `mev()`; ids: `egg_revealed`, `mount_start`, `mount_ready`, `egg_reserved`, `mount_lost`, `mount_ability`, `mount_struck`. SFX próprios desconhecidos (A8) ficam `null` em `MOUNT_SFX` | spec §3.15 "ver §5" (vazio); decisão 30 do plano 6 |
| L14 | Pegar ovo | Não cura doença nem emite `item_picked` | sem medição; ovo não passa pela rotina comum de item (`$C1:5E8B`) |
| L15 | Atordoamento montado | `onStunLoss` (gancho do plano 6): em `riding`, a montaria (e as reservas) some, não voa, e conta como a perda "montaria ou traje"; fora de `riding` devolve `false` | spec §3.10; decisão 17 do plano 6 |
| L16 | Fases `won`/`timeUp` | Projéteis congelam fora de `play`; tempos do montador correm em `play` e `won` | §3.12 (bombas congelam) |
| L17 | Sprite do jogador montado/traje (ROM) | Gancho novo `romPlayerHooks` em `render/battle-layers.ts`, consultado pelo desenhista de jogadores do plano 7 antes do desenho padrão | §2.5 não prevê troca do sprite do jogador |
| L18 | Tabela `$C2:76F5` | É do **traje** (índice `+$45 & 7` = traje, MEC §5.7), como diz a spec §5.3; a ANI a rotulou "Montado". As animações do montado saem da medição (T4) | MEC §3.4/§5.7, ANI §3 |
| L19 | Paleta das montarias na OAM | Medida em T4 (provisório: vaga 1 → OBJ pal 2, vaga 2 → OBJ pal 3) | 2 vagas = 2 conjuntos de gráficos |
| L20 | Tipo A + atravessa-bomba ("`$0A` anula") | Não implementado: o `passBomb` do item continua valendo | combinação rara; `passes` só concede |
| L21 | F em alvo já travado | Reinicia a dança (192); jogadores `dying`/`out` não são atingidos | – |

---

### Task 1: Sincronização com os planos 5/6 e esqueleto

**Files:**
- Create: `web/src/core/mounts/{types,events,core-api,abilities,module}.ts`, `web/src/core/mounts/abilities/type2.ts`, `type3.ts`, `typeA.ts`, `typeC.ts`, `typeD.ts`, `typeE.ts`, `typeF.ts`
- Modify (só acrescentar linhas): `web/src/core/mounts/index.ts` (do plano 6: `MOUNTS.current = mountModule`)
- Create (stub, substituído depois): `web/src/core/ai/mounts.ts`
- Create: `web/src/render/rom/mounts/{index,layer,rider,costume}.ts`, `web/src/render/fallback/mounts/{index,layer,costume}.ts`
- Modify (só acrescentar): `web/src/render/layers-index.ts`; se faltar, `web/src/render/battle-layers.ts` (contrato `romPlayerHooks`)
- Create: `web/tests/mounts/helpers.ts`, `web/tests/mounts/rom-helpers.ts`, `web/tests/mounts/core-api.test.ts`

**Interfaces:**
- Consumes (plano 6): `RoundState`, `Player`, `PlayerAct`, `GameEvent` (variante `mount`), `BTN`, `CODE`, `MountModule` (`core/hooks.ts`), `MOUNTS`/`NO_MOUNT` (`core/mounts/index.ts`), `AiMountHints` (`core/ai/hints.ts`), `rnd`, `units.ts` (`GRID_W`, `GRID_H`, `cellOf`, `colOf`, `linOf`, `cellAt`, `centerX`, `centerY`), `state.ts` (`setAct`, `isEggCode`), `bombs.ts` (`addBomb`, `canPlaceBomb`, `bombFireOf`, `fuseOf`, `explodeBomb`), tabela da cápsula `$C1:5DA4` (`core/tables/`), kit de teste `tests/core/kit.ts`. Plano 5: `ObjEntry`, `RomAssets`, `ROM` de `tests/rom/helpers.ts`, fábrica de `RomAssets`. `RomBattleLayer`/`FallbackBattleLayer`/`romLayers`/`fallbackLayers`.
- Produces: `MountRider`, `MountState`, `MountProjectile`, `MountAbility`, constantes de tempo, `rider(p)`, `mstate(s)`, `MountEvent`, `mev`, `MOUNT_SFX`, `core-api` (reexporta `GRID_W`, `GRID_H`, `cellOf`, `colOf`, `linOf`, `cellAt`, `centerX`, `centerY`, `rnd`, `isEggCode`; próprios: `EGG_TYPES`, `placeBombAt`, `explodeAt`, `lockAct`, `isEnemy`), `ABILITIES`, `mountModule` (stub), `mountAiHints` (stub), `romMountLayer`/`riderHook`/`costumeHook` (stubs), `fallbackMountLayer`/`fallbackCostumeLayer` (stubs), `RomPlayerHook`/`romPlayerHooks`, helpers de teste.

Esta tarefa é curta de propósito: confere os nomes reais e cria os arquivos que as ondas 2 e 3 só vão **substituir**, sem editar arquivos compartilhados de novo.

- [ ] **Step 1: Conferir o que os planos 5 e 6 entregaram.** Ler `docs/superpowers/plans/2026-09-26-crown-blast-5-rom-loader.md`, `...-6-core-fiel.md` e o código mesclado. Preencher esta tabela na descrição do PR (seção "Sincronização"), com o nome real ao lado de cada linha:

| Esperado (este plano, já com os nomes do plano 6) | Onde conferir | Se for diferente |
|---|---|---|
| `MountModule` com `init?, revealEgg, stepOnEgg, onHit, onY, onStunLoss?, passes?, bombType?(p): 0\|1\|2\|null, kicks?, tick, ai?` | `src/core/hooks.ts` | adaptar `module.ts` (T2); interface nova só com acordo no PR |
| Registro `MOUNTS: { current: MountModule }` + `NO_MOUNT` em `core/mounts/index.ts`; o plano 9 só **acrescenta** `MOUNTS.current = mountModule` no fim | `src/core/mounts/index.ts` | seguir o nome real |
| `revealCell(s, cell, ev)` (`bombs.ts`) chama `MOUNTS.current.revealEgg` quando a queima de um soft com item escondido `$30` termina, **com a casa já em `FLOOR`** | `core/bombs.ts` | se o core gravar `0970` antes, `revealEgg` sobrescreve; registrar |
| `pickup(s, p, ev)` (`items.ts`) chama `stepOnEgg(s, p, cell, ev)` **a cada tick** em que o jogador de pé está numa casa `isEggCode`, sem consumir a casa, sem curar e sem `item_picked` | `core/items.ts` | se consumir a casa, pedir ajuste no PR (sem isso o ovo tipo 8–F sumiria) |
| `checkHit` (`hit.ts`) consulta `onHit` **antes** de traje/coração, só para chama; `EE80` mata direto; `stunPlayer` usa `onStunLoss` na prioridade "montaria ou traje" | `core/hit.ts`, `core/items.ts` (`loseItems`) | registrar |
| `playerActions` (`actions.ts`) chama `onY` na **borda** do Y, antes de P/soco, só com o jogador livre | `core/actions.ts` | registrar |
| `MOUNTS.current.passes?.(p, CODE.SOFT)` no bloqueio `$82` do movimento (`blockedFor`); `bombType` na colocação (decisão 13 do plano 6); `kicks` no chute (decisão 14) | `movement.ts`, `bombs.ts`, `kick.ts` | registrar |
| `MOUNTS.current.tick` no fim de `tickObjects` (passo 4), chamado em `play` e `won` | `core/step.ts` | já confere com o esqueleto do plano 6 |
| `setAct(s, p, act, left)`: `left > 0` trava (entrada ignorada), `tickAct` decrementa e volta a `idle` em 0 | `core/state.ts`, `core/actions.ts` | `lockAct` no adaptador ajusta o deslocamento para "livre de novo no tick atual + n" (teste do Step 7) |
| `Player.effect {kind: 2, left}` → velocidade nível 7 em `speedLevel(s, p)`; `left` cai 1 a cada 4 ticks; `kind` volta a 0 no fim | `core/disease.ts` / `movement.ts` | registrar; o teste da T12 depende disso |
| `emptyRound`/`createRound` criam `mount: null` e `mountState: null` | `core/state.ts` | já confere com o plano 6 |
| `GameEvent` tem `{ type: 'mount'; id: string; slot?; cell? }` | `core/types.ts` | já confere (decisão 30 do plano 6) |
| Tabela da cápsula `$C1:5DA4` gerada em `core/tables/` (o plano 6 põe as tabelas soltas em `tables/misc.ts`) | `src/core/tables/*.ts` | importar em `core-api.ts` com o nome real; se não existir, abrir pendência do plano 6 (§3.16) e usar o literal da spec §5.1 com comentário |
| `addBomb(s, owner, cell, init?)`, `canPlaceBomb(p)`, `bombFireOf(p)`, `fuseOf(p)`, `explodeBomb(s, b, ev)` | `core/bombs.ts` | ajustar `placeBombAt`/`explodeAt` (Step 3) |
| `AiMountHints { useY?(s, slot): boolean; eggValue?(s, slot, cell): number }` e onde a IA os consulta | `src/core/ai/hints.ts`, `src/core/ai/*` | `mountAiHints` (T6) mapeia para `eggValue`/`wantMountY` |
| `RomBattleLayer`, `FallbackBattleLayer`, `romLayers`, `fallbackLayers`, `BattleObj` (igual ao `ObjEntry`; assets tipados `object` até o plano 7 trocar por `RomAssets`, decisão 3 do plano 6) | `src/render/battle-layers.ts`, `layers-index.ts` | seguir os nomes reais |
| Gancho para trocar o sprite do jogador na ROM | plano 7 (`docs/.../*-7-*.md`, `src/render/rom/**`) | se não existir, acrescentar `RomPlayerHook`/`romPlayerHooks` (Step 5) e registrar o acordo "o desenhista de jogadores do plano 7 consulta `romPlayerHooks`" |
| `ObjEntry`, `RomAssets.anim`, decodificadores `tiles.ts`/`zte.ts`, `ROM` em `tests/rom/helpers.ts`, fábrica de `RomAssets` | plano 5: `src/render/ppu/`, `src/rom/`, `tests/rom/helpers.ts` | usar os nomes reais em `rom-helpers.ts` e na T14 |
| Kit de teste do plano 6: `arena(opts)`, `put(s, slot, col, lin, dx?, dy?)`, `run(s, n, inputs)` | `web/tests/core/kit.ts` | `tests/mounts/helpers.ts` (Step 6) usa o kit |
| IA: `createAi()`, `aiInputs(s, ai, cpu, levelIdx)`; partida: `createMatch(rules, stage, seed?)`, `startRound(m)`, `finishRound(m, s)` | `core/ai/index.ts`, `core/match.ts` | T16 usa esses nomes |
| Transformação de coordenadas do fallback | `src/render/draw-game.ts` (adaptado na T19 do plano 6) | se o fallback não desenha em coordenadas de tela SNES 256×224, a T5 usa a função do plano 6 |

- [ ] **Step 2: Tipos e constantes** `web/src/core/mounts/types.ts`:

```ts
import type { RoundState, Player, GameEvent } from '../types';

export type MountPhase = 'mounting' | 'riding' | 'dismount';

/** Guardado em Player.mount. Espelha +$5C (tipo), +$5D (vaga) e +$52/+$54/+$56 (reservas). */
export interface MountRider {
  type: number;          // 2, 3, $A, $C, $D, $E, $F no Battle
  slot: 0 | 1 | 2;       // vaga de sprite $1ED5/$1ED6; 0 = sem vaga (desmontando sem reserva)
  phase: MountPhase;
  t0: number;            // tick em que a fase começou
  reserves: number[];    // tipos dos ovos reserva; [0] = o que vem logo atrás (máx. 3)
  trail: number[];       // [casa atual, anterior, ...] (máx. 4), para desenhar os reservas 1 casa atrás
  cooldown: number;      // recarga do Y (tipo E), ticks
  remount: boolean;      // desmonte com reserva (1 + 44)
}

export type ProjKind = 0xd | 0xe | 0xf;

export interface MountProjectile {
  id: number;
  kind: ProjKind;
  owner: number;         // slot do montador
  x: number; y: number;  // 1/256 px
  dir: 0 | 2 | 4 | 6;
  born: number;          // tick do Y (k = tick − born)
  state: 'fly' | 'cloud' | 'done';
  t: number;             // tick em que entrou no estado atual
  slot: 0 | 1 | 2;       // D: vaga de sprite da montaria lançada
}

export interface MountState { projectiles: MountProjectile[]; nextId: number }

export interface MountAbility {
  type: number;
  passes?(p: Player, code: number): boolean;
  bombType?(p: Player): 0 | 1 | 2 | null;
  kicks?(p: Player): boolean;
  onY?(s: RoundState, p: Player, r: MountRider, ev: GameEvent[]): boolean;
  tickProjectile?(s: RoundState, pr: MountProjectile, ev: GameEvent[]): void;
}

export const MOUNTING_TICKS = 43;   // $C2:261E
export const DISMOUNT_TICKS = 52;   // 1 ($C2:105E) + 51 ($C2:10D5)
export const REMOUNT_TICKS = 45;    // 1 + 44 ($C2:1089)
export const POST_INV = 32;         // +$96
export const MAX_ACTIVE = 2;        // $1ED4
export const MAX_RESERVES = 3;      // +$52/+$54/+$56

export function rider(p: Player): MountRider | null {
  return (p.mount as MountRider | null | undefined) ?? null;
}

export function mstate(s: RoundState): MountState {
  let m = s.mountState as MountState | null | undefined;
  if (!m) { m = { projectiles: [], nextId: 1 }; s.mountState = m; }
  return m;
}
```

- [ ] **Step 3: Eventos e adaptador.** O plano 6 já reservou na união `GameEvent` a variante `{ type: 'mount'; id: string; slot?: number; cell?: number }` (decisão 30 dele). Os eventos do plano 9 usam essa variante com campos extras; como são criados por uma função (e não como literal), o TS aceita os campos a mais sem editar `types.ts`. `web/src/core/mounts/events.ts`:

```ts
export type MountEventId =
  | 'egg_revealed' | 'mount_start' | 'mount_ready' | 'egg_reserved' | 'mount_lost' | 'mount_ability' | 'mount_struck';

/** Evento de montaria = variante { type: 'mount' } do GameEvent do plano 6, com dados extras. */
export interface MountEvent {
  type: 'mount'; id: MountEventId; slot?: number; cell?: number;
  mount?: number;                                  // tipo da montaria (2, 3, $A, ...)
  target?: number;                                 // mount_struck: slot atingido
  reserve?: boolean; cause?: 'hit' | 'launch' | 'stun';   // mount_lost
}

export function mev(e: Omit<MountEvent, 'type'>): MountEvent {
  return { type: 'mount', ...e };
}

/** SFX por evento de montaria (plano 11 consome). null = sem som medido (spec §12 A8). */
export const MOUNT_SFX: Readonly<Record<MountEventId, number | null>> = {
  egg_revealed: null, mount_start: null, mount_ready: null, egg_reserved: null,
  mount_lost: null, mount_ability: null, mount_struck: null,
};
```

Todo arquivo de produção que emite evento importa `mev` de `'./events'` (ou `'../events'` em `abilities/`) e faz `ev.push(mev({ id: ..., ... }))`. Nos testes, a comparação é pelo objeto completo (`{ type: 'mount', id: 'mount_lost', slot: 0, mount: 2, reserve: false, cause: 'hit' }`).

`web/src/core/mounts/core-api.ts` — único ponto de contato com funções internas do core. Os nomes abaixo são os do plano 6 (T1 dele: `units.ts`, `state.ts`, `rng.ts`; tabela de módulos: `bombs.ts`). A Tarefa 1 só confere e corrige o que mudou no merge:

```ts
import type { RoundState, Player, GameEvent, PlayerAct } from '../types';
import { setAct } from '../state';
import { addBomb, canPlaceBomb, bombFireOf, fuseOf, explodeBomb } from '../bombs';
import { MOUNTS } from './index';
import { CAPSULE } from '../tables/misc';                       // $C1:5DA4 (nome real do gerador do plano 6, §3.16)

export { rnd } from '../rng';
export { GRID_W, GRID_H, cellOf, colOf, linOf, cellAt, centerX, centerY } from '../units';
export { isEggCode } from '../state';

/** Tipos de montaria sorteáveis: $C1:5DA4 & $0F = [2,3,A,C,D,E,F] × 2. */
export const EGG_TYPES: readonly number[] = CAPSULE.map((v: number) => v & 0x0f);

/** Bomba de `p` na casa `cell`, com as regras da colocação normal (decisão 13 do plano 6: $24 impede, $25 exige todas
 *  livres e dá fogo 10, fogo total dá 7, tipo = MOUNTS.current.bombType?.(p) ?? p.bombType). Gasta 1 disponível e emite
 *  bomb_placed. Devolve false (sem efeito) se não puder colocar ou se a casa não for piso. */
export function placeBombAt(s: RoundState, p: Player, cell: number, ev: GameEvent[]): boolean {
  if (!canPlaceBomb(p) || s.grid[cell] !== 0) return false;
  addBomb(s, p.slot, cell, { fire: bombFireOf(p), type: MOUNTS.current.bombType?.(p) ?? p.bombType, fuse: fuseOf(p) });
  p.bombsFree--;
  ev.push({ type: 'bomb_placed', slot: p.slot, cell });
  return true;
}

/** Explosão imediata em cruz na casa `cell` (range 2 = fogo 0), sem perfurar, dono `owner`; emite `explosion`.
 *  Não é bomba do jogador: o `bombsFree` do dono não muda (se explodeBomb devolver a bomba ao dono, desfazer). */
export function explodeAt(s: RoundState, cell: number, range: number, owner: number, ev: GameEvent[]): void {
  const fire = range === 1 ? 10 : range - 2;
  const p = s.players[owner];
  const free = p.bombsFree;
  const b = addBomb(s, owner, cell, { fire, type: 0 });
  explodeBomb(s, b, ev);
  p.bombsFree = free;
}

/** Trava o jogador em `act`: chamado durante o tick atual T, ele volta a agir no tick T + ticks.
 *  setAct(s, p, act, left) do plano 6: left > 0 trava. O deslocamento (ticks ou ticks − 1) é fixado pelo teste do Step 7. */
export function lockAct(s: RoundState, p: Player, act: PlayerAct, ticks: number): void {
  setAct(s, p, act, ticks);
  p.actT0 = s.tick;
}

/** Adversário: presente, de pé, outro slot e, em Team Battle, de outro time (Rules.mode/teams do plano 6). */
export function isEnemy(s: RoundState, a: Player, b: Player): boolean {
  if (!b.present || b.state !== 'alive' || b.slot === a.slot) return false;
  return s.rules.mode !== 'team' || s.rules.teams[a.slot] !== s.rules.teams[b.slot];
}
```

Armadilhas:
- **`cellAt` do plano 6 é `(x, y)` em 1/256 px** (devolve −1 fora da grade); a casa por coluna/linha é `cellOf(col, lin)`. Todo o plano 9 segue essa convenção.
- `core-api.ts` importa `MOUNTS` de `./index`, e `index.ts` importa `./module` (que importa `./abilities` → `core-api`). O ciclo é só de uso em tempo de chamada (nenhum valor é lido no carregamento), o que o ESM aceita; se o Vitest reclamar, mover `placeBombAt` para ler o tipo via `mountModule.bombType` importado de `./module` de forma tardia (`import('./module')` não serve: usar o registro `MOUNTS` dentro da função, como está).
- Se `addBomb` não aceitar `fuse`/`fire`/`type` em `init`, montar o objeto `Bomb` conforme a interface do plano 6 (`fuse: 126`, `state: 'idle'`, `born: s.tick`, `chainAt: 0`) e gravar `CODE.BOMB` na casa.

- [ ] **Step 4: Registro de habilidades, stubs e módulo.** Um stub por tipo — por exemplo `web/src/core/mounts/abilities/typeC.ts`:

```ts
import type { MountAbility } from '../types';
export const ABILITY_C: MountAbility = { type: 0xc };
```

(iguais para `ABILITY_2` `type: 0x2`, `ABILITY_3` `0x3`, `ABILITY_A` `0xa`, `ABILITY_D` `0xd`, `ABILITY_E` `0xe`, `ABILITY_F` `0xf`). `web/src/core/mounts/abilities.ts`:

```ts
import type { MountAbility } from './types';
import { ABILITY_2 } from './abilities/type2';
import { ABILITY_3 } from './abilities/type3';
import { ABILITY_A } from './abilities/typeA';
import { ABILITY_C } from './abilities/typeC';
import { ABILITY_D } from './abilities/typeD';
import { ABILITY_E } from './abilities/typeE';
import { ABILITY_F } from './abilities/typeF';

/** Os 7 tipos do Battle. Os demais (0, 1, 4–9, B) ficam fora do escopo (spec §5.2). */
export const ABILITIES: Record<number, MountAbility> = {
  0x2: ABILITY_2, 0x3: ABILITY_3, 0xa: ABILITY_A, 0xc: ABILITY_C, 0xd: ABILITY_D, 0xe: ABILITY_E, 0xf: ABILITY_F,
};
```

`web/src/core/mounts/module.ts` (stub; a T2 substitui):

```ts
import type { MountModule } from '../hooks';
import { mountAiHints } from '../ai/mounts';
export const mountModule: MountModule = {
  revealEgg() {}, stepOnEgg() {}, onHit: () => false, onY: () => false, onStunLoss: () => false, tick() {}, ai: mountAiHints,
};
```

`web/src/core/ai/mounts.ts` (stub; a T6 substitui mantendo o formato): `export const mountAiHints: AiMountHints = { useY: () => false, eggValue: () => 0 };` (campos do `AiMountHints` do plano 6).

`web/src/core/mounts/index.ts` (do plano 6): **só acrescentar** no fim, no formato combinado por ele:

```ts
import { mountModule } from './module';
MOUNTS.current = mountModule;
export * from './types';
export * from './events';
```

Ciclo de import: `index → module → abilities → abilities/typeC → core-api → index`. O `core-api` só lê `MOUNTS` dentro de funções (nunca no carregamento), o que o ESM aceita.

- [ ] **Step 5: Camadas (stubs) e gancho do sprite do jogador.** Se o contrato ainda não existir, acrescentar ao fim de `web/src/render/battle-layers.ts`:

```ts
/** Troca o desenho de um jogador na ROM (montado, traje). null = desenho padrão do plano 7.
 *  O desenhista de jogadores do plano 7 consulta os ganchos em ordem e usa o primeiro que não devolver null.
 *  `a` segue o mesmo tipo do parâmetro de assets de RomBattleLayer (`object` até o plano 7 trocar por RomAssets). */
export type RomPlayerHook = (s: RoundState, p: Player, a: object, frame: number) => BattleObj[] | null;
export const romPlayerHooks: RomPlayerHook[] = [];
```

Nas tarefas T14/T15, o gancho converte `a` para `RomAssets` com `a as RomAssets` (o plano 5 já está mesclado) e devolve `ObjEntry[]` (estruturalmente igual a `BattleObj`).

Stubs: `render/rom/mounts/layer.ts` → `export const romMountLayer: RomBattleLayer = { id: 'mounts', draw() {} };`; `rider.ts` → `export const riderHook: RomPlayerHook = () => null;`; `costume.ts` → `export const costumeHook: RomPlayerHook = () => null;`; `index.ts` re-exporta os três. `render/fallback/mounts/layer.ts` → `export const fallbackMountLayer: FallbackBattleLayer = { id: 'mounts', draw() {} };`; `costume.ts` → `export const fallbackCostumeLayer: FallbackBattleLayer = { id: 'costume', draw() {} };`; `index.ts` re-exporta. Em `render/layers-index.ts`, acrescentar:

```ts
import { romMountLayer, riderHook, costumeHook } from './rom/mounts';
import { fallbackMountLayer, fallbackCostumeLayer } from './fallback/mounts';
romLayers.push(romMountLayer);
romPlayerHooks.push(riderHook, costumeHook);
fallbackLayers.push(fallbackMountLayer, fallbackCostumeLayer);
```

(com o mecanismo real de registro do índice; se o índice monta arrays literais, acrescentar os itens neles).

- [ ] **Step 6: Helpers de teste** `web/tests/mounts/helpers.ts`, sobre o kit do plano 6 (`tests/core/kit.ts`: `arena` = paredes + pilares, sem soft, fase `play` no tick 100). As assinaturas exportadas são fixas (as outras tarefas dependem delas):

```ts
import { arena } from '../core/kit';
import { step } from '../../src/core/step';
import { BTN, type RoundState, type Player, type GameEvent } from '../../src/core/types';
import type { MountRider } from '../../src/core/mounts/types';

export { BTN };
export const cx = (col: number): number => 16 * col - 1;           // px
export const cy = (lin: number): number => 16 * (lin + 2) - 1;     // px
export const X = (p: Player): number => p.x / 256;
export const Y = (p: Player): number => p.y / 256;

export interface MkOpts { stage?: number; players?: number[]; seed?: number }

/** Rodada em `play` (tick 100), sem soft e sem itens escondidos; só os slots de `players` presentes (padrão P1 e P2). */
export function mkRound(o: MkOpts = {}): RoundState {
  const players = o.players ?? [0, 1];
  const s = arena({ stage: o.stage ?? 1, seed: o.seed ?? 0x12, rules: { active: [0, 1, 2, 3, 4].map(i => players.includes(i)) } });
  s.hidden = [];
  return s;
}

export function placePx(s: RoundState, slot: number, xPx: number, yPx: number): Player {
  const p = s.players[slot];
  p.x = xPx * 256; p.y = yPx * 256; p.moveDir = 8;
  return p;
}

/** Coloca o jogador já montado (fase riding) na menor vaga livre. */
export function ride(s: RoundState, slot: number, type: number, extra: Partial<MountRider> = {}): MountRider {
  const used = new Set(s.players.map(q => (q.mount as MountRider | null)?.slot ?? 0));
  const r: MountRider = { type, slot: used.has(1) ? 2 : 1, phase: 'riding', t0: s.tick, reserves: [], trail: [], cooldown: 0, remount: false, ...extra };
  s.players[slot].mount = r;
  return r;
}

export function btns(map: Partial<Record<number, number>> = {}): number[] {
  return [0, 1, 2, 3, 4].map(i => map[i] ?? 0);
}

/** n passos com os mesmos botões; devolve todos os eventos. */
export function run(s: RoundState, n: number, map: Partial<Record<number, number>> = {}): GameEvent[] {
  const all: GameEvent[] = [];
  for (let i = 0; i < n; i++) all.push(...step(s, btns(map)));
  return all;
}

/** Passa 1 tick por vez até pred() ser verdadeiro; devolve k (1 = o 1º passo) ou −1. */
export function firstTick(s: RoundState, maxK: number, pred: () => boolean, map: Partial<Record<number, number>> = {}): number {
  for (let k = 1; k <= maxK; k++) { run(s, 1, map); if (pred()) return k; }
  return -1;
}

/** Chama recém-criada numa casa (decisão 11 do plano 6: cellT0 = tick, cellAux = peça). */
export function flameAt(s: RoundState, cell: number): void {
  s.grid[cell] = 0x1000; s.cellT0[cell] = s.tick; s.cellAux[cell] = 0;
}

/** Casas das bombas (paradas ou deslizando). */
export function bombCells(s: RoundState): number[] {
  return s.bombs.map(b => b.cell);
}
```

`web/tests/mounts/rom-helpers.ts`:

```ts
import { ROM } from '../rom/helpers';
import { createRomAssets } from '../../src/rom/assets';   // fábrica real do plano 5
export { ROM };
export const ASSETS = ROM ? createRomAssets(ROM) : null;
```

- [ ] **Step 7: Teste do adaptador** `web/tests/mounts/core-api.test.ts`:

```ts
import { mkRound, placePx, run, BTN, cx, cy } from './helpers';
import { cellOf, cellAt, EGG_TYPES, lockAct, placeBombAt, explodeAt, isEnemy } from '../../src/core/mounts/core-api';
import { MOUNTS } from '../../src/core/mounts';
import { mountModule } from '../../src/core/mounts/module';
import type { GameEvent } from '../../src/core/types';

describe('adaptador do core', () => {
  it('convenção de casas do plano 6: cellOf(col, lin) e cellAt(x, y)', () => {
    expect(cellOf(2, 1)).toBe(19);
    expect(cellAt(31 * 256, 47 * 256)).toBe(cellOf(2, 1));
    expect(cellAt(32 * 256, 47 * 256)).toBe(cellOf(2, 1));
    expect(cellAt(40 * 256, 47 * 256)).toBe(cellOf(3, 1));
    expect(cellAt(31 * 256, 56 * 256)).toBe(cellOf(2, 2));
  });
  it('EGG_TYPES = $C1:5DA4 & $0F', () => {
    expect([...EGG_TYPES]).toEqual([2, 3, 0xa, 0xc, 0xd, 0xe, 0xf, 2, 3, 0xa, 0xc, 0xd, 0xe, 0xf]);
  });
  it('lockAct: o jogador volta a agir no tick atual + n', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    lockAct(s, p, 'mounting', 43);
    const x0 = p.x;
    for (let i = 1; i <= 42; i++) { run(s, 1, { 0: BTN.RIGHT }); expect(p.x, `tick +${i}`).toBe(x0); }
    run(s, 1, { 0: BTN.RIGHT });
    expect(p.x).toBeGreaterThan(x0);
  });
  it('placeBombAt: bomba do jogador na casa pedida, gasta 1 e emite bomb_placed', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(5), cy(1));
    p.bombsCap = 2; p.bombsFree = 2;
    const ev: GameEvent[] = [];
    expect(placeBombAt(s, p, cellOf(6, 1), ev)).toBe(true);
    expect(s.grid[cellOf(6, 1)]).toBe(0xc900);
    expect(p.bombsFree).toBe(1);
    expect(ev).toContainEqual({ type: 'bomb_placed', slot: 0, cell: cellOf(6, 1) });
    s.grid[cellOf(7, 1)] = 0xcc80;
    expect(placeBombAt(s, p, cellOf(7, 1), ev)).toBe(false);
    p.disease = 0x24;
    expect(placeBombAt(s, p, cellOf(8, 1), ev)).toBe(false);
  });
  it('explodeAt: cruz de alcance 2 com dono, sem mexer nas bombas do dono', () => {
    const s = mkRound();
    const p = s.players[0];
    const free = p.bombsFree;
    const ev: GameEvent[] = [];
    explodeAt(s, cellOf(6, 1), 2, 0, ev);
    ev.push(...run(s, 1));
    expect(s.grid[cellOf(8, 1)]).toBe(0x1000);
    expect(s.grid[cellOf(4, 1)]).toBe(0x1000);
    expect(s.grid[cellOf(9, 1)]).not.toBe(0x1000);
    expect(ev).toContainEqual({ type: 'explosion', cell: cellOf(6, 1), owner: 0 });
    expect(p.bombsFree).toBe(free);
  });
  it('isEnemy: outro jogador de pé é adversário; o próprio não; em times, o parceiro não', () => {
    const s = mkRound({ players: [0, 2] });
    expect(isEnemy(s, s.players[0], s.players[2])).toBe(true);
    expect(isEnemy(s, s.players[0], s.players[0])).toBe(false);
    s.rules.mode = 'team'; s.rules.teams = [0, 1, 0, 1, 0];
    expect(isEnemy(s, s.players[0], s.players[2])).toBe(false);
  });
  it('o registro do core aponta para o módulo do plano 9', () => {
    expect(MOUNTS.current).toBe(mountModule);
  });
});
```

- [ ] **Step 8: Rodar.** `cd web && npx vitest run tests/mounts && npx tsc --noEmit && npx vitest run`. Esperado: tudo verde (os stubs não mudam o jogo; os testes do plano 6 continuam passando).

- [ ] **Step 9: Commit.**

```bash
git add web/src/core/mounts web/src/core/ai/mounts.ts web/src/render/rom/mounts web/src/render/fallback/mounts web/src/render/layers-index.ts web/src/render/battle-layers.ts web/tests/mounts
git commit -m "feat(mounts): esqueleto do plano 9 — tipos, adaptador do core, registros e stubs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Ciclo do ovo, montar e acerto

**Files:**
- Create: `web/src/core/mounts/eggs.ts`, `web/src/core/mounts/rider.ts`
- Replace: `web/src/core/mounts/module.ts`
- Test: `web/tests/mounts/eggs.test.ts`, `web/tests/mounts/rider.test.ts`, `web/tests/mounts/module.test.ts`

**Interfaces:**
- Consumes: T1 (`types.ts`, `events.ts`, `core-api.ts`, `ABILITIES`, `mountAiHints`).
- Produces: `activeCount(s)`, `eggsOnGrid(s)`, `freeSlot(s)`, `revealEgg`, `stepOnEgg`, `loseMount(s, p, r, ev, cause)`, `onHit`, `onStunLoss`, `tickRiders`, `mountModule` completo (despacho para as habilidades e projéteis).

Regras (spec §5.1–5.2, MNT A.3–A.4, L1–L5, L14–L16):
- `revealEgg`: se `activeCount(s) ≥ 2`, não faz nada e **não gasta RNG**. Senão `t = EGG_TYPES[rnd(s.rng, 14)]`, grava `0x0970 + t`, evento `egg_revealed`.
- `stepOnEgg`: só com o jogador `alive`. Sem montaria → apaga a casa, cria `MountRider` em `mounting` (vaga = `freeSlot`), `lockAct(..., 'mounting', 43)`, evento `mount_start`. Montado em `riding` com ovo de tipo < 8 e menos de 3 reservas → apaga a casa, empurra o tipo em `reserves`, evento `egg_reserved`. Qualquer outro caso: o ovo fica.
- `tickRiders` (chamado pelo `tick` do módulo): jogador fora de `alive` perde a montaria; recarga cai 1 por tick; `mounting` vira `riding` no fim do tick T+42 (`mount_ready`); `dismount` sem reserva termina no fim do tick H+52 (`mount = null`, `inv = 32`); com reserva, no fim do tick H+45 vira `riding` com o tipo do reserva e `inv = 32` (`mount_ready`). Em `riding`, atualiza `trail`.
- `loseMount`: com reserva, tira `reserves[0]`, fase `dismount`, `remount = true`, trava 45; sem reserva, fase `dismount`, `slot = 0`, trava 52. Evento `mount_lost`.
- `onHit`: sem montaria → `false`; fora de `riding` → `true` sem efeito (L1); em `riding` → `loseMount(..., 'hit')` e `true`.
- `onStunLoss` (gancho opcional do plano 6, chamado quando o atordoamento sorteia a perda "montaria ou traje"): em `riding` zera `p.mount` (reservas somem junto), evento `mount_lost` com `cause: 'stun'`, `true`; senão `false` (o core passa ao traje).
- Módulo: `onY`/`passes`/`bombType`/`kicks` só valem em `riding` e delegam para `ABILITIES[r.type]`. `tick`: `tickRiders` sempre; projéteis só em `play`, a partir do tick seguinte ao nascimento (`born !== s.tick`), depois remove os `done`.

- [ ] **Step 1: Testes.** `web/tests/mounts/eggs.test.ts`:

```ts
import { mkRound, placePx, ride, run, BTN, cx, cy, X } from './helpers';
import { revealEgg, stepOnEgg, activeCount } from '../../src/core/mounts/eggs';
import { rider, mstate, type MountProjectile } from '../../src/core/mounts/types';
import { cellOf } from '../../src/core/mounts/core-api';
import type { GameEvent } from '../../src/core/types';

const TYPE_ORDER = [0x2, 0x3, 0xa, 0xc, 0xd, 0xe, 0xf];

describe('revelação do ovo ($C1:5DB2)', () => {
  it('sorteia o tipo por rnd(14) na tabela $C1:5DA4: semente $0012 → C (seed $42B9), depois D ($4FAB)', () => {
    const s = mkRound(); s.rng.seed = 0x0012;
    const ev: GameEvent[] = [];
    const c1 = cellOf(6, 1), c2 = cellOf(8, 1);
    revealEgg(s, c1, ev);
    expect(s.grid[c1]).toBe(0x097c);
    expect(s.rng.seed).toBe(0x42b9);
    expect(ev).toContainEqual({ type: 'mount', id: 'egg_revealed', cell: c1, mount: 0xc });
    revealEgg(s, c2, ev);
    expect(s.grid[c2]).toBe(0x097d);
    expect(s.rng.seed).toBe(0x4fab);
  });
  it('7 tipos equiprováveis: 7000 sorteios da semente $0012 dão as contagens exatas do LCG', () => {
    const s = mkRound(); s.rng.seed = 0x0012;
    const count: Record<number, number> = {};
    const c = cellOf(6, 1);
    for (let i = 0; i < 7000; i++) { s.grid[c] = 0; revealEgg(s, c, []); const t = s.grid[c] & 0xf; count[t] = (count[t] ?? 0) + 1; s.grid[c] = 0; }
    expect(count).toEqual({ 0x2: 1001, 0x3: 995, 0xa: 989, 0xc: 1022, 0xd: 1021, 0xe: 997, 0xf: 975 });
    expect(Object.keys(count).map(Number).sort((a, b) => a - b)).toEqual(TYPE_ORDER);
  });
  it('teto de 2: com 2 ovos no chão o bloco não dá nada e não gasta RNG', () => {
    const s = mkRound(); s.rng.seed = 0x0012;
    s.grid[cellOf(4, 1)] = 0x0972; s.grid[cellOf(4, 3)] = 0x097a;
    const c = cellOf(6, 1);
    revealEgg(s, c, []);
    expect(s.grid[c]).toBe(0);
    expect(s.rng.seed).toBe(0x0012);
  });
  it('montaria ativa conta no teto', () => {
    const s = mkRound(); s.rng.seed = 0x0012;
    ride(s, 0, 0x3); s.grid[cellOf(4, 3)] = 0x0972;
    expect(activeCount(s)).toBe(2);
    revealEgg(s, cellOf(6, 1), []);
    expect(s.grid[cellOf(6, 1)]).toBe(0);
  });
  it('ovo reserva conta no teto', () => {
    const s = mkRound();
    ride(s, 0, 0x3, { reserves: [0x2] });
    expect(activeCount(s)).toBe(2);
  });
  it('desmontando sem reserva não conta; com reserva conta 1', () => {
    const s = mkRound({ players: [0, 1] });
    ride(s, 0, 0x3, { phase: 'dismount', remount: false, slot: 0 });
    expect(activeCount(s)).toBe(0);
    ride(s, 1, 0x2, { phase: 'dismount', remount: true });
    expect(activeCount(s)).toBe(1);
  });
  it('míssil D em voo conta', () => {
    const s = mkRound();
    const pr: MountProjectile = { id: 1, kind: 0xd, owner: 0, x: 0, y: 0, dir: 2, born: s.tick, state: 'fly', t: s.tick, slot: 1 };
    mstate(s).projectiles.push(pr);
    expect(activeCount(s)).toBe(1);
    pr.state = 'done';
    expect(activeCount(s)).toBe(0);
  });
  it('ovo queimado (EDC0) sai da conta', () => {
    const s = mkRound();
    s.grid[cellOf(4, 1)] = 0x0972;
    expect(activeCount(s)).toBe(1);
    s.grid[cellOf(4, 1)] = 0xedc0;
    expect(activeCount(s)).toBe(0);
  });
});

describe('pisar no ovo', () => {
  it('monta: 43 ticks travado (mounting), depois anda 1 px/tick no nível 1 (mount_battery x_seq 32..43)', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    const c = cellOf(2, 1);
    s.grid[c] = 0x0973;
    const ev = run(s, 1);                                    // tick T: pisa
    const r = rider(p)!;
    expect(s.grid[c]).toBe(0);
    expect(r).toMatchObject({ type: 0x3, phase: 'mounting', slot: 1 });
    expect(p.act).toBe('mounting');
    expect(ev).toContainEqual({ type: 'mount', id: 'mount_start', slot: 0, mount: 0x3 });
    const x0 = p.x;
    const ready = run(s, 42, { 0: BTN.RIGHT });              // T+1..T+42
    expect(p.x).toBe(x0);
    expect(r.phase).toBe('riding');
    expect(ready).toContainEqual({ type: 'mount', id: 'mount_ready', slot: 0, mount: 0x3 });
    for (let k = 1; k <= 12; k++) { run(s, 1, { 0: BTN.RIGHT }); expect(X(p)).toBe(31 + k); }
  });
  it('a 2ª montaria usa a vaga 2', () => {
    const s = mkRound({ players: [0, 1] });
    ride(s, 1, 0xa);
    placePx(s, 0, cx(2), cy(1));
    s.grid[cellOf(2, 1)] = 0x097c;
    run(s, 1);
    expect(rider(s.players[0])!.slot).toBe(2);
  });
  it('2º ovo de tipo 0–7 vira reserva; de tipo 8–F fica na grade (mount_follow / mount_misc)', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    const r = ride(s, 0, 0x3);
    const c = cellOf(2, 1);
    s.grid[c] = 0x097a;                                      // ovo tipo A
    run(s, 1);
    expect(s.grid[c]).toBe(0x097a);
    expect(r.reserves).toEqual([]);
    s.grid[c] = 0x0972;                                      // ovo tipo 2
    const ev = run(s, 1);
    expect(s.grid[c]).toBe(0);
    expect(r.reserves).toEqual([0x2]);
    expect(r.type).toBe(0x3);
    expect(ev).toContainEqual({ type: 'mount', id: 'egg_reserved', slot: 0, mount: 0x2 });
    expect(p.act).not.toBe('mounting');
  });
  it('no máximo 3 reservas', () => {
    const s = mkRound();
    placePx(s, 0, cx(2), cy(1));
    const r = ride(s, 0, 0x3, { reserves: [2, 2, 3] });
    s.grid[cellOf(2, 1)] = 0x0972;
    run(s, 1);
    expect(r.reserves).toEqual([2, 2, 3]);
    expect(s.grid[cellOf(2, 1)]).toBe(0x0972);
  });
  it('não pega ovo durante a montagem nem durante o desmonte', () => {
    const s = mkRound();
    placePx(s, 0, cx(2), cy(1));
    const r = ride(s, 0, 0x3, { phase: 'mounting' });
    s.grid[cellOf(2, 1)] = 0x0972;
    stepOnEgg(s, s.players[0], cellOf(2, 1), []);
    expect(s.grid[cellOf(2, 1)]).toBe(0x0972);
    r.phase = 'dismount';
    stepOnEgg(s, s.players[0], cellOf(2, 1), []);
    expect(s.grid[cellOf(2, 1)]).toBe(0x0972);
    expect(r.reserves).toEqual([]);
  });
});
```


`web/tests/mounts/rider.test.ts`:

```ts
import { mkRound, placePx, ride, run, flameAt, BTN, cx, cy } from './helpers';
import { rider } from '../../src/core/mounts/types';
import { cellOf } from '../../src/core/mounts/core-api';
import { mountModule } from '../../src/core/mounts/module';
import type { GameEvent } from '../../src/core/types';

describe('acerto de chama montado ($C2:4B89)', () => {
  it('não morre: 1 + 51 ticks pulando, montaria some, 32 de invencibilidade (mount_battery T6_hit)', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    ride(s, 0, 0x2);
    const x0 = p.x;
    flameAt(s, cellOf(2, 1));
    const ev = run(s, 1);                                    // tick H
    expect(ev).toContainEqual({ type: 'mount', id: 'mount_lost', slot: 0, mount: 0x2, reserve: false, cause: 'hit' });
    expect(p.state).toBe('alive');
    expect(p.act).toBe('dismount');
    for (let i = 1; i <= 51; i++) {                          // H+1..H+51: chama ainda na casa até H+24
      run(s, 1, { 0: BTN.RIGHT });
      expect(p.x, `H+${i}`).toBe(x0);
      expect(p.state).toBe('alive');
    }
    run(s, 1);                                               // H+52
    expect(p.mount).toBeNull();
    expect(p.inv).toBe(32);
    run(s, 2, { 0: BTN.RIGHT });
    expect(p.x).toBeGreaterThan(x0);
  });
  it('com ovo reserva: 1 + 44, remonta com o tipo do reserva e 32 de invencibilidade', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    const r = ride(s, 0, 0x3, { reserves: [0x2] });
    flameAt(s, cellOf(2, 1));
    const ev = run(s, 1);                                    // H
    expect(ev).toContainEqual({ type: 'mount', id: 'mount_lost', slot: 0, mount: 0x3, reserve: true, cause: 'hit' });
    const x0 = p.x;
    run(s, 44, { 0: BTN.RIGHT });                            // H+1..H+44
    expect(p.x).toBe(x0);
    expect(r.phase).toBe('dismount');
    const ev2 = run(s, 1);                                   // H+45
    expect(p.mount).toBe(r);
    expect(r).toMatchObject({ phase: 'riding', type: 0x2, reserves: [], remount: false, slot: 1 });
    expect(p.inv).toBe(32);
    expect(ev2).toContainEqual({ type: 'mount', id: 'mount_ready', slot: 0, mount: 0x2 });
  });
  it('montando (antes de chocar) é imune à chama (L1)', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    s.grid[cellOf(2, 1)] = 0x0973;
    run(s, 1);
    flameAt(s, cellOf(2, 1));
    run(s, 1);
    expect(p.state).toBe('alive');
    expect(rider(p)!.phase).toBe('mounting');
  });
  it('velocidade montado = nível de patins (nível 4 → 352/256 px por tick)', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    p.speedLv = 4;
    ride(s, 0, 0xe);
    const x0 = p.x;
    run(s, 10, { 0: BTN.RIGHT });
    expect(p.x - x0).toBe(3520);
  });
  it('atordoamento: onStunLoss tira a montaria (e as reservas) só em riding', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    const r = ride(s, 0, 0x3, { reserves: [2] });
    r.phase = 'mounting';
    expect(mountModule.onStunLoss!(s, p, [])).toBe(false);
    r.phase = 'riding';
    const ev: GameEvent[] = [];
    expect(mountModule.onStunLoss!(s, p, ev)).toBe(true);
    expect(p.mount).toBeNull();
    expect(ev).toContainEqual({ type: 'mount', id: 'mount_lost', slot: 0, mount: 0x3, reserve: false, cause: 'stun' });
  });
  it('quem sai de alive perde a montaria no tick', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    ride(s, 0, 0x3, { reserves: [2] });
    p.state = 'out';
    run(s, 1);
    expect(p.mount).toBeNull();
  });
});
```

`web/tests/mounts/module.test.ts` (despacho com habilidades falsas, restauradas no fim):

```ts
import { mkRound, placePx, ride, run, BTN, cx, cy } from './helpers';
import { mountModule } from '../../src/core/mounts/module';
import { ABILITIES } from '../../src/core/mounts/abilities';
import { mstate, type MountAbility } from '../../src/core/mounts/types';

const saved: Record<number, MountAbility> = { ...ABILITIES };
afterEach(() => { Object.assign(ABILITIES, saved); });

describe('despacho do MountModule', () => {
  it('passes/bombType/kicks/onY só valem em riding', () => {
    ABILITIES[0x2] = { type: 0x2, passes: (_p, c) => c === 0xcc80, bombType: () => 2, kicks: () => true, onY: () => true };
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    expect(mountModule.passes!(p, 0xcc80)).toBe(false);
    const r = ride(s, 0, 0x2);
    expect(mountModule.passes!(p, 0xcc80)).toBe(true);
    expect(mountModule.passes!(p, 0xec40)).toBe(false);
    expect(mountModule.bombType!(p)).toBe(2);
    expect(mountModule.kicks!(p)).toBe(true);
    expect(mountModule.onY(s, p, [])).toBe(true);
    r.phase = 'mounting';
    expect(mountModule.passes!(p, 0xcc80)).toBe(false);
    expect(mountModule.bombType!(p)).toBeNull();
    expect(mountModule.kicks!(p)).toBe(false);
    expect(mountModule.onY(s, p, [])).toBe(false);
  });
  it('tipo sem onY devolve false (o Y segue para P/soco)', () => {
    ABILITIES[0x3] = { type: 0x3 };
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    ride(s, 0, 0x3);
    expect(mountModule.onY(s, p, [])).toBe(false);
  });
  it('projéteis: tickProjectile a partir do tick seguinte ao nascimento; done é removido; congelam fora de play', () => {
    const seen: number[] = [];
    ABILITIES[0xe] = { type: 0xe, tickProjectile: (st, pr) => { seen.push(st.tick - pr.born); if (st.tick - pr.born === 3) pr.state = 'done'; } };
    const s = mkRound();
    mstate(s).projectiles.push({ id: 1, kind: 0xe, owner: 0, x: 0, y: 0, dir: 2, born: s.tick, state: 'fly', t: s.tick, slot: 0 });
    mountModule.tick(s, []);                                 // mesmo tick do nascimento: nada
    run(s, 5);
    expect(seen).toEqual([1, 2, 3]);
    expect(mstate(s).projectiles).toHaveLength(0);
    mstate(s).projectiles.push({ id: 2, kind: 0xe, owner: 0, x: 0, y: 0, dir: 2, born: s.tick - 1, state: 'fly', t: s.tick, slot: 0 });
    s.phase = 'won';
    seen.length = 0;
    mountModule.tick(s, []);
    expect(seen).toEqual([]);
  });
  it('trail: guarda as casas anteriores do montador (até 4)', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    const r = ride(s, 0, 0x3, { reserves: [2] });
    run(s, 16 * 3, { 0: BTN.RIGHT });
    expect(r.trail.slice(0, 3)).toEqual([1 * 17 + 5, 1 * 17 + 4, 1 * 17 + 3]);
    expect(p.x / 256).toBe(31 + 48);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.** `cd web && npx vitest run tests/mounts/eggs.test.ts tests/mounts/rider.test.ts tests/mounts/module.test.ts` → FAIL (`eggs.ts`/`rider.ts` não existem; stub do módulo).

- [ ] **Step 3: Implementar** `web/src/core/mounts/eggs.ts`:

```ts
import type { RoundState, Player, GameEvent } from '../types';
import { rider, mstate, MAX_ACTIVE, MAX_RESERVES, MOUNTING_TICKS, type MountRider } from './types';
import { EGG_TYPES, rnd, lockAct, isEggCode } from './core-api';
import { mev } from './events';

export function eggsOnGrid(s: RoundState): number {
  let n = 0;
  for (const c of s.grid) if (isEggCode(c)) n++;
  return n;
}

/** $1ED4 derivado (L2). */
export function activeCount(s: RoundState): number {
  let n = eggsOnGrid(s);
  for (const p of s.players) {
    const r = rider(p);
    if (!r) continue;
    if (r.phase !== 'dismount' || r.remount) n++;
    n += r.reserves.length;
  }
  for (const pr of mstate(s).projectiles) if (pr.kind === 0xd && pr.state === 'fly') n++;
  return n;
}

/** Menor vaga de sprite livre (L3). */
export function freeSlot(s: RoundState): 0 | 1 | 2 {
  const used = new Set<number>();
  for (const p of s.players) { const r = rider(p); if (r && r.slot) used.add(r.slot); }
  for (const pr of mstate(s).projectiles) if (pr.state !== 'done' && pr.slot) used.add(pr.slot);
  return !used.has(1) ? 1 : !used.has(2) ? 2 : 0;
}

export function revealEgg(s: RoundState, cell: number, ev: GameEvent[]): void {
  if (activeCount(s) >= MAX_ACTIVE) return;              // JML $C3:50C9: o bloco não dá nada
  const t = EGG_TYPES[rnd(s.rng, 14)];
  s.grid[cell] = 0x0970 + t;
  ev.push(mev({ id: 'egg_revealed', cell, mount: t }));
}

export function stepOnEgg(s: RoundState, p: Player, cell: number, ev: GameEvent[]): void {
  const code = s.grid[cell];
  if (!isEggCode(code) || p.state !== 'alive') return;
  const t = code & 0x0f;
  const r = rider(p);
  if (!r) {
    s.grid[cell] = 0;
    const nr: MountRider = { type: t, slot: freeSlot(s) || 1, phase: 'mounting', t0: s.tick, reserves: [], trail: [], cooldown: 0, remount: false };
    p.mount = nr;
    lockAct(s, p, 'mounting', MOUNTING_TICKS);
    ev.push(mev({ id: 'mount_start', slot: p.slot, mount: t }));
    return;
  }
  if (r.phase === 'riding' && t < 8 && r.reserves.length < MAX_RESERVES) {
    s.grid[cell] = 0;
    r.reserves.push(t);
    ev.push(mev({ id: 'egg_reserved', slot: p.slot, mount: t }));
  }
}
```

Armadilha: `freeSlot` é chamado **antes** de gravar `p.mount` (senão a vaga do próprio jogador contaria).

`web/src/core/mounts/rider.ts`:

```ts
import type { RoundState, Player, GameEvent } from '../types';
import { rider, MOUNTING_TICKS, DISMOUNT_TICKS, REMOUNT_TICKS, POST_INV, MAX_RESERVES, type MountRider } from './types';
import { cellAt, lockAct } from './core-api';
import { mev } from './events';

export function loseMount(s: RoundState, p: Player, r: MountRider, ev: GameEvent[], cause: 'hit' | 'launch'): void {
  const old = r.type;
  r.t0 = s.tick;
  r.phase = 'dismount';
  if (r.reserves.length > 0) {
    r.type = r.reserves.shift()!;
    r.remount = true;
    lockAct(s, p, 'dismount', REMOUNT_TICKS);
    ev.push(mev({ id: 'mount_lost', slot: p.slot, mount: old, reserve: true, cause }));
  } else {
    r.remount = false;
    r.slot = 0;
    lockAct(s, p, 'dismount', DISMOUNT_TICKS);
    ev.push(mev({ id: 'mount_lost', slot: p.slot, mount: old, reserve: false, cause }));
  }
}

export function onHit(s: RoundState, p: Player, ev: GameEvent[]): boolean {
  const r = rider(p);
  if (!r) return false;
  if (r.phase !== 'riding') return true;                  // L1
  loseMount(s, p, r, ev, 'hit');
  return true;
}

/** Atordoamento (§3.10, L15): a montaria é a perda "montaria ou traje"; some com as reservas, sem voar. */
export function onStunLoss(s: RoundState, p: Player, ev: GameEvent[]): boolean {
  const r = rider(p);
  if (!r || r.phase !== 'riding') return false;
  p.mount = null;
  ev.push(mev({ id: 'mount_lost', slot: p.slot, mount: r.type, reserve: false, cause: 'stun' }));
  return true;
}

function updateTrail(p: Player, r: MountRider): void {
  const c = cellAt(p.x, p.y);
  if (r.trail[0] !== c) {
    r.trail.unshift(c);
    if (r.trail.length > MAX_RESERVES + 1) r.trail.length = MAX_RESERVES + 1;
  }
}

export function tickRiders(s: RoundState, ev: GameEvent[]): void {
  for (const p of s.players) {
    const r = rider(p);
    if (!r) continue;
    if (p.state !== 'alive') { p.mount = null; continue; }
    if (r.cooldown > 0) r.cooldown--;
    const k = s.tick - r.t0;
    if (r.phase === 'mounting' && k >= MOUNTING_TICKS - 1) {
      r.phase = 'riding'; r.t0 = s.tick;
      ev.push(mev({ id: 'mount_ready', slot: p.slot, mount: r.type }));
    } else if (r.phase === 'dismount' && r.remount && k >= REMOUNT_TICKS) {
      r.phase = 'riding'; r.remount = false; r.t0 = s.tick; p.inv = POST_INV;
      ev.push(mev({ id: 'mount_ready', slot: p.slot, mount: r.type }));
    } else if (r.phase === 'dismount' && !r.remount && k >= DISMOUNT_TICKS) {
      p.mount = null; p.inv = POST_INV;
      continue;
    }
    if (r.phase === 'riding') updateTrail(p, r);
  }
}
```

Substituir `web/src/core/mounts/module.ts`:

```ts
import type { MountModule } from '../hooks';
import type { Player } from '../types';
import { mountAiHints } from '../ai/mounts';
import { ABILITIES } from './abilities';
import { revealEgg, stepOnEgg } from './eggs';
import { onHit, onStunLoss, tickRiders } from './rider';
import { mstate, rider, type MountRider } from './types';

function riding(p: Player): MountRider | null {
  const r = rider(p);
  return r && r.phase === 'riding' ? r : null;
}

export const mountModule: MountModule = {
  revealEgg,
  stepOnEgg,
  onHit,
  onStunLoss,
  onY(s, p, ev) {
    const r = riding(p);
    const ab = r ? ABILITIES[r.type] : undefined;
    return r && ab?.onY ? ab.onY(s, p, r, ev) : false;
  },
  passes(p, code) { const r = riding(p); return !!(r && ABILITIES[r.type]?.passes?.(p, code)); },
  bombType(p) { const r = riding(p); return r ? ABILITIES[r.type]?.bombType?.(p) ?? null : null; },
  kicks(p) { const r = riding(p); return !!(r && ABILITIES[r.type]?.kicks?.(p)); },
  tick(s, ev) {
    tickRiders(s, ev);
    if (s.phase !== 'play') return;                       // L16
    const ms = mstate(s);
    for (const pr of ms.projectiles) {
      if (pr.state === 'done' || pr.born === s.tick) continue;
      ABILITIES[pr.kind]?.tickProjectile?.(s, pr, ev);
    }
    ms.projectiles = ms.projectiles.filter(pr => pr.state !== 'done');
  },
  ai: mountAiHints,
};
```

- [ ] **Step 4: Rodar.** `cd web && npx vitest run tests/mounts && npx tsc --noEmit` → PASS. Se o teste de 43 ticks falhar por 1 tick, conferir `lockAct` (T1) antes de mexer nas constantes.

- [ ] **Step 5: Verificação opcional no emulador** (só se o core instrumentado carregar): `cd analise/investigacao/montarias-e-telas && SNES9X_CORE="$PWD/../../extraido/cores/rom-montarias/snes9x/libretro/snes9x_libretro.dylib" ../../extraido/cores/venv/bin/python mount_follow2.py` e conferir a linha em que `$32`/tipo mudam após o acerto com reserva (tipo do reserva ao remontar, A8). Registrar o resultado no PR.

- [ ] **Step 6: Commit.**

```bash
git add web/src/core/mounts/{eggs,rider,module}.ts web/tests/mounts/{eggs,rider,module}.test.ts
git commit -m "feat(mounts): ovo (teto de 2, rnd(14)), montar em 43 ticks, acerto 1+51+32 e reserva 1+44

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Motor de projéteis (D, E, F)

**Files:**
- Create: `web/src/core/mounts/projectile.ts`
- Test: `web/tests/mounts/projectile.test.ts`

**Interfaces:**
- Consumes: T1 (`types.ts`, `core-api.ts`).
- Produces: `ProjSpec`, `ProjResult`, `SPAWN_REACH`, `LANE`, `D_SPEC`, `E_SPEC`, `F_SPEC`, `spawnProjectile(s, owner, kind, slot?)`, `advanceProjectile(s, pr, spec)`, `hasFlying(s, owner, kind)`.

Regras (L6): k = `s.tick − pr.born`, chamado com k ≥ 1.
1. Se k = 1: acerta o 1º jogador (P1..P5; `present`, `state === 'alive'`, ≠ dono) com \|eixo\| ≤ 16 px e \|transversal\| < 8 px, **antes** de andar.
2. Anda `speed` no sentido de `dir` (0 ↑, 2 →, 4 ↓, 6 ←).
3. Acerta o 1º jogador com \|eixo\| ≤ `reach` e \|transversal\| < 8 px.
4. Se passou (ou está sobre) o centro da casa atual no sentido do movimento e a próxima casa está fora da grade ou tem bit 15 → prende no centro e devolve `block` com a casa atual.

Calibração (medidas do emulador, montador em X = 32 px, alvo em X = 32 + 16·d, mesma linha):

| Spec | speed (1/256 px) | reach (1/256 px) | Medido |
|---|---|---|---|
| `E_SPEC` | 512 | 2816 (11 px) | acerto em k = 1, 11, 19, 27 para d = 1..4 (`mount_e.py`) |
| `D_SPEC` | 512 | 3072 (12 px) | explosão em k = 34 para d = 5 (`mount_vs.py D Y 112`) |
| `F_SPEC` | 128 | 128 (0,5 px) | acerto em k = 79 a 40 px (`vs_F_Y_72`) |

- [ ] **Step 1: Teste** `web/tests/mounts/projectile.test.ts`:

```ts
import { mkRound, placePx, cx, cy } from './helpers';
import { spawnProjectile, advanceProjectile, hasFlying, D_SPEC, E_SPEC, F_SPEC, type ProjSpec } from '../../src/core/mounts/projectile';
import { cellOf } from '../../src/core/mounts/core-api';
import type { ProjKind } from '../../src/core/mounts/types';

function firstHit(spec: ProjSpec, kind: ProjKind, targetPx: number, max = 300): number {
  const s = mkRound({ players: [0, 2] });
  const p = placePx(s, 0, 32, 47); p.face = 2;
  placePx(s, 2, targetPx, 47);
  const pr = spawnProjectile(s, p, kind);
  for (let k = 1; k <= max; k++) {
    s.tick++;
    const r = advanceProjectile(s, pr, spec);
    if (r.kind === 'player') { expect(r.slot).toBe(2); return k; }
    if (r.kind === 'block') return -k;
  }
  return 0;
}

describe('projéteis das montarias (calibrados no emulador)', () => {
  it('E (2 px/tick): acerta alvos a 1, 2, 3, 4 casas em k = 1, 11, 19, 27', () => {
    expect([1, 2, 3, 4].map(d => firstHit(E_SPEC, 0xe, 32 + 16 * d))).toEqual([1, 11, 19, 27]);
  });
  it('D (2 px/tick): alvo a 5 casas é atingido em k = 34', () => {
    expect(firstHit(D_SPEC, 0xd, 32 + 80)).toBe(34);
  });
  it('F (0,5 px/tick): alvo a 40 px é atingido em k = 79', () => {
    expect(firstHit(F_SPEC, 0xf, 72)).toBe(79);
  });
  it('bloqueio: da col 2 para a direita, soft em (5,1) → para no centro da (4,1) em k = 16', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1)); p.face = 2;
    s.grid[cellOf(5, 1)] = 0xcc80;
    const pr = spawnProjectile(s, p, 0xd);
    let res = null as ReturnType<typeof advanceProjectile> | null, k = 0;
    while (k < 100) { k++; s.tick++; res = advanceProjectile(s, pr, D_SPEC); if (res.kind !== 'none') break; }
    expect(res).toEqual({ kind: 'block', cell: cellOf(4, 1) });
    expect(k).toBe(16);
    expect(pr.x).toBe(63 * 256);
  });
  it('item e chama não bloqueiam (bit 15 = 0)', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1)); p.face = 2;
    s.grid[cellOf(4, 1)] = 0x0941; s.grid[cellOf(5, 1)] = 0x1000;
    const pr = spawnProjectile(s, p, 0xd);
    for (let k = 1; k <= 40; k++) { s.tick++; expect(advanceProjectile(s, pr, D_SPEC).kind).toBe('none'); }
  });
  it('fora da faixa (outra linha) não acerta; o dono não é atingido; morrendo não é atingido', () => {
    const s = mkRound({ players: [0, 1, 2] });
    const p = placePx(s, 0, 32, 47); p.face = 2;
    placePx(s, 1, 64, 47 + 16);
    const q = placePx(s, 2, 80, 47); q.state = 'dying';
    const pr = spawnProjectile(s, p, 0xe);
    for (let k = 1; k <= 28; k++) { s.tick++; expect(advanceProjectile(s, pr, E_SPEC).kind).not.toBe('player'); }
  });
  it('para cima diminui Y', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(9)); p.face = 0;
    const pr = spawnProjectile(s, p, 0xe);
    s.tick++; advanceProjectile(s, pr, E_SPEC);
    expect(pr.y).toBe(p.y - 512);
    expect(pr.x).toBe(p.x);
  });
  it('hasFlying: só projéteis em voo do dono e do tipo', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1)); p.face = 2;
    const pr = spawnProjectile(s, p, 0xf);
    expect(hasFlying(s, 0, 0xf)).toBe(true);
    expect(hasFlying(s, 0, 0xe)).toBe(false);
    pr.state = 'cloud';
    expect(hasFlying(s, 0, 0xf)).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.** `npx vitest run tests/mounts/projectile.test.ts` → FAIL.

- [ ] **Step 3: Implementar** `web/src/core/mounts/projectile.ts`:

```ts
import type { RoundState, Player } from '../types';
import { mstate, type MountProjectile, type ProjKind } from './types';
import { cellOf, cellAt, GRID_W, GRID_H, colOf, linOf, centerX, centerY } from './core-api';

export interface ProjSpec { speed: number; reach: number }             // 1/256 px
export type ProjResult = { kind: 'none' } | { kind: 'player'; slot: number } | { kind: 'block'; cell: number };

export const SPAWN_REACH = 16 * 256;
export const LANE = 8 * 256;
export const D_SPEC: ProjSpec = { speed: 512, reach: 12 * 256 };
export const E_SPEC: ProjSpec = { speed: 512, reach: 11 * 256 };
export const F_SPEC: ProjSpec = { speed: 128, reach: 128 };

const AX: Record<number, readonly [number, number]> = { 0: [0, -1], 2: [1, 0], 4: [0, 1], 6: [-1, 0] };

export function spawnProjectile(s: RoundState, owner: Player, kind: ProjKind, slot: 0 | 1 | 2 = 0): MountProjectile {
  const ms = mstate(s);
  const pr: MountProjectile = { id: ms.nextId++, kind, owner: owner.slot, x: owner.x, y: owner.y, dir: owner.face, born: s.tick, state: 'fly', t: s.tick, slot };
  ms.projectiles.push(pr);
  return pr;
}

export function hasFlying(s: RoundState, owner: number, kind: ProjKind): boolean {
  return mstate(s).projectiles.some(pr => pr.owner === owner && pr.kind === kind && pr.state === 'fly');
}

function hitPlayer(s: RoundState, pr: MountProjectile, reach: number): number {
  const [ux] = AX[pr.dir];
  for (const q of s.players) {
    if (!q.present || q.state !== 'alive' || q.slot === pr.owner) continue;
    const dx = q.x - pr.x, dy = q.y - pr.y;
    const along = ux !== 0 ? dx : dy, across = ux !== 0 ? dy : dx;
    if (Math.abs(along) <= reach && Math.abs(across) < LANE) return q.slot;
  }
  return -1;
}

export function advanceProjectile(s: RoundState, pr: MountProjectile, spec: ProjSpec): ProjResult {
  const k = s.tick - pr.born;
  if (k === 1) {
    const q0 = hitPlayer(s, pr, SPAWN_REACH);
    if (q0 >= 0) return { kind: 'player', slot: q0 };
  }
  const [ux, uy] = AX[pr.dir];
  pr.x += ux * spec.speed;
  pr.y += uy * spec.speed;
  const q = hitPlayer(s, pr, spec.reach);
  if (q >= 0) return { kind: 'player', slot: q };
  const c = cellAt(pr.x, pr.y);
  const col = colOf(c), lin = linOf(c);
  const ccx = centerX(col), ccy = centerY(lin);
  const past = ux > 0 ? pr.x >= ccx : ux < 0 ? pr.x <= ccx : uy > 0 ? pr.y >= ccy : pr.y <= ccy;
  if (past) {
    const nc = col + ux, nl = lin + uy;
    const blocked = nc < 0 || nc >= GRID_W || nl < 0 || nl >= GRID_H || (s.grid[cellOf(nc, nl)] & 0x8000) !== 0;
    if (blocked) {
      if (ux !== 0) pr.x = ccx; else pr.y = ccy;
      return { kind: 'block', cell: c };
    }
  }
  return { kind: 'none' };
}
```

- [ ] **Step 4: Rodar.** `npx vitest run tests/mounts/projectile.test.ts && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Verificação opcional no emulador.** Rodar `mount_vs.py F Y 88 300` e `mount_vs.py D Y 96 80` (mesmo ambiente da T2) e anotar o quadro do acerto. Se divergir do modelo (F: 88 → k = 111; D: 96 → k = 26), ajustar `reach` e acrescentar o caso ao teste, registrando no PR.

- [ ] **Step 6: Commit.**

```bash
git add web/src/core/mounts/projectile.ts web/tests/mounts/projectile.test.ts
git commit -m "feat(mounts): motor de projéteis D/E/F calibrado nas medições do emulador

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Fatos de render das montarias (emulador → fixture + `facts.ts`)

**Files:**
- Create: `analise/investigacao/montarias-e-telas/mount_render_facts.py` (raiz do repositório)
- Create (gerados pelo script): `web/tests/fixtures/rom/mount-render.json`, `web/src/render/rom/mounts/facts.ts`
- Test: `web/tests/mounts/rom-facts.test.ts`

**Interfaces:**
- Consumes: T1 (`rom-helpers.ts`), plano 5 (`RomAssets.anim`, `RomView`, decodificador ZTE, `p24`).
- Produces: fixture `mount-render.json` (esquema abaixo) e `facts.ts` com os endereços usados pela T14 e pela T15.

A spec lista tabelas (§5.4) mas não diz qual animação desenha o quê. Esta tarefa **mede** no emulador e grava só fatos: endereços, deslocamentos, números de paleta e SHA-1 dos índices de pixel.

Esquema da fixture:

```ts
interface Piece { dx: number; dy: number; size: 16 | 32; hflip: boolean; vflip: boolean; pal: number; prio: number; tile: number; pxSha1: string }
interface Sample { f: number; anim: number; frame: number; sheet2: number; pieces: Piece[] }   // f = quadro desde o início da cena
interface MountRenderFixture {
  source: string; romSha1: string;
  riders: Record<string, Record<'up' | 'right' | 'down' | 'left', { walk: Sample[]; idle: Sample[] }>>;  // chave "2","3","a",...
  mounting: Record<string, Sample[]>;          // 43 quadros depois de pisar no ovo
  dismount: Sample[];                          // 52 quadros depois do acerto (tipo 2)
  remount: Sample[];                           // 45 quadros (tipo 3 com reserva 2)
  reserveEgg: Sample[];                        // objeto $C2:62D7 seguindo
  eggs: { id: number; samples: Sample[] }[];   // ovo no chão (st_ride_pre.bin)
  projectiles: Record<'d' | 'e' | 'f', { rt: number; samples: (Sample & { x: number; y: number })[] }>;
  dance: Sample[];                             // P3 atingido pelas notas
  costumes: Record<string, Record<'up' | 'right' | 'down' | 'left', { walk: Sample[]; idle: Sample[] }>>;  // "0".."7"
  palettes: { scene: string; objPal: number; sha1: string; romAddrs: number[] }[];
  gfx: Record<string, { tableAddr: number; src: number; format: 'zte' | 'raw' | 'unknown'; decodedSha1: string; vramTileSha1: string[] }>;
}
```

- [ ] **Step 1: Escrever o script** `analise/investigacao/montarias-e-telas/mount_render_facts.py`:

```python
"""Fatos de render das montarias (plano 9, Tarefa 4). Uso:
   ../../extraido/cores/venv/bin/python mount_render_facts.py <caminho de web/>
Grava tests/fixtures/rom/mount-render.json e src/render/rom/mounts/facts.ts. Só números, endereços e SHA-1."""
import os, sys, json, hashlib
BASE = "/Users/dlotuz/Projetos Claude/Bomber Project/analise"
os.environ["SNES9X_CORE"] = BASE + "/extraido/cores/rom-montarias/snes9x/libretro/snes9x_libretro.dylib"
sys.path.insert(0, BASE + "/investigacao/montarias-e-telas")
sys.path.insert(0, BASE + "/investigacao/graficos-formato")
import mt, mount_lib as M, objlist, scr
from decomp import decode_zte

WEB = sys.argv[1]
ROM = mt.ROM
TYPES = [0x2, 0x3, 0xA, 0xC, 0xD, 0xE, 0xF]
DIRS = [('up', 'UP'), ('right', 'RIGHT'), ('down', 'DOWN'), ('left', 'LEFT')]
def p24(a): o = a & 0x3FFFFF; return ROM[o] | ROM[o + 1] << 8 | ROM[o + 2] << 16
def sha1(b): return hashlib.sha1(bytes(b)).hexdigest()

def blocks(st):
    p = 14; B = {}
    while p < len(st) - 10:
        name = st[p:p + 3].decode(); ln = int(st[p + 4:p + 10]); B[name] = st[p + 11:p + 11 + ln]; p += 11 + ln
    return B

def vram_cgram(e):
    B = blocks(e.save()); cg = B['PPU'][64:576]
    return B['VRA'], [cg[2 * i] << 8 | cg[2 * i + 1] for i in range(256)]

def tile4(vram, a):
    out = []
    for r in range(8):
        b0, b1, b2, b3 = vram[a + 2 * r], vram[a + 2 * r + 1], vram[a + 16 + 2 * r], vram[a + 17 + 2 * r]
        for c in range(8):
            s = 7 - c
            out.append(((b0 >> s) & 1) | ((b1 >> s) & 1) << 1 | ((b2 >> s) & 1) << 2 | ((b3 >> s) & 1) << 3)
    return out

def obj_px(vram, tile, size):
    n = size // 8; px = [0] * (size * size)
    for ty in range(n):
        for tx in range(n):
            col = ((tile & 0xF) + tx) & 0xF; row = ((tile >> 4) + ty) & 0xF
            tt = (tile & 0x100) | (row << 4) | col
            a = (0xC000 + (tt & 0xFF) * 32 + (0x2000 if tt & 0x100 else 0)) & 0xFFFF
            for i, v in enumerate(tile4(vram, a)): px[(ty * 8 + (i >> 3)) * size + tx * 8 + (i & 7)] = v
    return px

def pieces_near(e, X, Y, rad=40):
    vram, _ = vram_cgram(e); out = []
    for o in scr.oam(e):
        size = 32 if o['big'] else 16
        if abs(o['x'] + size // 2 - X) > rad or abs(o['y'] + size // 2 - Y) > rad: continue
        out.append(dict(dx=o['x'] - X, dy=o['y'] - Y, size=size, hflip=bool(o['hf']), vflip=bool(o['vf']),
                        pal=o['pal'], prio=o['pri'], tile=o['tile'], pxSha1=sha1(obj_px(vram, o['tile'], size))))
    return out

def sample(e, base, f):
    w = e.wram()
    X = w[base + 0x12] | w[base + 0x13] << 8; Y = w[base + 0x16] | w[base + 0x17] << 8
    return dict(f=f, anim=(w[base + 8] | w[base + 9] << 8 | w[base + 10] << 16) - 1, frame=w[base + 0x0C],
                sheet2=w[base + 0xA4] | w[base + 0xA5] << 8 | w[base + 0xA6] << 16, pieces=pieces_near(e, X, Y))

def rec(e, base, n, held=None, who='p0'):
    out = []
    for f in range(n):
        e.run(1, **{who: held or []}); out.append(sample(e, base, f))
    return out

e = mt.new(); fx = dict(source='analise/investigacao/montarias-e-telas/mount_render_facts.py',
                        romSha1=hashlib.sha1(ROM).hexdigest(), riders={}, mounting={}, costumes={}, gfx={}, palettes=[])
pal_seen = {}
def note_pal(scene):
    _, cg = vram_cgram(e)
    for pal in range(8):
        cols = cg[128 + 16 * pal:128 + 16 * pal + 16]
        raw = b''.join(bytes([c & 0xFF, c >> 8]) for c in cols)
        addrs, i = [], ROM.find(raw)
        while i >= 0 and len(addrs) < 4:
            addrs.append(0xC00000 + i); i = ROM.find(raw, i + 1)
        fx['palettes'].append(dict(scene=scene, objPal=pal, sha1=sha1(raw), romAddrs=addrs))

for t in TYPES:
    e.load(open(mt.EST + 'st_arena01.bin', 'rb').read()); e.run(1); M.clear_soft(e)
    p = M.pl(e); e.w16(M.cell(p['x'], p['y']), 0x0940 + (0x30 | t))
    fx['mounting'][format(t, 'x')] = rec(e, 0x300, 43)
    base = e.save(); fx['riders'][format(t, 'x')] = {}
    for name, btn in DIRS:
        e.load(base)
        walk = rec(e, 0x300, 24, [btn]); idle = rec(e, 0x300, 8)
        fx['riders'][format(t, 'x')][name] = dict(walk=walk, idle=idle)
    note_pal('rider_' + format(t, 'x'))
    src = p24(0xC470DC + 3 * t)
    vram, _ = vram_cgram(e)
    mount_tiles = sorted({pc['tile'] for s in fx['riders'][format(t, 'x')]['right']['idle'] for pc in s['pieces']})
    tsha = [sha1(obj_px(vram, tl, 16)) for tl in mount_tiles]
    try:
        dec, _ = decode_zte(src); fmt = 'zte'
    except Exception:
        dec, fmt = b'', 'unknown'
    fx['gfx'][format(t, 'x')] = dict(tableAddr=0xC470DC + 3 * t, src=src, format=fmt, decodedSha1=sha1(dec), vramTileSha1=tsha)

# desmonte (tipo 2) e remonte (tipo 3 com reserva tipo 2)
M.mount(e, 0x2); e.run(3, p0=['A']); e.run(120)
fx['dismount'] = rec(e, 0x300, 60)
M.mount(e, 0x3); e.w16(M.cell(64, 48), 0x0940 + 0x32)
for f in range(32): e.run(1, p0=['RIGHT'])
fx['reserveEgg'] = []
for f in range(30):
    e.run(1)
    for o in objlist.objs(e):
        if o['rt'] >> 8 == 0xC262:
            fx['reserveEgg'].append(dict(sample(e, o['a'], f), x=o['x'], y=o['y']))
e.run(3, p0=['A']); e.run(120)
fx['remount'] = rec(e, 0x300, 50)

# ovos no chão (partida real de CPU)
e.load(open(mt.OUT + 'st_ride_pre.bin', 'rb').read()); e.run(1)
fx['eggs'] = []
for lin in range(13):
    for col in range(17):
        code = e.r16(0x2800 + lin * 0x40 + col * 2)
        if (code & 0xFFF0) == 0x0970:
            X, Y = 16 * col, 16 * (lin + 2)
            objs = [o for o in objlist.objs(e) if abs(o['x'] - X) <= 1 and abs(o['y'] - Y) <= 1]
            smp = [dict(sample(e, objs[0]['a'], 0))] if objs else [dict(f=0, anim=0, frame=0, sheet2=0, pieces=pieces_near(e, X, Y, 12))]
            fx['eggs'].append(dict(id=0x30 | (code & 0xF), samples=smp))

# projéteis e dança
fx['projectiles'] = {}
for t, key, tx in ((0xD, 'd', 200), (0xE, 'e', 200), (0xF, 'f', 200)):
    M.mount(e, t); e.w16(0x512, tx); e.w16(0x516, 48)
    e.run(1, p0=['RIGHT']); e.run(2, p2=['LEFT']); e.run(2, p2=['RIGHT'])
    before = {(o['a'], o['rt']) for o in objlist.objs(e)}; smp = []; rt = 0
    for f in range(120):
        e.run(1, p0=(['Y'] if f < 3 else []))
        for o in objlist.objs(e):
            if (o['a'], o['rt']) in before or o['rt'] == 0xC34EE6 or not (0x800 <= o['a'] < 0x1400): continue
            rt = rt or o['rt']
            smp.append(dict(sample(e, o['a'], f), x=o['x'], y=o['y']))
    fx['projectiles'][key] = dict(rt=rt, samples=smp)
M.mount(e, 0xF); e.w16(0x512, 72); e.w16(0x516, 48)
e.run(1, p0=['RIGHT']); e.run(2, p2=['LEFT']); e.run(2, p2=['RIGHT'])
e.run(3, p0=['Y']); e.run(76)
fx['dance'] = rec(e, 0x500, 200)

# trajes (fase 10)
for c in range(8):
    fx['costumes'][str(c)] = {}
    for name, btn in DIRS:
        e.load(open(mt.EST + 'st_arena10.bin', 'rb').read()); e.run(1); M.clear_soft(e)
        e.w8(0x345, 0xE8 | c); e.run(2)
        fx['costumes'][str(c)][name] = dict(walk=rec(e, 0x300, 24, [btn]), idle=rec(e, 0x300, 8))
    note_pal('costume_' + str(c))

json.dump(fx, open(WEB + '/tests/fixtures/rom/mount-render.json', 'w'), indent=1)

# facts.ts: endereços distintos (ordem de aparição) por cena
def anims(samples): 
    out = []
    for s in samples:
        if s['anim'] and s['anim'] not in out: out.append(s['anim'])
    return out
def h(v): return '0x%06x' % v
L = ['// gerado por analise/investigacao/montarias-e-telas/mount_render_facts.py — não editar',
     '// ROM SHA-1 ' + fx['romSha1'],
     'export interface DirAnims { walk: number[]; idle: number[] }   // ↑ → ↓ ← (índices 0..3)',
     'export const RIDER_ANIMS: Record<number, DirAnims[]> = {']
for t in TYPES:
    d = fx['riders'][format(t, 'x')]
    L.append('  0x%x: [%s],' % (t, ', '.join('{ walk: [%s], idle: [%s] }' % (', '.join(map(h, anims(d[n]['walk']))), ', '.join(map(h, anims(d[n]['idle'])))) for n, _ in DIRS)))
L.append('};')
L.append('export const MOUNTING_ANIMS: Record<number, number[]> = {' + ', '.join('0x%x: [%s]' % (t, ', '.join(map(h, anims(fx['mounting'][format(t, 'x')])))) for t in TYPES) + '};')
L.append('export const DISMOUNT_ANIMS: number[] = [%s];' % ', '.join(map(h, anims(fx['dismount']))))
L.append('export const REMOUNT_ANIMS: number[] = [%s];' % ', '.join(map(h, anims(fx['remount']))))
L.append('export const RESERVE_EGG_ANIMS: number[] = [%s];' % ', '.join(map(h, anims(fx['reserveEgg']))))
L.append('export const EGG_ANIMS: number[] = [%s];' % ', '.join(map(h, anims([s for g in fx['eggs'] for s in g['samples']]))))
L.append('export const PROJ_ANIMS: Record<\'d\' | \'e\' | \'f\', number[]> = {' + ', '.join("%s: [%s]" % (k, ', '.join(map(h, anims(v['samples'])))) for k, v in fx['projectiles'].items()) + '};')
L.append('export const DANCE_ANIMS: number[] = [%s];' % ', '.join(map(h, anims(fx['dance']))))
L.append('export const COSTUME_ANIMS: Record<number, DirAnims[]> = {')
for c in range(8):
    d = fx['costumes'][str(c)]
    L.append('  %d: [%s],' % (c, ', '.join('{ walk: [%s], idle: [%s] }' % (', '.join(map(h, anims(d[n]['walk']))), ', '.join(map(h, anims(d[n]['idle'])))) for n, _ in DIRS)))
L.append('};')
L.append('export const MOUNT_GFX: Record<number, { src: number; format: \'zte\' | \'raw\' | \'unknown\' }> = {' + ', '.join("0x%x: { src: %s, format: '%s' }" % (t, h(fx['gfx'][format(t, 'x')]['src']), fx['gfx'][format(t, 'x')]['format']) for t in TYPES) + '};')
L.append('export const SHEET2 = %s;   // +$A4 medido (esperado $D4:0000)' % h(fx['riders']['2']['right']['idle'][0]['sheet2']))
open(WEB + '/src/render/rom/mounts/facts.ts', 'w').write('\n'.join(L) + '\n')
print('ok', len(json.dumps(fx)))
```

Armadilhas:
- `mt.py` aponta `SNES9X_CORE` para um scratchpad antigo; o script sobrescreve a variável **antes** do `import mt`.
- `sample()` subtrai 1 de `+$08` (o campo guarda o endereço da animação + 1, ANI §1.2).
- `pieces_near` pega todo sprite a até 40 px; as cenas deixam só o P1 (e o alvo) perto. Se aparecer sprite de outro jogador, reduzir `rad`.
- Se `decode_zte` do endereço de `$C4:70DC` não bater com `vramTileSha1`, tentar leitura crua (`ROM[src & 0x3FFFFF:...]`) e marcar `format='raw'`; se nenhum bater, `unknown` e a T14 usa as peças medidas por hash (ver T14, "Plano B").

- [ ] **Step 2: Rodar o script.**

```bash
cd "/Users/dlotuz/Projetos Claude/Bomber Project/.worktrees/fidelity/analise/investigacao/montarias-e-telas"
../../extraido/cores/venv/bin/python mount_render_facts.py "/Users/dlotuz/Projetos Claude/Bomber Project/.worktrees/fidelity/web"
```

Esperado: `ok <tamanho>`; fixture < 1,5 MB; `facts.ts` compila (`cd web && npx tsc --noEmit`). Conferir à mão: `SHEET2` = `0xd40000`; `RIDER_ANIMS[0x3][1].idle` não vazio; `PROJ_ANIMS.d` não vazio. Se o venv ou o core não estiverem nesses caminhos, usar os do `PLAN_WRITING_BRIEF.md`.

- [ ] **Step 3: Teste de consistência com a ROM** `web/tests/mounts/rom-facts.test.ts`:

```ts
import { createHash } from 'node:crypto';
import fx from '../fixtures/rom/mount-render.json';
import { ASSETS, ROM } from './rom-helpers';
import { RIDER_ANIMS, COSTUME_ANIMS, MOUNTING_ANIMS, DISMOUNT_ANIMS, PROJ_ANIMS, DANCE_ANIMS, EGG_ANIMS, SHEET2 } from '../../src/render/rom/mounts/facts';

const sha1 = (b: Uint8Array) => createHash('sha1').update(b).digest('hex');

describe('fixture das montarias (sem ROM)', () => {
  it('só fatos: nenhuma chave de bytes crus', () => {
    const txt = JSON.stringify(fx);
    expect(txt).not.toMatch(/"(bytes|data|raw|pixels)"\s*:/);
    expect(fx.romSha1).toBe('38f4394986bd39fcbe32a722a3fe103ee6177d9b');
  });
  it('facts.ts cobre os 7 tipos, 4 direções e 8 trajes', () => {
    expect(Object.keys(RIDER_ANIMS).map(Number).sort((a, b) => a - b)).toEqual([2, 3, 10, 12, 13, 14, 15]);
    for (const t of Object.values(RIDER_ANIMS)) { expect(t).toHaveLength(4); for (const d of t) expect(d.idle.length).toBeGreaterThan(0); }
    expect(Object.keys(COSTUME_ANIMS)).toHaveLength(8);
    for (const k of Object.keys(MOUNTING_ANIMS)) expect(MOUNTING_ANIMS[Number(k)].length).toBeGreaterThan(0);
    expect(DISMOUNT_ANIMS.length).toBeGreaterThan(0);
    expect(PROJ_ANIMS.d.length * PROJ_ANIMS.e.length * PROJ_ANIMS.f.length).toBeGreaterThan(0);
    expect(DANCE_ANIMS.length).toBeGreaterThan(0);
    expect(EGG_ANIMS.length).toBeGreaterThan(0);
    expect(SHEET2).toBe(0xd40000);
  });
});

describe.skipIf(!ASSETS)('fatos das montarias × ROM', () => {
  it('toda animação medida decodifica pelo formato da ANI §2.1', () => {
    const all = [
      ...Object.values(RIDER_ANIMS).flatMap(t => t.flatMap(d => [...d.walk, ...d.idle])),
      ...Object.values(COSTUME_ANIMS).flatMap(t => t.flatMap(d => [...d.walk, ...d.idle])),
      ...DISMOUNT_ANIMS, ...DANCE_ANIMS, ...EGG_ANIMS, ...PROJ_ANIMS.d, ...PROJ_ANIMS.e, ...PROJ_ANIMS.f,
    ];
    for (const a of all) {
      const anim = ASSETS!.anim(a);
      expect(anim.length, a.toString(16)).toBeGreaterThan(0);
      for (const fr of anim) expect(fr.pieces.length).toBeGreaterThan(0);
    }
  });
  it('paletas medidas existem na ROM nos endereços gravados', () => {
    for (const p of fx.palettes) for (const a of p.romAddrs) {
      const b = ROM!.subarray(a - 0xc00000, a - 0xc00000 + 32);
      expect(sha1(b)).toBe(p.sha1);
    }
  });
});
```

- [ ] **Step 4: Rodar.** `cd web && npx vitest run tests/mounts/rom-facts.test.ts` e com a ROM: `SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc" npx vitest run tests/mounts/rom-facts.test.ts` → PASS.

- [ ] **Step 5: Commit** (sem imagens nem bytes):

```bash
git add analise/investigacao/montarias-e-telas/mount_render_facts.py web/tests/fixtures/rom/mount-render.json web/src/render/rom/mounts/facts.ts web/tests/mounts/rom-facts.test.ts
git commit -m "feat(mounts): fatos de render das montarias medidos no emulador (animações, peças, paletas, gráficos)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Camada fallback (ovos, montarias, reservas, projéteis)

**Files:**
- Create: `web/src/render/fallback/mounts/art.ts`, `web/src/render/fallback/mounts/sprites.ts`
- Replace: `web/src/render/fallback/mounts/layer.ts`
- Test: `web/tests/mounts/fallback.test.ts`

**Interfaces:**
- Consumes: T1 (tipos do estado, `FallbackBattleLayer`), `render/art/pix.ts` (`Pix`, `makePix`, `setPx`), `pixToCanvas` de `render/sprite-bank.ts`.
- Produces: `MOUNT_LOOK`, `mountPix(type, face, step)`, `eggPix(kind, frame)`, `shotPix(kind, state, frame)`, `fallbackMountSprites(s, frame): FbSprite[]`, `fallbackMountLayer`.

Regras:
- Coordenadas de tela SNES (256×224), iguais às da ROM (se a T1 registrou outra transformação no fallback do plano 6, aplicar a função dela no `layer.ts`, nunca em `sprites.ts`).
- Ovo na grade: 16×16 em `(16·col − 8, 16·lin + 24)`; `kind` 0 para tipo < 8, 1 para ≥ 8 (as duas artes `$D8:D271`/`$D8:D2CC`).
- Montador `riding`: montaria 24×20 em `(X − 12, Y − 12)` px, desenhada **depois** do jogador (cobre a metade de baixo, como se ele estivesse sentado). `step` = `(frame >> 3) & 1` quando `p.moveDir !== 8`.
- `mounting`: ovo balançando (±1 px, `frame & 8`) na casa do jogador. `dismount` com `remount`: ovo na casa do jogador. `dismount` sem reserva: nada.
- Reservas: ovo `kind` do tipo na casa `trail[i + 1]` (se faltar, na casa atual).
- Projéteis: `fly` D = `mountPix(0xd, dir, frame>>2 & 1)` em `(x − 12, y − 12)`; E = bola 8×8 em `(x − 4, y − 4)`; F = nota 8×12 em `(x − 4, y − 10 + ((frame >> 2) & 1))`; `cloud` = nuvem 16×12 em `(x − 8, y − 6)`.
- Cada sprite tem `key` estável (cache de canvas por chave).

- [ ] **Step 1: Teste** `web/tests/mounts/fallback.test.ts`:

```ts
import { mkRound, placePx, ride, cx, cy } from './helpers';
import { MOUNT_LOOK, mountPix, eggPix, shotPix } from '../../src/render/fallback/mounts/art';
import { fallbackMountSprites } from '../../src/render/fallback/mounts/sprites';
import { mstate } from '../../src/core/mounts/types';
import { cellOf } from '../../src/core/mounts/core-api';

const opaque = (p: { data: Uint8ClampedArray }) => { let n = 0; for (let i = 3; i < p.data.length; i += 4) if (p.data[i]) n++; return n; };
const hash = (p: { data: Uint8ClampedArray }) => Array.from(p.data).join(',');
const TYPES = [0x2, 0x3, 0xa, 0xc, 0xd, 0xe, 0xf];

describe('arte das montarias (fallback)', () => {
  it('7 tipos × 4 direções × 2 passos: 24×20 com corpo', () => {
    expect(Object.keys(MOUNT_LOOK).map(Number).sort((a, b) => a - b)).toEqual(TYPES);
    for (const t of TYPES) for (const f of [0, 2, 4, 6] as const) for (const st of [0, 1]) {
      const p = mountPix(t, f, st);
      expect([p.w, p.h]).toEqual([24, 20]);
      expect(opaque(p)).toBeGreaterThan(120);
    }
  });
  it('tipos diferentes têm desenhos diferentes', () => {
    const set = new Set(TYPES.map(t => hash(mountPix(t, 4, 0))));
    expect(set.size).toBe(7);
  });
  it('ovos 16×16 nas duas artes; projéteis e nuvem', () => {
    for (const k of [0, 1] as const) { const e = eggPix(k, 0); expect([e.w, e.h]).toEqual([16, 16]); expect(opaque(e)).toBeGreaterThan(60); }
    expect(hash(eggPix(0, 0))).not.toBe(hash(eggPix(1, 0)));
    expect([shotPix(0xe, 'fly', 0).w, shotPix(0xe, 'fly', 0).h]).toEqual([8, 8]);
    expect([shotPix(0xf, 'fly', 0).w, shotPix(0xf, 'fly', 0).h]).toEqual([8, 12]);
    expect([shotPix(0xe, 'cloud', 0).w, shotPix(0xe, 'cloud', 0).h]).toEqual([16, 12]);
  });
});

describe('sprites da camada fallback', () => {
  it('ovo na grade na posição da casa', () => {
    const s = mkRound();
    s.grid[cellOf(6, 1)] = 0x0972; s.grid[cellOf(6, 3)] = 0x097c;
    const sp = fallbackMountSprites(s, 0);
    expect(sp.find(x => x.key.startsWith('egg:0'))).toMatchObject({ x: 88, y: 40 });
    expect(sp.find(x => x.key.startsWith('egg:1'))).toMatchObject({ x: 88, y: 72 });
  });
  it('montador riding: montaria em (X−12, Y−12)', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1)); p.face = 2;
    ride(s, 0, 0x3);
    const m = fallbackMountSprites(s, 0).find(x => x.key.startsWith('mount:3:'));
    expect(m).toMatchObject({ x: 31 - 12, y: 47 - 12 });
  });
  it('montando: ovo na casa; desmontando sem reserva: nada; com reserva: ovo', () => {
    const s = mkRound();
    placePx(s, 0, cx(2), cy(1));
    const r = ride(s, 0, 0x3, { phase: 'mounting' });
    expect(fallbackMountSprites(s, 0).some(x => x.key.startsWith('egg:'))).toBe(true);
    r.phase = 'dismount'; r.remount = false;
    expect(fallbackMountSprites(s, 0)).toHaveLength(0);
    r.remount = true;
    expect(fallbackMountSprites(s, 0).some(x => x.key.startsWith('egg:'))).toBe(true);
  });
  it('reservas atrás do montador, na trilha', () => {
    const s = mkRound();
    placePx(s, 0, cx(4), cy(1));
    ride(s, 0, 0x3, { reserves: [0x2, 0x3], trail: [cellOf(4, 1), cellOf(3, 1), cellOf(2, 1)] });
    const eggs = fallbackMountSprites(s, 0).filter(x => x.key.startsWith('egg:'));
    expect(eggs.map(e => [e.x, e.y])).toEqual([[40, 40], [24, 40]]);
  });
  it('projéteis: E em voo e nuvem, F e D', () => {
    const s = mkRound();
    const ms = mstate(s);
    ms.projectiles.push({ id: 1, kind: 0xe, owner: 0, x: 100 * 256, y: 47 * 256, dir: 2, born: 0, state: 'fly', t: 0, slot: 0 });
    ms.projectiles.push({ id: 2, kind: 0xe, owner: 0, x: 60 * 256, y: 47 * 256, dir: 2, born: 0, state: 'cloud', t: 0, slot: 0 });
    ms.projectiles.push({ id: 3, kind: 0xd, owner: 1, x: 150 * 256, y: 79 * 256, dir: 6, born: 0, state: 'fly', t: 0, slot: 2 });
    const sp = fallbackMountSprites(s, 0);
    expect(sp.find(x => x.key.startsWith('shot:e:fly'))).toMatchObject({ x: 96, y: 43 });
    expect(sp.find(x => x.key.startsWith('shot:e:cloud'))).toMatchObject({ x: 52, y: 41 });
    expect(sp.find(x => x.key.startsWith('mount:13:'))).toMatchObject({ x: 138, y: 67 });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar** `web/src/render/fallback/mounts/art.ts` (desenho procedural; cores da MNT A.5):

```ts
import { makePix, setPx, type Pix } from '../../art/pix';

type Shape = 'fish' | 'dino' | 'round' | 'bell' | 'leaf' | 'tank' | 'clown';
export const MOUNT_LOOK: Readonly<Record<number, { body: string; dark: string; accent: string; shape: Shape }>> = {
  0x2: { body: '#3fae4a', dark: '#1f5f2a', accent: '#ff7fb0', shape: 'fish' },   // peixe verde, barbatanas rosa
  0x3: { body: '#8fd13f', dark: '#4c7f1a', accent: '#ff6fa0', shape: 'dino' },   // triceratops verde, crista rosa
  0xa: { body: '#ffc23f', dark: '#b8680f', accent: '#3f5fff', shape: 'round' },  // redondo amarelo, óculos
  0xc: { body: '#e8b830', dark: '#7f5a10', accent: '#d8312b', shape: 'bell' },   // sino dourado, saia vermelha
  0xd: { body: '#5fa83f', dark: '#2a5a1a', accent: '#ffffff', shape: 'leaf' },   // alcachofra verde com olhos
  0xe: { body: '#3f6fd8', dark: '#1a2a70', accent: '#c8c8c8', shape: 'tank' },   // robô-tanque azul
  0xf: { body: '#ffe04f', dark: '#a8861a', accent: '#2f4fcf', shape: 'clown' },  // bola de palhaço, chapéu azul
};

function ellipse(p: Pix, cx: number, cy: number, rx: number, ry: number, fill: string, edge: string): void {
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
    if (d <= 1) setPx(p, x, y, d > 0.72 ? edge : fill);
  }
}
function rect(p: Pix, x: number, y: number, w: number, h: number, c: string): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setPx(p, xx, yy, c);
}

/** 24×20. face 0 ↑ 2 → 4 ↓ 6 ←; step 0/1 = balanço de andar. */
export function mountPix(type: number, face: 0 | 2 | 4 | 6, step: number): Pix {
  const L = MOUNT_LOOK[type];
  const p = makePix(24, 20);
  const bob = step ? 1 : 0;
  const ex = face === 2 ? 3 : face === 6 ? -3 : 0;            // olhos seguem a direção
  switch (L.shape) {
    case 'tank':
      rect(p, 3, 15 - bob, 18, 5, L.dark);                     // esteiras
      rect(p, 5, 6 - bob, 14, 10, L.body);
      rect(p, 12 + ex, 8 - bob, 10, 3, L.accent);              // canhão
      break;
    case 'bell':
      ellipse(p, 12, 10 - bob, 8, 8, L.body, L.dark);
      rect(p, 3, 15 - bob, 18, 4, L.accent);                   // saia
      break;
    default:
      ellipse(p, 12, 12 - bob, 10, 8, L.body, L.dark);
  }
  if (L.shape === 'fish') { rect(p, 0, 10 - bob, 3, 4, L.accent); rect(p, 21, 10 - bob, 3, 4, L.accent); }
  if (L.shape === 'dino') for (let i = 0; i < 4; i++) rect(p, 6 + 4 * i, 3 - bob, 2, 3, L.accent);
  if (L.shape === 'round') { ellipse(p, 9 + ex, 10 - bob, 3, 3, L.accent, L.dark); ellipse(p, 15 + ex, 10 - bob, 3, 3, L.accent, L.dark); }
  if (L.shape === 'leaf') for (let i = 0; i < 3; i++) rect(p, 5 + 5 * i, 7 + (i & 1) - bob, 4, 1, L.dark);
  if (L.shape === 'clown') { rect(p, 8, 1 - bob, 8, 3, L.accent); rect(p, 11, 0, 2, 1, L.accent); }
  if (face !== 0) {                                            // olhos (de costas não aparecem)
    const eye = L.shape === 'leaf' ? L.accent : '#ffffff';
    rect(p, 9 + ex, 11 - bob, 2, 2, eye); rect(p, 13 + ex, 11 - bob, 2, 2, eye);
    setPx(p, 10 + ex, 12 - bob, '#000000'); setPx(p, 14 + ex, 12 - bob, '#000000');
  }
  return p;
}

/** 16×16. kind 0 = ids < $38 ($D8:D271, pintas verdes); 1 = ids ≥ $38 ($D8:D2CC, pintas laranja). */
export function eggPix(kind: 0 | 1, frame: number): Pix {
  const p = makePix(16, 16);
  const tilt = frame & 1;
  ellipse(p, 8 + tilt * 0.5, 9, 6, 7, '#f8f8f0', '#9090a0');
  const spot = kind ? '#ff8f2f' : '#3fae4a';
  rect(p, 5, 6, 2, 2, spot); rect(p, 9, 9, 3, 2, spot); rect(p, 6, 12, 2, 1, spot);
  return p;
}

export function shotPix(kind: 0xd | 0xe | 0xf, state: 'fly' | 'cloud', frame: number): Pix {
  if (state === 'cloud') { const p = makePix(16, 12); ellipse(p, 5, 7, 5, 4, '#d8d8e0', '#9898a8'); ellipse(p, 11, 6, 5, 5, '#e8e8f0', '#9898a8'); return p; }
  if (kind === 0xe) { const p = makePix(8, 8); ellipse(p, 4, 4, 4, 4, '#7fb8ff', '#1a2a70'); return p; }
  if (kind === 0xf) {
    const p = makePix(8, 12);
    ellipse(p, 3, 9, 3, 2.5, '#202020', '#000000'); rect(p, 5, 1, 1, 8, '#202020'); rect(p, 5, 1, 3, 2 + (frame & 1), '#202020');
    return p;
  }
  return mountPix(0xd, 2, frame & 1);
}
```

`web/src/render/fallback/mounts/sprites.ts`:

```ts
import type { RoundState } from '../../../core/types';
import type { Pix } from '../../art/pix';
import { rider, mstate } from '../../../core/mounts/types';
import { cellAt, colOf, linOf } from '../../../core/mounts/core-api';
import { mountPix, eggPix, shotPix } from './art';

export interface FbSprite { key: string; make: () => Pix; x: number; y: number }

const cellXY = (cell: number) => ({ x: 16 * colOf(cell) - 8, y: 16 * linOf(cell) + 24 });
const faceOf = (d: number): 0 | 2 | 4 | 6 => ((d & 6) as 0 | 2 | 4 | 6);

export function fallbackMountSprites(s: RoundState, frame: number): FbSprite[] {
  const out: FbSprite[] = [];
  const egg = (cell: number, type: number, wob: number) => {
    const k: 0 | 1 = type >= 8 ? 1 : 0, f = wob;
    const { x, y } = cellXY(cell);
    out.push({ key: `egg:${k}:${f}`, make: () => eggPix(k, f), x: x + (f ? 1 : 0), y });
  };
  for (let c = 0; c < s.grid.length; c++) if ((s.grid[c] & 0xfff0) === 0x0970) egg(c, s.grid[c] & 0xf, 0);
  for (const p of s.players) {
    const r = rider(p);
    if (!r) continue;
    const here = cellAt(p.x, p.y);
    if (r.phase === 'mounting') { egg(here, r.type, (frame >> 3) & 1); continue; }
    if (r.phase === 'dismount') { if (r.remount) egg(here, r.type, (frame >> 3) & 1); continue; }
    const st = p.moveDir !== 8 ? (frame >> 3) & 1 : 0, f = faceOf(p.face);
    out.push({ key: `mount:${r.type}:${f}:${st}`, make: () => mountPix(r.type, f, st), x: Math.floor(p.x / 256) - 12, y: Math.floor(p.y / 256) - 12 });
    r.reserves.forEach((t, i) => egg(r.trail[i + 1] ?? here, t, 0));
  }
  for (const pr of mstate(s).projectiles) {
    if (pr.state === 'done') continue;
    const x = Math.floor(pr.x / 256), y = Math.floor(pr.y / 256), a = (frame >> 2) & 1;
    if (pr.state === 'cloud') { out.push({ key: `shot:${pr.kind.toString(16)}:cloud`, make: () => shotPix(pr.kind, 'cloud', 0), x: x - 8, y: y - 6 }); continue; }
    if (pr.kind === 0xd) out.push({ key: `mount:13:${pr.dir}:${a}`, make: () => mountPix(0xd, pr.dir, a), x: x - 12, y: y - 12 });
    else if (pr.kind === 0xe) out.push({ key: 'shot:e:fly', make: () => shotPix(0xe, 'fly', 0), x: x - 4, y: y - 4 });
    else out.push({ key: `shot:f:fly:${a}`, make: () => shotPix(0xf, 'fly', a), x: x - 4, y: y - 10 + a });
  }
  return out;
}
```

Armadilha: o teste do D espera `key` começando por `mount:13:` (tipo D = 13 em decimal no `key`), e o do montador tipo 3 `mount:3:`. Manter `r.type` em decimal no `key` (`${r.type}`).

Substituir `web/src/render/fallback/mounts/layer.ts`:

```ts
import type { FallbackBattleLayer } from '../../battle-layers';
import { pixToCanvas, type Img } from '../../sprite-bank';
import { fallbackMountSprites } from './sprites';

const cache = new Map<string, Img>();
export const fallbackMountLayer: FallbackBattleLayer = {
  id: 'mounts',
  draw(s, ctx, _bank, frame) {
    for (const sp of fallbackMountSprites(s, frame)) {
      let img = cache.get(sp.key);
      if (!img) { img = pixToCanvas(sp.make()); cache.set(sp.key, img); }
      ctx.drawImage(img, sp.x, sp.y);
    }
  },
};
```

- [ ] **Step 4: Rodar.** `npx vitest run tests/mounts/fallback.test.ts && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit.**

```bash
git add web/src/render/fallback/mounts web/tests/mounts/fallback.test.ts
git commit -m "feat(mounts): arte por código das 7 montarias, ovos, reservas e projéteis (fallback)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Dicas de IA (`AiMountHints`)

**Files:**
- Replace: `web/src/core/ai/mounts.ts`
- Test: `web/tests/mounts/ai.test.ts`

**Interfaces:**
- Consumes: T1 (`types.ts`, `core-api.ts` → `cellAt`, `isEnemy`), `AiMountHints` (formato real registrado na T1).
- Produces: `MOUNT_Y_RANGE`, `eggValue(s, p, cell)`, `alignedEnemy(s, p, dir, maxCells)`, `lineCells(s, p, dir, n)`, `wantMountY(s, p, safeWith)`, `escapeAfterLine(s, p, cells)`, `mountAiHints: AiMountHints` (`useY(s, slot)`, `eggValue(s, slot, cell)` do plano 6).

Regras (spec §9 item 9):
- `eggValue`: `null` se a casa não é ovo. Sem montaria → 3 (item bom). Montado em `riding` com ovo tipo < 8 e < 3 reservas → 1. Outros casos → 0 (não vale ir: o ovo não seria pego).
- `wantMountY(s, p, safeWith)`: só em `riding` e com tipo ativo. Alcance C 4, D 5, E 3, F 3 casas, em linha reta, sem casa de bit 15 no caminho. E com recarga > 0 → `null`; F com nota em voo → `null`; C com `$24`/`$25` ou sem bomba disponível → `null`, e só se `safeWith(lineCells)` (há rota de fuga com essas bombas). Testa as direções na ordem `[p.face, 0, 2, 4, 6]` (sem repetir) e devolve `{dir}`.
- `mountAiHints.useY(s, slot)` = `wantMountY` com `escapeAfterLine` como `safeWith`, e só `true` quando `dir === p.face` (o `AiMountHints` do plano 6 não tem campo para pedir a virada; a IA vira naturalmente ao andar e dispara quando alinha). `mountAiHints.eggValue(s, slot, cell)` = `eggValue ?? 0`.
- Não lê `s.hidden`. Não consome RNG.

- [ ] **Step 1: Teste** `web/tests/mounts/ai.test.ts`:

```ts
import { mkRound, placePx, ride, cx, cy } from './helpers';
import { eggValue, wantMountY, lineCells, escapeAfterLine, mountAiHints, MOUNT_Y_RANGE } from '../../src/core/ai/mounts';
import { cellOf } from '../../src/core/mounts/core-api';
import { mstate } from '../../src/core/mounts/types';

const yes = () => true, no = () => false;

function duel(type: number, dCells: number, opts: { face?: 0 | 2 | 4 | 6; targetDown?: boolean } = {}) {
  const s = mkRound({ players: [0, 2] });
  const p = placePx(s, 0, cx(3), cy(1)); p.face = opts.face ?? 2;
  if (opts.targetDown) placePx(s, 2, cx(3), cy(1 + dCells)); else placePx(s, 2, cx(3 + dCells), cy(1));
  const r = ride(s, 0, type);
  return { s, p, r };
}

describe('eggValue', () => {
  it('só ovos; sem montaria vale 3; montado com ovo 0–7 vale 1; ovo 8–F montado vale 0', () => {
    const { s, p } = duel(0x3, 4);
    s.grid[cellOf(6, 1)] = 0x0941;
    expect(eggValue(s, p, cellOf(6, 1))).toBeNull();
    s.grid[cellOf(6, 1)] = 0x0972;
    expect(eggValue(s, p, cellOf(6, 1))).toBe(1);
    s.grid[cellOf(6, 1)] = 0x097c;
    expect(eggValue(s, p, cellOf(6, 1))).toBe(0);
    p.mount = null;
    expect(eggValue(s, p, cellOf(6, 1))).toBe(3);
  });
  it('com 3 reservas não vale ir', () => {
    const { s, p, r } = duel(0x3, 4);
    r.reserves = [2, 2, 2];
    s.grid[cellOf(6, 1)] = 0x0972;
    expect(eggValue(s, p, cellOf(6, 1))).toBe(0);
  });
});

describe('wantMountY', () => {
  it('alcances: C 4, D 5, E 3, F 3', () => {
    expect(MOUNT_Y_RANGE).toEqual({ 0xc: 4, 0xd: 5, 0xe: 3, 0xf: 3 });
    for (const [t, n] of [[0xc, 4], [0xd, 5], [0xe, 3], [0xf, 3]] as const) {
      const a = duel(t, n); a.p.bombsFree = 3;
      expect(wantMountY(a.s, a.p, yes), `tipo ${t} a ${n}`).toEqual({ dir: 2 });
      const b = duel(t, n + 1); b.p.bombsFree = 3;
      expect(wantMountY(b.s, b.p, yes), `tipo ${t} a ${n + 1}`).toBeNull();
    }
  });
  it('passivas e fora de riding: nunca', () => {
    for (const t of [0x2, 0x3, 0xa]) { const a = duel(t, 1); expect(wantMountY(a.s, a.p, yes)).toBeNull(); }
    const b = duel(0xd, 2); b.r.phase = 'mounting';
    expect(wantMountY(b.s, b.p, yes)).toBeNull();
  });
  it('C: só com rota de fuga, com bombas e sem $24/$25', () => {
    const a = duel(0xc, 3); a.p.bombsFree = 2;
    expect(wantMountY(a.s, a.p, no)).toBeNull();
    expect(wantMountY(a.s, a.p, yes)).toEqual({ dir: 2 });
    a.p.disease = 0x25;
    expect(wantMountY(a.s, a.p, yes)).toBeNull();
    a.p.disease = 0; a.p.bombsFree = 0;
    expect(wantMountY(a.s, a.p, yes)).toBeNull();
  });
  it('C: lineCells = casas que a linha ocuparia', () => {
    const a = duel(0xc, 3); a.p.bombsFree = 3;
    a.s.grid[cellOf(5, 1)] = 0xcc80;
    expect(lineCells(a.s, a.p, 2, 3)).toEqual([cellOf(3, 1), cellOf(4, 1)]);
  });
  it('E com recarga e F com nota em voo: não', () => {
    const e = duel(0xe, 2); e.r.cooldown = 10;
    expect(wantMountY(e.s, e.p, yes)).toBeNull();
    const f = duel(0xf, 2);
    mstate(f.s).projectiles.push({ id: 1, kind: 0xf, owner: 0, x: 0, y: 0, dir: 2, born: 0, state: 'fly', t: 0, slot: 0 });
    expect(wantMountY(f.s, f.p, yes)).toBeNull();
  });
  it('bloco no caminho impede', () => {
    const a = duel(0xd, 4);
    a.s.grid[cellOf(5, 1)] = 0xcc80;
    expect(wantMountY(a.s, a.p, yes)).toBeNull();
  });
  it('alvo em outra direção: devolve a direção para virar', () => {
    const a = duel(0xe, 2, { face: 2, targetDown: true });
    a.s.grid[cellOf(3, 2)] = 0;                              // (3,2) é pilar no layout: abrir para o teste
    expect(wantMountY(a.s, a.p, yes)).toEqual({ dir: 4 });
  });
  it('escapeAfterLine: sai por (2,2); com (2,2) fechada não há fuga', () => {
    const a = duel(0xc, 3); a.p.fire = 0;
    const cells = [cellOf(3, 1), cellOf(4, 1)];
    expect(escapeAfterLine(a.s, a.p, cells)).toBe(true);
    a.s.grid[cellOf(2, 2)] = 0xcc80;
    expect(escapeAfterLine(a.s, a.p, cells)).toBe(false);
  });
  it('mountAiHints (formato do plano 6): useY só virado para o alvo; eggValue 0 fora de ovo', () => {
    const a = duel(0xe, 2);
    expect(mountAiHints.useY!(a.s, 0)).toBe(true);
    a.p.face = 4;
    expect(mountAiHints.useY!(a.s, 0)).toBe(false);
    expect(mountAiHints.eggValue!(a.s, 0, cellOf(8, 1))).toBe(0);
    a.s.grid[cellOf(8, 1)] = 0x0972;
    expect(mountAiHints.eggValue!(a.s, 0, cellOf(8, 1))).toBe(1);
  });
  it('não lê hidden: estados que diferem só em hidden dão a mesma resposta', () => {
    const a = duel(0xd, 3), b = duel(0xd, 3);
    b.s.hidden = [[cellOf(7, 1), 0x30], [cellOf(9, 3), 0x21]];
    expect(wantMountY(b.s, b.p, yes)).toEqual(wantMountY(a.s, a.p, yes));
    expect(eggValue(b.s, b.p, cellOf(7, 1))).toEqual(eggValue(a.s, a.p, cellOf(7, 1)));
  });
});
```


- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar** `web/src/core/ai/mounts.ts`:

```ts
import type { RoundState, Player } from '../types';
import type { AiMountHints } from './hints';
import { rider, mstate, MAX_RESERVES } from '../mounts/types';
import { cellAt, isEnemy } from '../mounts/core-api';
import { rangeOf } from '../constants';

export const MOUNT_Y_RANGE: Readonly<Record<number, number>> = { 0xc: 4, 0xd: 5, 0xe: 3, 0xf: 3 };
const STEP: Readonly<Record<number, number>> = { 0: -17, 2: 1, 4: 17, 6: -1 };

export function eggValue(s: RoundState, p: Player, cell: number): number | null {
  const code = s.grid[cell];
  if ((code & 0xfff0) !== 0x0970) return null;
  const r = rider(p);
  if (!r) return 3;
  if (r.phase === 'riding' && (code & 0xf) < 8 && r.reserves.length < MAX_RESERVES) return 1;
  return 0;
}

export function alignedEnemy(s: RoundState, p: Player, dir: number, maxCells: number): Player | null {
  let c = cellAt(p.x, p.y);
  for (let i = 1; i <= maxCells; i++) {
    c += STEP[dir];
    if (c < 0 || c >= s.grid.length || (s.grid[c] & 0x8000) !== 0) return null;
    for (const q of s.players) if (q.present && isEnemy(s, p, q) && cellAt(q.x, q.y) === c) return q;
  }
  return null;
}

export function lineCells(s: RoundState, p: Player, dir: number, n: number): number[] {
  const out: number[] = [];
  let c = cellAt(p.x, p.y);
  while (out.length < n && c >= 0 && c < s.grid.length && s.grid[c] === 0) { out.push(c); c += STEP[dir]; }
  return out;
}

export function wantMountY(s: RoundState, p: Player, safeWith: (bombCells: number[]) => boolean): { dir: 0 | 2 | 4 | 6 } | null {
  const r = rider(p);
  if (!r || r.phase !== 'riding') return null;
  const range = MOUNT_Y_RANGE[r.type];
  if (!range) return null;
  if (r.type === 0xe && r.cooldown > 0) return null;
  if (r.type === 0xf && mstate(s).projectiles.some(pr => pr.owner === p.slot && pr.kind === 0xf && pr.state === 'fly')) return null;
  if (r.type === 0xc && (p.disease === 0x24 || p.disease === 0x25 || p.bombsFree === 0)) return null;
  const dirs = [p.face, 0, 2, 4, 6].filter((d, i, a) => a.indexOf(d) === i) as (0 | 2 | 4 | 6)[];
  for (const dir of dirs) {
    if (!alignedEnemy(s, p, dir, range)) continue;
    if (r.type === 0xc && !safeWith(lineCells(s, p, dir, p.bombsFree))) continue;
    return { dir };
  }
  return null;
}

/** Rota de fuga depois da linha do C: BFS de até 6 casas por piso livre (as casas da linha bloqueiam, menos a própria)
 *  até uma casa fora da cruz de todas as bombas da linha (alcance rangeOf(p.fire), parando em bit 15). */
export function escapeAfterLine(s: RoundState, p: Player, cells: readonly number[]): boolean {
  const blast = new Set<number>();
  const range = rangeOf(p.fire);
  for (const b of cells) {
    blast.add(b);
    for (const d of [0, 2, 4, 6]) {
      let c = b;
      for (let i = 0; i < range; i++) { c += STEP[d]; if (c < 0 || c >= s.grid.length || (s.grid[c] & 0x8000) !== 0) break; blast.add(c); }
    }
  }
  const start = cellAt(p.x, p.y);
  const line = new Set(cells);
  const seen = new Set([start]);
  let frontier = [start];
  for (let depth = 0; depth <= 6 && frontier.length; depth++) {
    const next: number[] = [];
    for (const c of frontier) {
      if (!blast.has(c)) return true;
      for (const d of [0, 2, 4, 6]) {
        const n = c + STEP[d];
        if (n < 0 || n >= s.grid.length || seen.has(n) || line.has(n) || s.grid[n] !== 0) continue;
        seen.add(n); next.push(n);
      }
    }
    frontier = next;
  }
  return false;
}

/** AiMountHints do plano 6: useY(s, slot) e eggValue(s, slot, cell). A IA só aperta Y já virada para o alvo. */
export const mountAiHints: AiMountHints = {
  eggValue: (s, slot, cell) => eggValue(s, s.players[slot], cell) ?? 0,
  useY: (s, slot) => {
    const p = s.players[slot];
    const w = wantMountY(s, p, cells => escapeAfterLine(s, p, cells));
    return w !== null && w.dir === p.face;
  },
};
```

- [ ] **Step 4: Rodar.** `npx vitest run tests/mounts/ai.test.ts && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit.**

```bash
git add web/src/core/ai/mounts.ts web/tests/mounts/ai.test.ts
git commit -m "feat(ai): dicas de montaria — pegar ovos e usar Y (C ≤4, D ≤5, E ≤3, F ≤3)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Tipo 2 — atravessa soft

**Files:** Replace `web/src/core/mounts/abilities/type2.ts`; Test `web/tests/mounts/type2.test.ts`.
**Interfaces:** Consumes T2 (`mountModule`). Produces `ABILITY_2` com `passes`.

Regra: `passes(p, code) = code === 0xCC80` (a verificação `$C2:1631` pula o teste de bloco). Y não faz nada. Dados: `mount_battery_2_A_C_D_E_F.json` → `"0x2"."T2_softblock_x_final" = 91`, `"0xa"...= 47`.

- [ ] **Step 1: Teste** `web/tests/mounts/type2.test.ts`:

```ts
import { mkRound, placePx, ride, run, BTN, cx, cy, X } from './helpers';
import { mountModule } from '../../src/core/mounts/module';
import { ABILITY_2 } from '../../src/core/mounts/abilities/type2';
import { cellOf } from '../../src/core/mounts/core-api';

describe('montaria tipo 2 (peixe verde)', () => {
  it('atravessa soft: de x=31 anda 60 px em 60 ticks e o bloco fica (T2 = 91)', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    s.grid[cellOf(4, 1)] = 0xcc80;
    ride(s, 0, 0x2);
    run(s, 60, { 0: BTN.RIGHT });
    expect(X(p)).toBe(91);
    expect(s.grid[cellOf(4, 1)]).toBe(0xcc80);
  });
  it('outro tipo para em x=47, diante do bloco', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    s.grid[cellOf(4, 1)] = 0xcc80;
    ride(s, 0, 0xa);
    run(s, 60, { 0: BTN.RIGHT });
    expect(X(p)).toBe(47);
  });
  it('passes só concede soft; Y não faz nada', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    ride(s, 0, 0x2);
    expect(ABILITY_2.passes!(p, 0xcc80)).toBe(true);
    expect(ABILITY_2.passes!(p, 0xec40)).toBe(false);
    expect(ABILITY_2.passes!(p, 0xc900)).toBe(false);
    expect(mountModule.onY(s, p, [])).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.** `npx vitest run tests/mounts/type2.test.ts`.
- [ ] **Step 3: Implementar:**

```ts
import type { MountAbility } from '../types';
/** Tipo 2: atravessa soft blocks ($C2:1631). */
export const ABILITY_2: MountAbility = { type: 0x2, passes: (_p, code) => code === 0xcc80 };
```

- [ ] **Step 4: Rodar** → PASS. Se o 1º teste parar em 47, o core não consulta `MOUNTS.current.passes` no bloqueio `$82`: registrar como pendência do plano 6 (T1) em vez de contornar aqui.
- [ ] **Step 5: Commit** (`git add` dos arquivos que a tarefa possui):

```bash
git commit -m "feat(mounts): tipo 2 atravessa soft blocks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Tipo 3 — bombas perfurantes

**Files:** Replace `web/src/core/mounts/abilities/type3.ts`; Test `web/tests/mounts/type3.test.ts`.
**Interfaces:** Produces `ABILITY_3` com `bombType`.

Regra: na criação da bomba (`$C2:5127`) o tipo 3 grava `bomba+$22 = 2` → `bombType(p) = 2`, sobrepondo remota/perfurante do item. Dados: `bombtype.py` (fogo 3 = alcance 5; soft em x=64 e x=96 → (4,1) e (6,1)).

- [ ] **Step 1: Teste** `web/tests/mounts/type3.test.ts`:

```ts
import { mkRound, placePx, ride, run, BTN, cx, cy } from './helpers';
import { mountModule } from '../../src/core/mounts/module';
import { cellOf } from '../../src/core/mounts/core-api';

function scene(mounted: boolean) {
  const s = mkRound();
  const p = placePx(s, 0, cx(2), cy(1));
  p.fire = 3;
  s.grid[cellOf(4, 1)] = 0xcc80; s.grid[cellOf(6, 1)] = 0xcc80;
  if (mounted) ride(s, 0, 0x3);
  run(s, 1, { 0: BTN.A });
  expect(s.grid[cellOf(2, 1)]).toBe(0xc900);
  placePx(s, 0, cx(4), cy(5));                               // fora da cruz
  run(s, 130);
  return s;
}

describe('montaria tipo 3 (triceratops)', () => {
  it('bomba do montado perfura: queima (4,1) e (6,1)', () => {
    const s = scene(true);
    expect(s.grid[cellOf(4, 1)]).not.toBe(0xcc80);
    expect(s.grid[cellOf(6, 1)]).not.toBe(0xcc80);
  });
  it('sem montaria só queima (4,1)', () => {
    const s = scene(false);
    expect(s.grid[cellOf(4, 1)]).not.toBe(0xcc80);
    expect(s.grid[cellOf(6, 1)]).toBe(0xcc80);
  });
  it('bombType = 2 só em riding; Y não faz nada', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    expect(mountModule.bombType!(p)).toBeNull();
    const r = ride(s, 0, 0x3);
    expect(mountModule.bombType!(p)).toBe(2);
    expect(mountModule.onY(s, p, [])).toBe(false);
    r.phase = 'dismount';
    expect(mountModule.bombType!(p)).toBeNull();
  });
});
```

- [ ] **Step 2–4:** ver falhar; implementar:

```ts
import type { MountAbility } from '../types';
/** Tipo 3: bombas perfurantes ($C2:5127 grava bomba+$22 = 2). */
export const ABILITY_3: MountAbility = { type: 0x3, bombType: () => 2 };
```

rodar → PASS.
- [ ] **Step 5: Commit** (`git add` dos arquivos que a tarefa possui):

```bash
git commit -m "feat(mounts): tipo 3 põe bombas perfurantes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Tipo A — chute

**Files:** Replace `web/src/core/mounts/abilities/typeA.ts`; Test `web/tests/mounts/typeA.test.ts`.
**Interfaces:** Produces `ABILITY_A` com `kicks`.

Regra: o código trata `tipo == $A` como o item chute (`$C2:4339`, `$C2:33A5`, `$C2:4E9C`). Cenário `mount_kick.py`: montado anda 32 ticks para a direita, põe bomba, 32 para a esquerda, 30 para a direita, espera 20.

- [ ] **Step 1: Teste** `web/tests/mounts/typeA.test.ts`:

```ts
import { mkRound, placePx, ride, run, bombCells, BTN, cx, cy, X } from './helpers';
import { mountModule } from '../../src/core/mounts/module';
import { cellOf, colOf, linOf } from '../../src/core/mounts/core-api';

function kickScene(type: number) {
  const s = mkRound();
  const p = placePx(s, 0, cx(2), cy(1));
  ride(s, 0, type);
  run(s, 32, { 0: BTN.RIGHT });
  expect(X(p)).toBe(63);
  run(s, 1, { 0: BTN.A });
  run(s, 32, { 0: BTN.LEFT });
  run(s, 30, { 0: BTN.RIGHT });
  run(s, 20);
  return s;
}

describe('montaria tipo A (chute)', () => {
  it('andar contra a bomba a chuta: sai da (4,1) para a direita (mount_kick.py)', () => {
    const s = kickScene(0xa);
    expect(s.grid[cellOf(4, 1)]).not.toBe(0xc900);
    const cells = bombCells(s);
    expect(cells).toHaveLength(1);
    expect(linOf(cells[0])).toBe(1);
    expect(colOf(cells[0])).toBeGreaterThan(4);
  });
  it('tipo 3 não chuta: a bomba fica na (4,1)', () => {
    const s = kickScene(0x3);
    expect(bombCells(s)).toEqual([cellOf(4, 1)]);
  });
  it('kicks só em riding; Y não faz nada', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    expect(mountModule.kicks!(p)).toBe(false);
    ride(s, 0, 0xa);
    expect(mountModule.kicks!(p)).toBe(true);
    expect(mountModule.onY(s, p, [])).toBe(false);
  });
});
```

- [ ] **Step 2–4:** implementar:

```ts
import type { MountAbility } from '../types';
/** Tipo A: chuta como o item $0E ($C2:4339/$C2:33A5/$C2:4E9C). */
export const ABILITY_A: MountAbility = { type: 0xa, kicks: () => true };
```

→ PASS.
- [ ] **Step 5: Commit** (`git add` dos arquivos que a tarefa possui):

```bash
git commit -m "feat(mounts): tipo A chuta bombas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Tipo C — linha de bombas

**Files:** Replace `web/src/core/mounts/abilities/typeC.ts`; Test `web/tests/mounts/typeC.test.ts`.
**Interfaces:** Consumes `placeBombAt`, `cellAt`. Produces `ABILITY_C` com `onY`.

Regras (MNT A.5, L11): Y põe **todas as bombas disponíveis**, uma por casa, a partir da **própria casa**, na direção do rosto; para na 1ª casa com código ≠ 0; com `$24`/`$25` consome o Y sem efeito; evento `mount_ability` se pôs ao menos 1. Dado: `mount_c.py` com 3 bombas → objetos em x = 80, 96, 112 = cols 5, 6, 7 (o X do objeto bomba é `16·col`).

- [ ] **Step 1: Teste** `web/tests/mounts/typeC.test.ts`:

```ts
import { mkRound, placePx, ride, run, BTN, cx, cy } from './helpers';
import { cellOf } from '../../src/core/mounts/core-api';

function setup(bombs: number, face: 0 | 2 | 4 | 6 = 2) {
  const s = mkRound();
  const p = placePx(s, 0, cx(5), cy(1));
  p.face = face; p.bombsCap = bombs; p.bombsFree = bombs;
  ride(s, 0, 0xc);
  return { s, p };
}
const row = (s: ReturnType<typeof mkRound>, cols: number[]) => cols.map(c => s.grid[cellOf(c, 1)]);

describe('montaria tipo C (sino): Y = linha de bombas', () => {
  it('3 bombas em x = 80/96/112 (cols 5, 6, 7), a partir da própria casa (mount_c.py)', () => {
    const { s, p } = setup(3);
    const ev = run(s, 1, { 0: BTN.Y });
    expect(row(s, [5, 6, 7, 8])).toEqual([0xc900, 0xc900, 0xc900, 0]);
    expect(p.bombsFree).toBe(0);
    expect(ev.filter(e => e.type === 'bomb_placed')).toHaveLength(3);
    expect(ev).toContainEqual({ type: 'mount', id: 'mount_ability', slot: 0, mount: 0xc });
  });
  it('para no obstáculo: soft em (7,1) → só (5,1) e (6,1)', () => {
    const { s, p } = setup(3);
    s.grid[cellOf(7, 1)] = 0xcc80;
    run(s, 1, { 0: BTN.Y });
    expect(row(s, [5, 6, 7])).toEqual([0xc900, 0xc900, 0xcc80]);
    expect(p.bombsFree).toBe(1);
  });
  it('olhando para a esquerda: (5,1), (4,1), (3,1)', () => {
    const { s } = setup(3, 6);
    run(s, 1, { 0: BTN.Y });
    expect(row(s, [3, 4, 5, 6])).toEqual([0xc900, 0xc900, 0xc900, 0]);
  });
  it('com 1 bomba disponível põe só 1', () => {
    const { s } = setup(1);
    run(s, 1, { 0: BTN.Y });
    expect(row(s, [5, 6])).toEqual([0xc900, 0]);
  });
  it('doenças $24 e $25: o Y é consumido e nada acontece', () => {
    for (const d of [0x24, 0x25]) {
      const { s, p } = setup(3);
      p.disease = d;
      p.punch = true;                                        // Y não pode virar soco
      const ev = run(s, 1, { 0: BTN.Y });
      expect(row(s, [5, 6, 7])).toEqual([0, 0, 0]);
      expect(ev.some(e => e.type === 'punch')).toBe(false);
    }
  });
  it('bomba já na própria casa: nada (a linha começa bloqueada)', () => {
    const { s, p } = setup(3);
    run(s, 1, { 0: BTN.A });
    run(s, 1, { 0: BTN.Y });
    expect(row(s, [5, 6])).toEqual([0xc900, 0]);
    expect(p.bombsFree).toBe(2);
  });
});
```

- [ ] **Step 2–4:** implementar `web/src/core/mounts/abilities/typeC.ts`:

```ts
import type { MountAbility } from '../types';
import { cellAt, placeBombAt } from '../core-api';
import { mev } from '../events';

const STEP: Readonly<Record<number, number>> = { 0: -17, 2: 1, 4: 17, 6: -1 };

/** Tipo C: Y = todas as bombas disponíveis em linha ($C2:47D3, objeto $C1:1E75). */
export const ABILITY_C: MountAbility = {
  type: 0xc,
  onY(s, p, _r, ev) {
    if (p.disease === 0x24 || p.disease === 0x25) return true;
    let cell = cellAt(p.x, p.y), n = 0;
    while (p.bombsFree > 0 && cell >= 0 && cell < s.grid.length && s.grid[cell] === 0) {
      if (!placeBombAt(s, p, cell, ev)) break;
      cell += STEP[p.face]; n++;
    }
    if (n > 0) ev.push(mev({ id: 'mount_ability', slot: p.slot, mount: 0xc }));
    return true;
  },
};
```

→ PASS.
- [ ] **Step 5: Verificação opcional:** `mount_c.py` com log por tick da grade (`e.r16(M.cell(x,48))` para x = 80..112 a cada `e.run(1)`) para confirmar que as 3 bombas nascem no mesmo tick (L11). Se nascerem espaçadas, trocar a colocação por um objeto em `mountState` e ajustar o 1º teste.
- [ ] **Step 6: Commit** (`git add` dos arquivos que a tarefa possui):

```bash
git commit -m "feat(mounts): tipo C põe linha de bombas com Y

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Tipo D — lança a montaria

**Files:** Replace `web/src/core/mounts/abilities/typeD.ts`; Test `web/tests/mounts/typeD.test.ts`.
**Interfaces:** Consumes `spawnProjectile`, `advanceProjectile`, `D_SPEC` (T3), `loseMount` (T2), `explodeAt`, `cellAt`. Produces `ABILITY_D` com `onY` e `tickProjectile`.

Regras (MNT A.5, L3, L6, L8): Y cria o míssil (vaga = vaga da montaria) e o montador perde a montaria como num acerto (`loseMount(..., 'launch')`: 1 + 51 + 32, ou 1 + 44 com reserva, que remonta na **outra** vaga). O míssil anda 2 px/tick e, ao acertar jogador ou bloco, explode em cruz de alcance 2 na casa onde está, dono = montador, e some.

- [ ] **Step 1: Teste** `web/tests/mounts/typeD.test.ts`:

```ts
import { mkRound, placePx, ride, run, BTN, cx, cy } from './helpers';
import { activeCount } from '../../src/core/mounts/eggs';
import { mstate } from '../../src/core/mounts/types';
import { cellOf } from '../../src/core/mounts/core-api';

function launch(targetPx: number | null, extra = {}) {
  const s = mkRound({ players: [0, 2] });
  const p = placePx(s, 0, 32, 47); p.face = 2;
  if (targetPx !== null) placePx(s, 2, targetPx, 47); else placePx(s, 2, cx(14), cy(11));
  const r = ride(s, 0, 0xd, extra);
  const ev0 = run(s, 1, { 0: BTN.Y });                     // k = 0
  return { s, p, r, ev0 };
}

describe('montaria tipo D (alcachofra): Y lança a montaria', () => {
  it('alvo a 5 casas: explode 34 ticks depois do Y na (6,1) e mata o alvo', () => {
    const { s, ev0 } = launch(112);
    expect(ev0).toContainEqual({ type: 'mount', id: 'mount_lost', slot: 0, mount: 0xd, reserve: false, cause: 'launch' });
    let kExp = -1;
    for (let k = 1; k <= 40 && kExp < 0; k++) {
      const ev = run(s, 1);
      const ex = ev.find(e => e.type === 'explosion');
      if (ex) { kExp = k; expect(ex).toMatchObject({ cell: cellOf(6, 1), owner: 0 }); }
    }
    expect(kExp).toBe(34);
    run(s, 3);
    expect(s.players[2].state).not.toBe('alive');
  });
  it('o montador cai: 1 + 51 ticks travado, depois 32 de invencibilidade', () => {
    const { s, p } = launch(null);
    const x0 = p.x;
    run(s, 51, { 0: BTN.RIGHT });
    expect(p.x).toBe(x0);
    expect(p.act).toBe('dismount');
    run(s, 1);
    expect(p.mount).toBeNull();
    expect(p.inv).toBe(32);
  });
  it('bate no bloco: explode na casa antes dele (soft em (6,1) → explosão na (5,1) em k = 24)', () => {
    const s = mkRound();
    const p = placePx(s, 0, 32, 47); p.face = 2;
    s.grid[cellOf(6, 1)] = 0xcc80;
    ride(s, 0, 0xd);
    run(s, 1, { 0: BTN.Y });
    let k = 0, ex: { cell?: number } | undefined;
    while (!ex && k < 60) { k++; ex = run(s, 1).find(e => e.type === 'explosion') as { cell?: number } | undefined; }
    expect(k).toBe(24);
    expect(ex!.cell).toBe(cellOf(5, 1));
    run(s, 1);
    expect(s.grid[cellOf(6, 1)]).not.toBe(0xcc80);
  });
  it('míssil em voo conta no teto; some depois de explodir', () => {
    const { s } = launch(null);
    expect(activeCount(s)).toBe(1);
    expect(mstate(s).projectiles[0]).toMatchObject({ kind: 0xd, slot: 1, state: 'fly' });
    run(s, 120);
    expect(mstate(s).projectiles).toHaveLength(0);
    expect(activeCount(s)).toBe(0);
  });
  it('com ovo reserva: remonta em 1 + 44 na outra vaga; o míssil fica com a antiga', () => {
    const { s, p, r } = launch(null, { reserves: [0x3] });
    expect(mstate(s).projectiles[0].slot).toBe(1);
    expect(r.slot).toBe(2);
    run(s, 45);
    expect(p.mount).toBe(r);
    expect(r).toMatchObject({ phase: 'riding', type: 0x3 });
  });
});
```

- [ ] **Step 2–4:** implementar `web/src/core/mounts/abilities/typeD.ts`:

```ts
import type { MountAbility } from '../types';
import { spawnProjectile, advanceProjectile, D_SPEC } from '../projectile';
import { loseMount } from '../rider';
import { cellAt, explodeAt } from '../core-api';
import { mev } from '../events';

export const D_RANGE = 2;   // fogo 0 (spec §12 A8)

/** Tipo D: Y lança a própria montaria ($C1:3238 → $C1:32EA). */
export const ABILITY_D: MountAbility = {
  type: 0xd,
  onY(s, p, r, ev) {
    const slot = r.slot;
    spawnProjectile(s, p, 0xd, slot);
    loseMount(s, p, r, ev, 'launch');
    if (r.remount) r.slot = slot === 1 ? 2 : 1;
    ev.push(mev({ id: 'mount_ability', slot: p.slot, mount: 0xd }));
    return true;
  },
  tickProjectile(s, pr, ev) {
    const res = advanceProjectile(s, pr, D_SPEC);
    if (res.kind === 'none') return;
    if (res.kind === 'player') ev.push(mev({ id: 'mount_struck', slot: pr.owner, target: res.slot, mount: 0xd }));
    explodeAt(s, cellAt(pr.x, pr.y), D_RANGE, pr.owner, ev);
    pr.state = 'done'; pr.t = s.tick;
  },
};
```

Armadilha: em `loseMount` sem reserva a vaga do montador vira 0; por isso `slot` é lido **antes**.

→ PASS.
- [ ] **Step 5: Verificação opcional:** `mount_vs.py D Y 112 60` registrando a grade de `$7E:2800` no quadro da explosão, para medir o alcance real da cruz (A8). Se não for 2, trocar `D_RANGE` e registrar.
- [ ] **Step 6: Commit** (`git add` dos arquivos que a tarefa possui):

```bash
git commit -m "feat(mounts): tipo D lança a montaria como míssil que explode em cruz

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Tipo E — tiro lento

**Files:** Replace `web/src/core/mounts/abilities/typeE.ts`; Test `web/tests/mounts/typeE.test.ts`.
**Interfaces:** Consumes `spawnProjectile`, `advanceProjectile`, `E_SPEC`. Produces `ABILITY_E`, `E_COOLDOWN`, `E_FLIGHT`, `E_CLOUD`.

Regras (MNT A.5, L6, L7, L9, L10): Y → se `cooldown > 0`, consome sem efeito; senão tiro na posição do montador, `cooldown = 64`, evento `mount_ability`. Em voo: acerto → alvo recebe `effect = {kind: 2, left: 64}`, evento `mount_struck`, vira nuvem; bloco ou k > 28 → nuvem. Nuvem dura 16 ticks e some. O efeito vale mesmo com o alvo montado ou invencível.

- [ ] **Step 1: Teste** `web/tests/mounts/typeE.test.ts`:

```ts
import { mkRound, placePx, ride, run, firstTick, BTN } from './helpers';
import { mstate } from '../../src/core/mounts/types';

function shoot(targetPx: number) {
  const s = mkRound({ players: [0, 2] });
  const p = placePx(s, 0, 32, 47); p.face = 2;
  const q = placePx(s, 2, targetPx, 47);
  const r = ride(s, 0, 0xe);
  run(s, 1, { 0: BTN.Y });
  return { s, p, q, r };
}

describe('montaria tipo E (tanque): Y = tiro lento', () => {
  it('acerta alvos a 1, 2, 3, 4 casas em 1, 11, 19, 27 ticks (mount_e.py)', () => {
    const got = [1, 2, 3, 4].map(d => { const { s, q } = shoot(32 + 16 * d); return firstTick(s, 60, () => q.effect.kind === 2); });
    expect(got).toEqual([1, 11, 19, 27]);
  });
  it('alvo fica a 128/256 px por tick durante 253–256 ticks (effect {2, 64}; medido 255)', () => {
    const { s, q } = shoot(64);
    expect(firstTick(s, 60, () => q.effect.kind === 2)).toBe(11);
    expect(q.effect).toEqual({ kind: 2, left: 64 });
    let slowed = 1;
    for (let i = 0; i < 20; i++) {
      const x0 = q.x;
      run(s, 1, { 2: BTN.RIGHT });
      expect(q.x - x0).toBe(128);
      if (q.effect.kind === 2) slowed++;
    }
    while (q.effect.kind === 2 && slowed < 400) { run(s, 1); if (q.effect.kind === 2) slowed++; }
    expect(slowed).toBeGreaterThanOrEqual(253);
    expect(slowed).toBeLessThanOrEqual(256);
  });
  it('recarga de 64 ticks: Y antes disso não atira', () => {
    const s = mkRound();
    const p = placePx(s, 0, 32, 47); p.face = 2;
    const r = ride(s, 0, 0xe);
    run(s, 1, { 0: BTN.Y });
    expect(mstate(s).projectiles).toHaveLength(1);
    expect(r.cooldown).toBe(64);
    run(s, 30);
    run(s, 1, { 0: BTN.Y });
    expect(mstate(s).projectiles.filter(pr => pr.born === s.tick)).toHaveLength(0);
    run(s, 40);
    run(s, 1, { 0: BTN.Y });
    expect(mstate(s).projectiles.filter(pr => pr.born === s.tick)).toHaveLength(1);
  });
  it('sem alvo: voa 28 ticks, vira nuvem por 16 e some', () => {
    const s = mkRound();
    const p = placePx(s, 0, 32, 47); p.face = 2;
    ride(s, 0, 0xe);
    run(s, 1, { 0: BTN.Y });
    const pr = mstate(s).projectiles[0];
    run(s, 28);
    expect(pr.state).toBe('fly');
    expect(pr.x).toBe((32 + 56) * 256);
    run(s, 1);
    expect(pr.state).toBe('cloud');
    run(s, 16);
    expect(mstate(s).projectiles).toHaveLength(0);
  });
});
```

- [ ] **Step 2–4:** implementar `web/src/core/mounts/abilities/typeE.ts`:

```ts
import type { MountAbility } from '../types';
import { spawnProjectile, advanceProjectile, E_SPEC } from '../projectile';
import { mev } from '../events';

export const E_COOLDOWN = 64;   // +$C6 (spec §12 A8)
export const E_FLIGHT = 28;     // ticks de voo (56 px)
export const E_CLOUD = 16;      // ticks de nuvem

/** Tipo E: tiro lento ($C1:2CFF/$C1:2D73 → nuvem $C1:2EB6). */
export const ABILITY_E: MountAbility = {
  type: 0xe,
  onY(s, p, r, ev) {
    if (r.cooldown > 0) return true;
    spawnProjectile(s, p, 0xe);
    r.cooldown = E_COOLDOWN + 1;   // tickRiders desconta 1 ainda neste tick: depois do tick do Y vale 64
    ev.push(mev({ id: 'mount_ability', slot: p.slot, mount: 0xe }));
    return true;
  },
  tickProjectile(s, pr, ev) {
    if (pr.state === 'cloud') { if (s.tick - pr.t >= E_CLOUD) pr.state = 'done'; return; }
    const res = advanceProjectile(s, pr, E_SPEC);
    if (res.kind === 'player') {
      s.players[res.slot].effect = { kind: 2, left: 64 };
      ev.push(mev({ id: 'mount_struck', slot: pr.owner, target: res.slot, mount: 0xe }));
    }
    if (res.kind !== 'none' || s.tick - pr.born >= E_FLIGHT + 1) { pr.state = 'cloud'; pr.t = s.tick; }
  },
};
```

Armadilha: `onY` roda na fase dos jogadores e `tickRiders` (T2) roda depois, no mesmo tick, descontando 1. Por isso o código grava `E_COOLDOWN + 1`: o valor observável depois do tick do Y é 64, e o Y volta a funcionar 64 ticks depois.

→ PASS. Se a faixa 253–256 falhar, conferir a contagem do `effect` no core (T1) antes de mexer aqui.
- [ ] **Step 5: Verificação opcional:** `mount_e3.py` (duração e média de velocidade) e `mount_e.py` com alvos a 5 e 6 casas (define o fim do voo, L7).
- [ ] **Step 6: Commit** (`git add` dos arquivos que a tarefa possui):

```bash
git commit -m "feat(mounts): tipo E dispara tiro que deixa o alvo lento

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Tipo F — notas musicais

**Files:** Replace `web/src/core/mounts/abilities/typeF.ts`; Test `web/tests/mounts/typeF.test.ts`.
**Interfaces:** Consumes `spawnProjectile`, `advanceProjectile`, `hasFlying`, `F_SPEC`, `lockAct`. Produces `ABILITY_F`, `F_FLIGHT`, `DANCE_TICKS`.

Regras (MNT A.5, L6, L7, L9, L21): Y → se já há nota do montador em voo, consome sem efeito; senão nota (0,5 px/tick), evento `mount_ability`. Acerto → `lockAct(alvo, 'dance', 192)` (rotina `$C2:0D83` → `$C2:0DDC`), evento `mount_struck`, a nota some. Bloco ou k > 160 → some.

- [ ] **Step 1: Teste** `web/tests/mounts/typeF.test.ts`:

```ts
import { mkRound, placePx, ride, run, firstTick, BTN } from './helpers';
import { mstate } from '../../src/core/mounts/types';
import { cellOf } from '../../src/core/mounts/core-api';

describe('montaria tipo F (palhaço): Y = notas', () => {
  it('alvo a 2,5 casas (x=72): dança do tick 79 ao 270 e fica livre no 271 (vs_F_Y_72)', () => {
    const s = mkRound({ players: [0, 2] });
    const p = placePx(s, 0, 32, 47); p.face = 2;
    const q = placePx(s, 2, 72, 47);
    ride(s, 0, 0xf);
    run(s, 1, { 0: BTN.Y });
    expect(firstTick(s, 100, () => q.act === 'dance')).toBe(79);
    const x0 = q.x;
    const free = firstTick(s, 300, () => q.act !== 'dance', { 2: BTN.RIGHT });
    expect(79 + free).toBe(271);
    expect(q.x - x0).toBeLessThanOrEqual(256);                // só o tick 271 pode ter andado
  });
  it('uma nota por vez', () => {
    const s = mkRound();
    const p = placePx(s, 0, 32, 47); p.face = 2;
    ride(s, 0, 0xf);
    run(s, 1, { 0: BTN.Y });
    run(s, 5);
    run(s, 1, { 0: BTN.Y });
    expect(mstate(s).projectiles).toHaveLength(1);
  });
  it('nota some ao bater em bloco', () => {
    const s = mkRound();
    const p = placePx(s, 0, 32, 47); p.face = 2;
    s.grid[cellOf(4, 1)] = 0xcc80;
    ride(s, 0, 0xf);
    run(s, 1, { 0: BTN.Y });
    run(s, 40);                                              // chega ao centro da (3,1) em k = 30
    expect(mstate(s).projectiles).toHaveLength(0);
  });
  it('sem alvo nem bloco some depois de 160 ticks', () => {
    const s = mkRound();
    const p = placePx(s, 0, 32, 47 + 16 * 4); p.face = 2;   // linha 5: (3,5)..(14,5) livres
    ride(s, 0, 0xf);
    run(s, 1, { 0: BTN.Y });
    run(s, 160);
    expect(mstate(s).projectiles).toHaveLength(1);
    run(s, 1);
    expect(mstate(s).projectiles).toHaveLength(0);
  });
});
```

- [ ] **Step 2–4:** implementar `web/src/core/mounts/abilities/typeF.ts`:

```ts
import type { MountAbility } from '../types';
import { spawnProjectile, advanceProjectile, hasFlying, F_SPEC } from '../projectile';
import { lockAct } from '../core-api';
import { mev } from '../events';

export const F_FLIGHT = 160;    // ticks (80 px) — provisório (L7)
export const DANCE_TICKS = 192; // $C0

/** Tipo F: notas musicais ($C1:2F21); atingido dança ($C2:0D83 → $C2:0DDC). */
export const ABILITY_F: MountAbility = {
  type: 0xf,
  onY(s, p, _r, ev) {
    if (hasFlying(s, p.slot, 0xf)) return true;
    spawnProjectile(s, p, 0xf);
    ev.push(mev({ id: 'mount_ability', slot: p.slot, mount: 0xf }));
    return true;
  },
  tickProjectile(s, pr, ev) {
    const res = advanceProjectile(s, pr, F_SPEC);
    if (res.kind === 'player') {
      lockAct(s, s.players[res.slot], 'dance', DANCE_TICKS);
      ev.push(mev({ id: 'mount_struck', slot: pr.owner, target: res.slot, mount: 0xf }));
    }
    if (res.kind !== 'none' || s.tick - pr.born >= F_FLIGHT + 1) { pr.state = 'done'; pr.t = s.tick; }
  },
};
```

Nota do teste do bloco: da x=32, a nota chega ao centro da (3,1) (x=47) em k = 30 (15 px a 0,5 px/tick) e a (4,1) tem soft → `block` em k = 30.

→ PASS.
- [ ] **Step 5: Verificação opcional:** `mount_vs.py F Y 88 300` e `F Y 120 400` para o fim do voo (L7).
- [ ] **Step 6: Commit** (`git add` dos arquivos que a tarefa possui):

```bash
git commit -m "feat(mounts): tipo F solta notas que fazem o alvo dançar 192 ticks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Camada ROM (montarias, ovos, reservas, projéteis, jogador montado)

**Files:**
- Replace: `web/src/render/rom/mounts/layer.ts`, `web/src/render/rom/mounts/rider.ts`
- Create: `web/src/render/rom/mounts/sprites.ts`, `web/src/render/rom/mounts/gfx.ts`
- Test: `web/tests/mounts/rom-layer.test.ts`

**Interfaces:**
- Consumes: T4 (`facts.ts`, fixture), plano 5 (`RomAssets.anim`, `CharacterAssets.frame`, `RomView`, `decodeZte`, `ObjEntry`), T1 (`RomPlayerHook`, `RomBattleBuilder`).
- Produces: `mountGfx(a, type)` (tiles decodificados em cache), `piecePx(a, piece, ctx)`, `riderHook`, `mountRomSprites(s, a, frame): { e: ObjEntry; sortY: number }[]`, `romMountLayer`.

Regras:
- **Amostragem da animação** igual à §7.4: `t = s.tick − t0` (t0 = `r.t0` para montaria/ovo, `p.actT0` para o jogador, `pr.born` para projétil), percorre os quadros pela duração, `dur = 255` congela, tudo em loop.
- **Escolha da animação** pelos fatos da T4: montado `riding` → `RIDER_ANIMS[type][dirIdx].walk|idle` (walk se `p.moveDir !== 8`); `mounting` → `MOUNTING_ANIMS[type]`; `dismount` → `DISMOUNT_ANIMS` (ou `REMOUNT_ANIMS` com `remount`); ovo → `EGG_ANIMS` (a ordem da lista segue a fixture: id < `$38` primeiro); reserva → `RESERVE_EGG_ANIMS`; projéteis → `PROJ_ANIMS`; dança (`act === 'dance'`) → `DANCE_ANIMS`. Quando a lista tem mais de 1 endereço (sequência de animações), avança para a seguinte quando o tempo da anterior acaba.
- **Pixels de cada peça:** peça no slot do jogador (tile do slot: P1 `$000`, P2 `$004`, P3 `$040`, P4 `$044`, P5 `$048`, ANI §1.2) → quadro 32×32 do personagem (`CharacterAssets.frame(g)`) ou da 2ª folha `SHEET2` pela mesma fórmula; peça no slot da montaria → tiles de `mountGfx(type)` (`MOUNT_GFX[type]`: ZTE ou cru), recortando 16×16/32×32 no layout OBJ (linhas de 16 tiles).
- **Paleta:** jogador → OBJ do slot (0, 1, 4, 5, 6); montaria → número medido na fixture para a vaga, carregando as 16 cores do endereço medido (`palettes[].romAddrs[0]`) com `b.cgram(128 + 16·pal + i, cor)`.
- **Posição:** `x = X + dx`, `y = Y + dy` (X, Y em px; dx, dy medidos). Prioridade OBJ 2. `sortY = Y` do dono (§7.2).
- **Plano B** (se a T4 marcou `format: 'unknown'` para algum tipo): usar os `pxSha1` medidos para achar a origem por varredura na ROM **não** é permitido em tempo de execução; nesse caso esse tipo usa só as peças do personagem e a montaria sai pelo fallback (`mountPix`) convertido em `src.px` com a paleta do fallback. Registrar no PR.

- [ ] **Step 1: Teste** `web/tests/mounts/rom-layer.test.ts` (compara com o emulador pela fixture):

```ts
import { createHash } from 'node:crypto';
import fx from '../fixtures/rom/mount-render.json';
import { ASSETS } from './rom-helpers';
import { mkRound, placePx, ride, cx, cy } from './helpers';
import { riderHook } from '../../src/render/rom/mounts/rider';
import { mountRomSprites } from '../../src/render/rom/mounts/sprites';
import type { ObjEntry } from '../../src/render/ppu';

const sha1 = (b: Uint8Array) => createHash('sha1').update(b).digest('hex');
const DIRS = ['up', 'right', 'down', 'left'] as const;
const FACE = { up: 0, right: 2, down: 4, left: 6 } as const;
type FxPiece = { dx: number; dy: number; size: number; hflip: boolean; vflip: boolean; pxSha1: string };
const norm = (ps: FxPiece[]) => ps.map(p => `${p.dx},${p.dy},${p.size},${+p.hflip},${+p.vflip},${p.pxSha1}`).sort();
function facts(es: ObjEntry[], X: number, Y: number) {
  return norm(es.map(e => ({ dx: e.x - X, dy: e.y - Y, size: e.size, hflip: e.hflip, vflip: e.vflip, pxSha1: sha1((e.src as { px: Uint8Array }).px) })));
}

describe.skipIf(!ASSETS)('camada ROM das montarias × emulador', () => {
  for (const t of ['2', '3', 'a', 'c', 'd', 'e', 'f']) for (const d of DIRS) {
    it(`montado tipo ${t} parado olhando ${d} = OAM medida`, () => {
      const s = mkRound();
      const p = placePx(s, 0, cx(7), cy(5));
      p.face = FACE[d]; p.act = 'idle'; p.actT0 = s.tick; p.moveDir = 8;
      ride(s, 0, parseInt(t, 16));
      const exp = (fx.riders as Record<string, Record<string, { idle: { pieces: FxPiece[] }[] }>>)[t][d].idle.at(-1)!.pieces;
      const got = riderHook(s, p, ASSETS!, s.tick)!;
      expect(got).not.toBeNull();
      expect(facts(got, cx(7), cy(5))).toEqual(norm(exp));
    });
  }
  it('andando: a sequência de quadros distintos bate com a medida (tipo 3, direita)', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(7), cy(5));
    p.face = 2; p.act = 'walk'; p.actT0 = s.tick; p.moveDir = 2;
    ride(s, 0, 0x3);
    const seq: string[] = [];
    for (let i = 0; i < 24; i++) { const k = facts(riderHook(s, p, ASSETS!, s.tick)!, cx(7), cy(5)).join('|'); if (seq.at(-1) !== k) seq.push(k); s.tick++; }
    const exp: string[] = [];
    for (const smp of fx.riders['3'].right.walk) { const k = norm(smp.pieces as FxPiece[]).join('|'); if (exp.at(-1) !== k) exp.push(k); }
    expect(seq).toEqual(exp);
  });
  it('ovo no chão: peças medidas em st_ride_pre', () => {
    const g = fx.eggs[0];
    const s = mkRound();
    s.grid[5 * 17 + 7] = 0x0970 | (g.id & 0xf);
    const got = mountRomSprites(s, ASSETS!, s.tick).map(x => x.e);
    expect(facts(got, 16 * 7, 16 * (5 + 2))).toEqual(norm(g.samples[0].pieces as FxPiece[]));
  });
  it('sem montaria, sem traje: o gancho não troca o jogador', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(7), cy(5));
    expect(riderHook(s, p, ASSETS!, s.tick)).toBeNull();
  });
});
```

Armadilha: o ovo no chão da ROM é objeto com X = `16·col`, Y = `16·(lin+2)` (sem o −1 dos jogadores); `mountRomSprites` usa esse ponto de referência para ovos.

- [ ] **Step 2: Rodar com a ROM e ver falhar.** `SB4_ROM=... npx vitest run tests/mounts/rom-layer.test.ts`.

- [ ] **Step 3: Implementar.**
  - `gfx.ts`: `mountGfx(a: RomAssets, type: number): Tiles` com cache por `type` (ZTE via decodificador do plano 5 ou leitura crua `a.rom.bytes(src, n)`), e `objPx(tiles, baseTile, tile, size): Uint8Array` (layout OBJ: `col = (tile & 15) + tx`, `row = (tile >> 4) + ty`, 16 tiles por linha).
  - `rider.ts`: `riderHook` (montado em qualquer fase ou `act === 'dance'`): escolhe a animação, amostra o quadro, monta um `ObjEntry` por peça (`src.px`), aplica `hflip`/`vflip` da peça, paleta do slot do jogador ou da vaga.
  - `sprites.ts`: `mountRomSprites` para ovos na grade, reservas (casa `trail[i+1]`), projéteis (D em voo, E voo/nuvem, F) e o ovo chocando em `mounting`/`remount`.
  - `layer.ts`: `romMountLayer.draw` carrega as paletas das vagas (`b.cgram`) e chama `b.sprite(e, sortY, order)` para cada item de `mountRomSprites`.
- [ ] **Step 4: Rodar** com e sem ROM → PASS (sem ROM, *skipped*). `npx tsc --noEmit`.
- [ ] **Step 5: Conferência visual:** `SB4_ROM=... npm run snap` (se o plano 10 já tiver o script) ou o harness de screenshot do plano 7, com uma rodada da fase 1 em que P1 começa montado em cada tipo; comparar a olho com `analise/extraido/montarias-e-telas/montarias_battle_7tipos.png` (não versionar a captura).
- [ ] **Step 6: Commit** (`git add` dos arquivos que a tarefa possui):

```bash
git commit -m "feat(render): montarias, ovos e projéteis desenhados da ROM

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Traje da fase 10 (visual ROM e fallback)

**Files:**
- Replace: `web/src/render/rom/mounts/costume.ts`, `web/src/render/fallback/mounts/costume.ts`
- Create: `web/src/render/fallback/mounts/costume-art.ts`
- Test: `web/tests/mounts/costume.test.ts`

**Interfaces:**
- Consumes: T4 (`COSTUME_ANIMS`, `SHEET2`, fixture `costumes`), plano 6 (`Player.costume`: −1 ou 0..7).
- Produces: `costumeHook`, `costumePix(c)`, `fallbackCostumeLayer`.

Regras (spec §5.3, L18): a mecânica é do plano 6. Visual: com `p.costume >= 0`, `p.state === 'alive'` e sem montaria, o jogador é desenhado pela animação `COSTUME_ANIMS[costume & 7][dirIdx]` (walk/idle) com a 2ª folha `SHEET2` (medida `$D4:0000`), mesma paleta do slot. Ações sem entrada medida (soco, arremesso, morte) usam o desenho padrão (o gancho devolve `null`). Fallback: chapéu/roupa de 16×10 desenhado sobre a cabeça em `(X − 8, Y − 26)`, um desenho por traje.

- [ ] **Step 1: Teste** `web/tests/mounts/costume.test.ts`:

```ts
import { createHash } from 'node:crypto';
import fx from '../fixtures/rom/mount-render.json';
import { ASSETS } from './rom-helpers';
import { mkRound, placePx, ride, cx, cy } from './helpers';
import { costumeHook } from '../../src/render/rom/mounts/costume';
import { costumePix } from '../../src/render/fallback/mounts/costume-art';
import { fallbackCostumeSprites } from '../../src/render/fallback/mounts/costume';

const sha1 = (b: Uint8Array) => createHash('sha1').update(b).digest('hex');
const hash = (p: { data: Uint8ClampedArray }) => Array.from(p.data).join(',');

describe('traje (fallback)', () => {
  it('8 trajes distintos, 16×10', () => {
    const set = new Set<string>();
    for (let c = 0; c < 8; c++) { const p = costumePix(c); expect([p.w, p.h]).toEqual([16, 10]); set.add(hash(p)); }
    expect(set.size).toBe(8);
  });
  it('sprite sobre a cabeça só com traje e vivo', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(7), cy(5));
    expect(fallbackCostumeSprites(s)).toHaveLength(0);
    p.costume = 5;
    expect(fallbackCostumeSprites(s)).toEqual([expect.objectContaining({ key: 'costume:5', x: cx(7) - 8, y: cy(5) - 26 })]);
    p.state = 'dying';
    expect(fallbackCostumeSprites(s)).toHaveLength(0);
  });
});

describe.skipIf(!ASSETS)('traje (ROM) × emulador', () => {
  for (let c = 0; c < 8; c++) it(`traje ${c} parado para a direita = OAM medida na fase 10`, () => {
    const s = mkRound({ stage: 10 });
    const p = placePx(s, 0, cx(7), cy(5));
    p.costume = c; p.face = 2; p.act = 'idle'; p.actT0 = s.tick; p.moveDir = 8;
    const got = costumeHook(s, p, ASSETS!, s.tick)!;
    const exp = (fx.costumes as Record<string, { right: { idle: { pieces: { dx: number; dy: number; pxSha1: string }[] }[] } }>)[String(c)].right.idle.at(-1)!.pieces;
    expect(got.map(e => `${e.x - cx(7)},${e.y - cy(5)},${sha1((e.src as { px: Uint8Array }).px)}`).sort())
      .toEqual(exp.map(q => `${q.dx},${q.dy},${q.pxSha1}`).sort());
  });
  it('montado: o gancho do traje não interfere', () => {
    const s = mkRound({ stage: 10 });
    const p = placePx(s, 0, cx(7), cy(5));
    p.costume = 2; ride(s, 0, 0x3);
    expect(costumeHook(s, p, ASSETS!, s.tick)).toBeNull();
  });
});
```

- [ ] **Step 2–4:** implementar `costume-art.ts` (8 desenhos procedurais: cores/formas distintas — cartola, coroa, chapéu de palha, capacete, laço, turbante, boné, gorro), `costume.ts` do fallback (`fallbackCostumeSprites(s)` puro + `fallbackCostumeLayer` com cache de canvas, como na T5) e `costume.ts` da ROM. Como `rider.ts`/`gfx.ts` são da T14 (mesma onda), a T15 **não** os importa: lê `RomAssets.anim(addr)` e `CharacterAssets` direto e tem a própria amostragem de animação (percorre os quadros por `dur`, `dur = 255` congela, loop), cerca de 15 linhas. A T16 unifica as duas amostragens.
- [ ] **Step 5:** rodar com e sem ROM → PASS; `npx tsc --noEmit`.
- [ ] **Step 6: Commit** (`git add` dos arquivos que a tarefa possui):

```bash
git commit -m "feat(render): visual dos 8 trajes da fase 10 (ROM e fallback)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Integração, partidas de CPU e aceite

**Files:**
- Create: `web/tests/mounts/sim.ts`, `web/tests/mounts/acceptance.test.ts`, `web/tests/mounts/cpu.test.ts`
- Modify (só se preciso, com acordo no PR): o desenhista de jogadores do plano 7 para consultar `romPlayerHooks` (3 linhas); a amostragem duplicada T14/T15 unificada em `render/rom/mounts/anim.ts`.

**Interfaces:**
- Consumes: tudo. Plano 6: `createMatch(rules, stage, seed)`, `startRound`, `finishRound`, `step`, `defaultRules` (de `core/index.ts`), `createAi`/`aiInputs` (`core/ai/index.ts`), `hashState`.

- [ ] **Step 1: Harness** `web/tests/mounts/sim.ts` (nomes da IA do plano 6):

```ts
import { createMatch, startRound, finishRound, step, defaultRules, type Rules } from '../../src/core';
import { createAi, aiInputs } from '../../src/core/ai';
import type { RoundState, GameEvent } from '../../src/core/types';
import { activeCount } from '../../src/core/mounts/eggs';

export interface SimResult { s: RoundState; events: GameEvent[]; maxActive: number; ticks: number }

/** Rodada só de CPU (5 jogadores, nível Normal) até `over` ou maxTicks. */
export function cpuRound(stage: number, seed: number, maxTicks = 60 * 60 * 4): SimResult {
  const m = createMatch({ ...defaultRules(), cpuLevel: 1 }, stage, seed);   // createMatch(rules, stage, seed) do plano 6
  const s = startRound(m);
  const ai = createAi();
  const events: GameEvent[] = [];
  let maxActive = 0, t = 0;
  for (; t < maxTicks && s.phase !== 'over'; t++) {
    events.push(...step(s, aiInputs(s, ai, [true, true, true, true, true], 1)));
    maxActive = Math.max(maxActive, activeCount(s));
  }
  return { s, events, maxActive, ticks: t };
}
export function rulesWith(active: boolean[]): Rules { return { ...defaultRules(), active }; }
export { createMatch, finishRound, startRound, step };
```

- [ ] **Step 2: Aceite** `web/tests/mounts/acceptance.test.ts` (resume a linha 9 da §11 em cima do core real):

```ts
import { cpuRound, createMatch, finishRound, startRound, rulesWith } from './sim';
import { placePx, ride, run, cx, cy } from './helpers';
import { hashState } from '../../src/core/hash';
import { rider } from '../../src/core/mounts/types';

describe('aceite do plano 9', () => {
  it('fases 1, 2, 3, 6 e 7: ovos aparecem, teto de 2 nunca é passado, rodadas terminam', () => {
    let revealed = 0, mounted = 0;
    for (const stage of [1, 2, 3, 6, 7]) for (const seed of [1, 2, 3, 4]) {
      const r = cpuRound(stage, seed);
      expect(r.maxActive, `fase ${stage} semente ${seed}`).toBeLessThanOrEqual(2);
      expect(r.s.phase, `fase ${stage} semente ${seed}`).toBe('over');
      revealed += r.events.filter(e => (e.type === 'mount' && e.id === 'egg_revealed')).length;
      mounted += r.events.filter(e => (e.type === 'mount' && e.id === 'mount_ready')).length;
    }
    expect(revealed).toBeGreaterThan(0);
    expect(mounted).toBeGreaterThan(0);
  });
  it('fases 4, 5, 8, 9, 10: nenhum ovo', () => {
    for (const stage of [4, 5, 8, 9, 10]) {
      const r = cpuRound(stage, 1);
      expect(r.events.some(e => (e.type === 'mount' && e.id === 'egg_revealed')), `fase ${stage}`).toBe(false);
    }
  });
  it('determinismo: mesma semente → mesmo hash, com montarias', () => {
    const a = cpuRound(1, 7), b = cpuRound(1, 7);
    expect(hashState(a.s)).toBe(hashState(b.s));
  });
  it('montaria zerada na rodada seguinte', () => {
    const m = createMatch(rulesWith([true, true, false, false, false]), 1, 3);
    const s = startRound(m);
    s.phase = 'play';
    placePx(s, 0, cx(2), cy(1)); ride(s, 0, 0x3, { reserves: [2] });
    s.players[1].state = 'out';
    run(s, 200);
    finishRound(m, s);
    const s2 = startRound(m);
    expect(s2.players.every(p => rider(p) === null)).toBe(true);
    expect(s2.mountState ?? null).toBeNull();
  });
});
```

- [ ] **Step 3: IA com montarias** `web/tests/mounts/cpu.test.ts`:

```ts
import { cpuRound } from './sim';

describe('CPU e montarias', () => {
  it('CPUs pegam ovos e usam o Y das montarias ativas em algum momento (40 rodadas)', () => {
    let starts = 0, abilities = 0;
    for (const stage of [1, 2, 3, 6, 7]) for (let seed = 1; seed <= 8; seed++) {
      const r = cpuRound(stage, seed);
      starts += r.events.filter(e => (e.type === 'mount' && e.id === 'mount_start')).length;
      abilities += r.events.filter(e => (e.type === 'mount' && e.id === 'mount_ability')).length;
    }
    expect(starts).toBeGreaterThan(0);
    expect(abilities).toBeGreaterThan(0);
  });
  it('nenhuma rodada trava: todas chegam a over', () => {
    for (const stage of [1, 2, 3, 6, 7]) for (const seed of [11, 12]) expect(cpuRound(stage, seed).s.phase).toBe('over');
  });
});
```

- [ ] **Step 4: Gancho do plano 7.** Com a ROM, abrir uma partida montada e conferir que o desenhista de jogadores consulta `romPlayerHooks` (spy num teste curto em `tests/mounts/acceptance.test.ts`: registrar um gancho falso que devolve `[]` e verificar que `drawRomBattle` não desenha o jogador). Se não consultar e o plano 7 já estiver mesclado, aplicar o patch de 3 linhas no desenhista (antes do desenho padrão: `for (const h of romPlayerHooks) { const r = h(s, p, a, frame); if (r) { for (const e of r) b.sprite(e, sortY, order); drawn = true; break; } }`) e registrar no PR.
- [ ] **Step 5: Unificar** a amostragem de animação duplicada da T14/T15 em `render/rom/mounts/anim.ts` (testes da T14/T15 continuam verdes).
- [ ] **Step 6: Rodar tudo.**

```bash
cd web && npx vitest run && npx tsc --noEmit && npm run build
SB4_ROM="/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc" npx vitest run
npm run snap
```

Esperado: tudo verde; testes de ROM *skipped* sem `SB4_ROM`; screenshots das fases 1, 2, 3, 6 e 7 com montarias visíveis nos dois modos (revisão visual; não versionar).
- [ ] **Step 7: Commit** (`git add` dos arquivos que a tarefa possui):

```bash
git commit -m "test(mounts): aceite do plano 9 — partidas de CPU, teto de 2, determinismo e rodada seguinte

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Aceite do plano

Linha 9 da §11 da spec, com onde cada item é verificado:

| Critério | Teste | Comando |
|---|---|---|
| Teto de 2 | `eggs.test.ts` (teto, montaria/reserva/míssil contam), `acceptance.test.ts` (`maxActive ≤ 2` em 20 rodadas de CPU) | `cd web && npx vitest run tests/mounts` |
| Tipo por `rnd(14)` na tabela `$C1:5DA4` | `eggs.test.ts` (C/D da semente `$0012`, contagens exatas em 7000 sorteios), `core-api.test.ts` | idem |
| 43 ticks para montar | `eggs.test.ts` "monta: 43 ticks" | idem |
| Acerto 1 + 51 + 32; reserva 1 + 44 | `rider.test.ts` | idem |
| Linha com 3 bombas em x = 80/96/112 | `typeC.test.ts` | idem |
| Míssil D a 5 casas | `typeD.test.ts` (explode em k = 34 e mata) | idem |
| E deixa o alvo a 128/256 por 255 ticks | `typeE.test.ts` (128 por tick; 253–256 ticks) | idem |
| F atordoa por 192 | `typeF.test.ts` (dança 79 → 271) | idem |
| Tipo 2 atravessa soft; 3 perfura; A chuta | `type2/type3/typeA.test.ts` | idem |
| Montaria zerada na rodada seguinte | `acceptance.test.ts` | idem |
| Visual do traje | `costume.test.ts` | `SB4_ROM=... npx vitest run tests/mounts` |
| Camadas ROM e fallback | `rom-layer.test.ts`, `fallback.test.ts`, `rom-facts.test.ts` | idem |
| Dicas de IA (§9 item 9) e IA sem ler `hidden` | `ai.test.ts`, `cpu.test.ts` | `npx vitest run tests/mounts` |
| Suíte inteira, tipos e build | – | `npx vitest run && npx tsc --noEmit && npm run build` |
| Screenshots | – | `npm run snap` |

## Riscos

- **Contrato do core diferente do esperado** (chamadas de `stepOnEgg`/`onY`/`passes`/`lockAct`/`effect`): mitigado pela T1 e pelo adaptador único; qualquer mudança de interface vai para o PR com acordo. Os testes das habilidades falham cedo se o core não consultar o gancho (ex.: tipo 2 parando em x=47).
- **Modelo dos projéteis calibrado em poucos pontos** (E: 4 medidas; D: 1; F: 1): o modelo acerta todas, mas outras distâncias podem divergir. Passos de verificação no emulador nas T3, T11, T12, T13.
- **Faixa do lento (253–256)**: depende da fase da contagem de 4 ticks do core; o emulador mediu 255.
- **Medição de render (T4) depende do core instrumentado e dos savestates**: se o emulador não carregar, a T14/T15 ficam sem fatos. Plano B: fallback para o desenho das montarias com `src.px` gerado por código, e registrar a pendência.
- **Gancho `romPlayerHooks` depende do plano 7** (onda 2 global, em paralelo): o acordo precisa entrar no PR do plano 7 ou ser aplicado pela T16.
- **Contagens de sorteio "exatas"** (7000 reveals) dependem de `rnd` ser o LCG da §3.2; se o plano 6 mudar o `rnd`, o teste acusa.
- **Tipos fora do Battle** (0, 1, 4–9, B) e a senha `$7F:70BD` ficam fora; `ABILITIES` não os registra e o `mountModule` ignora tipos sem entrada.
- **Aceite de CPU** (ovos revelados, montarias e uso de Y em 40 rodadas) é determinístico, mas sensível a mudanças na IA do plano 6; se falhar sem bug, aumentar o número de sementes e registrar.
