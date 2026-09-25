# Áudio do Super Bomberman 4 (Battle): driver, dados, IDs e plano para o navegador

Frente **audio**. Marcações: ✅ medido/confirmado · 🟡 provável · ❌ não encontrado.
Endereços `$BB:AAAA` (HiROM) e offset de arquivo `0x…` (offset = `(banco − $C0) << 16 | addr`).
Scripts em `analise/investigacao/audio/`, arquivos gerados em `analise/extraido/audio/` (fora do git).

---

## 0. Resumo

- ✅ O som usa o **driver Hudson "SFX SOUND DRIVER Ver 2.28 / Kazumi-TYPE"**. É um programa SPC700 de 10 KB (bloco `$31`) que o jogo sobe com o protocolo IPL. Depois disso, **tudo é pedido pelas 4 portas**: música e SFX pela **porta 0**, com o bit 7 alternando a cada comando, e comandos de sistema pela **porta 1** (carregar, parar, fade, stream).
- ✅ Todos os dados de áudio ficam entre `$D9:0000` e `$DE:9C94` (arquivo `0x190000–0x1E9C94`, ≈ 368 KB). Os bancos `$D9–$DD` de entropia alta são **samples BRR** (96 samples de música e 20 vozes) e **sequências**. Não há compressão.
- ✅ As tabelas de ponteiros ficam em `$C0:0190` (50 blocos), `$C0:0739` (música: bloco, set de samples, comando), `$C0:0787` (SFX → comando), `$C0:07B9` (voz → bloco, comando) e `$DA:17D2`/`$DA:2118`/`$DA:2238` (sets de samples).
- ✅ **Músicas do Battle:** `$01` título, `$12` menus, `$13` "BATTLE START!", **`$14` partida (a mesma nas 10 arenas)**, `$15` placar, `$16` VICTORY, `$18` DRAW GAME. **Não há música de "hurry"**: em 1:00 toca o SFX `$15` e a voz `$10`.
- ✅ Mapeei 19 SFX e 9 vozes para eventos, com o call site de cada um no código (§3).
- ✅ **Prova de conceito:** o programa `spchost` faz o papel da CPU **sem emular o 65816**. Ele lê a ROM, sobe driver, sequência e samples pelas portas de um SPC700+DSP emulado e gera `.spc` e `.wav`.
  - A RAM do APU fica **idêntica byte a byte à do jogo**: driver, SFX, música e 31.158 bytes de samples.
  - O áudio coincide com o do jogo rodando no snes9x completo. O atraso fica constante em 25 s (mesmo andamento e mesmas notas) e há trechos com r = 0,99999.
- **Recomendação:** emular só o **APU** (SPC700+DSP; sugiro o `snes_spc` do blargg, LGPL-2.1, em WASM ou portado para TS) e reimplementar em TS o lado CPU. São ≈ 250 linhas: tabelas e handshakes, já escritos em C++ no `spchost.cpp`. Estimativa: **6–9 dias** (WASM) ou **10–14 dias** (TS puro).

---

## 1. Driver de som e dados

### 1.1 Onde fica cada coisa na ROM ✅

