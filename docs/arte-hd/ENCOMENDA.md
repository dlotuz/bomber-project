# Lista de encomenda — arte HD do Crown Blast

> Gerado por `web/scripts/arte-hd/encomenda.ts` a partir de `web/src/render/hdart/catalog.ts`. Não edite à mão:
> mude o catálogo e rode `cd web && node scripts/arte-hd/encomenda.ts`.
> Ritmo (quadros e ticks) medido nas tabelas de animação do jogo original (ROM SHA-1 `38f4394986bd…`); só números, nenhum pixel.

O Crown Blast é uma recriação do modo Battle de um jogo de bombas para Super Nintendo. Esta lista é tudo o que a
partida pode desenhar com o **pacote de arte HD**: arte nova, desenhada na resolução da tela, que substitui o
desenho do jogo elemento por elemento.

## Atenção: a arte tem de ser ORIGINAL

- **Personagens novos.** Não redesenhe, não decalque e não "atualize" os personagens, montarias, itens ou cenários do
  Super Bomberman 4 (nem de outro jogo da série). Nada de capacete com antena-bolinha, rostos, roupas ou cores que
  lembrem os originais. As vagas abaixo têm nomes provisórios do Crown Blast; você pode propor outros.
- **Montarias novas**: cada uma precisa "contar" a habilidade dela (descrita na lista), com visual próprio.
- **Itens**: ícones novos e legíveis; não copie os ícones originais.
- **Arenas**: tema próprio para cada uma das 10, guiado pelo nome e pela mecânica, não pelo cenário original.
- Nunca use sprites, prints ou recortes do jogo original como base, nem como "referência por baixo".
- O `pacote.json` exige `credits` (autoria) e `license` (licença) preenchidos: sem isso o validador reprova o pacote.

## Resumo: quantos desenhos

| Grupo | Total | Essencial para jogar | Bom ter | Raro |
|---|---:|---:|---:|---:|
| Personagens | 468 | 228 | 240 | 0 |
| Cavaleiros (montados) | 24 | 0 | 24 | 0 |
| Trajes (arena 10) | 64 | 0 | 64 | 0 |
| Montarias | 156 | 0 | 56 | 100 |
| Ovos | 13 | 7 | 0 | 6 |
| Bombas | 3 | 1 | 2 | 0 |
| Chamas | 7 | 7 | 0 | 0 |
| Itens | 30 | 10 | 5 | 15 |
| Arenas | 92 | 71 | 18 | 3 |
| Placar (HUD) | 26 | 25 | 1 | 0 |
| Efeitos | 13 | 0 | 12 | 1 |
| **Total** | **896** | **349** | **422** | **125** |

"Desenho" = uma chave do pacote (uma animação). Muitas animações reaproveitam o mesmo desenho (a coluna *Quadros*
diz quantos desenhos diferentes o original usa), e um quadro pode repetir o mesmo recorte da imagem.

- **Essencial para jogar**: aparece em quase toda partida (comece por aqui).
- **Bom ter**: aparece com certas regras, arenas, itens ou montarias.
- **Raro**: só com a senha das montarias extras, variações que o original desenha igual, ou casos de canto.

O pacote pode ser **parcial**: o que não estiver nele continua vindo do desenho atual do jogo.

## Escala, tamanho e ponto de apoio

- **64 px por casa** do campo (o campo tem 13 × 11 casas; uma casa do original tem 16 px, então tudo é 4×).
  Os tamanhos abaixo já estão nessa escala. Se usar outra escala, declare em `cell` e mude tudo na mesma proporção.
- **Ponto de apoio** (`anchor`): o pixel do quadro que vai exatamente no ponto do jogo.
  - Personagens, cavaleiros, trajes e montarias: o **centro da sombra sob os pés** (o ponto em que o desenho toca o
    chão), não o centro do quadro. O jogo alinha esse ponto 9 px do original (36 px nesta escala) abaixo do
    centro da casa. Personagem: quadro 96×128 com apoio (48, 108); montaria: 128×128 com apoio (64, 108).
    O corpo pode passar da casa para cima; o cavaleiro usa o mesmo apoio no chão e é desenhado já na altura do assento.
  - Bombas, chamas, itens, ovos, peças de arena e efeitos: o **centro da casa**.
  - Placar (HUD): o canto de cima à esquerda.
- Cada quadro pode ter o seu próprio apoio: use isso para o pulo (montar, ser largado) subir e descer sem desenhar
  o personagem em posições diferentes da folha.
- Peças de arena (`stage/<n>/floor`, `hard`, `wall`, `soft`…) têm de ter exatamente uma casa e encaixar lado a lado
  sem emenda. A gangorra (arena 9) ocupa 3 casas.

## Ritmo (quadros e ticks)

- O jogo roda a **60 ticks por segundo**. `ticks` é a duração de cada quadro em ticks (12 ticks = 0,2 s).
- Os números recomendados vêm do ritmo do original, para a animação casar com o jogo (passos, pavio, chama).
- Pode usar mais quadros para ficar mais suave, desde que a **soma dos ticks** (o total entre parênteses) fique igual.
- **Loop**: `sim` repete; `não` para no último quadro (derrota, chama, bloco queimando, montar/desmontar).
- "parado" = 1 quadro só.

## Regras de estilo

- Fundo **transparente** (PNG ou WebP com alfa). Sem sombra projetada no chão: o jogo já desenha sombras suaves.
- Vista de cima, levemente inclinada (vemos o topo e a frente das coisas), luz vindo de cima à esquerda.
- **Legibilidade antes de detalhe**: num relance tem de dar para distinguir bomba, item, bloco destrutível, pilar e
  chama. Bloco destrutível e pilar indestrutível precisam ser bem diferentes entre si em todas as arenas.
- Até 5 jogadores podem usar o mesmo personagem: silhueta e rosto bem legíveis; evite depender só da cor.
- Itens: ícone central forte sobre uma placa de fundo; eles piscam (2 quadros: normal e realçado).
- Chama: 3 desenhos por peça (forte, média, fraca) que o jogo alterna; as peças precisam emendar umas nas outras
  (centro + braços + pontas formam uma cruz contínua).
- A moita da arena 7 fica **por cima** de tudo: use transparência/frestas para o jogador perceber algo embaixo.
- Montarias: desenhe a montaria **sem** o cavaleiro; o cavaleiro (`rider/…`) é desenhado por cima, na altura do assento.

## Formato do pacote

Uma pasta com `pacote.json` na raiz e as imagens (PNG ou WebP) ao lado (subpastas valem):

```json
{
  "format": 1, "name": "meu-pacote", "credits": "Fulana de Tal", "license": "CC BY 4.0", "cell": 64,
  "images": { "personagem-0": "personagem-0.png" },
  "anims": {
    "char/0/walk/down": {
      "frames": [
        { "img": "personagem-0", "rect": [0, 0, 96, 128], "anchor": [48, 108] },
        { "img": "personagem-0", "rect": [96, 0, 96, 128], "anchor": [48, 108] },
        { "img": "personagem-0", "rect": [0, 0, 96, 128], "anchor": [48, 108] },
        { "img": "personagem-0", "rect": [192, 0, 96, 128], "anchor": [48, 108] }
      ],
      "ticks": [12, 8, 12, 8], "loop": true
    }
  }
}
```

- `images`: apelido → arquivo (relativo à pasta). `rect`: `[x, y, largura, altura]` do quadro na imagem.
- `anchor`: ponto de apoio, em px **dentro do recorte**. `ticks`: um valor por quadro, inteiros > 0.
- `docs/arte-hd/pacote-modelo.json` traz **todas** as chaves já com os quadros, apoios e ticks recomendados, numa
  folha por personagem, por montaria e por arena (e uma por grupo no resto). Dá para desenhar direto nessas folhas
  ou reorganizar à vontade: só valem os recortes do `pacote.json`.

## Como testar

