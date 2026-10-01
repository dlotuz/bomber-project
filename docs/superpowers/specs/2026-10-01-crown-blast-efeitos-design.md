# Crown Blast: efeitos visuais da batalha (design)

**Data:** 2026-10-01 · **Branch:** `feat/efeitos`
**Relação com as specs anteriores:** a fidelidade (`2026-09-25-crown-blast-fidelidade-design.md`) continua valendo para o
**canvas de base** 256×224. Os efeitos são uma camada **por cima** dele, desenhada em resolução nativa, ligada por padrão
e desligável em Opções. Desligados, a imagem é idêntica à de hoje.

## 1. Objetivo e decisões

- **Meta:** deixar a batalha mais bonita e "realista" partindo da imagem real da ROM, sem redistribuir nada dela.
  Os efeitos só leem o estado da rodada e os eventos do núcleo, então valem com ROM e com a arte de fallback.
- **Decisões do usuário**
  1. Melhoria em tempo real no navegador sobre a ROM do usuário (nada extraído da ROM vai para o repositório).
  2. Efeitos de jogo (não só filtro de pixel): os 7 da §4 entram todos na primeira versão.
  3. Um liga/desliga único em Opções, **ligado por padrão**.
  4. Abordagem: canvas de base 256×224 fora da tela + canvas visível em resolução nativa com os efeitos em Canvas2D.
- **Fora desta versão:** WebGL/bloom real, filtro de upscale (xBR/ScaleFX), liga/desliga por efeito, efeitos fora da
  tela de batalha (menus, placar, vitória).

## 2. Invariantes

1. O núcleo (`web/src/core`) não muda e não importa nada de `render/fx`. Os efeitos não alteram o determinismo.
2. O fx tem o próprio RNG com semente; nunca usa o RNG do núcleo nem `Math.random`.
3. O canvas de base continua sendo exatamente o que o jogo desenha hoje. Testes de fidelidade/golden não mudam.
4. Com `options.fx = false` (ou `?fx=0`), o canvas visível mostra só a base ampliada.

## 3. Arquitetura

### 3.1 Display
`web/src/render/display.ts` passa a criar:
- **base**: canvas 256×224 fora da tela (`willReadFrequently`), cujo `ctx` é o que todo o código atual recebe;
- **visível**: o `#screen`, com tamanho de backing = 256·s × 224·s, `s` = maior inteiro que cabe na janela × DPR
  (a mesma conta de hoje). Redimensionado só no `resize`.

`present(fxFrame | null, fade)`, chamado depois de `app.draw` (no loop e no gancho `__crown.step`):
1. limpa o visível e copia a base ampliada por `s` sem suavização, deslocada pelo tremor (§4.2);
2. se houver `fxFrame` e a opção estiver ligada, desenha os efeitos (§3.3) com todas as opacidades × `fade`
   (`fade` = brilho do App / 15, para os efeitos acompanharem fades e o intro).

### 3.2 Módulo `web/src/render/fx/`
| Arquivo | Papel |
|---|---|
| `state.ts` | `FxState`: partículas em arrays de tamanho fixo (teto 600), flash, tremor, grade anterior, RNG |
| `update.ts` | `fxUpdate(fx, round, events)`: um tick de 60 Hz; eventos → partículas/flash/tremor; decaimentos |
| `coords.ts` | casa/entidade → pixel de base (o mesmo mapeamento de `draw-game.ts`) |
| `shadows.ts` | máscara de chão + elipses de sombra |
| `lights.ts` | luz das chamas e brilho dos itens (sprite de luz pré-renderizado) |
| `particles.ts` | desenho das partículas |
| `ambient.ts` | tabela de clima por arena |
| `index.ts` | `drawFx(ctx, frame, s, offset, fade)` na ordem da §4.8 |

### 3.3 Ligação com a tela de batalha
- `Screen` ganha `fx?(): FxFrame | null`. Só `battleScreen` implementa.
- `FxFrame = { state: FxState; round: RoundState; drawNoActors(ctx): void }`.
  `drawNoActors` desenha a cena sem jogadores, bombas, projéteis e camadas de montaria: no caminho ROM
  `buildBattleFrame(..., { sprites: false, layers: [] })`; no fallback `drawRound(..., { actors: false })`.
- `battleScreen.update` chama `fxUpdate` logo depois de `step()`. Pausado, não chama: tudo congela.
  Em TIME UP (`phase === 'timeUp'`) o fx só decai, sem gerar nada novo.

## 4. Efeitos

