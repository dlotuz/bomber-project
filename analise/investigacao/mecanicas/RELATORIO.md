# Frente "mecânicas": relatório

Super Bomberman 4 (USA, fan-translation), Battle Mode. Medições feitas num core snes9x próprio, com watchpoints,
breakpoints e trace, mais a leitura das rotinas na ROM.

Legenda: ✅ medido ou confirmado (emulador e/ou código) · 🟡 provável (lido no código, sem medição completa) · ❌ não encontrado.
Endereços no formato `$BB:AAAA` (HiROM: offset no arquivo = `(BB-$C0)·$10000 + AAAA`, por exemplo `$C3:2A50` → `0x032A50`).

---

## 0. Resumo: o que muda em relação ao que se sabia

1. ✅ **O layout de soft blocks não é fixo.** Toda rodada o jogo **preenche de soft blocks todas as casas que não são
   pilar**, abre um quadrado 3×3 em volta de cada spawn ocupado e **remove N blocos aleatórios** (N depende da fase:
   14, 14, 12, 4, 8, 14, 4, 0, 4, 14). O `layouts_arenas.txt` é só o resultado da 1ª rodada depois de ligar o console
   (a semente do RNG liga em `$12`). Veja §6.1.
2. ✅ **Não existe "chance de 40%" para os itens.** Cada fase tem uma **lista fixa de itens escondidos** (26 a 35 itens).
   As posições são sorteadas entre os soft blocks. Veja §6.2 e §6.3.
3. ✅ **"P" não é bomba perfurante.** O "P" (`$12`, `+D8`) dá o **soco em jogador**: com **Y**, o jogador avança 1 casa e
   empurra quem estiver na frente 3 casas. A bomba perfurante existe (item `$02`), mas **não aparece nas listas padrão do Battle**.
4. ✅ Há **cápsulas de montaria** (itens `$3x`: 4 por fase nas fases 1, 2, 3, 6 e 7) e **8 "trajes"** na fase 10 (item `$0F`).
   O traje vale 1 vida (🟡, pelo código). O que a montaria faz no acerto não foi verificado.
5. ✅ A **caveira tem 11 doenças** (`$21`–`$2B`) e **nenhuma expira sozinha**. Ela é curada ao pegar qualquer item, e aí
   a doença é arremessada como uma nova caveira aleatória. Também passa por contato: **quem passa fica curado**.
6. ✅ O movimento usa uma **máquina de "assistência de canto" por tabelas**. Reconstruí o algoritmo, que bate com o jogo
   em **20.034 ticks testados, com 0 divergências** (`movesim.py`).
7. ✅ Tempos em **ticks lógicos**: pavio de 127 ticks, chama de 25, morte de 65, reação em cadeia com +2 ticks e pressão
   de 1 bloco a cada 14 ticks. Os "≈33 frames de chama" e os "78 frames de morte" medidos antes incluíam **frames de lag** do SNES.
8. ✅ **Morte Súbita On** faz a pressão continuar depois dos 2 anéis até **encher a arena inteira**. **Tempo esgotado é sempre DRAW.**
9. ✅ **Bad Bomber:** anda pela moldura externa a 1 px/tick e arremessa 1 bomba por vez (fogo 1 = alcance 3), com mira
   automática de 2 a 5 casas. **Não volta para a partida.** Sai de cena quando a pressão começa (🟡, pelo código).
10. ✅/🟡 **"Racer Bomber"** não dá velocidade. Ao fim de cada **partida**, o campeão gira uma roleta. O prêmio sorteado
    é aplicado a esse jogador no início de cada rodada da partida seguinte.

---

## 1. Ferramentas e método

- **Core próprio com depuração:** `scratchpad/rom-mecanicas/snes9x/` (cópia do snes9x com `dbg.cpp`, hooks em `getset.h`
  e `cpuexec.cpp`). Exporta `dbg_watch_w/dbg_watch_r` (watchpoints na WRAM), `dbg_bp` (breakpoint de execução),
  `dbg_set_trace` (trace completo) e `dbg_records` (log com PC, A, X, Y, D, DB, P e frame). Para recompilar:
  `make -C libretro platform=osx`.
- **`mec.py`:** a classe `Dbg` (herda de `Emu`) e a classe **`TDbg`**, que conta **ticks lógicos** (execuções do despachante
  de objetos `$C0:F3DD` com X=`$0300`). Também traz `tele()` (teleporte que mantém a grade de ocupação `$7F:1000`
  coerente), `bomb_at()`, `grid()` e `start_round()`, que parte da seleção de fase com as regras escolhidas.
- **Modelos validados:** `movesim.py` (movimento), `itemsim.py` (RNG, remoção de blocos, sorteio de itens).
- **Tabelas extraídas:** `analise/extraido/mecanicas/tabelas_mecanica.json` e `layouts_base.json` (fora do git).
- **Para reproduzir:** `cd analise/investigacao/mecanicas && ./py tNN.py` (o `py` usa o venv do scratchpad e o core próprio).

**Ticks × frames (importante).** O jogo roda a lógica 1 vez por frame, mas **perde frames** quando a CPU não dá conta.
Por exemplo, logo após uma explosão, 1 em cada 4 frames é "lag". Todas as durações deste relatório estão em **ticks
lógicos**. O jogo web deve contar ticks a 60 Hz e não precisa imitar o lag. ✅ (`t27.py`, `t29.py`)

---

## 2. Coordenadas e unidades