1. Copie a pasta do pacote para `web/public/arte/<nome>/` (fica `web/public/arte/<nome>/pacote.json`).
2. Confira o pacote: `cd web && node scripts/arte-hd/validar.ts public/arte/<nome>` (use `--tudo` para listar tudo o
   que falta). O relatório mostra erros (recorte fora da imagem, apoio fora do recorte, ticks inválidos, chaves
   desconhecidas…) e a cobertura por grupo e prioridade.
3. Rode o jogo (`cd web && npm run dev`) e abra o endereço que ele mostrar com `?arte=<nome>` no fim
   (ex.: `http://localhost:5173/?arte=<nome>`). O que faltar no pacote continua com o desenho atual.

## Lista completa

### Personagens

Cada personagem tem 78 desenhos: todas as ações do jogo, nas 4 direções
(`up`, `right`, `down`, `left`), menos derrota e vitória, que não têm direção. `<p>` é o número do personagem:

| `<p>` | Vaga (nome provisório) |
|---|---|
| 0 | BLANCO |
| 1 | GEAR |
| 2 | TIGRA |
| 3 | AERO |
| 4 | VERDI |
| 5 | RUBI |

| Chave | O que desenhar | Tamanho | Apoio | Quadros | Ticks por quadro (60 Hz) | Loop | Prioridade |
|---|---|---|---|---|---|---|---|
| `char/<p>/idle/<dir>` | parado | 96×128 | 48, 108 | 1 | parado | não | essencial para jogar |
| `char/<p>/walk/<dir>` | andando (ciclo de passos; o ritmo não muda com a velocidade) | 96×128 | 48, 108 | 4 (3 desenhos) | 12, 8, 12, 8 (= 40) | sim | essencial para jogar |
| `char/<p>/lift/<dir>` | levantando a bomba com a luva | 96×128 | 48, 108 | 4 (1 desenho) | 4 × 2 (= 8) | sim | essencial para jogar |
| `char/<p>/carryIdle/<dir>` | parado com a bomba erguida acima da cabeça | 96×128 | 48, 108 | 1 | parado | não | essencial para jogar |
| `char/<p>/carryWalk/<dir>` | andando com a bomba erguida acima da cabeça | 96×128 | 48, 108 | 4 (3 desenhos) | 12, 8, 12, 8 (= 40) | sim | essencial para jogar |
| `char/<p>/throw/<dir>` | arremessando a bomba | 96×128 | 48, 108 | 1 | 20 | sim | essencial para jogar |
| `char/<p>/punch/<dir>` | socando a bomba | 96×128 | 48, 108 | 4 (1 desenho) | 4 × 2 (= 8) | sim | essencial para jogar |
| `char/<p>/pPunch/<dir>` | golpe P (avanço com o punho) | 96×128 | 48, 108 | 1 | parado | não | bom ter |
| `char/<p>/detonate/<dir>` | apertando o detonador da bomba remota (pose de 3 ticks; segurando, congela) | 96×128 | 48, 108 | 1 | parado | não | essencial para jogar |
| `char/<p>/stunned/<dir>` | atordoado, girando (bola da arena 3, arremesso na cabeça) | 96×128 | 48, 108 | 4 | 4 × 4 (= 16) | sim | essencial para jogar |
| `char/<p>/dying` | derrota: o personagem é atingido e some no último quadro (sem loop) | 96×128 | 48, 108 | 4 | 5, 5, 6, 6 (= 22) | não | essencial para jogar |
| `char/<p>/victory` | comemoração de quem venceu a rodada | 96×128 | 48, 108 | 2 | 2 × 12 (= 24) | sim | essencial para jogar |
| `char/<p>/mounting/<dir>` | pulando para cima da montaria (o arco do pulo pode ir no ponto de apoio de cada quadro) | 96×128 | 48, 108 | 12 (2 desenhos) | 5, 5, 4, 3, 2, 2, 2, 6, 6, 4, 3, 1 (= 43) | não | bom ter |
| `char/<p>/dismount/<dir>` | perdendo a montaria: pulo para fora e volta ao chão | 96×128 | 48, 108 | 14 (3 desenhos) | 1, 5, 5, 4, 3, 2, 2, 2, 6, 6, 4, 3, 3, 1 (= 47) | não | bom ter |
| `char/<p>/launched/<dir>` | lançado pela gangorra (arena 9), no ar | 96×128 | 48, 108 | ↑ 12 (1 desenho)<br>→ 14 (1 desenho)<br>↓ 14 (1 desenho)<br>← 14 (1 desenho) | ↑ 5, 5, 4, 3, 2, 2, 3, 7, 7, 5, 4, 4 (= 51)<br>→ 5, 5, 4, 3, 2, 2, 2, 6, 6, 4, 3, 3, 3, 14 (= 62)<br>↓ 5, 5, 4, 3, 2, 2, 2, 6, 6, 4, 3, 3, 3, 3 (= 51)<br>← 5, 5, 4, 3, 2, 2, 2, 6, 6, 4, 3, 3, 3, 3 (= 51) | sim | bom ter |
| `char/<p>/pushed/<dir>` | escorregando no piso de listras (arena 6), sem controle | 96×128 | 48, 108 | 2 | 2 × 4 (= 8) | sim | bom ter |
| `char/<p>/shocked/<dir>` | levando choque da cerca elétrica (arena 5) | 96×128 | 48, 108 | 2 | 2 × 3 (= 6) | sim | bom ter |
| `char/<p>/dance/<dir>` | dançando sem controle (acertado pela nota da montaria F) | 96×128 | 48, 108 | 18 (12 desenhos) | 1, 10, 27, 6, 7, 8, 9, 8, 6, 6, 18, 16, 8, 8, 8, 8, 8, 8 (= 170) | sim | bom ter |
| `char/<p>/bad/<dir>` | Bomber Vingador: eliminado, andando pela borda de fora da arena | 96×128 | 48, 108 | 4 (3 desenhos) | 12, 8, 12, 8 (= 40) | sim | bom ter |
| `char/<p>/held/<dir>` | preso na luva de outro jogador (ou voando, arremessado): pose parada, encolhido | 96×128 | 48, 108 | 1 | parado | não | bom ter |
| `char/<p>/dropped/<dir>` | largado pela luva: pulo de volta ao chão | 96×128 | 48, 108 | 14 (3 desenhos) | 1, 5, 5, 4, 3, 2, 2, 2, 6, 6, 4, 3, 3, 1 (= 47) | não | bom ter |

### Cavaleiros (montados)

Metade de cima do personagem sentado; vai por cima da montaria.

| Chave | O que desenhar | Tamanho | Apoio | Quadros | Ticks por quadro (60 Hz) | Loop | Prioridade |
|---|---|---|---|---|---|---|---|
| `rider/<p>/<dir>` | personagem <p> montado (só a metade de cima aparece; apoio no chão como o de pé, corpo já na altura do assento, 64 px acima) | 96×128 | 48, 108 | 4 (3 desenhos) | 4 × 16 (= 64) | sim | bom ter |

### Trajes (arena 10)

Com o item Traje o jogador veste uma roupa sorteada entre 8; parado e andando.

