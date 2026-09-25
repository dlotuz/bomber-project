# Super Bomberman 4 + Scripts do "Crown Cup": análise completa

> Método: análise estática da ROM (cabeçalho, strings, entropia, disassembler 65816 próprio) e **análise dinâmica**. Rodei a ROM num emulador snes9x sem interface (libretro via Python), naveguei pelos menus, joguei partidas com 5 humanos e com 5 CPUs e li e escrevi na WRAM para validar cada endereço usado pelos scripts.
> Marcações: ✅ = verificado no emulador · 🟡 = inferido e não confirmado.

---

## 1. Resumo

| Arquivo | O que é |
|---|---|
| `Super Bomberman 4 (USA).sfc` | ROM de SNES do **Super Bomberman 4** (Hudson Soft, 1996). É o jogo **japonês** com **patch de tradução em inglês** e ROM expandida. Nunca houve lançamento oficial nos EUA. |
| `scripts.zip` | 2 scripts **Lua para o BizHawk**. (1) embaralha os spawns dos 5 jogadores a cada rodada; (2) envia o placar final por **webhook** para `crown-cup-champions.lovable.app` quando alguém chega a 5 vitórias. |

Juntos, os dois arquivos descrevem um **sistema de torneio**: Battle Mode com 5 jogadores (multitap), partidas "melhor de 5 coroas", spawns aleatórios para ser justo e resultado enviado automaticamente para um site.

---

## 2. A ROM

### 2.1 Identificação ✅
| Campo | Valor |
|---|---|
| Tamanho do arquivo | 4.194.304 bytes (32 Mbit), sem header de copiadora |
| CRC32 / MD5 / SHA-1 | `4DC7D0D3` / `390fbd3349b4b763dbc365dab718f9cb` / `38f4394986bd39fcbe32a722a3fe103ee6177d9b` |
| Título interno | `SUPER BOMBERMAN 4` |
| Mapeamento | **HiROM + FastROM** (`$31`) |
| ROM size declarado | `$0C` = 32 Mbit |
| SRAM | nenhuma (o modo história usa password) |
| Região | `$00` = **Japão** |
| Maker / Game code | `$33` → ext. `18` = **Hudson Soft** / `A4BJ` |
| Versão | 1.0 |
| Checksum | `$B460` (complemento `$4B9F`), **válido** (o patch recalculou) |
| Vetores | RESET `$00:F074`, NMI `$00:F001`, IRQ `$00:F04D` |

### 2.2 Evidências do hack/tradução ✅
- Os dados vão até o offset `0x228E20` (≈2,16 MB). O resto até 4 MB é `0xFF`, ou seja, a ROM foi **expandida**.
- Há **código novo em `$E0–$E2`** (área expandida) com trampolins típicos de patch, por exemplo `JSL $E1FF7F / JSL $E1330E / JML $C4096B`. O código original tem dezenas de `JSL/JML/LDA long` apontando para `$E0–$E2`.
- Os menus e a seleção de fase estão em **inglês com localização criativa** ("Orb-ital Bombardment", "Sartorial Shenanigans"). Isso é típico de fan-translation.

### 2.3 Strings e componentes ✅
- `NINTENDO SHVC MULTI5 BIOS Ver2.10` e `MULTI5 CONNECT CHECK Ver1.00`: suporte ao **Super Multitap**, até **5 jogadores**.
- `SFX SOUND DRIVER Ver 2.28 ,(C)1993-95 Hudson Soft, Program : LU.Iwabuchi, Driver : Kazumi-TYPE`: driver de som (SPC700) da Hudson.
- **Menu de debug escondido**, com data de build **`96-02-29 21:38`**: `PARAMETER / EXIT / WHO'S PRM / FIRE LEV / BOMBCOUNT / BOMBTYPE / SPEED / PASS BOMB / PASS WALL / PASS16SEC / STOP TIME / PUSH / PUNCH / KICK / POW GLOVE / HEART / NODEATH`. É a lista oficial de atributos e habilidades do jogador (offset `0x46E69`).
- Mapa de entropia: bancos `$D9–$DD` têm entropia ≈7,4 (dados comprimidos ou samples de áudio BRR). Os demais misturam código, tiles e tabelas.

