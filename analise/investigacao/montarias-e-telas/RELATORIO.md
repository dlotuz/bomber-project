# Frente montarias-e-telas: relatório

Legenda: ✅ medido ou confirmado no emulador/código · 🟡 provável (evidência parcial) · ❌ não encontrado ou não investigado.
Endereços: `$BB:AAAA` (HiROM). O offset no arquivo é `endereço & $3FFFFF`, por exemplo `$C2:465F` → `0x02465F`.
Frames a 60 Hz. Tela: 256×224. Coordenadas de sprite vêm da cópia da OAM na WRAM (`$7F:0000–$021F`, idêntica à OAM do PPU ✅).

---

## Parte A: montarias

### A.1 Resposta curta

**Existem montarias no Battle Mode.** ✅ A análise anterior não as encontrou. Elas saem de **OVOS escondidos em blocos macios**. Ao pisar no ovo, ele choca e o jogador monta a criatura. Isso foi observado numa partida só de CPUs, sem nenhuma alteração de RAM (a CPU do P2 montou um "triceratops" verde: `extraido/montarias-e-telas/ride_first.png`, `g_pre.png`, `g_ride.png`).

| Condição | Tem ovo? |
|---|---|
| Battle Royale (FFA/Team), fases **1, 2, 3, 6, 7** | ✅ **4 ovos por rodada** na lista de itens escondidos |
| Battle Royale, fases 4, 5, 8, 9, 10 | ✅ nenhum ovo (as tabelas não têm o item `$30`) |
| Regra que liga ou desliga os ovos | ❌ nenhuma. "Racer Bomber" **não** é montaria (veja A.9) |
| Bombermania | ✅ o jogador escolhe de 0 a **9** ovos em "Choose the items!" (último ícone da grade) |
| Championship | ❌ não investigado a fundo. É 1 humano × 1 CPU em arenas próprias |
| Senha secreta (`$7F:70BD`=1) | 🟡 amplia o sorteio para 13 tipos (A.4) |

### A.2 Itens: onde o ovo entra

- Grade lógica (`$7E:2800`): um item é gravado como `$0940 + id` ou `$0980 + id`, com `id` de 6 bits. O ovo é o **id `$30–$3F`**, e o tipo de montaria é `id & $0F`. ✅ (Na análise anterior o formato "4x 09" só cobria os ids até `$3F` com o bit 6; o ovo aparece como `$097x`.)
- Tabela de efeitos de item (3 bytes por id) em **`$C1:60A0`**. Os ids `$30–$37` vão para `$C1:6417` e os ids `$38–$3F` vão para `$C1:63F9`. ✅
- Lista de itens escondidos por fase (pares palavra `casa`,`item`; `$0044` = casa sorteada; fim `$FFFF`), montada por `$C4:121D` em `$7E:8000`. ✅

| Fase | Tabela ROM | Itens | Ovos (`$30`) |
|---|---|---|---|
| 1 The Classic | `$C3:7C30` | 30 | 4 |
| 2 Fast 'n' Slow | `$C3:7E14` | 31 | 4 |
| 3 Orb-ital | `$C3:7FF8` | 35 | 4 |
| 4 Don't Push Me | `$C3:8252` | 26 | 0 |
| 5 Hard Shocks | `$C3:83E2` | 0 | 0 |
| 6 Totally Floored | `$C3:83E4` | 34 | 4 |
| 7 Hide & Blow Seek | `$C3:8640` | 35 | 4 |
| 8 Spinny Slots | `$C3:8814` | 0 | 0 |
| 9 Seesaw | `$C3:88A8` | 32 | 0 |
| 10 Sartorial | `$C3:8A68` | 33 | 0 (tem 8× item `$0F`) |

A contagem completa de cada item por fase está em `item_tables.py`. Ela interessa à frente de mecânicas: o jogo **não** sorteia 40 % por bloco, cada fase tem uma lista fixa.

### A.3 Revelação do ovo (bloco destruído)