| Região (SNES) | Arquivo | Conteúdo |
|---|---|---|
| `$C0:0190–$C0:07EA` | `0x000190` | Código do lado CPU (upload, comandos, stream) e 4 tabelas (§1.2) |
| `$C3:492F–$C3:4B0D` | `0x03492F` | Camada do jogo: fila de SFX e wrappers (§1.5) |
| `$D9:0000–$DA:17D2` | `0x190000–0x1A17D2` | Blocos `$1A–$2D`: **20 vozes/samples de "stream"** (BRR) |
| `$DA:17D2–$DA:22F8` | `0x1A17D2–0x1A22F8` | Sets de samples: índice (`$DA:17D2`), descritores, DIR e instrumentos, ponteiros (`$DA:2118`, 3 B) e tamanhos (`$DA:2238`, 2 B) |
| `$DA:22F8–$DD:88AA` | `0x1A22F8–0x1D88AA` | **96 samples BRR de música** (222.642 bytes). Todos têm tamanho múltiplo de 9 e o flag END só no último bloco; 69 têm loop |
| `$DD:88AA–$DE:3DBB` | `0x1D88AA–0x1E3DBB` | Blocos `$01–$19`: **sequências das 25 músicas** (em `$4300` no APU; a `$11` vai em `$3100`) |
| `$DE:3DBB–$DE:4F66` | `0x1E3DBB` | Bloco `$2F`: **banco de SFX da partida** (sequências dos efeitos, em `$3100`) |
| `$DE:4F66–$DE:5F3F` | `0x1E4F66` | Bloco `$30`: **banco de SFX de menus e telas de resultado** (em `$3100`) |
| `$DE:5F3F–$DE:7445` | `0x1E5F3F` | Bloco `$2E`: DIR, instrumentos e samples BRR dos SFX (`$5300/$5400/$5500–$6975`) |
| `$DE:7445–$DE:9C94` | `0x1E7445–0x1E9C94` | Bloco `$31`: **driver SPC700** (`$0780` texto/tabelas, `$0800` entrada, `$0880–$2FDA` código, `$FF00–$FF49` rotinas). A string do driver fica em `0x1E7449` |

A entropia ≈ 7,4 dos bancos `$D9–$DD` vem dos samples BRR, que são áudio ADPCM e, portanto, parecem aleatórios. ✅

### 1.2 Formato das tabelas ✅ (`romaudio.py` lê todas)

- **Blocos de upload `$C0:0190`**: 50 entradas × 3 bytes (ponteiro longo). A entrada 0 é nula. Cada bloco segue o formato IPL: `[tam16][dest16][dados…]`, repetido, e termina com `tam = 0` seguido de uma palavra de "endereço de salto". O jogo envia essa palavra, mas o driver só a usa no boot (`$0800`).
- **Música `$C0:0739`**: 26 × 3 bytes `(bloco, set_de_samples, comando)`. Para os IDs `n = $01…$19` vale sempre `(n, n−1, $01)`.
- **SFX `$C0:0787`**: 50 bytes. O comando na porta 0 é `$32 + id` (`id $01 → $33 … $31 → $63`).
- **Voz/stream `$C0:07B9`**: 21 × 2 bytes `(bloco, comando)`. `id $01…$14 → bloco $1A…$2D`, comando `$64…$77`.
- **Sets de samples** (`$DA:17D2`, 25 entradas × 2 bytes, banco `$DA`). Cada descritor tem este formato:
  - `[ptr16 → lista IPL com DIR+instrumentos]`
  - `[dest16 dos samples]` (sempre `$7C00`, exceto o set `$10`, que usa `$4500`)
  - `[ids de sample…] $FF`

  O sample `s` fica em `long($DA:2118 + 3s)`, com tamanho `word($DA:2238 + 2s)`. Os samples são enviados em sequência a partir de `dest`.

### 1.3 Mapa da RAM do APU com o driver carregado ✅

Medido comparando a RAM do APU do jogo com os blocos da ROM (`romaudio.identify`).

| Faixa | Uso |
|---|---|
| `$0000–$07FF` | Variáveis do driver e pilha |
| `$0780–$2FDA`, `$FF00–$FF49` | Driver (bloco `$31`) |
| `$3100–$42FF` | Banco de SFX (`$2F` na partida, `$30` nos menus) |
| `$4300–$52FF` | Sequência da música atual |
| `$5300–$53FF` / `$5400–$54FF` | DIR (4 B por sample) e tabela de instrumentos. SFX em `$5300–$533F`, música a partir de `$5378`, voz de stream em `$53FC`/`$54FC` |
| `$5500–$6975` | Samples BRR dos SFX (bloco `$2E`) |
| `$6A00–$7BFF` | Área da voz em stream (a voz `$01`, do boot, vai para `$7C00`) |
| `$7C00–…` | Samples BRR da música atual (set `$13` da partida: `$7C00–$F5B5`) |

### 1.4 Protocolo CPU ↔ APU ✅

Lado CPU (banco `$C0`, variáveis na página direta `$D0–$F3`):