Tempos em ticks de 60 Hz; "px" = pixel de base (×`s` no visível). Todos os números são pontos de partida, reunidos em
constantes no topo de cada arquivo para ajuste.

### 4.1 Luz das chamas
Cada casa `CODE.FLAME` emite luz quente (sprite radial pré-renderizado, centro amarelo → borda laranja → transparente),
raio ≈ 24 px, `globalCompositeOperation = 'lighter'`. Intensidade pela idade da chama: sobe em 2 ticks e cai até 0 no
fim (`FLAME_TICKS`). Centro (`FLAME_PIECE.CENTER`) com raio ×1,5.

### 4.2 Tremor de tela
`explosion` soma 2,5 px ao tremor (teto 6 px); decai ×0,85 por tick e zera abaixo de 0,3. Deslocamento do frame =
inteiro aleatório em ±tremor (RNG do fx), sorteado no `fxUpdate`. Com `prefers-reduced-motion: reduce`, deslocamento 0.

### 4.3 Partículas
- **Explosão:** 18 faíscas (amarelo→laranja, vida 14–24, velocidade 1,5–3 px/tick, gravidade 0,08) e 6 baforadas de
  fumaça (cinza, sobem 0,3 px/tick, crescem de 3 a 10 px, vida 36–48).
- **Bloco quebrando:** casa que vira `CODE.BURNING` com `cellAux === BURN.SOFT` (diferença da grade entre ticks):
  8 detritos quadrados de 2–3 px, cor amostrada do canvas de base no centro da casa, saltam e caem com gravidade 0,2,
  vida 30.
- **Bomba caindo** (`bomb_landed`): anel de poeira, 10 partículas bege radiais, vida 16.
- Teto de 600; acima dele, a nova substitui a mais antiga.

### 4.4 Sombras
Elipse preta 12×5 px, opacidade 0,4, borda suave, sob jogadores vivos, bombas paradas/chutadas, objetos em voo e
montarias (na posição do jogador montado). Em voo (`z`), a sombra fica no chão: escala e opacidade × max(0,3, 1 − z/48).
**Máscara de chão:** pixels em que o frame normal e o frame de `drawNoActors` são iguais. A sombra só aparece nesses
pixels (fica embaixo dos sprites). Se o tempo médio do `present` passar de 12 ms em 60 quadros, as sombras desligam até
o fim da rodada.

### 4.5 Brilho nos itens
Casas de item no chão: halo pulsante (seno com período de 60 ticks, opacidade 0,25–0,5), raio ≈ 14 px, `'lighter'`.
Cor por item: fogo laranja, bomba azul, velocidade verde, doença (caveira) roxo, demais branco-dourado.

### 4.6 Morte
`player_hit`: flash branco sobre o campo, opacidade 0,35 caindo a 0 em 6 ticks, e 24 partículas na cor do slot
(`PLAYER_COLORS`) saindo do jogador, vida 30.

### 4.7 Clima da arena
Tabela de 10 entradas (arena 1..10): cor + força (0..0,25), aplicada com `'multiply'` sobre o retângulo do campo
(y ≥ 24, a HUD fica fora). A escuridão máxima é 25% para não atrapalhar a leitura do jogo.

### 4.8 Ordem de desenho
base (com tremor) → sombras → clima → luzes e brilho dos itens → partículas → flash.
Clima, luzes e flash só cobrem o retângulo do campo.

## 5. Opção
- `Options.fx: boolean`, padrão `true`; normalização `bool(ro.fx, d.options.fx)` (configurações antigas entram com
  `true`). Não faz parte do `GameplayPreset`.
- Opções (página principal), antes dos volumes: **EFEITOS VISUAIS: SIM/NÃO** (`S.options.fx`). Vale na hora.
- `?fx=0` na URL força desligado nesta sessão.

## 6. Testes
- `fxUpdate` (Vitest, sem DOM): explosão gera faíscas/fumaça/tremor; bloco que vira BURNING gera detritos;
  `player_hit` gera flash; tremor decai a 0; teto de partículas; mesma semente + mesmos eventos = mesmo estado.
- Máscara de chão: comparação de dois buffers RGBA pequenos feitos à mão.
- Settings: padrão `fx = true`, configuração antiga sem o campo carrega `true`.
- Núcleo não importa `render/fx` (busca por import nos fontes).
- Visual: `npm run snap` com e sem ROM; conferir capturas de explosão/item com efeitos (imagens fora do git).

## 7. Riscos
- **Custo do render duplo** (sombra): mitigado pelo desligamento automático da §4.4.
- **Mapeamento de coordenadas** do caminho ROM pode diferir 1 px do fallback: conferido nas capturas com ROM.