`$C1:5CC7`: quando `(item & $30) == $30`, o código segue para `$C1:5DB2`. ✅
1. **Limite:** se `$1ED4` (ovos no chão + montarias ativas) já for **≥ 2**, o bloco não dá nada (`JML $C3:50C9`). ✅ Portanto há **no máximo 2 ovos ou montarias por rodada ao mesmo tempo**. Os 3º e 4º ovos só saem se um anterior sumir. Há também **2 "vagas" de montaria** (`$1ED5`/`$1ED6`), uma para cada conjunto de gráficos de sprite. `$1ED4` e `$1ED5`/`$1ED6` são zerados no início de cada rodada (`$C1:0317`, `$C1:0340`), então **a montaria não passa para a rodada seguinte**. ✅ (código)
2. **Tipo:** o RNG (`$C3:54B3`, com `$AE = ($AE|1)·$0383`) sorteia um valor de 0 a 13 e consulta a tabela `$C1:5DA4 = 32 33 3A 3C 3D 3E 3F 32 33 3A 3C 3D 3E 3F`. Isso dá **7 tipos equiprováveis: 2, 3, A, C, D, E, F**. ✅
   - Com `$7F:70BD ≠ 0` a tabela passa a ser `$C1:5D87` (26 entradas, tipos 1,2,3,4,5,6,9,A–F). `$7F:70BD` só é gravado em `$C2:AAEC`, que é chamado pela cadeia de senhas da tela PASSWORD (hash `$00A4`). 🟡 (qual senha gera esse hash não foi determinado)
3. Gráfico do ovo: `$D8:D271` (ids < `$38`) e `$D8:D2CC` (ids ≥ `$38`).

### A.4 Como se monta e como se desmonta

| Evento | O que acontece | Status |
|---|---|---|
| Pisar no ovo | `+$51 \|= 1`, `+$5C = tipo`, `+$32 = 1` (ids `$30–$37`) ou 2 (`$38–$3F`). Rotina do jogador `$C2:261E` (chocar e pular na montaria) por **43 frames**, depois `+$5D = vaga (1/2)` e volta ao normal `$C2:141C`. | ✅ |
| 2º ovo tipo 0–7 já montado | O ovo vira um **ovo reserva** que segue o jogador 1 casa atrás (objeto `$C2:62D7`, ponteiros em `+$52/$54/$56`, até 3). | ✅ |
| 2º ovo tipo 8–F já montado | Não é pego: fica na grade. | ✅ |
| Atingido pela chama montado | **O jogador não morre.** A rotina vai para `$C2:105E` (1 f) e depois `$C2:10D5` (**51 f**, pulo para fora). A montaria **some**. Em seguida vêm **32 f de invencibilidade** (`+$96` conta 32 → 0, o jogador pisca). Código em `$C2:4B89`. | ✅ |
| Atingido com ovo reserva | `$C2:105E` (1 f) e depois `$C2:1089` (**44 f**). O ovo reserva choca debaixo do jogador e ele já monta de novo, com 32 f de invencibilidade. | ✅ (no teste artificial o tipo virou 0 🟡) |
| Desmontar voluntariamente | Não existe. A única exceção é o tipo D, que se lança (A.5). | ✅ |
| Velocidade | A montaria **não muda a velocidade**. Usa o nível de patins do jogador (1 px/f no nível 1; 1,375 px/f no nível 4, igual sem montaria). | ✅ |
| Bombas | O jogador montado continua pondo bombas com A normalmente. | ✅ |

Na RAM do jogador (`$0300+n·$100`): `+$5C` = tipo, `+$5D` = vaga de sprite (0 = a pé), `+$51` bit 0 = pedido de montar, `+$32` = estado do ovo, `+$52/54/56` = ovos reserva.

### A.5 As 7 montarias do Battle (medidas)

Imagem: `extraido/montarias-e-telas/montarias_battle_7tipos.png` (parado, →, ↑, ←, ↓). Todas medidas na fase 1 com base na montaria dos testes (`mount_battery.py`, `mount_vs.py`, `mount_ystrip.py`).
A habilidade ativa é o **botão Y**, pela tabela `$C2:465F` (3 bytes por tipo; teste `+$88 & $4000`). As passivas estão espalhadas pelo código do jogador.