| Rotina | O que faz |
|---|---|
| `$C0:029B` entrar no loader | Escreve `$10` na porta 1 em loop até ler `$AA/$BB` nas portas 0/1. Depois `D3 = $CC` |
| `$C0:02F0` + `$0310` enviar bloco | Porta 1 `$FF`, portas 2/3 = destino, porta 0 = `D3` (kick), espera o eco. Depois envia 1 byte por vez: porta 1 = byte, porta 0 = índice (0,1,2…), espera o eco. Ao final, `D3 = índice+1`, e 1 se der 0 |
| `$C0:02BD` fim | Porta 1 = 0, portas 2/3 = palavra final do bloco, porta 0 = `D3` (se `D3 = $AA`, soma 1), espera o eco. `E0 = (D3 & $80) ^ $80` (bit de alternância) |
| `$C0:0416` subir bloco *n* | Faz 029B + 02F0 + 02BD com o ponteiro de `$C0:0190` |
| `$C0:0226` subir set de samples | 029B, envia a lista IPL do descritor e depois cada sample (`$F0 = 1`: mesmo destino corrido) e termina com 02BD. Os 2 bytes finais são lidos logo após o último sample |
| `$C0:0376` boot | Sobe os blocos `$31`, `$2E` e `$2F`. O `LDA #$30` ali não tem efeito (é sobrescrito) |
| `$C0:0394` música *id* | Sobe o bloco, sobe o set e envia o comando pela porta 0 |
| `$C0:071D` comando porta 0 | Escreve `(cmd \| E0) ^ $80` até ler `cmd \| E0` duas vezes. Depois `E0 ^= $80` |
| `$C0:046E` **STOP** | Espera porta 2 = `$AA`. Porta 1 = `$13`, espera `$93`. Porta 1 = `$93`, espera `$13`. Zera SFX e voz pendentes |
| `$C0:0445` **FADE** | Porta 2 = `$7F` (velocidade), porta 1 = `$18`, espera `$98` e porta 2 = `$AA` |
| `$C0:0573` / `$05F3` NMI | Envia a voz em stream. Antes manda o comando `$32` na porta 0. Depois envia pedaços de até 64 bytes: porta 1 = `$31\|E1`, e 2 bytes por handshake nas portas 2/3 com o índice na porta 1. Termina com `$7F`. Ao acabar, envia o comando da voz (`$64+`). Depois envia o SFX pendente (`$E2`) |

Lado APU (driver, desmontado com `spc700dis.py`):

- **Porta 0** (`$0984`): lê a porta 0 até ficar estável. Se mudou, lê as portas 2 e 3 e ecoa `porta0 ^ $80`. Depois compara `cmd & $7F` com o limiar `[$080B] = $32`:
  - abaixo do limiar: comando de música (`$01` = tocar a sequência carregada; as portas 2/3 viram parâmetros);
  - a partir do limiar: efeito número `cmd − $31`, via `CALL $28CF`. Isso cobre os SFX `$33–$63`, as vozes `$64–$77` e o `$32`, que prepara o slot de stream 🟡.
- **Porta 1** (`$099E`): ecoa `porta1 ^ $80` e salta pela tabela `$0A0F` (comandos `$01–$3B`). A maioria termina escrevendo `$AA` nas portas 2 e 3 ("pronto"). Comandos usados pelo jogo:
  - `$10`: para tudo e entra no loader. O loader fica em `$0FF0`, escreve `AA/BB` e espera o `$CC`.
  - `$13`: STOP.
  - `$18`: fade (mais as variantes `$19` e `$1A`).
  - `$26`, `$28`, `$2C` e `$2E`: configuram bases e modos. São enviados só pela sequência `$C3:492F` 🟡.
  - `$30`: loader alternativo.
  - `$31`: recebe um pedaço de stream.

⚠️ **Detalhe de tempo** ✅: no fim de um upload, o driver ecoa a porta 0 e **só depois** lê a porta 1 (`$1037–$103A`). Se a CPU escrever `$10` na porta 1 rápido demais, o driver acha que vem outro bloco e trava em `$100C`. O 65816 real tem folga para isso. No `spchost` coloquei 64 ciclos de SMP após cada handshake final (`CPU_SLACK`). Sem essa folga, reproduzi o travamento.