---

## 3. Fluxo de menus (Battle) ✅

```
Intro (história) → Logo Hudson → Título
  START → [NORMAL GAME | BATTLE GAME | PASSWORD]
  BATTLE GAME → "Select a VS mode!" [Battle Royale | Championship | Bombermania]
    Battle Royale → [Free-for-All | Team Battle]
      → "Decide on the players!"  1º..5º Player: Human / CPU   (LEFT alterna, DOWN move, A confirma)
      → "Configure the rules!"
      → "Select a character!"     (grade 3×2, 6 personagens)
      → "Select a stage!"         (LEFT/RIGHT, 10 fases)  → "BATTLE START!"
      → rodada → Score Board (coroas) → ... → 5ª coroa → Score Board → "VICTORY!" (troféu) → volta a "Select a stage!"
```

### Opções de regra ✅
| Regra | Valores |
|---|---|
| CPU Level | Low · **Normal** · Strong |
| Matches (coroas para vencer) | 1 · 2 · **3** · 4 · 5 |
| Time | 1:00 · 2:00 · **3:00** · 5:00 · ∞ |
| Sudden Death | **Off** · On |
| Bad Bomber | **Off** · On |
| Racer Bomber | **Off** · On |

(em negrito = padrão). **Para o webhook funcionar, Matches precisa estar em 5** (veja §7).

---

## 4. Fases de batalha ✅

| # | Nome (tradução) | Soft blocks | Observações (layout lógico em `layouts_arenas.txt`) |
|---|---|---|---|
| 1 | The Classic | 80 | Arena padrão |
| 2 | Fast 'n' Slow | 80 | Mesmo layout base; piso com zonas especiais 🟡 |
| 3 | Orb-ital Bombardment | 80 | Tem objetos especiais no centro (código `410F`) |
| 4 | Don't Push Me | 70 | Blocos fixos extras (buracos/paredes nas laterais e no centro) |
| 5 | School of Hard Shocks | **0** | Sem blocos. **Todos começam fortes**: 5 bombas, fogo 6, soco, luva, chute e "P" |
| 6 | Totally Floored | 80 | Layout base; piso especial 🟡 |
| 7 | Hide and Blow Seek | 62 | Arbustos/esconderijos (código `4000`) |
| 8 | Spinny Slots | **0** | Caça-níquel; 3 casas especiais (`000C`) |
| 9 | Seesaw Yeehaw | 78 | Gangorras (lançam jogadores) 🟡 |
| 10 | Sartorial Shenanigans | 80 | Layout base com tema próprio |

- **Grid de 13×11 casas**, com pilares fixos nas posições (ímpar, ímpar) do padrão clássico.
- **O layout de soft blocks é fixo por fase.** Testei com 4 tempos de início diferentes e o resultado foi sempre idêntico. Os **itens escondidos** são sorteados.
- Veja `arenas/arena_01..10.png` e `telas/selecao_de_fases.png`.

---

## 5. Mecânicas medidas no emulador

### 5.1 Coordenadas ✅
- Posição do jogador = **centro da casa** em pixels: `X = 16·col`, `Y = 16·(linha+2)`.
- Área jogável: `X ∈ {32, 48, …, 224}` (13 colunas), `Y ∈ {48, 64, …, 208}` (11 linhas).
- **Spawns padrão** (P1…P5): `(32,48)`, `(224,208)`, `(224,48)`, `(32,208)`, `(128,128)`. No primeiro frame da rodada o jogo ajusta as posições para `(32,48) (223,207) (223,48) (32,207) (127,128)`. Esses são exatamente os valores do script.

### 5.2 Status iniciais ✅
| Atributo | Padrão | Fase 5 |
|---|---|---|
| Velocidade (nível) | 1 | 1 |
| Bombas | 1 | 5 |
| Fogo (nível) | 0 → **alcance 2 casas** | 4 → alcance 6 |
| Soco / Luva / Chute / "P" | não | sim |