| Chave | O que desenhar | Tamanho | Apoio | Quadros | Ticks por quadro (60 Hz) | Loop | Prioridade |
|---|---|---|---|---|---|---|---|
| `costume/0/idle/<dir>` | traje 1 de 8 (item Traje, arena 10), parado | 96×128 | 48, 108 | 1 | parado | não | bom ter |
| `costume/0/walk/<dir>` | traje 1 de 8 (item Traje, arena 10), andando | 96×128 | 48, 108 | ↑ 5 (4 desenhos)<br>→ 4 (3 desenhos)<br>↓ 5 (3 desenhos)<br>← 4 (3 desenhos) | ↑ 1, 12, 8, 12, 8 (= 41)<br>→ 12, 8, 12, 8 (= 40)<br>↓ 1, 12, 8, 12, 8 (= 41)<br>← 12, 8, 12, 8 (= 40) | sim | bom ter |
| `costume/1/idle/<dir>` | traje 2 de 8 (item Traje, arena 10), parado | 96×128 | 48, 108 | 1 | parado | não | bom ter |
| `costume/1/walk/<dir>` | traje 2 de 8 (item Traje, arena 10), andando | 96×128 | 48, 108 | ↑ 5 (4 desenhos)<br>→ 4 (3 desenhos)<br>↓ 5 (3 desenhos)<br>← 4 (3 desenhos) | ↑ 1, 12, 8, 12, 8 (= 41)<br>→ 12, 8, 12, 8 (= 40)<br>↓ 1, 12, 8, 12, 8 (= 41)<br>← 12, 8, 12, 8 (= 40) | sim | bom ter |
| `costume/2/idle/<dir>` | traje 3 de 8 (item Traje, arena 10), parado | 96×128 | 48, 108 | 1 | parado | não | bom ter |
| `costume/2/walk/<dir>` | traje 3 de 8 (item Traje, arena 10), andando | 96×128 | 48, 108 | ↑ 5 (4 desenhos)<br>→ 4 (3 desenhos)<br>↓ 5 (3 desenhos)<br>← 4 (3 desenhos) | ↑ 1, 12, 8, 12, 8 (= 41)<br>→ 12, 8, 12, 8 (= 40)<br>↓ 1, 12, 8, 12, 8 (= 41)<br>← 12, 8, 12, 8 (= 40) | sim | bom ter |
| `costume/3/idle/<dir>` | traje 4 de 8 (item Traje, arena 10), parado | 96×128 | 48, 108 | 1 | parado | não | bom ter |
| `costume/3/walk/<dir>` | traje 4 de 8 (item Traje, arena 10), andando | 96×128 | 48, 108 | ↑ 5 (4 desenhos)<br>→ 4 (3 desenhos)<br>↓ 5 (3 desenhos)<br>← 4 (3 desenhos) | ↑ 1, 12, 8, 12, 8 (= 41)<br>→ 12, 8, 12, 8 (= 40)<br>↓ 1, 12, 8, 12, 8 (= 41)<br>← 12, 8, 12, 8 (= 40) | sim | bom ter |
| `costume/4/idle/<dir>` | traje 5 de 8 (item Traje, arena 10), parado | 96×128 | 48, 108 | 1 | parado | não | bom ter |
| `costume/4/walk/<dir>` | traje 5 de 8 (item Traje, arena 10), andando | 96×128 | 48, 108 | ↑ 5 (4 desenhos)<br>→ 4 (3 desenhos)<br>↓ 5 (3 desenhos)<br>← 4 (3 desenhos) | ↑ 1, 12, 8, 12, 8 (= 41)<br>→ 12, 8, 12, 8 (= 40)<br>↓ 1, 12, 8, 12, 8 (= 41)<br>← 12, 8, 12, 8 (= 40) | sim | bom ter |
| `costume/5/idle/<dir>` | traje 6 de 8 (item Traje, arena 10), parado | 96×128 | 48, 108 | 1 | parado | não | bom ter |
| `costume/5/walk/<dir>` | traje 6 de 8 (item Traje, arena 10), andando | 96×128 | 48, 108 | ↑ 5 (4 desenhos)<br>→ 4 (3 desenhos)<br>↓ 5 (3 desenhos)<br>← 4 (3 desenhos) | ↑ 1, 12, 8, 12, 8 (= 41)<br>→ 12, 8, 12, 8 (= 40)<br>↓ 1, 12, 8, 12, 8 (= 41)<br>← 12, 8, 12, 8 (= 40) | sim | bom ter |
| `costume/6/idle/<dir>` | traje 7 de 8 (item Traje, arena 10), parado | 96×128 | 48, 108 | 1 | parado | não | bom ter |
| `costume/6/walk/<dir>` | traje 7 de 8 (item Traje, arena 10), andando | 96×128 | 48, 108 | ↑ 5 (4 desenhos)<br>→ 4 (3 desenhos)<br>↓ 5 (3 desenhos)<br>← 4 (3 desenhos) | ↑ 1, 12, 8, 12, 8 (= 41)<br>→ 12, 8, 12, 8 (= 40)<br>↓ 1, 12, 8, 12, 8 (= 41)<br>← 12, 8, 12, 8 (= 40) | sim | bom ter |
| `costume/7/idle/<dir>` | traje 8 de 8 (item Traje, arena 10), parado | 96×128 | 48, 108 | 1 | parado | não | bom ter |
| `costume/7/walk/<dir>` | traje 8 de 8 (item Traje, arena 10), andando | 96×128 | 48, 108 | ↑ 5 (4 desenhos)<br>→ 4 (3 desenhos)<br>↓ 5 (3 desenhos)<br>← 4 (3 desenhos) | ↑ 1, 12, 8, 12, 8 (= 41)<br>→ 12, 8, 12, 8 (= 40)<br>↓ 1, 12, 8, 12, 8 (= 41)<br>← 12, 8, 12, 8 (= 40) | sim | bom ter |

### Montarias

Fases: `mounting` (surge embaixo do jogador ao pegar o ovo), `riding` (montada, andando), `dismount` (reaparece no
remonte com ovo reserva). Tipos marcados "só com a senha 0164" saem apenas com a senha das montarias extras.