| Item | Valor | Status |
|---|---|---|
| Posição do jogador | 24 bits: `+$11` = fração (1/256 px), `+$12/+$13` = pixel X. O mesmo para Y (`+$15`, `+$16/+$17`) | ✅ |
| Centro de casa | **X = 16·col − 1**, **Y = 16·(lin+2) − 1** (col 2..14, lin 1..11 no grid `$2800`). Os spawns (32,48) ficam 1 px fora do centro e se alinham no 1º movimento | ✅ |
| Casa de um ponto | `off = ((Y−$18) & $F0)·4 + ((X+8) & $1F0)/8`. Equivale a col = ⌊(X+8)/16⌋ e lin = ⌊(Y+8)/16⌋ − 2 (`$C2:3221`) | ✅ |
| Grid lógico | `$7E:2800`, 16 colunas × 2 bytes, 64 bytes por linha. Códigos (word): `EC40` pilar/parede, `CC80` soft, `C900` bomba, `EDC0` bloco (ou item) queimando, `EE80` bloco de pressão, `1000` chama, `09xx` item (`xx` = `$40`+id; `$80`+id = caveira), `0001` marca de bloco de pressão caindo | ✅ |
| Ocupação de jogadores | `$7F:1000` (mesmo layout). Bit `$90` do objeto: P1=`$10`, P2=`$20`, P3=`$40`, P4=`$80`, P5=`$100` | ✅ |
| Objeto do jogador | `$0300 + n·$100`. `+$40` velocidade, `+$41` bombas **disponíveis**, `+$42` **capacidade**, `+$43` tipo de bomba, `+$44` fogo, `+$45` traje (bit 7), `+$47` coração, `+$48` soco, `+$49` luva, `+$4A` chute, `+$4B` atravessa soft, `+$4C` atravessa bomba, `+$4D` doença, `+$5C/$5D` montaria, `+$60` direção de movimento, `+$62` direção em que olha (0/2/4/6), `+$80` casa atual, `+$96` invencibilidade (ticks), `+$D8` "P", `+$E3` fogo total | ✅ |
| Objeto da bomba | slots de `$30` bytes a partir de `$0800`. `+$1A` pavio, `+$1C` estado (2 = chutada), `+$1D` direção, `+$22` tipo, `+$23` fogo, `+$2A` casa | ✅ |

---

## 3. Jogador

### 3.1 Velocidade ✅
Tabela `$C3:2A50` (64 bytes por nível; `dx,dy` por direção, em 1/256 px por tick):

| Índice | 1/256 px/tick | px/tick | Uso |
|---|---|---|---|
| 0 | 224 | 0,875 | não usado no Battle (nível 0) |
| **1** | **256** | **1,000** | **inicial** |
| 2 | 288 | 1,125 | Patins ×1 |
| 3 | 320 | 1,250 | |
| 4 | 352 | 1,375 | |
| **5** | **384** | **1,500** | **máximo** (Patins só sobe se `nível+1 < 6`, `$C1:6304`) |
| 6 | 512 | 2,000 | doença `$21` (rápido) e montaria tipo `$0B` |
| 7 | 128 | 0,500 | doença `$22` (lento) e piso lento da fase 2 |

Diagonais usam a mesma velocidade nos dois eixos (ex.: nível 1 → (256, 256)), sem normalizar. A velocidade é
aplicada à posição de 24 bits. Quando o jogador para, a fração é zerada (`$C2:3040`).

### 3.2 Movimento, tolerância e correção de canto ✅ (modelo validado)
Rotinas: `$C2:3F44` (direção), `$C2:2F3A` (velocidade), `$C2:3287`, `$C2:3339` e `$C2:3566` (colisão). A cópia fiel está
em **`movesim.py`**. Em 20.034 ticks aleatórios (fases 1 e 5, níveis 0–7, entradas com diagonais, bombas espalhadas)
**não houve nenhuma divergência** (`./py t33.py st_arena01 5 60 6` e `./py t33.py st_arena05 6 60 12`). A fase 4 tem
pisos especiais (`$9C` bit `$100`) que desviam o movimento, e isso é assunto da frente de arenas.

Algoritmo por tick:
1. `din = DPAD[nibble]` (`$C3:2C50`: 1=R→2, 2=L→6, 4=D→4, 8=U→0, diagonais 1/3/5/7, nada = 8). Direções: 0 cima, 1 cima-direita, … 7 cima-esquerda.
2. **Código de subposição:** `code = $C3:2520[((Y−8)&15)·16 + ((X−8)&15)] & 15`. O centro (7,7) dá `C`.
3. **Tabela de direção** pela paridade da casa (`$C2:4F25`: `(lin&1)·2 + (col&1)` → 1, 3, 0, 2):
   cruzamento → `$C3:2C60`; corredor vertical (colunas pares nas linhas de pilar) → `$C3:2D40`; corredor horizontal → `$C3:2CD0`.
   `v = tabela[code·8 + din]` e a nova direção é `v & 15`. Se `v ≥ $10`, testa o vizinho `1 << (v>>4)` na máscara `$82`.
   Se estiver bloqueado, para, ou num corredor usa `tabela[$68 + din]`.
4. Velocidade = `SPEED[nível][dir]`. Calcula a posição tentativa.
5. Na posição tentativa:
   - **Entrar numa casa com bomba** zera a velocidade (sem chute). ✅
   - `$82` (8 vizinhos bloqueados: N NE E SE S SW W NW → bits 0..7; parede, soft, bomba, bloco queimando) e `$86`
     (só bombas) são avaliados na casa tentativa.
   - Parede acima e subY<7: empurra para baixo `7−subY`. Parede abaixo e subY>7: empurra para cima. O mesmo vale para
     leste e oeste. Tabela `$C3:2A20`: `7,6,…,0,0…0,−1…−8`.
   - Bomba vizinha: em vez do empurrão, **zera a componente da velocidade** na direção da bomba se o jogador já passou do centro.
   - Se não houve empurrão e a casa é cruzamento, aplica o **empurrão diamante** `$C3:2620[subY·16+subX]` (zero num
     losango em volta do centro; nas bordas, empurra até o eixo).
   - velocidade += empurrão·256. A posição final = posição antiga + velocidade.

Efeito prático (nível 1, andando para BAIXO; `./py t100.py`):

| Situação | Comportamento |
|---|---|
| Abertura à frente, desalinhado \|dx\| ≤ 7 | O movimento vira **diagonal** (1 px/tick nos dois eixos) até alinhar. Entra na casa de baixo no **mesmo tick** que entraria alinhado (tick 9 para cruzar o meio) |
| \|dx\| = 8 ou 9 | Idem, com 1–2 ticks de atraso |
| Pilar à frente, \|dx\| ≤ 3 | **Não anda** (zona morta) |
| Pilar à frente, \|dx\| ≥ 4 | **Desliza de lado** a 1 px/tick até a abertura mais próxima e entra em diagonal |
| Parede ou bloco à frente, alinhado | Para exatamente no centro da casa (o empurrão cancela a velocidade) |

