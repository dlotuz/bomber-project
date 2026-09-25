# Crown Blast (web): design

**Data:** 2026-09-25
**Origem:** `analise/ANALISE_COMPLETA.md` (análise do Super Bomberman 4 Battle Mode + scripts do torneio Crown Cup)
**Nome de trabalho:** *Crown Blast* (pode mudar). Não usamos o nome, a marca, os sprites, as músicas ou os sons da Hudson/Konami. **Estrutura, regras, layouts e timings são fiéis ao original; a arte e o áudio são originais.**

## 1. Objetivo

Um jogo web de batalha em arena para **até 5 jogadores locais** (mesma tela, gamepads e teclado), com CPUs, que reproduz o Battle Mode do SB4 medido no emulador. O jogo reporta o resultado de cada partida ao site **Crown Cup**. O motor é determinístico para permitir **online numa versão futura**, que fica fora da v1.

### Escopo da v1
- **Entra:** título; menus VS completos; Battle Royale (Free-for-All e Team Battle); jogadores Human/CPU; todas as 6 regras; 6 personagens; 10 arenas; itens; rodadas; coroas; Score Board; VICTORY; spawns aleatórios; webhook; áudio chiptune original.
- **Fica fora:** modo história, password, modos Championship e Bombermania (aparecem no menu como "Em breve"), online e menu de debug.

## 2. Stack e arquitetura

- **TypeScript + Vite**, sem framework de UI e sem engine de terceiros. O resultado é um site estático.
- **Vitest** para testes do núcleo.
- Pasta do app: `web/` na raiz do projeto.

```
web/src/
  core/     simulação pura: sem DOM, sem Date/Math.random; recebe inputs[5] por tick e devolve o estado
  input/    teclado + Gamepad API → 5 controles virtuais estilo SNES
  render/   Canvas 256×224, sprites e tiles pixel art gerados por código, escala inteira
  audio/    WebAudio: SFX e músicas chiptune originais
  screens/  máquina de telas (título → menus → jogo → placar → vitória)
  net/      webhook Crown Cup
  main.ts   loop: acumulador de tempo → N ticks de 1/60 s → render
```

**Invariantes do núcleo**
1. Tick fixo de **60 Hz**. Todos os tempos são medidos em frames.
2. Um RNG com seed, que faz parte do estado, é a única fonte de aleatoriedade.
3. `step(state, inputs) → state` é determinístico: mesma seed + mesmos inputs = mesmo estado bit a bit. Um teste garante isso por hash do estado.
4. O núcleo não importa nada de `render/`, `audio/`, `input/` nem `net/`. Ele emite **eventos** (explosão, morte, item pego, fim de rodada) que o render e o áudio consomem.

## 3. Coordenadas e arena

- A tela lógica tem **256×224**. HUD no topo e campo de **15×13 tiles de 16 px** (as paredes externas fazem parte do campo).
- Área jogável de **13×11**. A posição do jogador fica no **centro da casa**: `X = 16·col` (col 2–14) e `Y = 16·(linha+2)` (linha 1–11). O layout usa exatamente essas coordenadas.
- **Movimento sub-pixel** em ponto fixo 1/8 px (velocidade nível 1 = 8/8 px/frame, +1/8 por nível).
- **Correção de canto** (estilo clássico): ao andar contra uma parede com a porta a até 6 px de distância, o jogador desliza para se alinhar.
- **Tipos de célula:** `EMPTY`, `HARD` (pilar ou parede), `SOFT` (destrutível), `BOMB`, `FLAME`, `ITEM` e as especiais da fase.
- **Layouts:** as 10 grades copiadas de `analise/layouts_arenas.txt` (`#` HARD, `x` SOFT, `.` EMPTY). As células `?` viram os elementos especiais de cada fase (§8).
- **Soft blocks fixos por fase**, como no original.

## 4. Jogador

| Atributo | Inicial | Máximo | Observação |
|---|---|---|---|
| Velocidade (nível) | 1 | 5 | 60 px/s + 7,5 px/s por nível |
| Bombas | 1 | 8 | simultâneas |
| Fogo (nível) | 0 | 8 | **alcance = nível + 2** |
| Chute, Soco, Luva, P | não | – | flags |