| Chave | O que desenhar | Tamanho | Apoio | Quadros | Ticks por quadro (60 Hz) | Loop | Prioridade |
|---|---|---|---|---|---|---|---|
| `mount/1/mounting/<dir>` | montaria tipo 1 (criatura; atravessa bombas; só com a senha 0164) — surgindo embaixo do jogador quando ele pega o ovo (parada; o jogo faz piscar e subir). Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 1 | parado | não | raro |
| `mount/1/riding/<dir>` | montaria tipo 1 (criatura; atravessa bombas; só com a senha 0164) — com o jogador montado, andando (parada: o jogo mostra o 1º quadro). Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 4 (3 desenhos) | 4 × 16 (= 64) | sim | raro |
| `mount/1/dismount/<dir>` | montaria tipo 1 (criatura; atravessa bombas; só com a senha 0164) — reaparecendo no remonte (ovo reserva estoura e a montaria volta), parada. Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 1 | parado | não | raro |
| `mount/2/mounting/<dir>` | montaria tipo 2 (criatura; atravessa blocos) — surgindo embaixo do jogador quando ele pega o ovo (parada; o jogo faz piscar e subir). Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 1 | parado | não | bom ter |
| `mount/2/riding/<dir>` | montaria tipo 2 (criatura; atravessa blocos) — com o jogador montado, andando (parada: o jogo mostra o 1º quadro). Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 4 (3 desenhos) | 4 × 16 (= 64) | sim | bom ter |
| `mount/2/dismount/<dir>` | montaria tipo 2 (criatura; atravessa blocos) — reaparecendo no remonte (ovo reserva estoura e a montaria volta), parada. Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 1 | parado | não | raro |
| `mount/3/mounting/<dir>` | montaria tipo 3 (criatura; bombas perfurantes) — surgindo embaixo do jogador quando ele pega o ovo (parada; o jogo faz piscar e subir). Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 1 | parado | não | bom ter |
| `mount/3/riding/<dir>` | montaria tipo 3 (criatura; bombas perfurantes) — com o jogador montado, andando (parada: o jogo mostra o 1º quadro). Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 4 (3 desenhos) | 4 × 16 (= 64) | sim | bom ter |
| `mount/3/dismount/<dir>` | montaria tipo 3 (criatura; bombas perfurantes) — reaparecendo no remonte (ovo reserva estoura e a montaria volta), parada. Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 1 | parado | não | raro |
| `mount/4/mounting/<dir>` | montaria tipo 4 (criatura; investida (Y); só com a senha 0164) — surgindo embaixo do jogador quando ele pega o ovo (parada; o jogo faz piscar e subir). Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 1 | parado | não | raro |
| `mount/4/riding/<dir>` | montaria tipo 4 (criatura; investida (Y); só com a senha 0164) — com o jogador montado, andando (parada: o jogo mostra o 1º quadro). Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 4 (3 desenhos) | 4 × 16 (= 64) | sim | raro |
| `mount/4/dismount/<dir>` | montaria tipo 4 (criatura; investida (Y); só com a senha 0164) — reaparecendo no remonte (ovo reserva estoura e a montaria volta), parada. Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 1 | parado | não | raro |
| `mount/5/mounting/<dir>` | montaria tipo 5 (criatura; varredura que queima os blocos (Y); só com a senha 0164) — surgindo embaixo do jogador quando ele pega o ovo (parada; o jogo faz piscar e subir). Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 1 | parado | não | raro |
| `mount/5/riding/<dir>` | montaria tipo 5 (criatura; varredura que queima os blocos (Y); só com a senha 0164) — com o jogador montado, andando (parada: o jogo mostra o 1º quadro). Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 4 (3 desenhos) | 4 × 16 (= 64) | sim | raro |
| `mount/5/dismount/<dir>` | montaria tipo 5 (criatura; varredura que queima os blocos (Y); só com a senha 0164) — reaparecendo no remonte (ovo reserva estoura e a montaria volta), parada. Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 1 | parado | não | raro |
| `mount/6/mounting/<dir>` | montaria tipo 6 (criatura; fogo total; só com a senha 0164) — surgindo embaixo do jogador quando ele pega o ovo (parada; o jogo faz piscar e subir). Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 1 | parado | não | raro |
| `mount/6/riding/<dir>` | montaria tipo 6 (criatura; fogo total; só com a senha 0164) — com o jogador montado, andando (parada: o jogo mostra o 1º quadro). Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 4 (3 desenhos) | 4 × 16 (= 64) | sim | raro |
| `mount/6/dismount/<dir>` | montaria tipo 6 (criatura; fogo total; só com a senha 0164) — reaparecendo no remonte (ovo reserva estoura e a montaria volta), parada. Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 1 | parado | não | raro |
| `mount/9/mounting/<dir>` | montaria tipo 9 (máquina; soca a bomba da frente (Y); só com a senha 0164) — surgindo embaixo do jogador quando ele pega o ovo (parada; o jogo faz piscar e subir). Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 1 | parado | não | raro |
| `mount/9/riding/<dir>` | montaria tipo 9 (máquina; soca a bomba da frente (Y); só com a senha 0164) — com o jogador montado, andando (parada: o jogo mostra o 1º quadro). Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 4 (3 desenhos) | 4 × 16 (= 64) | sim | raro |
| `mount/9/dismount/<dir>` | montaria tipo 9 (máquina; soca a bomba da frente (Y); só com a senha 0164) — reaparecendo no remonte (ovo reserva estoura e a montaria volta), parada. Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 1 | parado | não | raro |
| `mount/a/mounting/<dir>` | montaria tipo A (máquina; chuta bombas) — surgindo embaixo do jogador quando ele pega o ovo (parada; o jogo faz piscar e subir). Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 3 | 3 × 8 (= 24) | sim | bom ter |
| `mount/a/riding/<dir>` | montaria tipo A (máquina; chuta bombas) — com o jogador montado, andando (parada: o jogo mostra o 1º quadro). Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 3 | 3 × 8 (= 24) | sim | bom ter |
| `mount/a/dismount/<dir>` | montaria tipo A (máquina; chuta bombas) — reaparecendo no remonte (ovo reserva estoura e a montaria volta), parada. Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 1 | parado | não | raro |
| `mount/b/mounting/<dir>` | montaria tipo B (máquina; velocidade máxima; só com a senha 0164) — surgindo embaixo do jogador quando ele pega o ovo (parada; o jogo faz piscar e subir). Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 1 | parado | não | raro |
| `mount/b/riding/<dir>` | montaria tipo B (máquina; velocidade máxima; só com a senha 0164) — com o jogador montado, andando (parada: o jogo mostra o 1º quadro). Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 4 (3 desenhos) | 4 × 16 (= 64) | sim | raro |
| `mount/b/dismount/<dir>` | montaria tipo B (máquina; velocidade máxima; só com a senha 0164) — reaparecendo no remonte (ovo reserva estoura e a montaria volta), parada. Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 1 | parado | não | raro |
| `mount/c/mounting/<dir>` | montaria tipo C (máquina; linha com todas as bombas (Y)) — surgindo embaixo do jogador quando ele pega o ovo (parada; o jogo faz piscar e subir). Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 1 | parado | não | bom ter |
| `mount/c/riding/<dir>` | montaria tipo C (máquina; linha com todas as bombas (Y)) — com o jogador montado, andando (parada: o jogo mostra o 1º quadro). Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 4 (3 desenhos) | 4 × 16 (= 64) | sim | bom ter |
| `mount/c/dismount/<dir>` | montaria tipo C (máquina; linha com todas as bombas (Y)) — reaparecendo no remonte (ovo reserva estoura e a montaria volta), parada. Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 1 | parado | não | raro |
| `mount/d/mounting/<dir>` | montaria tipo D (máquina; lança a si mesma como míssil (Y)) — surgindo embaixo do jogador quando ele pega o ovo (parada; o jogo faz piscar e subir). Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 1 | parado | não | bom ter |
| `mount/d/riding/<dir>` | montaria tipo D (máquina; lança a si mesma como míssil (Y)) — com o jogador montado, andando (parada: o jogo mostra o 1º quadro). Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 4 (3 desenhos) | 4 × 16 (= 64) | sim | bom ter |
| `mount/d/dismount/<dir>` | montaria tipo D (máquina; lança a si mesma como míssil (Y)) — reaparecendo no remonte (ovo reserva estoura e a montaria volta), parada. Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 1 | parado | não | raro |
| `mount/e/mounting/<dir>` | montaria tipo E (máquina; tiro lento que vira nuvem (Y)) — surgindo embaixo do jogador quando ele pega o ovo (parada; o jogo faz piscar e subir). Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 1 | parado | não | bom ter |
| `mount/e/riding/<dir>` | montaria tipo E (máquina; tiro lento que vira nuvem (Y)) — com o jogador montado, andando (parada: o jogo mostra o 1º quadro). Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 4 (3 desenhos) | 4 × 16 (= 64) | sim | bom ter |
| `mount/e/dismount/<dir>` | montaria tipo E (máquina; tiro lento que vira nuvem (Y)) — reaparecendo no remonte (ovo reserva estoura e a montaria volta), parada. Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 1 | parado | não | raro |
| `mount/f/mounting/<dir>` | montaria tipo F (máquina; nota musical que faz o alvo dançar (Y)) — surgindo embaixo do jogador quando ele pega o ovo (parada; o jogo faz piscar e subir). Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 1 | parado | não | bom ter |
| `mount/f/riding/<dir>` | montaria tipo F (máquina; nota musical que faz o alvo dançar (Y)) — com o jogador montado, andando (parada: o jogo mostra o 1º quadro). Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 4 (3 desenhos) | 4 × 16 (= 64) | sim | bom ter |
| `mount/f/dismount/<dir>` | montaria tipo F (máquina; nota musical que faz o alvo dançar (Y)) — reaparecendo no remonte (ovo reserva estoura e a montaria volta), parada. Fica ATRÁS do cavaleiro | 128×128 | 64, 108 | 1 | parado | não | raro |

### Ovos