### 5.3 Números ✅
- **Pavio da bomba: 128 frames** (≈2,13 s), sempre igual.
- **Chama visível: ≈33 frames.**
- **Alcance da chama = nível de fogo + 2** casas em cada direção (fogo 0 → 2 … fogo 8 → 10).
- **Velocidade de andar** (px por segundo, 60 fps): nível 1 = 60 (1 px/frame). Cada nível soma **7,5 px/s (⅛ px/frame)**: 2 = 68, 3 = 75, 4 = 83, 5 = 90. Os níveis 0 e 6 a 8 são valores fora do normal (provavelmente efeitos de caveira).
- **Morte → contador de vivos (`$1EA0`) cai ≈78 frames depois** da chama atingir o jogador, após a animação de morte.
- **Blocos de pressão** caem em espiral de fora para dentro a partir de ≈1:00 restante. Observado com Sudden Death = Off.
- **Tempo esgotado ou todos mortos → "DRAW GAME"**: ninguém ganha coroa e a tela espera um botão.

### 5.4 Controles ✅
| Botão | Ação |
|---|---|
| D-pad | Andar |
| **A** | Colocar bomba. Com a Luva, **segurar A sobre a bomba** levanta a bomba |
| **B** | Detonar (com Bomba Remota) |
| **Y** | Socar a bomba à frente (com o item Soco) |
| START | Pausa e confirmação em menus |

### 5.5 Itens ✅
| ID lógico | Tile visual | Item | Efeito na RAM do jogador | Aparece no Battle? |
|---|---|---|---|---|
| `01` | `80` | **Bomb Up** | `+41` e `+42` +1 | sim |
| `03` | `82` | **Fire Up** | `+44` +1 | sim |
| `05` | `A2` | **Patins (Speed)** | `+40` +1 | sim |
| `07` | `A6` | **Luva (Power Glove)**: carrega e arremessa | `+49 = FF` | sim |
| `0D` | `EC` | **Soco (Punch)** | `+48 = FF` | sim |
| `0E` | `A4` | **Chute (Kick)** 🟡 comportamento não reproduzido | `+4A = FF` | sim |
| `12` | `A8` | **"P"** 🟡 função exata não identificada | `+D8 = FF` | sim |
| `21/23/26/2B` (+`$80`) | `8A` | **Caveira**: 4 doenças diferentes | `+4D` = tipo, `+4E` = tempo | sim |
| `02` | – | Tipo de bomba 2 🟡 | `+43 = 2` | não visto |
| `06` | – | **Bomba remota** | `+43 = 1` (B detona) | não visto |
| `04` | – | ? | `+E3 = FF` | não visto |
| `08` | – | Timer de 489 frames (invencibilidade? 🟡) | `+96 = 0x01E9` | não visto |
| `09` | – | ? | `+47 = FF` | não visto |
| `0A` | – | **Atravessa soft blocks** | `+4B = FF` | não visto |
| `0B` | – | **Atravessa bombas** | `+4C = FF` | não visto |
| `0C` | – | **Para o tempo** (global, 1003 frames) | `$1ECC = 0x03EB` | não visto |
| `13–1A` | – | Itens de pontos do modo história | `$1EE6` = 200/800/8000/2000/1000/400/1000/1200 | não |

Em ≈45 min de partidas entre CPUs, a frequência relativa (amostras por tempo em tela) foi: Bomba > Fogo > Patins ≈ Chute > Caveira > Soco ≈ P ≈ Luva.

### 5.6 Personagens ✅
Há 6 personagens na grade de seleção: **Bomberman branco** e mais 5 bombers com visual próprio (ciborgue de monóculo, felino laranja, cavaleiro alado, bomber verde blindado e bomber vermelho/roxo). Veja `telas/personagens.png`. Os nomes oficiais não aparecem nos menus.

---

## 6. Mapa de RAM (WRAM `$7E0000`, domínio "WRAM" do BizHawk)