- **Spawns** P1..P5: `(32,48) (224,208) (224,48) (32,208) (128,128)`.
- **Spawns aleatórios** (opção, padrão **ligado**): embaralha os 5 pontos a cada rodada (Fisher-Yates com o RNG do núcleo). Isso substitui `bomberman_random_spawn.lua`.
- **Personagens:** 6, só cosméticos, com os mesmos stats (como no original). Nomes e visuais originais: **Blanco** (branco), **Gear** (ciborgue de monóculo), **Tigra** (felino laranja), **Aero** (cavaleiro alado), **Verdi** (verde blindado) e **Rubi** (vermelho/roxo).
- **Morte:** 78 frames de animação antes de o jogador contar como fora (valor medido).
- **Fase 5** ("Escola de Choques"): todos começam com 5 bombas, fogo 4, Chute, Soco, Luva e P.

## 5. Bombas e explosões

- **Pavio de 128 frames. Chama de 33 frames.**
- A explosão é em cruz, com alcance de fogo+2. Ela para em HARD, **destrói o primeiro SOFT** e para nele (exceto com P, §6), destrói itens no caminho e **detona outras bombas em cadeia** (a reação é imediata, no mesmo tick).
- **Controles:** **A** = colocar bomba; segurar **A sobre a bomba** com Luva = levantar e soltar para arremessar. **B** = reservado (não há item de bomba remota no Battle; fica para o futuro). **Y** = socar a bomba à frente (com Soco). **START** = pausa.
- **Chute:** andar contra uma bomba faz ela deslizar a 2 px/frame até bater em obstáculo, jogador ou item.
- **Soco e arremesso:** a bomba voa 3 casas por cima de obstáculos. Se cair em célula ocupada, quica mais 1 casa. Se sair do campo, reaparece do lado oposto.
- É possível atravessar a própria bomba recém-colocada até sair da casa dela.

## 6. Itens

Surgem sob soft blocks destruídos: **chance de 40%** de o bloco conter item. O item é sorteado por pesos derivados da frequência observada.

| Item | Peso | Efeito |
|---|---|---|
| Bomba+ | 28 | +1 bomba |
| Fogo+ | 20 | +1 nível de fogo |
| Patins | 12 | +1 velocidade |
| Chute | 10 | habilidade |
| Caveira | 9 | doença (abaixo) |
| Soco | 7 | habilidade |
| Luva | 7 | habilidade |
| P (Perfurante) | 7 | chama atravessa soft blocks (destrói todos no alcance) *(interpretação nossa)* |

- **Caveira**, com 4 doenças sorteadas *(interpretação nossa; o original tem 4 tipos)*: **Lento** (velocidade mínima), **Rápido demais** (velocidade 8), **Diarreia** (solta bombas sem parar) e **Fogo fraco** (alcance 1). Duração de 600 frames. **Passa para outro jogador por contato.**
- Um item atingido por chama é destruído.

## 7. Rodada e partida

- **Estados da rodada:** `INTRO` (fade, ≈90 frames) → `PLAYING` → `ENDING` (espera terminarem as animações de morte) → `RESULT`.
- **Relógio** conforme a regra Time (1:00, 2:00, 3:00, 5:00, ∞).
- **Pressão:** com **1:00 restante**, blocos HARD caem em espiral de fora para dentro, 1 bloco a cada 6 frames, preenchendo os **2 anéis externos** e então param (o original deixa o miolo livre). Quem estiver na casa morre; bombas e itens na casa somem. Com Tempo ∞ não há pressão.
- **Fim da rodada:** com ≤1 vivo depois das animações, 1 vivo ganha uma coroa e 0 vivos é **DRAW GAME**. Com o tempo esgotado e mais de 1 vivo, também é DRAW GAME (se Sudden Death estiver Off).
- **Team Battle:** 2 times (Vermelho/Branco), escolhidos na tela de jogadores. Uma rodada termina quando só resta um time. Todos os membros do time vencedor ganham uma coroa. A partida é decidida pelo time.
- **Partida:** acaba quando alguém (ou um time) chega a **Matches** coroas (1–5). Sequência: Score Board (≈9 s, com animação da coroa nova) → **VICTORY** (troféu, espera botão) → volta para "Selecionar fase" com as coroas zeradas.