| Tipo | Aparência | Habilidade | Números |
|---|---|---|---|
| **2** | Peixe/baiacu verde com barbatanas rosa | **Passiva: atravessa blocos macios.** A verificação `$C2:1631` pula o teste de bloco para o tipo 2. | Atravessou o bloco em (64,48) e andou até x=91 em 60 f ✅. Y não faz nada ✅ |
| **3** | "Triceratops" verde com crista rosa | **Passiva: bombas perfurantes.** Na criação da bomba (`$C2:5127`) o tipo 3 grava `bomba+$22 = 2`, e a chama atravessa blocos macios. | Fogo com alcance 5: destruiu os blocos em x=64 **e** x=96. Sem a montaria só destrói o de x=64 ✅. Y não faz nada |
| **A** | Bicho redondo amarelo/laranja com "óculos" | **Passiva: chute.** O código trata `tipo == $A` como o item chute (`$C2:4339`, `$C2:33A5`, `$C2:4E9C`). | Andar contra a bomba a tirou da casa ✅. Y não faz nada |
| **C** | Sino/lâmpada dourada com saia vermelha | **Y = linha de bombas:** põe **todas as bombas disponíveis** em linha, uma por casa, na direção em que está virado, a partir da própria casa, e para em obstáculo (`$C2:47D3`, objeto `$C1:1E75`, sfx `$0C`). Não funciona com as doenças de caveira `$24`/`$25`. | Com 3 bombas: bombas em x=80, 96 e 112 ✅ |
| **D** | Casca verde de "alcachofra" com olhos | **Y = lança a própria montaria como míssil:** o jogador cai (mesmo `$C2:105E`→`$C2:10D5`, 51 f + 32 f de invencibilidade). O míssil (`$C1:3238`→`$C1:32EA`) anda a **2 px/f** e **explode** (chama em cruz) ao bater em bloco ou jogador. | Matou o P3 a 5 casas: explodiu 34 f após o Y ✅ |
| **E** | Robô-tanque azul com canhão e esteiras | **Y = tiro que deixa lento:** o projétil (`$C1:2CFF`/`$C1:2D73`) anda a **2 px/f**, alcance ≈ 3 casas, e vira nuvem (`$C1:2EB6`) no fim. O jogador atingido fica com `+$E4 = 2` e `+$E6 = 64`, o que dá **velocidade 0,5 px/f por 255 f**. Tem recarga (`+$C6`). | Acertou alvos a 1–4 casas (1, 11, 19, 27 f) ✅ |
| **F** | Bola amarela de palhaço, olhos de estrela, chapéu azul de bobo | **Y = notas musicais:** as notas saem devagar (0,5 px/f; `$C1:2F21`) e o jogador atingido **dança/fica atordoado** (rotina `$C2:0D83`→`$C2:0DDC`) por **192 f** (`$C0`), sem poder agir. | P3 a 2,5 casas atingido em 79 f e solto em 271 f ✅ |

Os outros 9 tipos (0,1,4–9,B) existem no código e renderizam no Battle quando forçados (`mount_gallery_all16.png`), mas **não saem no Battle normal** (ids fora de `$C1:5DA4`).
Outras tabelas por tipo: gráficos `$C4:70DC` (ex.: tipo 3 → `$D3:D02B`), paletas `$C4:710C`, animação `$C2:72F9`/`$C2:75A5`.
A CPU pega ovos e monta ✅ (`find_ride.py`). Se a IA usa o Y não foi verificado ❌.

### A.6 Frequência natural

Em 4×40 000 frames de partidas só de CPU (`egg_sim.py`) foram revelados poucos ovos (tipos A, C, E) e houve 1 montaria (tipo C). O máximo simultâneo de ovos + montarias foi **2**, igual ao limite do código ✅. A amostra é pequena para dar uma proporção. A distribuição vem do código (1/7 por tipo).

### A.7 Montarias no modo história (para contexto)

O inimigo atordoado (`$C1:C8AC`, 240 f) é o mecanismo do story. O código é compartilhado (`$C2:416F` monta, `$C2:4B89` perde a montaria). O Battle chega nele pelo item-ovo `$30`. Os tipos 8, B e 12h de inimigo têm despacho próprio em `$C1:C933`.

### A.8 Recomendação para o jogo web

O web não tem ovos nem montarias (`grep egg|mount` em `core/` volta vazio). Para ficar idêntico:
- item OVO (`$30`): 4 por rodada nas fases 1, 2, 3, 6 e 7, na lista fixa de itens da fase;
- teto de 2 (ovos + montarias);
- 7 tipos equiprováveis com as habilidades da tabela A.5;
- 43 f para montar; ao ser atingido montado: some a montaria, 51 f de pulo e 32 f de invencibilidade;
- ovo reserva para os tipos 0–7.

### A.9 "Racer Bomber" (não é montaria)