### 3.3 Hitboxes ✅
| Colisão | Regra | Medição |
|---|---|---|
| Chama × jogador | Pela **casa do ponto central**: morre se `casa(X,Y)` tem chama. Cruzar a borda da casa (⌊(X+8)/16⌋) basta. Não há margem extra | `t25.py`: col 10 = X 152..167 morre, X 168 não. lin 1 = Y 44..55 morre, 56 não |
| Bomba × jogador | Não entra na casa da bomba. Vindo de uma casa vizinha, **para no centro da própria casa** (velocidade zerada ao passar do centro) | `t94.py` |
| Bomba recém-colocada | A bomba fica **na casa do jogador**, que não é "vizinha": o jogador anda livre dentro dela e sai por qualquer lado. **Depois de sair, não volta.** Quem estava na mesma casa na hora também pode sair | `t94.py` |
| Jogador × jogador | **Não colidem** (passam um pelo outro) | `t65.py` |
| Contato (doença) | \|dx\| ≤ 8 e \|dy\| ≤ 8 px (`$C2:5871`) | `t65.py` |

### 3.4 Invencibilidade ✅
- **No início da rodada: 0 ticks** (`+$96` = 0; ninguém nasce invencível).
- `+$96` é um contador de ticks decrementado 1 por tick. A chama não mata enquanto ele for maior que 0.
  - **Coração** (item `$09`, `+$47`): absorve 1 acerto e dá **96 ticks** (`$60`). ✅ `t85.py`
  - **Traje** (`+$45` bit 7): é perdido no acerto e dá **96 ticks**. 🟡 (código `$C2:1129`; montaria de cápsula não verificada)
  - **Colete** (item `$08`): `+$96 = $1FF` = **511 ticks**. ✅ `t85.py`
- **Bloco de pressão mata sempre**, mesmo com coração, montaria ou invencibilidade (`$C2:1111`: casa `EE80` → morte direta). 🟡

### 3.5 Tempo de morte ✅ (`t29.py`)
| Tick (após o acerto) | Estado (`+$00`) |
|---|---|
| 0 | acerto (`$C2:10F9`) |
| 1–21 | animação de morte (`$C2:1224`) |
| 22–64 | pós-morte (`$C2:1258`, 44 ticks): **solta os itens** (§6.4) |
| **65** | fora de jogo (`$C2:13DF`); o contador `$1EA0` cai |

Como o SNES tem lag nesse trecho, isso dá ≈86 frames de vídeo. O valor antigo de 78 frames estava no meio disso.

---

## 4. Bombas e explosão ✅

| Constante | Valor | Onde e como |
|---|---|---|
| Pavio normal | `+$1A` = **126** (`$7E`), decrementado por tick. **Explode 127 ticks após o tick em que foi colocada** | `$C1:1FC5`; `t24.py` |
| Pavio doença `$27` / `$28` | 62 / 253 (`$C1:56E8`) | código |
| Chama | **25 ticks** em todas as casas. O braço inteiro aparece **no mesmo tick** | `t23.py`, `t99.py` |
| Reação em cadeia | a bomba atingida explode **2 ticks depois** | `t99.py` |
| Soft block atingido | vira `EDC0` e queima **24 ticks**; no 24º tick revela o item (se houver) | `t7.py` |
| Alcance | fogo 0..8 → **2..10**; fogo 9 → 10; **fogo 10 → 1** (usado pela doença `$25`) | `t64.py` |
| Fogo máximo por item | **7** (alcance 9): o item só sobe se `fogo+1 < 8` (`$C1:6348`) | código |
| Bombas máximas | **8** (`capacidade+1 < 9`, `$C1:6362`) | código |
| Tipos de bomba (`+$43`) | 0 normal. 1 **remota** (explode com **B**). 2 **perfurante** (a chama atravessa soft blocks e destrói todos no alcance) | `t101.py` |
| Item na chama | o item **queima** (`EDC0`, some) e **segura a chama** como um soft block | `t67.py`, `t68.py` |
| Pavio durante voo ou transporte | **congela** (soco, arremesso, luva segurando). Na bomba **chutada o pavio continua** | `t42.py`, `t48.py`, `t36.py` |

---

## 5. Itens

### 5.1 Efeito de cada ID ✅ (tabela de despacho `$C1:60A0`, 3 bytes por entrada)
Ao pegar **qualquer** item doente, a doença é removida e jogada fora como nova caveira (§5.6).

| ID | Handler | Efeito | Nas listas do Battle? |
|---|---|---|---|
| `$01` | `$C1:6362` | Bomba +1 (`+$41` e `+$42`), até 8 | sim (6–10 por fase) |
| `$02` | `$C1:61B6` | `+$43 = 2`: **bomba perfurante** | **não** (só variantes de senha e roleta) |
| `$03` | `$C1:6348` | Fogo +1, até 7 | sim |
| `$04` | `$C1:623C` | `+$E3 = FF`: **fogo total**; toda bomba nasce com fogo 7 (alcance 9) | **sim**, 1 nas fases 3, 6 e 7 |
| `$05` | `$C1:6304` | Patins +1, até nível 5 | sim |
| `$06` | `$C1:61C9` | `+$43 = 1`: **bomba remota** (B detona) | não |
| `$07` | `$C1:62C7` | Luva (`+$49`) | sim |
| `$08` | `$C1:62B3` | **Colete**: 511 ticks invencível | não |
| `$09` | `$C1:61DC` | **Coração** (`+$47`): absorve 1 acerto | não |
| `$0A` | `$C1:631E` | Atravessa soft blocks (`+$4B`) | não |
| `$0B` | `$C1:6331` | Atravessa bombas (`+$4C`) e zera o Chute (exclusivos entre si) | não |
| `$0C` | `$C1:61EF` | Para o tempo: `$1ECC = $400` (1024 ticks) | não |
| `$0D` | `$C1:62DA` | **Soco** (`+$48`) | sim |
| `$0E` | `$C1:62ED` | **Chute** (`+$4A`) e zera atravessa-bomba | sim |
| `$0F` | `$C1:624F` | **Traje** aleatório: `+$45 = $E8 \| rnd(8)`. Muda o visual e vale 1 vida | **sim**, 8 na fase 10 |
| `$10` | `$C1:6295` | vida extra (`$01A8`, modo história) | não |
| `$12` | `$C1:637E` | **"P" = soco em jogador** (`+$D8`) | sim |
| `$13`–`$1A` | | pontos (história) | não |
| `$20`–`$2F` | `$C1:6189` | **Caveira**: `+$4D` = ID (`$2D` = patins −1, fora do Battle) | sim (1 caveira `$21` por fase) |
| `$3x` | objeto `$C1:5E8B` | **Cápsula de montaria**; o tipo é o nibble baixo | sim (4 de `$30` por fase nas fases 1, 2, 3, 6 e 7) |

