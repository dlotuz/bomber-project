import type { GlyphCut, StyleRomDef } from '../types';
/** Fonte cursiva dos menus (títulos azuis e itens vermelhos/verdes/azuis do VS, jogadores, regras e personagem).
 * É UMA fonte só: `menuTitle` e `menuItem` usam os mesmos desenhos e mudam só a linha de paleta; por isso as faixas
 * (`CURSIVE_STRIPS`), o kerning e as regras de recorte ficam aqui e `maps/menuTitle.ts` reaproveita.
 *
 * Faixas: blocos 16×16 do BG1 das cenas `vsmode`, `ffa`, `players` e `rules` (VRAM reconstruída da ROM pelo CAT §5,
 * conferida tile a tile contra as capturas), uma linha de 16 px por frase da ROM.
 *
 * Como cada letra sai limpa: o CORPO de cada letra (índices 10–15, degradê por linha: f no topo → a na perna de
 * baixo) é um único componente 8-conexo (traço de 1 px que só se liga pelos cantos) — medido em todas as 30 frases
 * das 5 cenas de menu: 1 componente por letra (+ o pingo do i/!, os 2 pontos do :). Cada recorte vai do corpo −1
 * ao corpo +1 (x = mín − 1, w = máx − mín + 3: o aro de 1 px de cada lado) com `spacing: −1` (letras vizinhas
 * dividem a coluna do aro) e `mask` (sementes no corpo, inundação 8-conexa pelo corpo + 1 camada de aro, índice 1):
 * assim a letra não traz pedaço da vizinha nem quando as duas se sobrepõem (Fr, Te). A sombra preta (índice 2) sai
 * do recorte (`bodyOnly`) e é redesenhada na frase montada (`outline.below`, 4-vizinha, só embaixo do corpo).
 * O corpo de cada letra é idêntico em todas as ocorrências medidas (só o aro muda com a vizinha); o recorte usado
 * é o da frase que o teste de fidelidade compara (Championship, Bombermania) quando a letra aparece nela.
 *
 * Kerning (`CURSIVE_KERN`): o vão entre corpos é 1 coluna em 181 dos 204 pares medidos; as exceções viram pares:
 * vão 0 → −1 (Hu No ff ia id ig im io ip rm ro rs tl tt), vão −1 → −2 (Fr fo), vão −2 → −3 (Te). O espaço é
 * sempre 6 colunas entre corpos (20 medidas) → `spaceWidth: 6`. Relógio: em "3:00" o ":" fica a 5 colunas do 3 e
 * do 0 → +4 em "d:" e ":0" para os dígitos usados (1, 2, 3, 5).
 *
 * Letras que não existem em nenhuma frase da ROM destas cenas (E, J, q, j, º, ∞) e os acentos ficam em
 * `extra/menuItem.ts`. Tons: linhas da CGRAM das cenas de menu (iguais em vsmode/ffa/players/rules): 7 = laranja
 * dos rótulos (padrão), 3 = verde ("Human", "Normal"), 0 = azul ("Off"), 2 = rampa vermelha (1 = $C81010,
 * 10–15 = $F82018…$F8F8F8). Cinza: não existe na ROM nenhuma paleta de 16 cores com rampa cinza em 10–15 e 1/2
 * escuros (busca na ROM inteira, 0 resultados) — o item desabilitado usa a linha 7 em luma (`grayscale`). */
export const CURSIVE_STRIPS: StyleRomDef['strips'] = {
  vs: { kind: 'grid16', scene: 'vsmode', region: 'bg', cells: [
    [0x008, 0x00a, 0x00c, 0x00e, 0x020, 0x022, 0x024, 0x026],   // Select a VS mode!
    [0x040, 0x042, 0x044, 0x046, 0x048, 0x04a],   // Battle Royale
    [0x04c, 0x04e, 0x060, 0x062, 0x064, 0x066],   // Championship
    [0x068, 0x06a, 0x06c, 0x06e, 0x080, 0x082],   // Bombermania
  ] },
  ffa: { kind: 'grid16', scene: 'ffa', region: 'bg', cells: [
    [0x040, 0x042, 0x044, 0x046, 0x048, 0x04a],   // Free-for-All
    [0x04c, 0x04e, 0x060, 0x062, 0x064, 0x066],   // Team Battle
  ] },
  players: { kind: 'grid16', scene: 'players', region: 'bg', cells: [
    [0x008, 0x00a, 0x00c, 0x00e, 0x020, 0x022, 0x024, 0x026, 0x028, 0x02a],   // Decide on the players!
    [0x044, 0x046, 0x048, 0x04a, 0x04c],   // 1st Player
    [0x082, 0x084, 0x086],   // Human
    [0x088, 0x08a],   // CPU
  ] },
  rules: { kind: 'grid16', scene: 'rules', region: 'bg', cells: [
    [0x008, 0x00a, 0x00c, 0x00e, 0x020, 0x022, 0x024, 0x026, 0x028, 0x02a],   // Configure the rules!
    [0x044, 0x046, 0x048, 0x04a, 0x04c],   // CPU Level
    [0x04e, 0x060, 0x062, 0x064],   // Matches
    [0x066, 0x068, 0x06a],   // Time
    [0x06c, 0x06e, 0x080, 0x082, 0x084, 0x086],   // Sudden Death
    [0x088, 0x08a, 0x08c, 0x08e, 0x0a0, 0x0a2],   // Bad Bomber
    [0x0a4, 0x0a6, 0x0a8, 0x08c, 0x08e, 0x0a0, 0x0a2],   // Racer Bomber
    [0x0c2, 0x0c4, 0x0c6, 0x0c8],   // Normal
    [0x0ca, 0x0cc, 0x0ce, 0x0e0],   // Strong
    [0x0e2, 0x0e4, 0x0e6, 0x0e8, 0x0ea],   // 12345
    [0x104, 0x0ee, 0x100],   // 3:00
    [0x10c, 0x10e],   // Off
  ] },
};