### Opções de regra (valores e padrões idênticos ao original)
| Regra | Valores (**padrão**) | Comportamento na v1 |
|---|---|---|
| Nível CPU | Fraco · **Normal** · Forte | parâmetros da IA (§9) |
| Coroas (Matches) | 1 · 2 · **3** · 4 · 5 | meta de vitórias |
| Tempo | 1:00 · 2:00 · **3:00** · 5:00 · ∞ | relógio; com ∞ não há pressão |
| Morte Súbita | **Off** · On | On: no 0:00 com mais de 1 vivo, a pressão continua pelos anéis internos a 1 bloco/frame até restar ≤1 *(interpretação nossa)* |
| Bomber Vingador (Bad Bomber) | **Off** · On | On: quem morreu anda pela borda externa e arremessa bombas para dentro (1 bomba por vez) |
| Corrida (Racer Bomber) | **Off** · On | On: todos começam com velocidade 4 *(interpretação nossa)* |

## 8. Arenas (nomes e mecânicas originais do nosso jogo)

| # | Nome | Base | Mecânica especial |
|---|---|---|---|
| 1 | O Clássico | layout 1 | nenhuma |
| 2 | Rápido e Devagar | layout 2 | esteiras: a linha 3 da área jogável empurra para a direita e a linha 9 para a esquerda, a 0,5 px/frame |
| 3 | Bombardeio Orbital | layout 3 | 2 esferas partem das casas `?` e percorrem um circuito retangular ao redor do centro (1 casa a cada 32 frames); bloqueiam a passagem e explodem bombas que tocam |
| 4 | Não Me Empurre | layout 4 | blocos HARD extras (já no layout) |
| 5 | Escola de Choques | layout 5 | sem soft blocks; todos começam fortes (§4) |
| 6 | Piso Traiçoeiro | layout 6 | alçapões: as 6 casas vazias do centro (linhas 5 e 7, colunas 6–8, contando a partir de 1) abrem e fecham a cada 240 frames; quem estiver em cima quando abrem cai e morre |
| 7 | Esconde-Explode | layout 7 | 4 moitas (`?`): quem está nelas fica invisível |
| 8 | Caça-Níquel | layout 8 | 3 casas `?`: ao pisar, sorteia um item a cada 10 s |
| 9 | Gangorra | layout 9 | 4 gangorras (`?`): pisar lança o jogador para a gangorra espelhada |
| 10 | Alfaiataria | layout 10 | nenhuma (visual temático) |

A seleção de fase replica a tela original: miniatura central, vizinhas nas laterais e "Fase N / Nome".

## 9. IA das CPUs

Uma **máquina de estados por tick** com mapa de perigo (casas que serão atingidas por chamas e em quantos frames):
- **Fugir:** se a casa atual está em perigo, faz um BFS até a casa segura mais próxima.
- **Coletar:** vai para itens alcançáveis.
- **Atacar:** coloca bomba se houver rota de fuga e se um soft block ou inimigo estiver no alcance.
- **Vagar:** caso contrário, anda.

Os níveis mudam o tempo de reação, a margem de segurança e a agressividade: **Fraco** reage a cada 20 frames e erra 20% das fugas; **Normal** a cada 8 frames e erra 5%; **Forte** reage a cada 2 frames, não erra e usa Chute, Soco e Luva. A IA usa só o RNG do núcleo, o que mantém o determinismo.

## 10. Telas e fluxo (estrutura idêntica ao original, textos em PT-BR)

```
Intro curta → Logo "Crown Blast" → Título [JOGO NORMAL (em breve) | JOGO DE BATALHA | CONFIG]
 → "Escolha o modo VS" [Battle Royale | Championship (em breve) | Bombermania (em breve)]
 → [Todos contra Todos | Batalha em Times]
 → "Defina os jogadores" (1º..5º: Humano/CPU [+ time])  ← LEFT alterna, DOWN move, A confirma, B volta
 → "Configure as regras" (6 regras + Spawns aleatórios)
 → "Escolha um personagem" (grade 3×2, cada jogador com seu cursor)
 → "Escolha uma fase" → "BATALHA!" → rodadas → Placar (coroas) → VITÓRIA → volta para a fase
```