### 5.2 "P" (`$12`) ✅ (`t45.py`, `t46.py`, `t47.py`; código `$C2:499F`)
- Botão **Y**: com o "P", o Y **sempre** faz este golpe. O jogador **avança 16 px (4 px/tick, 4 ticks)** e fica **35 ticks** na animação.
- Se houver jogador(es) na casa da frente, eles recebem **empurrão de 3 casas (48 px, 4 px/tick, 12 ticks)** e param antes de bomba, soft ou parede.
- Com o **Soco** junto, o golpe também soca a bomba da frente.
- Contra uma parede dura, o avanço não sai do lugar.
- Na fase 5 ("School of Hard Shocks"), empurrar alguém contra a **cerca externa** atordoa a vítima (§5.8). Isso é mecânica da fase (`$9C` bit `$200`, `$C2:319B`).

### 5.3 Chute (`$0E`) ✅ (`t36.py`, `t41.py`, `t91.py`; `$C2:4307`, `$C1:34D0`, `$C1:35E1`)
- **Dispara sozinho** quando o jogador está olhando para uma bomba parada na casa vizinha e sua subposição está na
  máscara `$C3:2EB0` (na prática, 1–2 px antes do centro da casa ao andar contra a bomba).
- A bomba desliza a **2 px/tick** (script `$C1:3548`+: 8 passos de 2 px por casa). **Não volta.**
- Antes de cada casa nova, verifica o destino. **Para (alinhada) antes de:** parede/soft (bit `$8400`), outra bomba ou
  **jogador**. Nesses casos ninguém sofre efeito.
- **Item no caminho é esmagado** (destruído) e a bomba continua ✅. **Cápsula de montaria bloqueia** 🟡 (código `$C1:3A1B`).
- **Botão X** para a bomba chutada na casa em que está. B, L, R e Y não param.
- O pavio continua. Enquanto desliza, a bomba não fica no grid; ela volta ao grid quando para.

### 5.4 Soco (`$0D`) ✅ (`t42.py`, `t43.py`, `t49.py`; scripts `$C1:2126`)
- Botão **Y** com bomba na casa vizinha, na direção em que se olha.
- **Voo de 3 casas (48 px) em 17 ticks** (15 com movimento + 2 parados). Na horizontal: dx `3,3,4,4,4,4,3,3,3,3,3,3,3,3,2,0,0`,
  altura `−4,−6,−7,−8,−9,−10,−10,−10,−10,−9,−8,−7,−6,−4,0` (**pico de 10 px**). Na vertical, o arco vem embutido no dy
  (subindo: `−4`×10, `−3`×3, 0, +1, 0, 0).
- **Pavio congelado** durante o voo.
- **Pouso** (`$C1:27A4`):
  - Casa livre: vira bomba normal.
  - Casa com bloco, bomba, item ou caveira: **quica 1 casa** (8 ticks: dx `3,3,3,3,2,2,0,0`, altura `−4,−6,−6,−6,−4,0`, **pico de 6 px**) e repete.
  - Jogador na casa: **atordoa** o jogador (§5.8) e quica.
  - Bloco de pressão (`$EE80`, testado antes de tudo em `$C1:27D7`): a bomba some (`$C1:2871` → `$C1:5C2F`) e volta ao dono. ✅ emulador (2026-10-01). Bloco queimando (`$EDC0`) tem o bit `$0800`: **quica**.
- **Borda** (`$C1:6566`): passando da parede, a bomba **dá a volta** (toroidal: ±272 px se x < −12 ou ≥ 268; ±224 px se
  y < 12 ou ≥ 244 — 14 linhas, com a linha 13 da grade, `$EC40` fora da tela, lida por `$C2:3221` como (y − 24) mod 224).
  Continua quicando casa a casa por cima das paredes até achar casa livre. Ex.: da col 13 para a direita → pousa na col 2.
  Da lin 2 para cima → quica na linha 13 e na parede e pousa na lin 10 (T+41 com jogador em (2,11)). Da lin 10 para baixo
  → linha 13, parede, lin 1 (T+33).

### 5.5 Luva (`$07`) ✅ (`t48.py`; `$C1:25FD`–`$C1:2780`)
- Parado sobre uma bomba (a recém-colocada ou outra), **aperte A de novo e segure**: levanta a bomba (4 ticks).
  **O pavio congela.** O jogador anda normalmente segurando.
- **Soltar A arremessa.** O jogador fica ~20 ticks travado na animação.
- **Distância com mira automática:** se houver jogador a 2, 3 ou 4 casas na direção, a bomba cai **no primeiro deles**.
  Senão cai a **5 casas**. Voo de 11–12 ticks (scripts `$C1:2571`/`2569`/`2561`/`2559`; 2/3/4/5 casas).
- Pouso, quique e volta pela borda iguais ao soco. Cair sobre jogador também atordoa.

### 5.6 Caveira: as 11 doenças ✅/🟡
| ID | Efeito | Onde | Status |
|---|---|---|---|
| `$21` | **Rápido**: velocidade 2 px/tick (índice 6). É a caveira que **sai dos blocos** em todas as fases | `$C2:2FAF`; `t63.py` | ✅ |
| `$22` | **Lento**: 0,5 px/tick (índice 7) | `$C2:2FB9`; `t30.py` | ✅ |
| `$23` | **Diarreia**: solta bomba sozinho sempre que tem bomba disponível | `$C2:4FCD` | 🟡 |
| `$24` | **Prisão de ventre**: não solta bombas. Só pode sair 1 vez por rodada (`$1EE4`) | `$C2:502B`, `$C2:5495` | 🟡 |
| `$25` | **Fogo mínimo**: toda bomba com fogo 10 → **alcance 1**. Só coloca quando todas as bombas estão disponíveis | `$C2:50DC`; `t64.py` | ✅ |
| `$26` | **Não para**: sem direção apertada, repete a última | `$C2:3F68` | 🟡 |
| `$27` | **Pavio curto** (62 ticks) | `$C2:5078` | 🟡 |
| `$28` | **Pavio longo** (253 ticks) | `$C2:5086` | 🟡 |
| `$29` | **Invisível** (pisca por padrão de `$C2:4F68`) | `$C2:4E06` | 🟡 |
| `$2A` | **Controles invertidos** (↑↓ e ←→) | `$C2:3F8D` | 🟡 |
| `$2B` | **Perde 1 item a cada 32 ticks** (os itens voam para o chão) | `$C2:4DE9`; `t66.py` | ✅ |
| `$2C` | troca de posição com outro jogador (1/4 de chance a cada 256 ticks). **Excluída do sorteio** | `$C2:4D4E` | 🟡 |