### 1.5 Camada do jogo (`$C3`) e regras de fila ✅

| API (JSL) | Uso | Call sites |
|---|---|---|
| `$C3:4A44` MÚSICA(A) | STOP (`$C0:046E`) e depois `$C0:0394` | 22 |
| `$C3:4A16` BLOCO(A) | STOP e depois sobe o bloco. Usado para o banco de SFX: `$2F` antes da partida, `$30` antes de menus e telas de resultado | 16 |
| `$C3:4A7F` SFX(A) | Põe o SFX na **fila circular `$7E:A28E`** (64 entradas; cabeça `$C2`, cauda `$C4`) | **167** |
| `$C3:4AAA` | Chamada **1× por frame** (`$C1:09A1`). Tira **um** SFX da fila. Se `$CA ≠ 0`, descarta tudo menos o SFX `$13` | 1 |
| `$C3:4AF9` VOZ(A) | Stream (`$C0:03E1`). É ignorado se já houver stream em andamento | 18 |
| `$C3:49F4` / `$C3:49ED` | STOP e FADE | 3 / 16 |

Consequências para uma reimplementação fiel:

- **No máximo 1 SFX novo por frame** chega ao driver. Uma rajada (por exemplo, 5 explosões no mesmo frame) sai espalhada por 5 frames.
- O stream de voz tem orçamento. Medido em `exp_tempo_1min`: 1 pedaço de 64 bytes por frame e 4 pedaços a cada 4º frame. A voz `$10` (3.285 bytes) leva ≈ 30 frames para começar a tocar ✅. A regra exata do orçamento (`$ED`, `$016A/$0166`) é 🟡.
- **Música e bloco sempre começam com STOP**, o que corta o SFX que estiver tocando. Subir a música `$14` leva **≈ 1,13 s** de APU; o jogo fica parado nesse tempo (tela de transição) ✅.

---

## 2. Músicas do fluxo Battle ✅

Música identificada pela RAM do APU em cada savestate e pelos ganchos em `$C3:4A44`, com o frame medido.

| ID | Bloco / set | Onde toca | Call site | Upload (APU) |
|---|---|---|---|---|
| `$02` | `$02` / `$01` | Intro/história do boot | `$C2:B5EB` | 1,00 s |
| `$01` | `$01` / `$00` | **Título** (também ao voltar da seleção de modo com B) | `$C1:965D` | 0,92 s |
| `$12` | `$12` / `$11` | **Menus do Battle**: modo, jogadores, regras, personagem, fase (`st_b1…st_stage*`) | `$C1:8C7A`, `$C1:9BB3` | 0,90 s |
| `$13` | `$13` / `$12` | Jingle **"BATTLE START!"** | `$C1:A576` | 0,19 s |
| `$14` | `$14` / `$13` | **Partida, nas 10 arenas**. Verifiquei `st_stage00…11`: sempre `$14` | `$C4:02B2` | 1,13 s |
| `$15` | `$15` / `$14` | **SCORE BOARD** (placar de coroas entre rodadas) | `$C2:9147` | 0,03 s |
| `$16` | `$16` / `$15` | **VICTORY!** (última coroa) | `$C2:7F9B` | 0,51 s |
| `$18` | `$18` / `$17` | **DRAW GAME** (tempo esgotado ou todos mortos) | `$C2:D95D` | 0,61 s |
| — | — | **Hurry/pressão**: **não há troca de música** (só SFX `$15` + voz `$10`) | — | — |

Sequências medidas, com o frame relativo ao primeiro evento:

- **Seleção de fase → partida** (`trace_stages.py`):
  - SFX `$02` (0)
  - MÚSICA `$13` (+48)
  - voz `$07` (+208)
  - FADE (+310)
  - bloco `$2F` (+511)
  - MÚSICA `$14` (+523)
- **1:00** (`exp tempo_1min`): SFX `$15` + voz `$10` no mesmo frame. Em seguida vem um SFX `$27` por bloco de pressão (1 a cada ≈ 15 frames).
- **Rodada com vencedor** (`exp vitoria`):
  - SFX `$17`
  - FADE (+97)
  - bloco `$30` (+113)
  - MÚSICA `$15` (+154)
  - na próxima rodada: bloco `$2F` e MÚSICA `$14`, **sem** repetir o `$13`
  - na última coroa: MÚSICA `$16` (+671) e voz `$0A` (+955)