| Chave | O que desenhar | Tamanho | Apoio | Quadros | Ticks por quadro (60 Hz) | Loop | Prioridade |
|---|---|---|---|---|---|---|---|
| `egg/1` | ovo da montaria tipo 1 (ovo comum; no chão e seguindo o jogador como reserva) — só com a senha 0164 | 64×64 | 32, 32 | 15 (8 desenhos) | 10, 10, 10, 10, 10, 10, 10, 10, 10, 4, 2, 4, 4, 2, 2 (= 108) | sim | raro |
| `egg/2` | ovo da montaria tipo 2 (ovo comum; no chão e seguindo o jogador como reserva) | 64×64 | 32, 32 | 15 (8 desenhos) | 10, 10, 10, 10, 10, 10, 10, 10, 10, 4, 2, 4, 4, 2, 2 (= 108) | sim | essencial para jogar |
| `egg/3` | ovo da montaria tipo 3 (ovo comum; no chão e seguindo o jogador como reserva) | 64×64 | 32, 32 | 15 (8 desenhos) | 10, 10, 10, 10, 10, 10, 10, 10, 10, 4, 2, 4, 4, 2, 2 (= 108) | sim | essencial para jogar |
| `egg/4` | ovo da montaria tipo 4 (ovo comum; no chão e seguindo o jogador como reserva) — só com a senha 0164 | 64×64 | 32, 32 | 15 (8 desenhos) | 10, 10, 10, 10, 10, 10, 10, 10, 10, 4, 2, 4, 4, 2, 2 (= 108) | sim | raro |
| `egg/5` | ovo da montaria tipo 5 (ovo comum; no chão e seguindo o jogador como reserva) — só com a senha 0164 | 64×64 | 32, 32 | 15 (8 desenhos) | 10, 10, 10, 10, 10, 10, 10, 10, 10, 4, 2, 4, 4, 2, 2 (= 108) | sim | raro |
| `egg/6` | ovo da montaria tipo 6 (ovo comum; no chão e seguindo o jogador como reserva) — só com a senha 0164 | 64×64 | 32, 32 | 15 (8 desenhos) | 10, 10, 10, 10, 10, 10, 10, 10, 10, 4, 2, 4, 4, 2, 2 (= 108) | sim | raro |
| `egg/9` | ovo da montaria tipo 9 (ovo de máquina; no chão e seguindo o jogador como reserva) — só com a senha 0164 | 64×64 | 32, 32 | 15 (7 desenhos) | 10, 10, 10, 10, 10, 10, 10, 10, 10, 4, 2, 4, 4, 2, 2 (= 108) | sim | raro |
| `egg/a` | ovo da montaria tipo A (ovo de máquina; no chão e seguindo o jogador como reserva) | 64×64 | 32, 32 | 15 (7 desenhos) | 10, 10, 10, 10, 10, 10, 10, 10, 10, 4, 2, 4, 4, 2, 2 (= 108) | sim | essencial para jogar |
| `egg/b` | ovo da montaria tipo B (ovo de máquina; no chão e seguindo o jogador como reserva) — só com a senha 0164 | 64×64 | 32, 32 | 15 (7 desenhos) | 10, 10, 10, 10, 10, 10, 10, 10, 10, 4, 2, 4, 4, 2, 2 (= 108) | sim | raro |
| `egg/c` | ovo da montaria tipo C (ovo de máquina; no chão e seguindo o jogador como reserva) | 64×64 | 32, 32 | 15 (7 desenhos) | 10, 10, 10, 10, 10, 10, 10, 10, 10, 4, 2, 4, 4, 2, 2 (= 108) | sim | essencial para jogar |
| `egg/d` | ovo da montaria tipo D (ovo de máquina; no chão e seguindo o jogador como reserva) | 64×64 | 32, 32 | 15 (7 desenhos) | 10, 10, 10, 10, 10, 10, 10, 10, 10, 4, 2, 4, 4, 2, 2 (= 108) | sim | essencial para jogar |
| `egg/e` | ovo da montaria tipo E (ovo de máquina; no chão e seguindo o jogador como reserva) | 64×64 | 32, 32 | 15 (7 desenhos) | 10, 10, 10, 10, 10, 10, 10, 10, 10, 4, 2, 4, 4, 2, 2 (= 108) | sim | essencial para jogar |
| `egg/f` | ovo da montaria tipo F (ovo de máquina; no chão e seguindo o jogador como reserva) | 64×64 | 32, 32 | 15 (7 desenhos) | 10, 10, 10, 10, 10, 10, 10, 10, 10, 4, 2, 4, 4, 2, 2 (= 108) | sim | essencial para jogar |

### Bombas

A mesma arte vale para a bomba parada, chutada, voando e na mão.

| Chave | O que desenhar | Tamanho | Apoio | Quadros | Ticks por quadro (60 Hz) | Loop | Prioridade |
|---|---|---|---|---|---|---|---|
| `bomb/0` | bomba normal (pavio aceso, pulsando) | 64×64 | 32, 32 | 8 (4 desenhos) | 20, 12, 16, 16, 20, 12, 16, 16 (= 128) | sim | essencial para jogar |
| `bomb/1` | bomba remota (explode no detonador; visual de controle remoto) | 64×64 | 32, 32 | 4 | 4 × 16 (= 64) | sim | bom ter |
| `bomb/2` | bomba perfurante (a chama atravessa blocos) | 64×64 | 32, 32 | 8 (4 desenhos) | 28, 16, 24, 16, 28, 16, 24, 16 (= 168) | sim | bom ter |

### Chamas

| Chave | O que desenhar | Tamanho | Apoio | Quadros | Ticks por quadro (60 Hz) | Loop | Prioridade |
|---|---|---|---|---|---|---|---|
| `flame/center` | chama — centro da explosão (onde estava a bomba); 3 desenhos (forte, média, fraca) repetidos na sequência | 64×64 | 32, 32 | 13 (3 desenhos) | 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1 (= 25) | não | essencial para jogar |
| `flame/h` | chama — braço horizontal (emenda à esquerda e à direita); 3 desenhos (forte, média, fraca) repetidos na sequência | 64×64 | 32, 32 | 13 (3 desenhos) | 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1 (= 25) | não | essencial para jogar |
| `flame/v` | chama — braço vertical (emenda em cima e embaixo); 3 desenhos (forte, média, fraca) repetidos na sequência | 64×64 | 32, 32 | 13 (3 desenhos) | 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1 (= 25) | não | essencial para jogar |
| `flame/up` | chama — ponta de cima; 3 desenhos (forte, média, fraca) repetidos na sequência | 64×64 | 32, 32 | 13 (3 desenhos) | 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1 (= 25) | não | essencial para jogar |
| `flame/down` | chama — ponta de baixo; 3 desenhos (forte, média, fraca) repetidos na sequência | 64×64 | 32, 32 | 13 (3 desenhos) | 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1 (= 25) | não | essencial para jogar |
| `flame/left` | chama — ponta da esquerda; 3 desenhos (forte, média, fraca) repetidos na sequência | 64×64 | 32, 32 | 13 (3 desenhos) | 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1 (= 25) | não | essencial para jogar |
| `flame/right` | chama — ponta da direita; 3 desenhos (forte, média, fraca) repetidos na sequência | 64×64 | 32, 32 | 13 (3 desenhos) | 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1 (= 25) | não | essencial para jogar |

### Itens

Códigos em hexadecimal (os do jogo). As caveiras de doença `22`…`2c` são iguais à `21` no original.