- **Duração: nenhuma.** O `+$4E` não conta no Battle. A doença só termina assim:
  (a) **pegando qualquer item**: a doença sai e é arremessada como **caveira nova** com ID sorteado `rnd(12)+$21`
      (re-sorteia `$2C`, e `$24` só uma vez), voando 3–5 casas ✅ `t65.py`;
  (b) **por contato:** a doença **passa** para o outro e **quem passou fica curado**. Não volta para quem acabou de
      passar enquanto o contato continuar (`+$F0`) ✅ `t65.py`;
  (c) **atordoamento:** a primeira perda é a doença (§5.8);
  (d) morte (some, não é solta).

### 5.7 Cápsulas e trajes ✅/🟡
- **Cápsula** (item `$30` na lista): ao ser revelada, sorteia `$C1:5DA4[rnd(14)]` ∈ {`$32`,`$33`,`$3A`,`$3C`,`$3D`,`$3E`,`$3F`},
  com 1/7 de chance para cada um. Ao ser pisada, o jogador **monta** (`+$5C` = tipo, `+$5D` = 1). ✅ `t18.py`, `t19.py`, `t83.py`
  - Efeitos por tipo, lidos no código 🟡: tipo 2 atravessa soft blocks; 3 bombas perfurantes; `$0A` anula atravessa-bomba.
    Tipos 1, 6, 9 e `$0B` (atravessa bomba, fogo 7, ação especial, velocidade 2) **não saem no Battle**. Os tipos
    `$0C`–`$0F` têm habilidades próprias que não investiguei.
- **Traje** (`$0F`, só na fase 10): `+$45 = $80 | tipo`, com 8 trajes. Troca o sprite do jogador (`t84.py`). Em ambos os
  casos que o código trata no acerto (`$C2:1129`), o **traje** (`+$45` bit 7) é perdido e o jogador ganha 96 ticks de
  invencibilidade em vez de morrer 🟡. Para a montaria de cápsula (`+$5C/$5D`), esse caminho não aparece no mesmo
  trecho, então o efeito dela no acerto ❌ não foi verificado.

### 5.8 Atordoamento ✅ (`t44.py`, `t47.py`; `$C2:51C4`, `$C2:0E29`)
Acontece com bomba (socada, arremessada ou do Bad Bomber) **caindo na cabeça**, e com empurrão contra a cerca
elétrica da fase 5.
- **63 ticks** parado.
- **Perde 1–4 itens** (`(rnd & 6)/2 + 1`). Prioridade: doença, depois montaria/traje, depois itens aleatórios de uma
  lista de 13 perdas (`$C2:519D`). Cada item perdido **voa 3, 4 ou 5 casas** numa direção aleatória (§6.4).

---

## 6. Drops e sorteio

### 6.1 Layout de soft blocks por rodada ✅ (`t57.py`–`t61.py`; `$C4:1640`–`$C4:1824`)
1. Carrega o layout-base da fase (`layouts_base.json`). Nas fases 1, 2, 6 e 10, **todas** as casas que não são pilar
   começam como soft. Fases 3, 4, 7 e 9 têm casas especiais ou vazias fixas. Fases 5 e 8 não têm blocos.
2. **Abre um quadrado 3×3** em volta de cada spawn **de jogador presente** (`$C4:1824`; spawns (2,1), (14,11), (14,1),
   (2,11), (8,6) no grid `$2800`).
3. **Remove N soft blocks aleatórios** (`$C4:179C`). N é o byte `+$1E` do registro da fase:

| Fase | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| N removidos | 14 | 14 | 12 | 4 | (8, sem blocos) | 14 | 4 | 0 | 4 | 14 |
| Soft blocks finais | 80 | 80 | 80 | 70 | 0 | 80 | 62 | 0 | 78 | 80 |

Sorteio de cada remoção: até 15 tentativas de `col = rnd(13)`, `lin = rnd(11)`; aceita se for soft. Se nenhuma servir,
usa a 1ª casa soft da lista fixa `$C4:1327`. O modelo (`itemsim.carve` + `remove_random`) reproduz **as 10 fases
exatamente** (`./py t61.py`).

### 6.2 Itens escondidos por fase ✅ (listas `$C3:7C30`…; registro da fase `+$18`; `./py t50.py`)
A tabela de fases `$C3:6233` (variante A) tem 14 ponteiros. As variantes B, C e D (`$C3:625D`/`6287`/`62B1`) só são usadas
com senhas (`$024A`, `$C2:AB06`). Valores conferidos contra a tabela montada em `$7E:8000` nos 10 savestates `st_arena`:

| Fase | Total | Bomba | Fogo | Patins | Chute | Soco | Luva | P | Caveira | Cápsula | Outros |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 30 | 8 | 5 | 3 | 3 | 2 | 2 | 2 | 1 | 4 | – |
| 2 | 31 | 10 | 6 | 2 | 3 | 0 | 3 | 2 | 1 | 4 | – |
| 3 | 35 | 10 | 5 | 5 | 2 | 2 | 2 | 3 | 1 | 4 | Fogo total 1 |
| 4 | 26 | 6 | 5 | 3 | 2 | 2 | 3 | 5 | 0 | 0 | – |
| 5 | 0 | – | – | – | – | – | – | – | – | – | todos começam fortes |
| 6 | 34 | 10 | 6 | 3 | 3 | 2 | 2 | 2 | 1 | 4 | Fogo total 1 |
| 7 | 35 | 10 | 6 | 4 | 5 | 1 | 0 | 3 | 1 | 4 | Fogo total 1 |
| 8 | 0 | – | – | – | – | – | – | – | – | – | (caça-níquel) |
| 9 | 32 | 10 | 6 | 3 | 3 | 3 | 3 | 3 | 1 | 0 | – |
| 10 | 33 | 10 | 6 | 5 | 3 | 0 | 0 | 0 | 1 | 0 | Traje 8 |

### 6.3 Sorteio e RNG ✅ (`$C3:54B3`, `$C4:121D`; `./py t52.py`, `./py t61.py`)
- **RNG:** `seed = ((seed | 1) · $0383) & $FFFF`; `valor = (seed · (n & $FF)) >> 16` (resultado entre 0 e n−1).
  A semente fica em `$AE` e começa em **`$12`** no boot (`$C0:F0E1`). Só avança quando alguém chama o RNG.
  Validado em 207 chamadas seguidas, sem erro.