- **Tempo esgotado** (`exp tempo`):
  - STOP em 0:00 (`$C1:14C2`): **o jogo corta a música; não há apito**
  - FADE (+161)
  - bloco `$30` (+218)
  - MÚSICA `$18` (+228)
  - voz `$0E` (+426)
- **Todos mortos** (`st_cp00`): FADE, depois bloco `$30` e MÚSICA `$18`.

---

## 3. Efeitos sonoros e vozes

Método: ganchos de PC em `$C3:4A7F`/`$C3:4AF9` no core próprio, somados a experimentos com o P1 em `st_arena01`/`st_arena05` (`exper.py`). O "call site" é o endereço do `JSL`. O comando enviado é `$32 + ID`. **Os SFX da partida vêm do banco `$2F`; os de menu, do `$30`.**

| ID | Evento | Call site(s) | Status |
|---|---|---|---|
| `$01` | Cursor nos menus: mover opção, trocar valor, fase ou personagem | `$C2:B281/B242/B331/B37B`, `$C1:A524`, `$C3:C17F…` | ✅ |
| `$02` | Confirmar (A ou START em menus e título) | `$C1:9856/99ED/9C19/9D53/9EF5/A54E/B2A2`… | ✅ |
| `$03` | Cancelar/voltar (B) | `$C1:B82B/B85C/B8AE/B8F6/B93C/B9E1`… | ✅ |
| `$04` | Pausar e despausar (START na partida) | `$C1:074F` | ✅ |
| `$07` | **Explosão** (1 por bomba; o bloco destruído e o item queimado não têm som próprio) | `$C1:3EBE` | ✅ |
| `$08` | **Pegar item** (o mesmo som para os 15 IDs testados: 01–0E e 12) | `$C1:6179` | ✅ |
| `$0A` | **Pegar caveira** | `$C1:61AD` | ✅ |
| `$0A` + voz `$04` | Caveira passada de um jogador a outro por contato (X e Y são 2 jogadores) | `$C2:4D34` | 🟡 |
| `$0B` | **Passo**: 1 a cada 20 frames andando (humanos e CPUs) | `$C2:150B` | ✅ |
| `$0C` | **Colocar bomba** | `$C2:50AB` (outro caminho: `$C2:4861`) | ✅ / 🟡 |
| `$0D` | **Chutar bomba** | `$C1:3538` | ✅ |
| `$0D` + voz `$03` | **Soco** (Y) | `$C2:4A38` | ✅ |
| `$0E` + voz `$03` | **Arremessar** com a luva | `$C2:37F6` | ✅ |
| `$0E` | Bomba quicando (sobre casa ocupada) | `$C1:286C` | 🟡 |
| `$0F` | Bomba arremessada ou socada pousa | `$C1:2860` | ✅ (luva, soco) |
| `$10` + voz `$06` | **Morte**. A voz sai 2 frames após a chama atingir o jogador; o SFX `$10`, ≈ 11 frames depois da voz | `$C2:123C`, voz `$C2:1213` | ✅ |
| `$12` + voz `$02` | Jogador atingido na cabeça por bomba arremessada ou socada | `$C2:51F7`, voz `$C2:51C8` | 🟡 |
| `$15` + voz `$10` | **"HURRY!"** em 1:00 (início da pressão) | `$C1:156F`, voz `$C1:1583` | ✅ |
| `$17` | Fim de rodada com vencedor (sobrou 1) | `$C2:0D6A` | ✅ |
| `$1C` | Objeto em arco (sobe e desce), 1 som a cada 16 unidades de altura; visto em partidas de CPU | `$C1:2C55/2C6A` | 🟡 |
| `$27` | **Bloco de pressão** caindo (1 por bloco) | `$C1:71E1` | ✅ |
| `$28` | Cria um objeto a partir de um jogador; visto em partidas de CPU | `$C2:281E` | ❌ evento não identificado |