A regra `Racer Bomber` fica em `$7F:201C` e é copiada para `$1F04` em `$C1:8FF6`. ✅ Com ela ligada, depois da tela VICTORY (ao apertar o botão) o **campeão joga um minijogo de corrida Mode-7** ("PRESS B!", `g_racer.png`, `racer_victory.py`). O prêmio (índice de item em `$1F50`, ex.: 8 = chute) vai para o campeão (`$1F4E = $1F4C`, `$C2:7FDA`) e é aplicado **no início de cada rodada** da partida seguinte (`$C2:08A6`, tabela de efeitos `$C2:08F4`). 🟡 (não confirmei que é aplicado em todas as rodadas)

---

## Parte B: telas e usabilidade (fluxo do Battle)

### B.0 Regras gerais medidas

| Item | Original | Status |
|---|---|---|
| Fade padrão entre menus | Saída **15 f** (brilho 14→0, 1 passo/f), tela preta, entrada **15 f**. Entre dois menus de Battle a entrada começa 57–61 f depois do botão. | ✅ |
| Fade título → menus | Saída **28 f** (2 f por passo); entrada 15 f | ✅ |
| Cursor | Mão branca apontando à direita (sprite 16×16, tile `$000`/`$0C8` no título). **Parada: não pisca nem balança** (128 f observados). | ✅ |
| Repetição ao segurar | **1º passo no frame 0, repete aos 20 f e depois a cada 5 f** (VS, jogadores, regras). Na seleção de fase: 36 f e depois a cada 21 f. | ✅ |
| Volta ao topo | Listas verticais **dão a volta** (↑ no 1º vai para o último). Valores de regra e Humano/CPU/Off **não dão a volta** (param no limite, mas o som toca). | ✅ |
| Sons | SFX `1` = mover/alterar · `2` = confirmar (A ou START) · `3` = voltar (B) · `4` = pausa. Fila de SFX em `$7E:A28E` (índice `$C2`). | ✅ |
| Quem controla | Menus compartilhados (VS, modo, jogadores, regras, fase): **qualquer controle P1–P5**. | ✅ |
| Botões ignorados | X, Y, L, R e SELECT não fazem nada em nenhum menu. | ✅ |

### B.1 Logo, intro e título

| Tela | Números | Status |
|---|---|---|
| Liga → logo HUDSON (fundo branco) | Fade-in f136–150, fica até f339, fade-out f339–353. **START não pula.** | ✅ |
| Intro da história | Fade-in f551. Cenas até ~f4900. **A ou START pulam**: fade-out de ~12 f e o título aparece **já com o menu** (cursor em f1148 quando se aperta em f1000). | ✅ |
| Título | Fade-in f4993–5007. O logo "SUPER BOMBERMAN 4" se monta (~430 f; START não acelera). **Menu com cursor em f5437.** | ✅ |
| Menu do título | `PUSH START BUTTON!` pisca (≈64 f aceso / 64 f apagado). Itens NORMAL GAME / BATTLE GAME / PASSWORD, cursor x=56, y=148/164/180. ↑/↓ com volta. A ou START confirma (sfx 2, a música muda). B, ←, → não fazem nada. | ✅ |
| Ocioso no título | **1327 f** depois de o cursor aparecer, fade de 28 f e começa a demo (fase 1-2 do story). | ✅ |
| Voltar ao título | B na tela VS: fade-out 12 f e título com o menu e o cursor já em **BATTLE GAME** (y=164). Fade-in f143–169 (2 f/passo). | ✅ |

### B.2 "Select a VS mode!"

Moldura de corda verde com bolas nos cantos: bbox (7,51)–(248,186). Título azul (64–190, y 47–59). Itens vermelhos x 80–171, y 79/111/143. Cursor (56, 80/112/144).
Itens: **Battle Royale, Championship e Bombermania, todos ativos.** A/START: fade 15 f (0–14) e a próxima entra em 57–71. B volta ao título.
Battle Royale → "Select a VS mode!" com **Free-for-All / Team Battle**: moldura y 67–170, itens x 85, y 95/127, cursor (61, 96/128). B volta com o cursor lembrado.

### B.3 "Decide on the players!" (5 linhas)

Moldura (7,19)–(248,218). Título (50–204, y 15–29). Rótulos `1st…5th Player` em x 48–116, y 47/79/111/143/175. Valor à direita (x≈160). Cursor x=24, y=48+32·i.
- **←** = Human → CPU → Off. **→** = Off → CPU → Human. Para no limite. Cores: **Human verde, CPU vermelho, Off azul**. ✅ (`$7F:2011+linha`: `$21` Human, `$22` CPU, `$20` Off)
- ↑/↓ com volta. **A ou START em qualquer linha** avança para as regras. B volta. Não existe item "Continuar".