- **Posição de cada item:** para cada entrada `(célula=$0044, item)` da lista, até 15 tentativas de `rnd(13)`, `rnd(11)`.
  Aceita se a casa for soft **e** ainda não tiver item. Senão usa a lista `$C4:1327`. O resultado vai para `$7E:8000`
  (pares `casa, item`, terminados por `$FFFF`). O bloco queimando consulta essa tabela ao terminar (`$C1:5997`).
- **Ordem de consumo do RNG na montagem da rodada:** remoção de blocos, depois (fases com elementos aleatórios)
  chamadas próprias da fase, depois itens.

### 6.4 Itens de quem morre ✅ (`t44.py`; `$C2:1258`, tabela `$C2:38F4`, posição `$C2:3922`)
- Durante os 44 ticks pós-morte, **a cada 4 ticks** uma categoria é solta, **inteira**, nesta ordem:
  bombas (capacidade − 1), luva, tipo de bomba (remota ou perfurante), atravessa-soft, **todo o fogo**, soco, chute,
  atravessa-bomba, patins (nível − 1), P.
- **Não soltam:** fogo total (`$E3`), coração, doença, montaria.
- Cada unidade **aparece direto numa casa vazia aleatória da arena inteira**, sem voar.
  - Sorteio: índice `rnd(113)` na lista `$C4:1327` (as 113 casas que não são pilar). Se a casa estiver ocupada
    (bloco, bomba, item, jogador ou piso especial), avança `rnd(8)` casas na lista, até 15 vezes. Depois disso, usa a
    1ª casa livre da lista.
  - O item é gravado na hora no grid (`$0940|id`, `$C2:3A00`).
- **Isso é diferente da perda por atordoamento ou pela doença `$2B`.** Nesses casos o item **voa 3, 4 ou 5 casas** em
  linha reta numa das 4 direções (`rnd(12)` sobre 12 scripts, `$C1:6715`; objeto `$C1:65BC`). Se cair em casa ocupada,
  quica 1 casa por vez, com volta pela borda; se cair em bloco queimando, some. ✅ `t66.py`

### 6.5 Item × explosão, pressão e chute ✅
- Chama **destrói** o item (queima 24 ticks) e **para** nele. Um item queimado não reaparece (`t67.py`, `t68.py`).
- Bloco de pressão caindo sobre item: some. Sobre bomba: a bomba **some sem explodir** e volta para o dono (`t98.py`).
- Bomba chutada esmaga o item.

---

## 7. Regras

### 7.1 Linha do tempo da rodada ✅ (`./py t75.py`, `t76.py`, `t77.py`, `t86.py`, `t95.py`, `t103.py`; frames de vídeo a partir do A na seleção de fase)
| Frame | Evento |
|---|---|
| 0 | A na seleção de fase: aparece "BATTLE START!" |
| 277–292 | fade-out (15 frames) |
| ~512 / ~619 | montagem da arena: remoção de blocos, depois itens |
| 646–655 | **10 ticks de lógica com a tela preta** (o relógio já anda: 3:01 → 3:00) |
| 656–670 | fade-in (15 frames) |
| 671–707 | **pausa de 37 frames sem lógica** (não há texto READY/GO) |
| **708** | **controle liberado** e relógio correndo |

Fim com vencedor:
- A vitória é decidida **2 ticks depois** de restar ≤1 jogador sem estar morrendo. A partir daí o vencedor fica **imune**
  (pose de vitória; as bombas param). ✅ `t97.py`
- Quando as animações terminam (65 ticks após o acerto), há **128 ticks** de comemoração.
- Depois vêm: fade-out (15 frames), coroa +1 com a tela preta, fade-in do **Score Board** (15), placar por ≈497 frames,
  fade-out (15) e a próxima rodada.

Fim por morte de todos: DRAW **no mesmo tick** em que a última animação termina (sem os 128 ticks).
Fim por tempo: veja §7.4.

### 7.2 Relógio e pressão ✅ (`$C1:09BE`, `$C1:1559`, `$C1:7030`; `./py t72.py`)
- **Tempo** (`$C1:1489`): 1:01, 2:01, 3:01, 5:01. "∞" = 30:01, e com ≥10 minutos o relógio não decrementa
  (logo, sem pressão). O relógio conta **ticks** (60 por segundo).
- **Início da pressão:** na virada **1:02 → 1:01**. Com a opção 1:00, na virada **0:42 → 0:41**.
  - Toca o aviso "HURRY" e a faixa passa por **192 ticks**.
  - As bordas mudam de gráfico (`EC40`→`EE80`).
  - **1º bloco nasce 205 ticks após o gatilho** (≈0:58,6).
- **Ritmo:** 1 casa a cada **14 ticks**. Casa de pilar **consome o turno** sem bloco.
- **Queda:** cada bloco cai por **36 + 2·lin ticks** (lin 1 → 38, lin 11 → 58) antes de virar `EE80`.
- **Ordem** (`$C1:724E`): espiral no sentido horário a partir de (2,1). Linha de cima →, coluna da direita ↓, linha de
  baixo ←, coluna da esquerda ↑, depois o anel seguinte. **Morte Súbita Off: para depois de 80 turnos** (2 anéis;
  62 blocos nas fases 1 e 5).
- Ao pousar: mata qualquer jogador da casa ✅ (ignora coração e invencibilidade 🟡), apaga bomba (devolvida ao dono) e
  item ✅ `t98.py`, e cobre soft block ✅.
- Bad Bombers saem de cena quando a pressão começa (`$0096 ≠ 0`, `$C2:5DFA`). 🟡 (código)

### 7.3 Morte Súbita ✅ (`$1F08` → `$C1:70BE`; `./py t72.py …st_r_sd.bin`)
- **On:** a espiral **não para** no marcador `$7000` depois dos 2 anéis. Continua no mesmo ritmo (14 ticks) até o centro
  (**143 turnos**, a arena inteira), terminando por volta de 0:25. Na prática ninguém chega ao 0:00.
- Não muda nada no 0:00: tempo esgotado continua sendo DRAW (§7.4).

### 7.4 Empate ✅ (`t95.py`, `t103.py`; `$C1:1499`)
- **0:00 com 2 ou mais vivos:** todos congelam. Faixa "TIME UP" (32 + 128 = **160 ticks**), fade e tela **DRAW GAME**.
  Ninguém ganha coroa.