| Chave | O que desenhar | Tamanho | Apoio | Quadros | Ticks por quadro (60 Hz) | Loop | Prioridade |
|---|---|---|---|---|---|---|---|
| `item/01` | item no chão — Bomba +1 | 64×64 | 32, 32 | 2 | 2 × 4 (= 8) | sim | essencial para jogar |
| `item/02` | item no chão — Bomba perfurante | 64×64 | 32, 32 | 2 | 2 × 4 (= 8) | sim | bom ter |
| `item/03` | item no chão — Fogo +1 | 64×64 | 32, 32 | 2 | 2 × 4 (= 8) | sim | essencial para jogar |
| `item/04` | item no chão — Fogo total | 64×64 | 32, 32 | 2 | 2 × 4 (= 8) | sim | essencial para jogar |
| `item/05` | item no chão — Patins (velocidade +1) | 64×64 | 32, 32 | 2 | 2 × 4 (= 8) | sim | essencial para jogar |
| `item/06` | item no chão — Bomba remota | 64×64 | 32, 32 | 2 | 2 × 4 (= 8) | sim | bom ter |
| `item/07` | item no chão — Luva (pegar e arremessar) | 64×64 | 32, 32 | 2 | 2 × 4 (= 8) | sim | essencial para jogar |
| `item/08` | item no chão — Colete (invencível por um tempo) | 64×64 | 32, 32 | 2 | 2 × 4 (= 8) | sim | raro |
| `item/09` | item no chão — Coração | 64×64 | 32, 32 | 2 | 2 × 4 (= 8) | sim | raro |
| `item/0a` | item no chão — Atravessa bloco | 64×64 | 32, 32 | 2 | 2 × 4 (= 8) | sim | bom ter |
| `item/0b` | item no chão — Atravessa bomba | 64×64 | 32, 32 | 2 | 2 × 4 (= 8) | sim | bom ter |
| `item/0c` | item no chão — Relógio | 64×64 | 32, 32 | 2 | 2 × 4 (= 8) | sim | raro |
| `item/0d` | item no chão — Soco | 64×64 | 32, 32 | 2 | 2 × 4 (= 8) | sim | essencial para jogar |
| `item/0e` | item no chão — Chute | 64×64 | 32, 32 | 2 | 2 × 4 (= 8) | sim | essencial para jogar |
| `item/0f` | item no chão — Traje (arena 10) | 64×64 | 32, 32 | 2 | 2 × 4 (= 8) | sim | essencial para jogar |
| `item/11` | item no chão — Estrela | 64×64 | 32, 32 | 2 | 2 × 4 (= 8) | sim | bom ter |
| `item/12` | item no chão — Golpe P | 64×64 | 32, 32 | 2 | 2 × 4 (= 8) | sim | essencial para jogar |
| `item/21` | item no chão — Caveira no chão (doença sorteada ao pegar) | 64×64 | 32, 32 | 2 | 2 × 4 (= 8) | sim | essencial para jogar |
| `item/22` | item no chão — Caveira de doença "lento" (no original é o mesmo desenho da caveira $21; pode repetir o recorte) | 64×64 | 32, 32 | 2 | 2 × 4 (= 8) | sim | raro |
| `item/23` | item no chão — Caveira de doença "solta bombas sem parar" (no original é o mesmo desenho da caveira $21; pode repetir o recorte) | 64×64 | 32, 32 | 2 | 2 × 4 (= 8) | sim | raro |
| `item/24` | item no chão — Caveira de doença "não solta bombas" (no original é o mesmo desenho da caveira $21; pode repetir o recorte) | 64×64 | 32, 32 | 2 | 2 × 4 (= 8) | sim | raro |
| `item/25` | item no chão — Caveira de doença "fogo mínimo" (no original é o mesmo desenho da caveira $21; pode repetir o recorte) | 64×64 | 32, 32 | 2 | 2 × 4 (= 8) | sim | raro |
| `item/26` | item no chão — Caveira de doença "não para de andar" (no original é o mesmo desenho da caveira $21; pode repetir o recorte) | 64×64 | 32, 32 | 2 | 2 × 4 (= 8) | sim | raro |
| `item/27` | item no chão — Caveira de doença "pavio curto" (no original é o mesmo desenho da caveira $21; pode repetir o recorte) | 64×64 | 32, 32 | 2 | 2 × 4 (= 8) | sim | raro |
| `item/28` | item no chão — Caveira de doença "pavio longo" (no original é o mesmo desenho da caveira $21; pode repetir o recorte) | 64×64 | 32, 32 | 2 | 2 × 4 (= 8) | sim | raro |
| `item/29` | item no chão — Caveira de doença "invisível" (no original é o mesmo desenho da caveira $21; pode repetir o recorte) | 64×64 | 32, 32 | 2 | 2 × 4 (= 8) | sim | raro |
| `item/2a` | item no chão — Caveira de doença "controles invertidos" (no original é o mesmo desenho da caveira $21; pode repetir o recorte) | 64×64 | 32, 32 | 2 | 2 × 4 (= 8) | sim | raro |
| `item/2b` | item no chão — Caveira de doença "perde itens" (no original é o mesmo desenho da caveira $21; pode repetir o recorte) | 64×64 | 32, 32 | 2 | 2 × 4 (= 8) | sim | raro |
| `item/2c` | item no chão — Caveira de doença "troca de lugar" (no original é o mesmo desenho da caveira $21; pode repetir o recorte) | 64×64 | 32, 32 | 2 | 2 × 4 (= 8) | sim | raro |
| `item/2d` | item no chão — Prêmio especial $2D do caça-níquel (arena 8), desenho próprio no original | 64×64 | 32, 32 | 2 | 2 × 4 (= 8) | sim | raro |

### Arenas

#### Arena 1 — O Clássico

| Chave | O que desenhar | Tamanho | Apoio | Quadros | Ticks por quadro (60 Hz) | Loop | Prioridade |
|---|---|---|---|---|---|---|---|
| `stage/1/floor` | piso | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/1/floorAlt` | piso alternado (xadrez com o piso; pode ser igual ao piso) | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/1/hard` | pilar indestrutível do meio do campo | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/1/wall` | parede da borda do campo | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/1/soft` | bloco destrutível | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/1/burning` | bloco destrutível queimando (sem loop; depois vira piso) | 64×64 | 32, 32 | 6 | 6 × 4 (= 24) | não | essencial para jogar |
| `stage/1/pressure` | bloco da pressão (Morte Súbita) já pousado | 64×64 | 32, 32 | 1 | parado | não | bom ter |

#### Arena 2 — Rápido e Devagar

| Chave | O que desenhar | Tamanho | Apoio | Quadros | Ticks por quadro (60 Hz) | Loop | Prioridade |
|---|---|---|---|---|---|---|---|
| `stage/2/floor` | piso | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/2/floorAlt` | piso alternado (xadrez com o piso; pode ser igual ao piso) | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/2/hard` | pilar indestrutível do meio do campo | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/2/wall` | parede da borda do campo | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/2/soft` | bloco destrutível | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/2/burning` | bloco destrutível queimando (sem loop; depois vira piso) | 64×64 | 32, 32 | 6 | 6 × 4 (= 24) | não | essencial para jogar |
| `stage/2/pressure` | bloco da pressão (Morte Súbita) já pousado | 64×64 | 32, 32 | 1 | parado | não | bom ter |
| `stage/2/x/clocks` | relógios translúcidos da camada de cima, que rola na horizontal (peça de 1 casa que se repete; rápido = rola mais rápido) | 64×64 | 32, 32 | 8 | 8 × 22 (= 176) | sim | bom ter |
| `stage/2/x/gears` | engrenagens animadas do cenário | 64×64 | 32, 32 | 4 | 4 × 22 (= 88) | sim | raro |

#### Arena 3 — Bombardeio Orbital