### B.4 "Configure the rules!"

Moldura (7,27)–(248,210). Título (56–198, y 23–37). 6 linhas em y 55/79/103/127/151/175 (passo de **24 px**), rótulos x=32. Cursor (16, 56+24·i).
←/→ mudam o valor **sem dar a volta** (o sfx 1 toca mesmo no limite). A ou START em qualquer linha → personagens. B → jogadores.
Valores em `$7F:2017..201C` (CPU, Matches-1, Time idx, Sudden, Bad, Racer). Padrão: Normal, 3, 3:00, Off, Off, Off.

### B.5 "Select a character!" (5 jogadores)

- Coluna de retratos à esquerda: um por jogador (x≈24–56, y 36–196), mostrando o personagem atual de cada um. Grade 3×2 na moldura (27,35)–(224,188).
- Cursor de cada jogador: cantos "[ ]" com etiqueta `1P…5P` na cor do jogador. Colunas x=80/128/176 (passo 48), linhas y=88 e 136 (passo 48). ✅
- **Todos os humanos escolhem ao mesmo tempo, cada um com o seu controle.** ←/→ dão a volta nas 3 colunas. ↑/↓ alternam as linhas. **A ou START confirma** (sfx 2) e o cursor some. Dois jogadores podem pegar o **mesmo personagem** ✅.
- **Personagens das CPUs:** quem escolhe é o **P1**, em sequência, depois de confirmar o próprio. O cursor "2P", "4P"… aparece e é controlado pelo P1. ✅ (`chars_cpu.py`)
- **B (qualquer jogador), mesmo depois de confirmar** → volta às regras (não desfaz só a escolha). ✅
- Quando o último confirma: fade-out imediato (14 f), e a seleção de fase entra em ~50–64 f.
- Team Battle: depois dos personagens vem **"Select the team members!"** (retratos na coluna x=16, y 32…160; ← e → movem o jogador entre os lados de um emblema "VS"). ✅ (tela vista, não medida em detalhe)

### B.6 "Select a stage!"

- Título "Select a stage!" em **sprite** (x 72–180, y 8). Miniatura central x **72–183** (112 px). Vizinhas a ±128 px, cortadas nas bordas. "Stage N" (y 152) e o nome (y 184) também são sprites azuis.
- ←/→ (qualquer controle): a faixa rola **8 px/f por 16 f = 128 px**, começando 1 f depois do botão. O texto troca no fim da rolagem. Dá a volta (1↔10). Segurar: 36 f e depois a cada 21 f. ↑/↓ não fazem nada.
- **A ou START:** sfx 2. O título fica até f47 e some em f48–64, quando toca a música 19. **"BATTLE START!" pisca a cada frame** de f65 a f207 e fica fixo de f208 a f277. Fade-out f278–292, **preto por ~363 f**, e o fade-in da arena começa em f**655**. ✅
- B → personagens.

### B.7 Intro da rodada

- **Não há texto "READY/GO".** Os jogadores já estão nos spawns. Fade-in de 15 f. **A rodada começa 52 f depois do início do fade-in** (38 f depois de acabar): movimento e relógio começam no mesmo frame. ✅
- Curiosidade: o contador de frames do relógio (`$1ECE`) desce 60→51 durante o fade e congela. Por isso o 1º segundo dura só **51 f** (3:00 → 2:59 em +50 f depois da liberação). ✅
- **HURRY!!** (verde, em BG) aparece a 1:01 e cruza a linha do meio (y≈128) da direita para a esquerda a **2 px/f** (~130 f), com sfx 21. Por volta de 0:57 começam os blocos de pressão. ✅
- **TIME UP!** a 0:00: cai do topo até o centro em ~16 f (música 5) e fica parado. O fade-out começa ~160 f depois de 0:00. Resultado: **DRAW GAME**. ✅

### B.8 Pausa

- **START de qualquer controle** (P1–P5, até os slots de CPU e em partidas só de CPU) pausa e despausa. Sfx 4. O relógio para. ✅
- Aparece só o texto **"PAUSE!"** (verde, contorno branco) no centro (x≈96–160, y≈110–126). **A tela não escurece.** ✅
- **Não existe opção de sair.** A, B, X, Y, L, R, SELECT e combinações (L+R+START, SELECT+START) não fazem nada. ✅

### B.9 Fim de rodada