- **Todos morrem**, ou os últimos morrem no mesmo tick: DRAW.
- **Coroas:** `$1F34 + 2n` ganha +1 com a tela preta, depois do fade.

### 7.5 Bad Bomber ✅/🟡 (`$1F06`; `$C2:5AB7`–`$C2:5FE9`; `t79.py`–`t82.py`)
- Depois do pós-morte, o morto vira Bad Bomber (sem voltar a "vivo"; `$1EA0` já caiu).
- Entra fora da tela pelo lado da arena em que morreu (X < 128 → esquerda) e anda 1 px/tick até a moldura.
- **Movimento:** percorre o retângulo externo **X ∈ {15, 239}, Y ∈ {32, 224}** a **1 px/tick**, seguindo o direcional.
  Faz as curvas nos cantos sozinho e para no ponto do lado em que o direcional deixa de fazer sentido.
- **Status:** 1 bomba, fogo 1 (alcance 3), sem habilidades.
- **Arremesso:** A com a bomba na mão ✅ (não vale nos cantos nem nos trechos próximos a eles 🟡, `$C2:5CC7`). Mesma mira da luva
  (jogador a 2, 3 ou 4 casas; senão 5). Voo de 11 ticks. Pavio cheio (126) ao pousar.
- **Cadência:** só pega outra bomba **depois que a anterior explode**, mais **48 ticks** (`$C2:5D91`). Com A apertado o
  tempo todo, o ciclo é de ≈190 ticks.
- **Não volta para a partida**, nem matando alguém (testado: o morto por ele vira outro Bad Bomber) ✅.
- A bomba do Bad Bomber que cai na cabeça de alguém atordoa (§5.8) ✅.

### 7.6 "Racer Bomber" 🟡 (`$1F04`; `$C2:7FCA`, `$C2:08B3`, tabela `$C2:08F4`)
- **Não mexe em velocidade.** Ao fim de cada **partida** (junto do reset de coroas, `$C2:7FB0`), se estiver On, roda uma
  **roleta** (`$C3:2FB0`, prêmio em `$1F50`). O vencedor da partida vira `$1F4E`.
- Na partida seguinte, **em toda rodada**, esse jogador começa com o prêmio. Os 17 prêmios: bomba +1, bomba perfurante,
  fogo +1, fogo total, patins +1, remota + luva, luva, chute, nada, atravessa-bomba, atravessa-soft, **patins −1**,
  soco, coração, P.
- Ao ligar a opção no menu, o prêmio é zerado para "nada" (`$1F50 = $FFFF`, `$C1:9EC3`).
- Não vi a roleta na tela (`t102.py` só passou de rodada). A probabilidade de cada prêmio fica em aberto.

### 7.7 Times 🟡
- Team Battle = `$7F:200C = 1`, e o modo `$01A4` passa de 16 para **32** (`$C1:8F03`).
- A tela de jogadores continua igual. Os times são guardados em `$7F:204C..2050` e copiados para `$1F20 + 2n`
  (`$C1:9017`). A tela onde eles são escolhidos não foi identificada.
- A roleta do Racer só existe no Free-for-All (`$C2:08A8`). Morte, drops e Bad Bomber valem nos dois modos (`$C2:1260`).
- Não medi a condição de vitória por time nem a contagem de coroas por time.

---

## 8. Tabela "nosso jogo × ROM"
Arquivos do nosso jogo: `.worktrees/cpu-ai/web/src/core/{constants,player,bombs,items,round,arena}.ts` e spec §4–§7.
✅ igual · ⚠️ diferente (valor certo na coluna ROM) · ➕ falta no nosso jogo.