| Chave | O que desenhar | Tamanho | Apoio | Quadros | Ticks por quadro (60 Hz) | Loop | Prioridade |
|---|---|---|---|---|---|---|---|
| `stage/3/floor` | piso | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/3/floorAlt` | piso alternado (xadrez com o piso; pode ser igual ao piso) | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/3/hard` | pilar indestrutível do meio do campo | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/3/wall` | parede da borda do campo | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/3/soft` | bloco destrutível | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/3/burning` | bloco destrutível queimando (sem loop; depois vira piso) | 64×64 | 32, 32 | 6 | 6 × 4 (= 24) | não | essencial para jogar |
| `stage/3/pressure` | bloco da pressão (Morte Súbita) já pousado | 64×64 | 32, 32 | 1 | parado | não | bom ter |
| `stage/3/x/orb` | bola que rola quando a chama a atinge e atordoa quem toca (2 por rodada) | 64×64 | 32, 32 | 4 | 4 × 8 (= 32) | sim | essencial para jogar |

#### Arena 4 — Não Me Empurre

| Chave | O que desenhar | Tamanho | Apoio | Quadros | Ticks por quadro (60 Hz) | Loop | Prioridade |
|---|---|---|---|---|---|---|---|
| `stage/4/floor` | piso | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/4/floorAlt` | piso alternado (xadrez com o piso; pode ser igual ao piso) | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/4/hard` | pilar indestrutível do meio do campo | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/4/wall` | parede da borda do campo | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/4/soft` | bloco destrutível | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/4/burning` | bloco destrutível queimando (sem loop; depois vira piso) | 64×64 | 32, 32 | 6 | 6 × 4 (= 24) | não | essencial para jogar |
| `stage/4/pressure` | bloco da pressão (Morte Súbita) já pousado | 64×64 | 32, 32 | 1 | parado | não | bom ter |

#### Arena 5 — Escola de Choques

| Chave | O que desenhar | Tamanho | Apoio | Quadros | Ticks por quadro (60 Hz) | Loop | Prioridade |
|---|---|---|---|---|---|---|---|
| `stage/5/floor` | piso | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/5/floorAlt` | piso alternado (xadrez com o piso; pode ser igual ao piso) | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/5/hard` | pilar indestrutível do meio do campo | 64×64 | 32, 32 | 4 | 4 × 9 (= 36) | sim | essencial para jogar |
| `stage/5/wall` | parede da borda do campo | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/5/soft` | bloco destrutível (esta arena começa sem blocos) | 64×64 | 32, 32 | 1 | parado | não | raro |
| `stage/5/burning` | bloco destrutível queimando (sem loop; depois vira piso) (esta arena começa sem blocos) | 64×64 | 32, 32 | 6 | 6 × 4 (= 24) | não | raro |
| `stage/5/pressure` | bloco da pressão (Morte Súbita) já pousado | 64×64 | 32, 32 | 1 | parado | não | bom ter |
| `stage/5/x/fence` | cerca elétrica em volta do campo (peça de 1 casa que se repete na borda; dá choque) | 64×64 | 32, 32 | 4 | 4 × 9 (= 36) | sim | bom ter |

#### Arena 6 — Piso Traiçoeiro

| Chave | O que desenhar | Tamanho | Apoio | Quadros | Ticks por quadro (60 Hz) | Loop | Prioridade |
|---|---|---|---|---|---|---|---|
| `stage/6/floor` | piso | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/6/floorAlt` | piso alternado (xadrez com o piso; pode ser igual ao piso) | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/6/hard` | pilar indestrutível do meio do campo | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/6/wall` | parede da borda do campo | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/6/soft` | bloco destrutível | 64×64 | 32, 32 | 4 | 4 × 9 (= 36) | sim | essencial para jogar |
| `stage/6/burning` | bloco destrutível queimando (sem loop; depois vira piso) | 64×64 | 32, 32 | 6 | 6 × 4 (= 24) | não | essencial para jogar |
| `stage/6/pressure` | bloco da pressão (Morte Súbita) já pousado | 64×64 | 32, 32 | 1 | parado | não | bom ter |
| `stage/6/x/stripes` | piso repintado de listras: empurra quem entra na direção em que olha | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/6/x/skull` | piso repintado de caveira: inverte os controles de quem pisa | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/6/x/skulls` | piso repintado de caveirinhas: bomba chutada para antes dele | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |

#### Arena 7 — Esconde-Explode

| Chave | O que desenhar | Tamanho | Apoio | Quadros | Ticks por quadro (60 Hz) | Loop | Prioridade |
|---|---|---|---|---|---|---|---|
| `stage/7/floor` | piso | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/7/floorAlt` | piso alternado (xadrez com o piso; pode ser igual ao piso) | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/7/hard` | pilar indestrutível do meio do campo | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/7/wall` | parede da borda do campo | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/7/soft` | bloco destrutível | 64×64 | 32, 32 | 4 | 4 × 12 (= 48) | sim | essencial para jogar |
| `stage/7/burning` | bloco destrutível queimando (sem loop; depois vira piso) | 64×64 | 32, 32 | 6 | 6 × 4 (= 24) | não | essencial para jogar |
| `stage/7/pressure` | bloco da pressão (Morte Súbita) já pousado | 64×64 | 32, 32 | 1 | parado | não | bom ter |
| `stage/7/x/arrow-up` | seta no chão apontando para cima: bomba chutada que passa nela vira para lá | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/7/x/arrow-right` | seta no chão apontando para a direita: bomba chutada que passa nela vira para lá | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/7/x/arrow-down` | seta no chão apontando para baixo: bomba chutada que passa nela vira para lá | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/7/x/arrow-left` | seta no chão apontando para a esquerda: bomba chutada que passa nela vira para lá | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/7/x/bush` | moita alta que fica POR CIMA de jogadores, bombas e chamas (esconde; deixe frestas/transparência) | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |

#### Arena 8 — Caça-Níquel

| Chave | O que desenhar | Tamanho | Apoio | Quadros | Ticks por quadro (60 Hz) | Loop | Prioridade |
|---|---|---|---|---|---|---|---|
| `stage/8/floor` | piso | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/8/floorAlt` | piso alternado (xadrez com o piso; pode ser igual ao piso) | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/8/hard` | pilar indestrutível do meio do campo | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/8/wall` | parede da borda do campo | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/8/soft` | bloco destrutível | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/8/burning` | bloco destrutível queimando (sem loop; depois vira piso) | 64×64 | 32, 32 | 6 | 6 × 4 (= 24) | não | essencial para jogar |
| `stage/8/pressure` | bloco da pressão (Morte Súbita) já pousado | 64×64 | 32, 32 | 1 | parado | não | bom ter |
| `stage/8/x/pad` | botão no chão que liga o caça-níquel (desligado) | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/8/x/pad-lit` | botão no chão aceso (máquina girando; pisar freia o rolo) | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/8/x/reel-0` | símbolo 1 de 4 do rolo do caça-níquel (3 iguais dão prêmio; o jogo rola a fita) | 64×64 | 32, 32 | 1 | parado | não | bom ter |
| `stage/8/x/reel-1` | símbolo 2 de 4 do rolo do caça-níquel (3 iguais dão prêmio; o jogo rola a fita) | 64×64 | 32, 32 | 1 | parado | não | bom ter |
| `stage/8/x/reel-2` | símbolo 3 de 4 do rolo do caça-níquel (3 iguais dão prêmio; o jogo rola a fita) | 64×64 | 32, 32 | 1 | parado | não | bom ter |
| `stage/8/x/reel-3` | símbolo 4 de 4 do rolo do caça-níquel (3 iguais dão prêmio; o jogo rola a fita) | 64×64 | 32, 32 | 1 | parado | não | bom ter |
| `stage/8/x/prize` | cápsula de prêmio caindo do alto até a casa | 64×64 | 32, 32 | 3 | 3 × 5 (= 15) | sim | bom ter |

#### Arena 9 — Gangorra