| Endereço | Tam. | Significado | Status |
|---|---|---|---|
| `$0300 + n·$100` (n = 0..4) | $100 | **Objeto do jogador P(n+1)** | ✅ |
| ` +$00` | 3 | Ponteiro da rotina (`$C2141C` = vivo/normal; muda na morte) | ✅ |
| ` +$12` | 2 | **X** (pixel, centro) | ✅ |
| ` +$16` | 2 | **Y** (pixel, centro) | ✅ |
| ` +$26` | 2 | Cópia de Y (ordenação de sprites) | 🟡 |
| ` +$20 / +$22` | 1 | Índice do jogador | ✅ |
| ` +$40` | 1 | Nível de velocidade | ✅ |
| ` +$41 / +$42` | 1 | Capacidade de bombas / bombas disponíveis | ✅ |
| ` +$43` | 1 | Tipo de bomba (0 normal, 1 remota, 2 = ?) | ✅/🟡 |
| ` +$44` | 1 | Nível de fogo (alcance = valor + 2) | ✅ |
| ` +$47` | 1 | Flag (item 09) | 🟡 |
| ` +$48` | 1 | Soco | ✅ |
| ` +$49` | 1 | Luva (carregar) | ✅ |
| ` +$4A` | 1 | Chute | 🟡 |
| ` +$4B` | 1 | Atravessa soft blocks | ✅ |
| ` +$4C` | 1 | Atravessa bombas | ✅ |
| ` +$4D / +$4E` | 1 | Doença da caveira: tipo / tempo | ✅ |
| ` +$96` | 2 | Timer do item 08 | 🟡 |
| ` +$D8` | 1 | Item "P" | ✅ (existe) |
| `$1EA0` | 1 | **Humanos vivos** (CPUs não contam; `$FF` se não há humanos) | ✅ |
| `$1ECC` | 2 | Timer de "stop time" | ✅ |
| `$1ECE` | 1 | Frames do relógio (60 → 0) | ✅ |
| `$1ED0` | 1 | **Segundos** | ✅ |
| `$1ED2` | 1 | **Minutos** | ✅ |
| `$1EE6` | 2 | Pontos (modo história) | ✅ |
| `$1F34,36,38,3A,3C` | 2 cada | **Coroas (vitórias) de P1…P5**; só o byte baixo é usado | ✅ |
| `$2000` | 14×$40 | **Grid visual** (2 bytes por casa): `$2000 + linha·$40 + col·2` | ✅ |
| `$2800` | 14×$40 | **Grid lógico** (mesmo layout) | ✅ |
| `$3000` | – | Timers das chamas | 🟡 |
| `$3800` | – | Piso base (cópia sem blocos) | ✅ |

Códigos do grid lógico `$2800` (byte baixo, byte alto):
`00 00` vazio · `40 EC` bloco fixo ou parede · `80 CC` soft block · `00 C9` bomba · `02 10` chama · `4x 09` item de ID x · `Ax 09` caveira.

Fórmula da casa a partir da posição: `col = X/16`, `linha = Y/16 − 2`, `endereço = $2000 (ou $2800) + linha·$40 + col·2`.

---

## 7. Os scripts Lua (BizHawk)

### 7.1 `bomberman_random_spawn.lua`
**O que faz:** a cada frame lê `$1EA0`. Quando o valor **sobe** (início de rodada), embaralha (Fisher-Yates) os 5 spawns padrão e escreve X/Y em `$0312/$0316 … $0712/$0716`.

**Validação no emulador ✅**
- Os endereços de X/Y e os 5 valores de spawn estão corretos.
- O valor de `$1EA0` sobe de 0 para N ainda durante o fade preto do início da rodada. As posições escritas **persistem** (conferido 200 frames depois) e a troca fica invisível para os jogadores. Veja `telas/teste_spawn_aleatorio.png`.

**Limitações e riscos**
1. `$1EA0` conta **só humanos**. Com todos em CPU o valor fica em `$FF` e o script nunca dispara. Num jogo misto ele dispara pela quantidade de humanos.
2. O script sempre embaralha **5 slots**. Com menos jogadores, alguém pode ir para o centro (posição mais exposta) ou para um slot vazio.
3. Se o script for carregado no meio de uma rodada, essa rodada não é embaralhada. Isso é esperado.
4. Só escreve X/Y. A direção inicial e a cópia `+26` não são ajustadas. Na prática não causou problema visual.