Outros eventos:

- **Levantar bomba com a luva** e **detonar a bomba remota com B**: não têm SFX próprio. A remota só produz a explosão `$07` ✅.
- **Tempo esgotado**: não há apito (§2) ✅.
- **Não medidos** ❌: regras Sudden Death, Bad Bomber e Racer Bomber ligadas, e os modos Championship e Bombermania.
- IDs com call sites fora do Battle (história e outros modos): `$09`, `$11`, `$13`, `$14`, `$16`, `$18–$1E`, `$20`, `$22`, `$24–$26`, `$2A–$30`. A lista completa de call sites está em `callsites.txt`.

**Vozes (stream)**. A voz toca pelo comando `$63 + id`. **Ela depende do banco de SFX carregado**: as vozes da partida só soam com o `$2F`, e as de tela, com o `$30` ✅ (`vozes_*.wav`).

| Voz | Bloco | Evento | Banco | Status |
|---|---|---|---|---|
| `$01` | `$1A` | Logo HUDSON no boot | `$30` | ✅ |
| `$02` | `$1B` | Jogador atingido por bomba | `$2F` | 🟡 |
| `$03` | `$1C` | Soco ou arremesso | `$2F` | ✅ |
| `$04` | `$1D` | Contágio da caveira (`$C2:4D3C`); também em `$C2:10C4` | `$2F` | 🟡 |
| `$06` | `$1F` | Morte | `$2F` | ✅ |
| `$07` | `$20` | "BATTLE START!" | `$30` | ✅ |
| `$0A` | `$23` | Tela VICTORY | `$30` | ✅ |
| `$0E` | `$27` | DRAW GAME | `$30` | ✅ |
| `$10` | `$29` | "HURRY!" | `$2F` | ✅ |

---

## 4. Viabilidade no navegador

### 4.1 Recomendação: emular só o APU (LLE) e reimplementar o lado CPU em TS

O jogo web não precisa de 65816. Basta:

1. **Núcleo SPC700 + S-DSP** com uma API de portas (`writePort(p, v)`, `readPort(p)`, `run(ciclos)`) e saída de amostras a 32 kHz.
2. **Loader em TS** (≈ 250 linhas; tradução direta do `spchost.cpp`): lê as tabelas da ROM do usuário (§1.2) e reproduz os handshakes (§1.4). Expõe:
   - `boot()`
   - `loadBank($2F|$30)`
   - `playMusic(id)`
   - `sfx(id)` com fila de 1 por frame
   - `voice(id)` com orçamento de stream
   - `stop()` e `fade()`
3. **AudioWorklet** rodando o núcleo. Os handshakes rodam dentro do worklet: o SPC avança em passos de 8 ciclos até a porta responder. O `spchost` gera 60 s de áudio em 0,29 s de CPU nativa (≈ 200× o tempo real), então há folga até em WASM ou JS.
4. **Eventos do jogo → IDs**: tabelas das §2 e §3. Troque o banco `$2F`/`$30` exatamente onde o jogo troca.

Fica fiel porque o próprio driver da Hudson toca as próprias sequências e samples, com os envelopes, o eco, a prioridade de canais e o corte de SFX dele. Nada precisa ser reinterpretado.

Alternativa HLE (interpretar o formato de sequência da Hudson e tocar com WebAudio): exige engenharia reversa do formato e dos efeitos do driver (vibrato, envelopes, eco, prioridades). Seriam 3–5 semanas, com fidelidade menor. **Não recomendo.**

### 4.2 Opções de núcleo e licenças

