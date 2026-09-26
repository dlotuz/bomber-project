import type { GlyphCut, StyleRomDef } from '../types';
// Faixa "PAUSE!/HURRY!!/TIME UP!" [CAT §3 "Comum a todas as partidas"]: $D0:F57B, VRAM BG3 $A400 (word $5200), 1024
// bytes, 2bpp, 64 tiles cruas (confere com a captura de arena — mesmo esquema do ascii8). Diferente do ascii8 (fonte
// simples 8×8 monoespaçada), esta faixa é arte pronta (palavras cursivas em negrito, pintadas à mão com os 4 índices
// de cor, sem grade por caractere): letras vizinhas se conectam/sobrepõem visualmente. Pesquisa (dump-capture +
// captura direta do jogo `tt_pause.bin`, ver `pause_p1.png`/`g3_HURRY.png`/`g3_TIMEUP.png`): decodificando as 64
// tiles em sequência (32 lado a lado, 8 px de altura) já dá "PAUSE!" legível nas tiles 1-8 (x 8-72). NÃO foi possível
// achar de forma confiável, dentro do tempo da tarefa, o mapeamento das 32 tiles seguintes (índices 32-63) como
// "metade de baixo" das mesmas letras — o perfil de tinta por coluna não bate com o das tiles 0-31 (os "buracos"
// entre palavras ficam em x diferente), e a varredura da VRAM/tilemap de uma captura real de PAUSA (savestate
// `tt_pause.bin`) não achou o tilemap do banner (só a camada de escurecimento, tile constante). Registrado aqui como
// desvio: o estilo `banner` usa altura 8 (as 32 tiles de cima, que já são legíveis sozinhas: P,A,U,S,E,! de "PAUSE!"
// x 8-72; T,I,M de "TIME UP!" x 87-117; R de "HURRY!!" x 168-184), não 16. As letras que a ROM não tem (Á O D G B)
// ganham glifos próprios em extra/banner.ts nos mesmos 4 índices de cor.
// Paleta: cores 0-3 em $D6:9172 — mesma tabela de 16 cores do grupo de paleta 0 do BG das arenas que o ascii8 usa
// (`$D6:918A` = essa tabela + 24 bytes = cores 12-15, os cinzas do ascii8; aqui é a tabela sem esse deslocamento =
// cores 0-3: cinza/verde-escuro/verde/branco). Batida contra a CGRAM de uma captura de PAUSA real (savestate
// `tt_pause.bin`, 5 frames): PAUSA! e HURRY!! saem brancas com preenchimento verde e sombra verde-escura nas duas
// capturas (`pause_p1.png`, `g3_HURRY.png`), por isso o tom `green` (exigido pelo teste) aponta para o mesmo
// endereço — não achamos uma paleta "só verde" diferente sendo usada de fato no jogo.
const cut = (ch: string, x: number, w: number): GlyphCut => ({ ch, strip: 'f', x, w });

export const DEF: StyleRomDef = {
  strips: { f: { kind: 'raw', rows: [0xd0f57b], tiles: 64, bpp: 2 } },
  cuts: [
    cut('P', 8, 11), cut('A', 19, 11), cut('U', 30, 11), cut('S', 41, 10), cut('E', 51, 11), cut('!', 62, 10),
    cut('T', 87, 10), cut('I', 97, 7), cut('M', 104, 13),
    cut('R', 168, 16),
  ],
  height: 8,
  spacing: 1,
  spaceWidth: 6,
  palette: { kind: 'rom', addr: 0xd69172, size: 4 },
  tones: { green: 0xd69172 },
  meta: { timeUpWidth: 86 },  // largura de "TIME UP!" com estes cortes (T+I+M+E+espaço+U+P+!); ver Step 5 do brief
};