### 7.2 `script_enviar_webhook_apos_5.lua`
**O que faz:** lê as 5 coroas (`$1F34…$1F3C`). Quando **alguma é exatamente 5** e o placar mudou em relação ao último envio, grava `payload.json` e roda `start /b curl -X POST https://crown-cup-champions.lovable.app/api/public/match-result` com `{"p1":..,"p2":..,"p3":..,"p4":..,"p5":..}`.

**Validação no emulador ✅**
- Os endereços de coroas estão certos e incrementam no fade preto logo após a rodada.
- Depois da 5ª coroa: Score Board (≈9 s) → "VICTORY!", que espera um botão. **Os contadores zeram** ao sair para "Select a stage!" (≈400 frames depois do 5 na minha automação).

**Bugs e riscos**
1. **Só funciona com `Matches = 5`.** Com 1 a 4 o valor 5 nunca aparece e nada é enviado.
2. **Um placar final repetido não é enviado.** `ultimo` guarda o placar da partida anterior e não é limpo quando os contadores voltam a 0. Se duas partidas seguidas terminarem com o mesmo placar (ex.: `5,2,0,1,3`), a segunda é ignorada. Correção: usar um estado "armado", que só dispara quando está armado e é rearmado quando todas as coroas voltam a 0.
3. **Só funciona no Windows** (`start /b`). `payload.json` é gravado na pasta atual do BizHawk, sem retry e sem conferir o código HTTP.
4. **Segurança:** o endpoint é `/api/public/…` **sem autenticação**. Qualquer pessoa pode mandar um resultado falso. Recomendo um segredo compartilhado (header ou HMAC do corpo).
5. **Falta contexto no payload:** não há id de partida, horário, fase, personagens, nomes dos jogadores ou modo (FFA/Team). O servidor não tem como diferenciar partidas.
6. O script lê 16 bits, mas o jogo só usa o byte baixo. Não causa erro.

---

## 8. Para a recriação

- **Regras do torneio:** Battle Royale Free-for-All, 5 jogadores, Matches = 5 (primeiro a 5 coroas), Time 3:00 (padrão), spawns aleatórios entre os 5 pontos padrão.
- **Constantes de gameplay:** grid 13×11 de 16 px, pavio de 128 frames, chama de ≈33 frames, alcance fogo+2, velocidade 1 px/frame +⅛ por nível, status iniciais 1 bomba / alcance 2 / velocidade 1, blocos de pressão em espiral a partir de ≈1:00, empate se ninguém sobrar.
- **Mapas:** layouts exatos das 10 fases em `layouts_arenas.txt` (`#` fixo, `x` soft, `.` vazio).
- **Itens do Battle:** Bomba, Fogo, Patins, Chute, Soco, Luva, "P" e Caveira (4 doenças).
- **Arte e áudio** são propriedade da Hudson/Konami. Para algo público, use arte própria inspirada no jogo.

### Pontos em aberto (dá para investigar mais com as ferramentas)
- Função exata do item "P" (`+D8`), do Chute (`+4A`), dos itens 02, 04, 08 e 09, e o que cada caveira faz.
- Efeito real das opções Sudden Death, Bad Bomber e Racer Bomber, e as mecânicas especiais de cada fase (gangorras, caça-níquel, piso).
- Tabela de probabilidade dos itens escondidos e contagem por fase.
- Modos Championship e Bombermania.

---

## 9. Arquivos gerados

```
analise/
  ANALISE_COMPLETA.md      ← este documento
  layouts_arenas.txt       ← grid lógico das 10 fases
  arenas/                  ← screenshot de cada fase em jogo + mosaico
  telas/                   ← título, menus, opções, personagens, itens, placar, VICTORY, teste de spawn
  ferramentas/
    emu.py                 ← frontend libretro headless (Python/ctypes): rodar, apertar botões, ler e escrever WRAM, savestates, screenshots
    dis65816.py            ← disassembler 65816 (HiROM) com rastreio de M/X
    nav.py                 ← utilitário de mosaico de screenshots
```
Para usar `emu.py`, compile o core `snes9x_libretro.dylib` (`git clone snes9x && make -C libretro platform=osx`) e aponte a variável `SNES9X_CORE` para ele. O Python precisa de `pillow` para as screenshots.