| Opção | Conteúdo | Licença | Observação |
|---|---|---|---|
| **blargg `snes_spc` 0.9.0** | SNES_SPC (CPU, timers, IPL) + SPC_DSP, ≈ 3,5 mil linhas C++, API de portas com carimbo de tempo | **LGPL-2.1+** (o cabeçalho do `SPC_DSP.cpp` foi confirmado localmente; o pacote inteiro, de memória 🟡) | **Recomendado.** Em WASM, deixe-o como módulo separado e substituível e publique o fonte e o aviso da LGPL |
| Game_Music_Emu (libgme) | Inclui o snes_spc | LGPL-2.1+ 🟡 | A API pública só toca `.spc` (sem portas). Útil apenas para tocar `.spc` pré-gerados |
| snes9x `apu/bapu` (usado no PoC) | SMP do byuu + SPC_DSP do blargg | **Licença Snes9x: só uso não comercial** ✅ (`LICENSE` local) | Bom para testes internos; **evitar** em produto público |
| ares (SFC SMP/DSP) | C++ moderno, preciso | ISC 🟡 (de memória) | Permissiva. Boa alternativa se a LGPL incomodar |
| bsnes/higan | C++ | GPLv3 🟡 | Copyleft contaminaria o app inteiro |
| Portar o snes_spc para TS | — | Obra derivada: continua LGPL | Atende a "TS puro". Dá 4–6 dias a mais que o WASM |

Não verifiquei as licenças online (sem internet). Os itens marcados 🟡 precisam ser conferidos antes de publicar. **Os dados (driver, sequências e samples) vêm sempre da ROM do usuário, em tempo de execução**, e nada é redistribuído.

### 4.3 Estimativa

| Tarefa | Dias |
|---|---|
| Compilar o snes_spc em WASM (emscripten) e a cola JS com a API de portas | 1–2 |
| Loader TS (tabelas + handshakes + fila + stream), portado do `spchost.cpp` | 1–1,5 |
| AudioWorklet e reamostragem de 32 kHz para a taxa do contexto | 1–2 |
| Ligar os eventos do jogo (§2/§3), troca de banco e transições | 1–2 |
| Testes automáticos: RAM do APU após cada carga = bytes da ROM (§5); WAV de referência | 1–1,5 |
| **Total com WASM** | **≈ 6–9** |
| Total com porte do SPC para TS | ≈ 10–14 |

Cuidados medidos:

- a folga de tempo depois dos handshakes (§1.4);
- o STOP antes de cada música ou bloco;
- 1 SFX por frame;
- o orçamento do stream;
- o atraso real de ≈ 1,1 s para a música `$14` começar;
- trocar o banco `$2F`/`$30`, senão as vozes ficam mudas.

---

## 5. Prova de conceito offline ✅

`spchost.cpp` é um host C++ ligado ao SMP e ao DSP do snes9x (`bapu`), **sem 65816**. Ele implementa as rotinas `$C0:0226–$C0:072F` e `$C3:49xx` e aceita um script: `init; blk 2F; mus 14; sfx 07; stream 10; stop; fade; frames N; rec; spc; loadspc`.

Resultados:

- **RAM do APU**: depois de `init; blk 2F; mus 14`, o `spchost` e o jogo em `st_arena01` coincidem byte a byte:
  - driver: 10.075 + 220 bytes
  - bloco `$2E`: 5.366
  - banco `$2F`: 4.515
  - sequência `$14`: 4.064
  - DIR e instrumentos: 144
  - **samples BRR: 31.158 (zero diferenças)**

  Os 2.907 bytes que diferem na RAM inteira são variáveis do driver, pilha e buffer de eco ✅.
- **Áudio × jogo real** (`compara_jogo.py` grava 32 s do snes9x completo a partir do pedido da `$14`; `compara_amostras.py` alinha por correlação cruzada no nível de amostra):
  - o atraso fica **constante em +1.291 ms** em t = 1, 5, 10, 15, 20 e 25 s, ou seja, mesmas notas e mesmo andamento;
  - r vai de 0,85 a **0,99999**, com diferença média de 4,7 em amplitude ≈ 1.567 em t = 20 s ✅;
  - as diferenças fora desses trechos vêm do estado anterior (eco da música anterior, fase do gerador de ruído do DSP, com NON = `$53`, e fase do tick do driver) 🟡.