| Item | Nosso jogo | ROM | |
|---|---|---|---|
| Subpixel | 1/8 px (`SUB=8`) | 1/256 px; todas as velocidades são múltiplas de 1/8 | ✅ |
| Velocidade nível 1..5 | 8..12 /8 px por tick | 256..384 /256 (1; 1,125; 1,25; 1,375; 1,5) | ✅ |
| `MAX_SPEED` | 5 | 5 | ✅ |
| Velocidade da doença rápida | 15/8 = 1,875 | **2,0** px/tick | ⚠️ |
| Velocidade da doença lenta | 4/8 = 0,5 | 0,5 | ✅ |
| Correção de canto (`CORNER_SUB` 6 px, só no eixo perpendicular) | "se off ≤ 6, corrige só a perpendicular" | Tabelas de assistência: vira **diagonal** (\|dx\| ≤ 9 na abertura); contra pilar, **zona morta \|dx\| ≤ 3** e desliza se ≥ 4; empurrão até o eixo em parede; corredores com tabela própria | ⚠️ usar `movesim.py` |
| Várias direções apertadas | tenta a 1ª que anda | a diagonal é uma direção própria (tabela) | ⚠️ |
| `FUSE_FRAMES` 128 (explode 127 ticks depois) | 127 ticks após colocar | igual | ✅ |
| `FLAME_FRAMES` | 33 | **25** | ⚠️ |
| Reação em cadeia | mesmo tick | **+2 ticks** | ⚠️ |
| Queima de soft block | 33 (= chama) | **24** ticks; item aparece no 24º | ⚠️ |
| Alcance | fogo + 2 | fogo + 2 (fogo 10 = alcance 1) | ✅ |
| `MAX_FIRE` | 8 (alcance 10) | **7** (alcance 9) | ⚠️ |
| `MAX_BOMBS` | 8 | 8 | ✅ |
| Hitbox da chama | casa do centro | casa do centro | ✅ |
| Passar pela própria bomba | `passers` | casa própria livre; não volta | ✅ |
| Jogador × jogador | não colidem | não colidem | ✅ |
| `DEATH_FRAMES` | 78 | **65** ticks até sair | ⚠️ |
| Decisão do vencedor | espera as animações | **2 ticks após o acerto**; vencedor imune e bombas congelam | ⚠️ |
| Comemoração ao vencer | não há | 128 ticks após as animações | ➕ |
| `INTRO_FRAMES` 90 | 90 | 10 ticks pretos + 15 fade + 37 parado (sem READY/GO) | ⚠️ |
| Invencibilidade inicial | 0 | 0 | ✅ |
| Layout de soft blocks | fixo (`layouts.ts`) | **tudo soft + 3×3 nos spawns + N aleatórios removidos por rodada** | ⚠️ |
| `ITEM_CHANCE_PCT` 40 e pesos | aleatório por bloco | **lista fixa por fase** (§6.2), posição sorteada | ⚠️ |
| RNG | mulberry32 | LCG ×`$383` de 16 bits (§6.3) | ⚠️ (opcional) |
| Item × chama | destrói e para | destrói e para | ✅ |
| Itens de quem morre | somem | **cada unidade surge numa casa vazia aleatória da arena** (§6.4) | ➕ |
| Chute: velocidade | 2 px/tick | 2 px/tick | ✅ |
| Chute: como dispara | movimento bloqueado pela bomba | olhando para a bomba na subposição da máscara | ✅ (quase) |
| Chute: para em | obstáculo, jogador, item | obstáculo, jogador, bomba; **item é esmagado** e a bomba segue; **X para** | ⚠️ ➕ |
| Soco: distância | 3 casas | 3 casas | ✅ |
| Soco: velocidade | 2 px/tick (24 ticks) | **17 ticks** (script, pico 10 px) | ⚠️ |
| Quique | 1 casa a 2 px/tick (8 ticks) | 1 casa em 8 ticks | ✅ |
| Volta pela borda | sim | sim | ✅ |
| Bomba cai no jogador | quica | **atordoa 63 ticks, perde 1–4 itens**, quica | ➕ |
| Luva: levantar | apertar A sobre a bomba | 2º toque de A **parado sobre** a bomba; segurar | ✅ (quase) |
| Luva: distância | 3 casas | **mira em jogador a 2/3/4 casas; senão 5** | ⚠️ |
| Pavio parado no voo e na mão | sim | sim | ✅ |
| "P" | chama perfurante | **soco em jogador** (Y: avança 1 casa, empurra 3) | ⚠️ ➕ |
| Bomba perfurante | "P" | item `$02`, fora do Battle padrão | ⚠️ |
| Caveira: tipos | 4 (lento, rápido, diarreia, fogo fraco) | **11** (§5.6); a dos blocos é sempre "rápido" | ⚠️ |
| `DISEASE_FRAMES` 600 | expira | **não expira** | ⚠️ |
| Contágio | mesma casa; os dois ficam doentes | \|dx\|,\|dy\| ≤ 8 px; **passa e cura quem passou** | ⚠️ |
| Cura ao pegar item | não | sim, e a doença é arremessada como caveira nova | ➕ |
| Fogo total (`$04`) | não existe | 1 nas fases 3, 6 e 7 | ➕ |
| Cápsulas e trajes | não existem | 4 cápsulas (fases 1, 2, 3, 6, 7); 8 trajes (fase 10, valem 1 vida 🟡) | ➕ |
| Fase 5 | 5 bombas, fogo 4, chute, soco, luva, perfurante | 5 bombas, fogo 4, chute, soco, luva e **P** | ⚠️ |
| Pressão: início | 60 s restantes (metade com 1:00) | virada **1:02→1:01** (0:42→0:41 com 1:00), aviso de 192 ticks, **1º bloco +205 ticks** | ⚠️ |
| `PRESSURE_INTERVAL` | 6 | **14** ticks | ⚠️ |
| Queda do bloco | instantânea | **36 + 2·lin** ticks | ⚠️ |
| Ordem e 2 anéis | espiral horária, 2 anéis | igual | ✅ |
| Casa de pilar no anel | pulada sem gastar tempo | **gasta o turno** | ⚠️ |
| Bloco sobre bomba ou item | remove | remove (bomba volta ao dono) | ✅ |
| Bloco × coração/invencibilidade | – | mata assim mesmo | 🟡 |
| Tempo ∞ | sem pressão | sem pressão (30:01 parado) | ✅ |
| Morte Súbita | no 0:00, anéis internos a 1 bloco/frame | **espiral inteira desde o início**, 14 ticks; 0:00 continua DRAW | ⚠️ |
| Tempo esgotado | DRAW (SD Off) | DRAW **sempre**, após 160 ticks de "TIME UP" | ⚠️ (pequeno) |
| Bad Bomber | borda, 1 bomba | borda a 1 px/tick, fogo 1, mira 2–5, espera explodir + 48 ticks, não volta, sai com a pressão | ⚠️ (detalhar) |
| Racer | todos com velocidade 4 | roleta de prêmio para o campeão da partida anterior | ⚠️ |
| Coroas e placar | ok | Score Board ≈ 497 frames, depois da coroa +1 | ✅ |
| Times | 2 times, vence o último time | modo `$01A4 = 32`; detalhes 🟡 | 🟡 |

---

## 9. Em aberto
- Habilidades de cada montaria (`$0C`–`$0F`, `$0A`, `$02`, `$03`) e dos 8 trajes (fase 10). 🟡
- Probabilidades da roleta do Racer e a tela da roleta. 🟡
- Regras de Team Battle (escolha de times, vitória, coroas). 🟡
- Doenças `$23`, `$24`, `$26`–`$2A`: efeito lido no código, mas não medido quadro a quadro. 🟡
- Se o chute dispara sozinho quando uma bomba para ao lado de um jogador parado olhando para ela (o código não testa o
  direcional). 🟡
- Bomba chutada atravessando chama (se explode na hora). ❌ não testado.

## 10. Como reproduzir (resumo)
```
cd analise/investigacao/mecanicas
./py t33.py st_arena05 1 60      # valida o modelo de movimento (0 divergências esperadas)
./py t61.py                      # layout aleatório + itens: modelo = jogo nas 10 fases
./py t50.py                      # listas de itens por fase (ROM × WRAM)
./py t52.py                      # RNG: 207 chamadas conferidas
./py t24.py; ./py t29.py         # pavio 127 ticks / chama 25 / morte 65
./py t36.py; ./py t41.py; ./py t91.py   # chute (velocidade, obstáculos, botão X)
./py t43.py hitp; ./py t44.py; ./py t49.py   # soco, atordoamento, volta pela borda
./py t48.py 20                   # luva (levantar, segurar, arremessar 5 casas)
./py t45.py; ./py t46.py         # item "P"
./py t64.py                      # alcance por nível de fogo
./py t65.py; ./py t66.py         # contágio, cura, doença $2B
./py t72.py st_arena05 2         # espiral de pressão (demora ~5 min)
./py t75.py; ./py t86.py; ./py t95.py; ./py t103.py   # linha do tempo da rodada, vitória, TIME UP, empate
./py t79.py; ./py t81.py; ./py t82.py   # Bad Bomber
./py export_tables.py            # regrava tabelas_mecanica.json
```