Quando sobra 1 jogador:
- O sobrevivente entra na **pose de vitória** (rotina `$C2:0D38`). Os mortos fazem a animação de morte (sfx 16).
- A fanfarra (música 23) toca **~110 f** depois do golpe fatal. O fade-out é **208 f depois do golpe** (15 f).
- Não há texto "VENCEU" na arena. ✅

Todos mortos (empate): sem fanfarra, fade-out **82 f** depois do golpe, e depois vem **DRAW GAME**. ✅

### B.10 Placar (SCORE BOARD)

- Céu azul com nuvens. Painel verde de x=8 a 248. Faixa "SCORE BOARD" em x≈50–212, y≈20–52.
- **5 linhas** "1P…5P" (y 56/88/120/152/184, passo 32): rótulo, retrato do personagem (x 48–80) e **sempre 5 casas** de coroa (x 80,112,144,176,208), qualquer que seja o valor de Matches.
- Linha do tempo (f contados a partir de quando as bombas são postas; o golpe fatal é em f127): fade-out da arena em f335–349, **48 f de preto**, fade-in do placar em **f397–411**.
- **Coroa nova:** gira como moeda (tiles `$106→$10A→$140→$144→$148`, sendo `$148` o quadro de frente 32×32 em (80,56)). A rotação **desacelera**: 1 f por quadro, depois 2, 3, 4, … até 13 f por quadro. Dura **~104 f** (f401–505) e para de frente. Durante o giro a casa fica preta. ✅
- **Avanço automático:** fade-out em **f908** (497 f em brilho total). **Pular:** A, B ou START de qualquer controle, a partir de **~4 f depois do fim do fade-in** (f416). Fade de 15 f. ✅
- Depois do placar (fade-out f908–922): 298 f de preto e a próxima rodada entra (fade-in f1221–1235, mesma contagem).

### B.11 VITÓRIA

Quando alguém chega às N coroas (mesma contagem de f do placar: a partir das bombas postas, com o golpe em f127):
- O **placar final não pode ser pulado** (A ignorado de f420 a f940). Em **f954** a câmera **desce 2 px/f por 128 f** (256 px) até a arquibancada, sem fade. ✅
- **"VICTORY!"** (letras laranja) entra deslizando pela direita (~f1090–1100). O troféu dourado com asas fica no centro do gramado. Os personagens entram correndo pela direita (~f1120–1160). **O campeão pula (~f1180) e fica em pé sobre o troféu.** Confete a partir de ~f1160. **Espera sem limite de tempo** (testado até 2 400 f). ✅
- A, B ou START de qualquer controle, **a partir de f954** (já durante a descida): fade-out 15 f, preto ~123 f, e fade-in em **"Select a stage!" na mesma fase**, com as coroas zeradas. ✅
- Com Racer Bomber ligado, o minijogo de corrida vem antes de voltar (A.9).

### B.12 DRAW GAME

- Fundo azul-escuro. Os 5 personagens ficam de pé sobre um disco claro com holofotes. As letras "DRAW GAME" **crescem** do centro (~f360–474, música 14) e depois **trocam de cor** (vermelho, amarelo e verde, alternando).
- Nenhuma coroa. **Só A ou B pulam** (START não), a partir de ~4 f depois do fade-in (f345). Fade 15 f e a próxima rodada começa (~395 f de preto). ✅ Sem botão, espera sem limite.

---

## B.13 Diferenças do jogo web (`.worktrees/cpu-ai/web/src/screens/*.ts`, `render/draw-screens.ts`)