- **O atraso até a música começar varia 170–300 ms** conforme o histórico do APU (fase do tick do driver) 🟡. No jogo, a música começa ≈ 1,29 s após o pedido.
- **`.spc`**: gerados pelo `SMP::save_spc` (formato padrão v0.30). O teste `loadspc mus_14_batalha.spc` toca a mesma música, com atraso constante de −45 ms em 20 s ✅.
- **Arquivos** (`analise/extraido/audio/`, 43 MB, fora do git):
  - músicas: `mus_01_titulo`, `mus_12_menus`, `mus_13_battle_start`, `mus_14_batalha` (60 s), `mus_15_placar`, `mus_16_vitoria`, `mus_18_empate`, cada uma em `.spc` + `.wav` (32 kHz estéreo);
  - efeitos e vozes: `sfx_batalha.wav` (16 SFX, na ordem da `gera_poc.py`), `sfx_menu.wav`, `vozes_batalha.wav`, `vozes_menu.wav`;
  - referência: `jogo_battle_14.wav` (gravado do jogo).

---

## 6. Em aberto

- ❌ SFX `$28` (evento), `$1C` e o contexto exato de `$0E` (quique) e `$12` (atingido): falta confirmação visual.
- ❌ Áudio com Sudden Death, Bad Bomber e Racer Bomber ligados, e nos modos Championship e Bombermania.
- 🟡 Semântica completa dos comandos da porta 1 `$26/$28/$2C/$2E` (sequência `$C3:492F`, 2 call sites, não disparada no Battle) e dos parâmetros das portas 2/3 nos comandos da porta 0. O jogo não os escreve para SFX; ficam os valores anteriores, e o host reproduz isso naturalmente.
- 🟡 Regra exata do orçamento de stream (`$ED`, `$016A/$0166`).
- Não fiz a desmontagem completa do formato de sequência. Ela não é necessária no plano LLE.

---

## 7. Como reproduzir

Python: `/private/tmp/claude-501/-Users-dlotuz-Projetos-Claude-Bomber-Project/189281cc-52ae-4614-9c45-1f93ec4bdecb/scratchpad/venv/bin/python` (chamado de `PY` abaixo). Rode tudo a partir de `analise/investigacao/audio/`.

1. **Core com rastreio**: copiei o snes9x para `scratchpad/rom-audio/snes9x` e apliquei `snes9x_trace.patch`, que acrescenta:
   - log `W frame PC porta valor` nas escritas em `$2140–3`;
   - log `H frame PC A X Y P ret` em PCs escolhidos;
   - as funções exportadas `aud_set_log`, `aud_add_hook`, `aud_spc_dump`, `aud_apuram` e `aud_dsp_read`.

   Para compilar: `cd scratchpad/rom-audio/snes9x/libretro && make`. O `aemu.py` usa esse core (via `SNES9X_CORE`) e captura o áudio.
2. Ferramentas estáticas:
   - `PY callsites.py > callsites.txt`: call sites e IDs imediatos;
   - `romaudio.py`: leitor das tabelas;
   - `spc700dis.py`: desmontagem do driver, por exemplo `dis(ram, 0x0984, 60)`.
3. Traços dinâmicos:
   - `PY trace_stages.py`: música das 10 arenas;
   - `PY trace_match.py st_cp00 11500 250`: partida entre CPUs;
   - `PY run_exp.py <exp>` com `<exp>` ∈ {bomba, morte, item, itens_todos, pause, chute2, soco2, luva2, remota, caveira, andar, explosao_sobrevive, bloco, morte_itens, item_queima, tempo, tempo_1min, vitoria, menu_st_title, menu_st_b1, menu_st_c0, menu_st_c1, menu_st_rules, menu_st_c3, menu_st_stage00}.
4. PoC:
   - `./build_spchost.sh` compila `scratchpad/rom-audio/spchost/spchost`;
   - `PY gera_poc.py` gera todos os `.spc` e `.wav`;
   - para um caso avulso: `spchost "<rom>" saida.wav saida.spc "init; blk 2F; mus 14; frames 2; spc; rec; frames 3600"`.
5. Validação:
   - `PY compara_jogo.py` grava `jogo_battle_14.wav` do jogo;
   - `PY compara_amostras.py jogo_battle_14.wav mus_14_batalha.wav 1,5,10,15,20,25`;
   - para a igualdade da RAM, veja o trecho em §5 (`romaudio.block`/`sample_set` comparados com `AEmu.apuram()` em `st_arena01`).