/** Recorte pela extensão do corpo `lo`–`hi` (colunas da frase) na linha `row` da faixa; sementes na frase. */
export const cursiveCut = (ch: string, strip: string, lo: number, hi: number, row: number,
  seeds: readonly (readonly [number, number])[]): GlyphCut =>
  ({ ch, strip, x: lo - 1, w: hi - lo + 3, y: row * 16, seeds: seeds.map(([x, y]) => [x, y + row * 16] as const) });
const c = cursiveCut;

export const CURSIVE_KERN: Readonly<Record<string, number>> = {
  Hu: -1, No: -1, ff: -1, ia: -1, id: -1, ig: -1, im: -1, io: -1, ip: -1, rm: -1, ro: -1, rs: -1, tl: -1, tt: -1,
  Fr: -2, fo: -2, Te: -3,
  '1:': 4, '2:': 4, '3:': 4, '5:': 4, ':0': 4,
};

/** Campos comuns a `menuTitle` e `menuItem` (tudo menos faixas, cortes, paleta e tons). */
export const CURSIVE_BASE = {
  height: 16, spacing: -1, spaceWidth: 6, kern: CURSIVE_KERN,
  mask: { fill: [10, 11, 12, 13, 14, 15], edge: [1], grow: 1, conn: 8 },
  bodyOnly: [1, 10, 11, 12, 13, 14, 15],
  outline: { conn: 4, below: 2 },
} as const satisfies Partial<StyleRomDef>;

export const DEF: StyleRomDef = {
  ...CURSIVE_BASE,
  strips: { vs: CURSIVE_STRIPS.vs, ffa: CURSIVE_STRIPS.ffa, players: CURSIVE_STRIPS.players, rules: CURSIVE_STRIPS.rules },
  cuts: [
    c('0', 'rules', 22, 29, 10, [[25, 1]]),   // 3:00
    c('1', 'rules', 3, 10, 9, [[6, 1]]),   // 12345
    c('2', 'rules', 19, 26, 9, [[22, 1]]),   // 12345
    c('3', 'rules', 35, 42, 9, [[37, 1]]),   // 12345
    c('4', 'rules', 51, 58, 9, [[53, 1]]),   // 12345
    c('5', 'rules', 67, 74, 9, [[68, 1]]),   // 12345
    c('B', 'vs', 1, 7, 3, [[3, 1]]),   // Bombermania
    c('a', 'vs', 18, 24, 2, [[20, 5]]),   // Championship
    c('t', 'vs', 38, 44, 0, [[41, 3]]),   // Select a VS mode!
    c('l', 'vs', 18, 20, 0, [[18, 1]]),   // Select a VS mode!
    c('e', 'vs', 37, 43, 3, [[39, 5]]),   // Bombermania
    c('R', 'vs', 48, 54, 1, [[50, 1]]),   // Battle Royale
    c('o', 'vs', 49, 55, 2, [[52, 5]]),   // Championship
    c('y', 'vs', 64, 70, 1, [[65, 5]]),   // Battle Royale
    c('C', 'vs', 1, 8, 2, [[4, 1]]),   // Championship
    c('m', 'vs', 26, 36, 2, [[28, 5]]),   // Championship
    c('p', 'vs', 38, 44, 2, [[40, 5]]),   // Championship
    c('n', 'vs', 57, 63, 2, [[59, 5]]),   // Championship
    c('T', 'ffa', 6, 14, 1, [[7, 1]]),   // Team Battle
    c('d', 'vs', 107, 113, 0, [[112, 1]]),   // Select a VS mode!
    c('s', 'vs', 65, 71, 2, [[67, 5]]),   // Championship
    c('c', 'vs', 30, 36, 0, [[33, 5]]),   // Select a VS mode!
    c('r', 'vs', 45, 51, 3, [[47, 5]]),   // Bombermania
    c('u', 'players', 10, 16, 2, [[11, 5]]),   // Human
    c('i', 'vs', 46, 48, 2, [[47, 5], [47, 1]]),   // Championship
    c('ı', 'vs', 46, 48, 2, [[47, 5]]),   // Championship
    c('g', 'rules', 45, 51, 0, [[48, 5]]),   // Configure the rules!
    c('H', 'players', 1, 9, 2, [[3, 1]]),   // Human
    c('P', 'players', 10, 16, 3, [[12, 1]]),   // CPU
    c('U', 'players', 18, 25, 3, [[20, 1]]),   // CPU
    c('N', 'rules', 1, 10, 7, [[3, 1]]),   // Normal
    c('h', 'vs', 10, 16, 2, [[12, 1]]),   // Championship
    c('v', 'rules', 49, 55, 1, [[49, 5]]),   // CPU Level
    c('M', 'rules', 1, 12, 2, [[3, 1]]),   // Matches
    c('S', 'vs', 1, 8, 0, [[4, 1]]),   // Select a VS mode!
    c('b', 'vs', 29, 35, 3, [[31, 1]]),   // Bombermania
    c('V', 'vs', 64, 71, 0, [[64, 1]]),   // Select a VS mode!
    c('F', 'ffa', 6, 13, 0, [[8, 1]]),   // Free-for-All
    c(':', 'rules', 14, 16, 10, [[14, 2], [14, 9]]),   // 3:00
  ],
  palette: { kind: 'scene', scene: 'vsmode', row: 7, size: 16 },
  tones: { gray: 7, green: 3, red: 2, blue: 0 },
  grayscale: ['gray'],
};