| Chave | O que desenhar | Tamanho | Apoio | Quadros | Ticks por quadro (60 Hz) | Loop | Prioridade |
|---|---|---|---|---|---|---|---|
| `stage/9/floor` | piso | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/9/floorAlt` | piso alternado (xadrez com o piso; pode ser igual ao piso) | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/9/hard` | pilar indestrutível do meio do campo | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/9/wall` | parede da borda do campo | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/9/soft` | bloco destrutível | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/9/burning` | bloco destrutível queimando (sem loop; depois vira piso) | 64×64 | 32, 32 | 6 | 6 × 4 (= 24) | não | essencial para jogar |
| `stage/9/pressure` | bloco da pressão (Morte Súbita) já pousado | 64×64 | 32, 32 | 1 | parado | não | bom ter |
| `stage/9/x/seesaw-left-up` | gangorra de 3 casas com a ponta da esquerda levantada | 192×64 | 96, 32 | 1 | parado | não | essencial para jogar |
| `stage/9/x/seesaw-right-up` | gangorra de 3 casas com a ponta da direita levantada | 192×64 | 96, 32 | 1 | parado | não | essencial para jogar |
| `stage/9/x/seesaw-turn` | gangorra virando (transição de 1–2 ticks, quase reta) | 192×64 | 96, 32 | 1 | parado | não | bom ter |

#### Arena 10 — Alfaiataria

| Chave | O que desenhar | Tamanho | Apoio | Quadros | Ticks por quadro (60 Hz) | Loop | Prioridade |
|---|---|---|---|---|---|---|---|
| `stage/10/floor` | piso | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/10/floorAlt` | piso alternado (xadrez com o piso; pode ser igual ao piso) | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/10/hard` | pilar indestrutível do meio do campo | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/10/wall` | parede da borda do campo | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/10/soft` | bloco destrutível | 64×64 | 32, 32 | 1 | parado | não | essencial para jogar |
| `stage/10/burning` | bloco destrutível queimando (sem loop; depois vira piso) | 64×64 | 32, 32 | 6 | 6 × 4 (= 24) | não | essencial para jogar |
| `stage/10/pressure` | bloco da pressão (Morte Súbita) já pousado | 64×64 | 32, 32 | 1 | parado | não | bom ter |

### Placar (HUD)

Faixa de cima da tela (1024×96): relógio, rostos e coroas dos 5 jogadores.

| Chave | O que desenhar | Tamanho | Apoio | Quadros | Ticks por quadro (60 Hz) | Loop | Prioridade |
|---|---|---|---|---|---|---|---|
| `hud/bar` | fundo da faixa do placar (largura da tela toda) | 1024×96 | 0, 0 | 1 | parado | não | essencial para jogar |
| `hud/clock` | ícone do relógio ao lado do tempo | 64×96 | 0, 0 | 1 | parado | não | essencial para jogar |
| `hud/digit/0` | algarismo 0 do relógio | 32×96 | 0, 0 | 1 | parado | não | essencial para jogar |
| `hud/digit/1` | algarismo 1 do relógio | 32×96 | 0, 0 | 1 | parado | não | essencial para jogar |
| `hud/digit/2` | algarismo 2 do relógio | 32×96 | 0, 0 | 1 | parado | não | essencial para jogar |
| `hud/digit/3` | algarismo 3 do relógio | 32×96 | 0, 0 | 1 | parado | não | essencial para jogar |
| `hud/digit/4` | algarismo 4 do relógio | 32×96 | 0, 0 | 1 | parado | não | essencial para jogar |
| `hud/digit/5` | algarismo 5 do relógio | 32×96 | 0, 0 | 1 | parado | não | essencial para jogar |
| `hud/digit/6` | algarismo 6 do relógio | 32×96 | 0, 0 | 1 | parado | não | essencial para jogar |
| `hud/digit/7` | algarismo 7 do relógio | 32×96 | 0, 0 | 1 | parado | não | essencial para jogar |
| `hud/digit/8` | algarismo 8 do relógio | 32×96 | 0, 0 | 1 | parado | não | essencial para jogar |
| `hud/digit/9` | algarismo 9 do relógio | 32×96 | 0, 0 | 1 | parado | não | essencial para jogar |
| `hud/colon` | dois-pontos do relógio | 32×96 | 0, 0 | 1 | parado | não | essencial para jogar |
| `hud/infinity` | símbolo ∞ (tempo infinito), no lugar dos algarismos | 96×96 | 0, 0 | 1 | parado | não | bom ter |
| `hud/head/0` | rosto de BLANCO no placar | 64×96 | 0, 0 | 1 | parado | não | essencial para jogar |
| `hud/head/1` | rosto de GEAR no placar | 64×96 | 0, 0 | 1 | parado | não | essencial para jogar |
| `hud/head/2` | rosto de TIGRA no placar | 64×96 | 0, 0 | 1 | parado | não | essencial para jogar |
| `hud/head/3` | rosto de AERO no placar | 64×96 | 0, 0 | 1 | parado | não | essencial para jogar |
| `hud/head/4` | rosto de VERDI no placar | 64×96 | 0, 0 | 1 | parado | não | essencial para jogar |
| `hud/head/5` | rosto de RUBI no placar | 64×96 | 0, 0 | 1 | parado | não | essencial para jogar |
| `hud/crown/0` | contador de coroas com 0 vitória(s) | 32×32 | 0, 0 | 1 | parado | não | essencial para jogar |
| `hud/crown/1` | contador de coroas com 1 vitória(s) | 32×32 | 0, 0 | 1 | parado | não | essencial para jogar |
| `hud/crown/2` | contador de coroas com 2 vitória(s) | 32×32 | 0, 0 | 1 | parado | não | essencial para jogar |
| `hud/crown/3` | contador de coroas com 3 vitória(s) | 32×32 | 0, 0 | 1 | parado | não | essencial para jogar |
| `hud/crown/4` | contador de coroas com 4 vitória(s) | 32×32 | 0, 0 | 1 | parado | não | essencial para jogar |
| `hud/crown/5` | contador de coroas com 5 vitória(s) | 32×32 | 0, 0 | 1 | parado | não | essencial para jogar |

### Efeitos

| Chave | O que desenhar | Tamanho | Apoio | Quadros | Ticks por quadro (60 Hz) | Loop | Prioridade |
|---|---|---|---|---|---|---|---|
| `fx/pressure-block` | bloco da pressão caindo do alto (8 px/tick no original) | 64×64 | 32, 32 | 1 | parado | não | bom ter |
| `fx/pressure-shadow` | sombra no chão onde o bloco da pressão vai cair | 64×64 | 32, 32 | 1 | parado | não | bom ter |
| `fx/item-burn` | item queimando na chama (sem loop; depois vira piso) | 64×64 | 32, 32 | 5 | 5 × 4 (= 20) | não | bom ter |
| `fx/egg-burst` | ovo estourando (ovo reserva queimado e fim do remonte) | 128×128 | 64, 64 | 4 | 4 × 10 (= 40) | não | bom ter |
| `fx/egg-glow` | ovo reserva brilhando e pulando até o jogador no remonte (antes de estourar) | 64×64 | 32, 32 | 2 | 16, 15 (= 31) | não | raro |
| `fx/dance-notes` | notas musicais em volta de quem foi acertado pela montaria F | 96×128 | 48, 108 | 4 | 8, 10, 10, 10 (= 38) | não | bom ter |
| `fx/missile/up` | montaria D lançada como míssil, voando para cima | 64×64 | 32, 32 | 3 | 3 × 1 (= 3) | sim | bom ter |
| `fx/missile/right` | montaria D lançada como míssil, voando para a direita | 64×64 | 32, 32 | 3 | 3 × 1 (= 3) | sim | bom ter |
| `fx/missile/down` | montaria D lançada como míssil, voando para baixo | 64×64 | 32, 32 | 3 | 3 × 1 (= 3) | sim | bom ter |
| `fx/missile/left` | montaria D lançada como míssil, voando para a esquerda | 64×64 | 32, 32 | 3 | 3 × 1 (= 3) | sim | bom ter |
| `fx/slow-shot` | tiro lento da montaria E, em voo | 64×64 | 32, 32 | 4 | 4 × 15 (= 60) | sim | bom ter |
| `fx/slow-cloud` | nuvem do tiro lento (deixa lento quem toca) | 128×128 | 64, 64 | 4 | 4 × 10 (= 40) | não | bom ter |
| `fx/sleep-note` | nota musical da montaria F, em voo | 64×64 | 32, 32 | 21 (19 desenhos) | 21 × 2 (= 42) | sim | bom ter |