| # | Tela | Original | Web hoje |
|---|---|---|---|
| 1 | Geral | Fades de 15 f entre todas as telas (28 f saindo do título) | Troca instantânea (`app.go`) |
| 2 | Geral | SFX de mover/confirmar/voltar/pausa | Sem som |
| 3 | Geral | Repetição ao segurar: 20 f e depois 5 f | Só na borda (`pressedAny`), sem repetição |
| 4 | Geral | Cursor = mão branca parada à esquerda | Setinha amarela que balança 1 px a cada 8 f (`drawCursor`) |
| 5 | Geral | Fundo de quebra-cabeça bege fixo, moldura de corda verde, títulos azuis, itens vermelhos | Xadrez azul que desliza, painel azul com borda amarela |
| 6 | Logo/intro | Logo Hudson, intro (pula com A/START), logo animado, demo depois de 1327 f ocioso | Não existe |
| 7 | Título | NORMAL / BATTLE / PASSWORD; "PUSH START BUTTON!" pisca a cada 64 f | BATALHA / CONFIGURAÇÕES; rodapé fixo |
| 8 | VS | Championship e Bombermania jogáveis | "EM BREVE", desativados |
| 9 | Jogadores | ← e → sem volta (Off↔CPU↔Human), cores verde/vermelho/azul; A em qualquer linha avança; sem "Continuar"; sem mensagem de erro | Opções dão a volta; item extra "CONTINUAR"; erro de validação em 150 f; time escolhido aqui |
| 10 | Times | Tela própria "Select the team members!" depois dos personagens | Time junto de Humano/CPU na tela de jogadores |
| 11 | Regras | 6 linhas (passo 24 px), valores param no limite, sem "Continuar" | 7 linhas (+SPAWN ALEATÓRIO) + "CONTINUAR", passo 16 px |
| 12 | Personagens | Cursor por humano com cantos "[ ]" e rótulo nP; CPUs escolhidas **pelo P1** em sequência; **B (qualquer um) volta às regras**; o último A já dispara o fade | CPUs já travadas no padrão; B desfaz a escolha; avanço automático em 90 f ou START/A; cursor que pisca a cada 8 f |
| 13 | Personagens | Coluna de retratos à esquerda; grade com sprites pequenos | Painéis com nome e "ESCOLHENDO/PRONTO"; sprites 32×40 |
| 14 | Fase | Faixa de miniaturas 112 px, passo 128, rola 8 px/f × 16 f; título, "Stage N" e nome em sprite | Miniaturas estáticas (vizinhas com alpha 0,55), sem animação |
| 15 | Fase→rodada | Some título → "BATTLE START!" pisca f65–207, fixo até 278 → fade → preto 363 f → rodada (655 f no total) | "BATALHA!" por 45 f e troca instantânea |
| 16 | Intro | Sem texto; ativo 52 f depois do início do fade-in; 1º segundo de 51 f | 90 f com "PRONTOS?"/"JÁ!" |
| 17 | Partida | "HURRY!!" rolando a 1:00; "TIME UP!" caindo a 0:00 | Não existe |
| 18 | Pausa | START de qualquer controle; só o texto "PAUSE!"; sem escurecer; **sem sair** | Tela escurecida, "PAUSA", B → "SAIR DA PARTIDA?" |
| 19 | Fim de rodada | Pose de vitória e fanfarra; nenhum texto; fade 208 f (vitória) ou 82 f (empate) depois do golpe | 150 f com "X VENCEU!" / "EMPATE!" sobre a arena |
| 20 | Empate | Tela **DRAW GAME** própria, pula com A/B e vai direto para a próxima rodada | Não existe; vai para o placar |
| 21 | Placar | Céu e nuvens, 5 linhas × 5 casas fixas, retratos, coroa girando 104 f; auto 497 f; pula com A/B/START desde ~4 f | 540 f, pula com START/A só depois de 60 f, coroa pisca 40 f, texto de vencedor no rodapé, casas = Matches |
| 22 | Placar final | Não pode pular; desce a câmera 2 px/f | Igual ao placar normal, depois vitória |
| 23 | Vitória | Arquibancada, "VICTORY!" deslizando, personagens correndo, campeão sobre o troféu, confete; espera sem limite; A/B/START desde a descida | "VITÓRIA!", bombers pulando, troféu 48 px, "PRESSIONE START" depois de 60 f; fim automático em 900 f sem controle |
| 24 | Depois da vitória | Seleção de fase na mesma fase, coroas zeradas | Igual (`stageScreen`) ✅ |
| 25 | Voltar ao título | B em cadeia (fase→personagens→regras→jogadores→modo→VS→título) | Igual em cadeia, mas sem fades |
| 26 | Ovos/montarias | Existem (Parte A) | Não existem |

---

## Como reproduzir

Todos os scripts ficam em `analise/investigacao/montarias-e-telas/`. Rode-os com o Python do venv a partir dessa pasta:
`PY=/private/tmp/claude-501/-Users-dlotuz-Projetos-Claude-Bomber-Project/189281cc-52ae-4614-9c45-1f93ec4bdecb/scratchpad/venv/bin/python`.