- **HUD:** relógio + ícone de cada jogador com a contagem de coroas (como no original).
- **CONFIG:** mapeamento de controles, volume, URL do webhook e nomes dos jogadores (usados no placar e no webhook).

## 11. Entrada

- **5 controles virtuais**, com os botões D-pad, A, B, Y e START.
- **Gamepads** (Gamepad API, layout padrão): os gamepads 1–5 viram os jogadores 1–5. Mapeamento SNES → padrão: A = botão direito (1), B = inferior (0), Y = esquerdo (2), START = 9.
- **Teclado** padrão:
  - P1: WASD + J (A), K (B), L (Y), Enter (START)
  - P2: setas + Numpad1 (A), Numpad2 (B), Numpad3 (Y), NumpadEnter (START)
- Tudo pode ser remapeado em CONFIG. Os mapeamentos ficam salvos em `localStorage`.

## 12. Webhook Crown Cup

- É enviado em **toda partida finalizada** (quando alguém atinge Matches coroas), não só em "5". Isso corrige os bugs 1 e 2 do script.
- `POST <URL configurável>`, padrão `https://crown-cup-champions.lovable.app/api/public/match-result`, `Content-Type: application/json`.
- O corpo mantém a compatibilidade (as chaves `p1..p5` = coroas de cada slot) e acrescenta campos extras:
```json
{"p1":5,"p2":2,"p3":0,"p4":1,"p5":3,
 "matchId":"<uuid>","finishedAt":"<ISO-8601>","mode":"ffa|team",
 "arena":1,"matchesTarget":5,"winnerSlot":1,
 "players":[{"slot":1,"name":"...","character":"blanco","human":true,"crowns":5,"team":null}]}
```
- **Retry:** 3 tentativas com backoff (1 s, 3 s, 9 s). Se todas falharem, o envio vai para uma fila em `localStorage` e é reenviado na próxima partida ou ao abrir o jogo. O jogo nunca trava por causa da rede.
- **Header opcional** `X-Crown-Secret` (configurável). Aviso: num app de navegador esse segredo fica visível. A proteção real depende do servidor.
- **CORS:** se o endpoint do Lovable não aceitar requisições do navegador, será preciso liberar CORS no site ou usar um proxy mínimo. Isso fica documentado; não há proxy na v1.

## 13. Arte e áudio

- **Pixel art original**, desenhada por código (arrays de pixels + paletas) em `render/sprites/`: 6 personagens (andar em 4 direções, morte, vitória), bomba, chamas, blocos por tema das 10 arenas, 8 itens, HUD, fontes bitmap, títulos e troféu.
- **Áudio** WebAudio sintetizado: SFX (colocar bomba, explosão, pegar item, morte, coroa, menu) e 3 músicas originais (menu, batalha, vitória) tocadas por um sequenciador próprio.

## 14. Testes

- **Vitest no `core/`**: pavio de 128 frames; chama de 33 frames; alcance de fogo+2; bloqueio por HARD e SOFT; reação em cadeia; P perfurante; efeito de cada item; stats iniciais (e os da fase 5); velocidade por nível; correção de canto; coroas, draw, meta de Matches e reset; spawns aleatórios como permutação dos 5 pontos; Team Battle; pressão a partir de 1:00.
- **Determinismo:** uma partida de 5 CPUs com seed fixa, rodada 2 vezes por 20.000 ticks, precisa ter o mesmo hash de estado.
- **`net/`**: formato do payload, retry e fila offline (com `fetch` mockado).
- **Verificação visual:** rodar o build no navegador e tirar screenshots de cada tela e arena.

## 15. Fora de escopo e futuro

Online (lockstep/rollback sobre o `core/` determinístico), modo história, Championship, Bombermania e integração de login com o Crown Cup.