- **Core instrumentado:** `scratchpad/rom-montarias/snes9x`. `getset.h` e `cpuexec.cpp` foram alterados para dar cobertura de PC com flags M/X e um log de leitura/escrita por faixa. Compile com `make platform=osx` em `libretro/`. `mt.py` já aponta `SNES9X_CORE` para ele.
- **Ferramentas:** `mt.py` (Emu, watch/log, cobertura, blocos do savestate), `scr.py` (OAM, brilho `$01BD`, fila de SFX, sondas), `d65.py <ender> <n>` (disassembler com flags reais e marcas de cobertura do Battle, usando `extraido/.../cov/*.cov` gerados por `cov_battle.py`).
- **Montarias:**
  - `find_ride.py` / `find_ride2.py`: ovo natural numa partida de CPU.
  - `item_tables.py`: lista de itens por fase.
  - `mount_battery.py 2,3,A,C,D,E,F`: velocidade, bloco, pilar, bomba, botões e golpe.
  - `mount_vs.py <tipo> Y <x_alvo> <n>`, `mount_e3.py` (lentidão), `mount_c.py` (linha de bombas), `bombtype.py` (bomba perfurante do tipo 3), `mount_kick.py`, `mount_follow*.py` (ovo reserva).
  - `mount_gallery7.py`: imagem das 7 montarias.
  - `mania_eggs.py`: ovos no Bombermania.
  - `racer_victory.py`: Racer Bomber.
- **Telas.** Os estados `tt_*.bin` são gerados em cadeia em `extraido/`:
  1. `boot_timeline.py` (gera `st_boot60s.bin`)
  2. `mk_title.py` (gera `tt_title`)
  3. `flow_step.py tt_title.bin tt_vsmode.bin "DOWN:2,A:2" 240 title2vs 20`
  4. `flow_step.py tt_vsmode.bin tt_brmode.bin "A:2" 90 vs2br 15`
  5. `… tt_players.bin`, `tt_rules.bin`, `tt_chars.bin`
  6. `flow_step.py tt_chars.bin tt_stage.bin "A:2:0,A:2:1,A:2:2,A:2:3,A:2:4" 100 ch2st 10`
  7. `flow_step.py tt_stage.bin tt_battle.bin "A:2" 640 st2bt 20`
  8. `flow_step.py tt_battle.bin tt_battle2.bin "B:0" 700 bt2 25`

  Medidas por tela:
  - `probe_screen.py <estado> <tag> [botões] [jogador]`: botões, sfx e fades.
  - `hold_test.py <estado> DOWN <tile>`: repetição ao segurar.
  - `chars_test.py`, `chars_cpu.py`: personagens.
  - `stage_scroll.py`: rolagem da fase.
  - `round_start.py`: intro da rodada.
  - `roundend.py`, `crown_anim.py`: fim de rodada e coroa.
  - `victory.py`, `victory_pan.py`, `final_sb_skip.py`: vitória.
  - `draw.py`, `draw_skip.py`: empate.
  - `timeup.py`, `hurry3.py`: HURRY e TIME UP.
  - `skip_intro.py`: intro e título.
  - `layout.py`: caixas de moldura e texto.
- **Quadros:** `extraido/montarias-e-telas/g_*.png`. Os principais são:
  - `g_title2vs`, `g_ch_mixed`, `g_stR`, `g_st2bt`, `g_bt2`: menus e início da partida
  - `g_roundend`, `crown_anim`, `g_victory`, `g_vpan`: fim de rodada, placar e vitória
  - `g_draw`, `g3_HURRY`, `g3_TIMEUP`, `pause_p1`, `g_boot*`: empate, avisos, pausa e abertura
  - `montarias_battle_7tipos`, `mount_gallery_all16`, `mount_D_Y_soft`, `vs_F_Y_72`, `mount_C_Y`: montarias
  - `g_modes2/3`, `mania_items_3x`, `team_3`: outros modos e tela de times

## Pontos em aberto

- Qual senha liga `$7F:70BD` (13 tipos de ovo). 🟡
- Bombermania: tipos de ovo observados 2, 6, 9, A e E, que não são a tabela de 7 do Battle. A tabela exata não foi localizada. 🟡
- Championship: não verifiquei se há ovos. ❌
- Se a IA usa as habilidades Y das montarias. ❌
- Alcance e tamanho exatos da explosão do míssil do tipo D. 🟡
- Posição em pixel da miniatura na vertical (y≈40–151). 🟡
- Fade de 2 f/passo na volta ao título, contra 1 f/passo nos menus. Medido, mas a regra geral não foi confirmada no código. 🟡
