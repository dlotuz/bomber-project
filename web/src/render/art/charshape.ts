// Formas das skins: além da cor, algumas mudam o desenho do boneco. Trabalha nos quadros 32×32 de índices de paleta
// (`sheetFrame`), antes de virarem sprite — então vale para a partida, a vitória e as telas que usam o quadro.
// Os acessórios são pixel art desenhada à mão (`ART_*`, letras → índices da paleta do Blanco, que já existe em todas as
// vagas: nada de cor nova), encaixada na cabeça ou no tronco medidos em cada quadro; o gordão e o pequeno redesenham o
// corpo por regra. Só mexe em quadros de corpo
// inteiro; peças pequenas, sombras e efeitos da folha ficam como estão.

export type SkinShape = 'hat' | 'fat' | 'small' | 'suit'
  | 'crown' | 'cowboy' | 'ninja' | 'pirate' | 'cape' | 'chef' | 'tall' | 'bighead'
  | 'antenna' | 'bow' | 'mohawk' | 'wizard' | 'safari' | 'plume' | 'bubble' | 'board';

const W = 32;
const MIN_BODY_H = 16;

/** Letra da arte → índice da paleta do Blanco (1 contorno; 8–10 e 5 variam com a cor do time, o resto é fixo). */
const INK: Readonly<Record<string, number>> = {
  '1': 1,    // contorno
  k: 11,     // preto-acinzentado (303030)
  g: 12,     // cinza médio
  h: 13,     // cinza claro
  w: 14,     // branco
  y: 4,      // dourado-osso (f8c870)
  T: 10,     // cor do time, clara
  t: 9,      // cor do time, média
  u: 8,      // cor do time, escura
  r: 5,      // vermelho/acento do time
};

interface Art {
  rows: readonly string[];
  /** Coluna do desenho que cai no centro da cabeça (ou do tronco). */
  ax: number;
  /** Linha do desenho que cai na linha de referência (topo da cabeça `t`, ou topo do tronco). */
  ay: number;
}

// --- cartola: copa de 4 linhas com brilho e faixa na cor do time, aba larga de 3 linhas sobre o topo da cabeça --------
const ART_HAT: Art = {
  ax: 7, ay: 4,
  rows: [
    '....1111111....',
    '...1kgkkkkk1...',
    '...1kgkkkkk1...',
    '...1TTTTTTT1...',
    '111111111111111',
    '1kkkkkkkkkkkkk1',
    '.11111111111111',
  ],
};

// --- terno: lapelas em V, camisa branca e gravata na cor do time (só de frente) ----------------------------------------
const ART_SUIT: Art = {
  ax: 4, ay: 0,
  rows: [
    '1.wwTww.1',
    '.1.wTw.1.',
    '..1.T.1..',
  ],
};
/** Corpo do Blanco na cor do time (8,9,10) → paletó preto e cinza escuro. */
const SUIT_BODY = [8, 9, 10] as const, SUIT_DARK = [1, 11, 11] as const;

interface Box { x0: number; x1: number; y0: number; y1: number }

function bounds(px: Uint8Array): Box | null {
  let x0 = W, x1 = -1, y0 = W, y1 = -1;
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (px[y * W + x]) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : { x0, x1, y0, y1 };
}

interface Head {
  /** Linha do topo da cabeça e coluna do centro dela. */
  t: number; hc: number;
  /** `back` sem viseira, `front` com a viseira no meio, `side` com ela de lado (`face` −1 esquerda, +1 direita). */
  kind: 'front' | 'back' | 'side';
  face: number;
}

/** Cabeça do Blanco no quadro: topo (1ª linha com 5 pixels seguidos), centro (meio das linhas do meio) e para onde olha. */
function findHead(px: Uint8Array, b: Box): Head | null {
  let t = -1;
  for (let y = b.y0; y <= b.y1 && t < 0; y++) {
    let run = 0;
    for (let x = 0; x < W; x++) { run = px[y * W + x] ? run + 1 : 0; if (run >= 5) { t = y; break; } }
  }
  if (t < 0) return null;
  let lo = W, hi = -1;
  for (let y = t + 4; y <= t + 8; y++) for (let x = 0; x < W; x++) if (px[y * W + x]) { if (x < lo) lo = x; if (x > hi) hi = x; }
  if (hi < 0 || hi - lo < 8) return null;   // sem cabeça inteira (faíscas, anel, morte)
  const hc = (lo + hi) / 2;
  let n = 0, sx = 0;
  for (let y = t + 3; y <= t + 9; y++) for (let x = lo; x <= hi; x++) {
    const v = px[y * W + x];
    if (v === 5 || v === 4) { n++; sx += x; }
  }
  if (n < 4) return { t, hc, kind: 'back', face: 0 };
  const off = sx / n - hc;
  return Math.abs(off) <= 1.5 ? { t, hc, kind: 'front', face: 0 } : { t, hc, kind: 'side', face: off > 0 ? 1 : -1 };
}

/** Carimba a arte com a referência (`cx`, `ty`) no ponto (`art.ax`, `art.ay`); `mirror` espelha em torno de `ax`. */
function stamp(out: Uint8Array, art: Art, cx: number, ty: number, mirror = false): void {
  art.rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const c = row[rx];
      if (c === '.') continue;
      const dx = mirror ? art.ax - rx : rx - art.ax;
      const x = Math.round(cx) + dx, y = ty + ry - art.ay;
      if (x >= 0 && x < W && y >= 0 && y < W) out[y * W + x] = INK[c];
    }
  });
}

function addHat(px: Uint8Array, b: Box): Uint8Array {
  const h = findHead(px, b);
  if (!h) return px;
  const out = px.slice();
  stamp(out, ART_HAT, h.hc, h.t);
  return out;
}

/** Terno: corpo preto e, de frente, lapelas, camisa branca e gravata do time. */
function addSuit(px: Uint8Array, b: Box): Uint8Array {
  const out = px.slice(), h = findHead(px, b);
  for (let i = 0; i < out.length; i++) {
    const k = SUIT_BODY.indexOf(out[i] as 8 | 9 | 10);
    if (k >= 0) out[i] = SUIT_DARK[k];
  }
  if (!h || h.kind !== 'front') return out;
  let ty = -1;
  const c = Math.round(h.hc);
  for (let y = h.t + 9; y <= b.y1 && ty < 0; y++) for (let x = c - 2; x <= c + 2; x++)
    if (SUIT_BODY.includes(px[y * W + x] as 8 | 9 | 10)) { ty = y; break; }
  if (ty < 0) return out;
  const art = ART_SUIT;
  art.rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const ch = row[rx];
      if (ch === '.') continue;
      const x = c + rx - art.ax, y = ty + ry - art.ay;
      if (x >= 0 && x < W && y < W && SUIT_BODY.includes(px[y * W + x] as 8 | 9 | 10)) out[y * W + x] = INK[ch];   // só sobre o paletó
    }
  });
  return out;
}

/** Gordão: o mesmo boneco (mesma altura, cabeça e pernas), com uma barriga redonda e bem larga no lugar do tronco: camisa
 *  listrada (branco e cor do time) que não chega ao fim e deixa um pedaço da barriga de fora, com umbigo, sobre o cinto e
 *  a calça (cor do time clara). As luvas ficam por cima. */
function makeFat(px: Uint8Array, b: Box): Uint8Array {
  const h = findHead(px, b), t = h ? h.t : b.y0;
  const body = (v: number): boolean => v === 8 || v === 9 || v === 10;
  let x0 = W, x1 = -1, y0 = W;
  for (let y = t + 9; y <= b.y1; y++) for (let x = 0; x < W; x++) if (body(px[y * W + x])) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; }
  if (x1 < 0) return px;
  const out = px.slice(), rows = 8, cx = (x0 + x1) / 2, cy = y0 + (rows - 1) / 2;
  const rx = Math.min((x1 - x0) / 2 + 5.5, 12), ry = rows / 2 + 1;
  // quase uma elipse (redonda, não um caixote): ombros largos o bastante para a cabeça assentar
  const inside = (x: number, y: number): boolean => (Math.abs(x - cx) / rx) ** 2.2 + (Math.abs(y - cy) / ry) ** 2.2 <= 1;
  for (let y = y0; y < y0 + rows + 1 && y < W; y++) for (let x = 0; x < W; x++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    const k = y - y0;
    // camisa listrada, um pedaço de barriga com umbigo, cinto e calça
    out[y * W + x] = edge ? 1 : k <= 4 ? (k % 2 === 0 ? 14 : 9) : k === 5 ? 4 : k === 6 ? 11 : 10;
  }
  if (h && h.kind !== 'back') {
    const nx = Math.round(h.kind === 'side' ? cx + h.face * 2 : cx), ny = y0 + 5;
    if (inside(nx, ny)) out[ny * W + nx] = 1;       // umbigo
  }
  // pernas: o que sobrou do desenho original embaixo da barriga (pernas e botas abertas na passada) é apagado e as botas
  // voltam curtas, uma de cada lado, mais juntas que as originais (ainda mostram qual pé vai à frente)
  {
    let lastBoot = -1;
    const left: number[][] = [], right: number[][] = [];
    for (let y = y0 + 4; y <= b.y1; y++) for (let x = 0; x < W; x++) {
      const v = px[y * W + x];
      if (v !== 6 && v !== 7) continue;
      lastBoot = Math.max(lastBoot, y);
      (x < cx ? left : right).push([x, y]);
    }
    if (lastBoot >= 0) {
      for (let y = y0 + 3; y <= lastBoot; y++) for (let x = 0; x < W; x++) if (!inside(x, y)) out[y * W + x] = 0;
      const put = (x: number, y: number, v: number): void => { if (x >= 0 && x < W && y >= 0 && y < W) out[y * W + x] = v; };
      // cada pé do desenho original dá a posição (x) e a altura (quanto está levantado) da bota nova: na passada uma bota
      // vai à frente e a outra sobe, como no Blanco; o pé de apoio fica sempre no chão, logo abaixo da barriga
      // (a altura vem do centro do pé, não da sola: de lado as duas solas ficam na mesma linha e só o pé levantado sobe)
      const foot = (c: number[][]): { x: number; bottom: number } | null =>
        c.length ? { x: c.reduce((s, p) => s + p[0], 0) / c.length, bottom: c.reduce((s, p) => s + p[1], 0) / c.length } : null;
      const fl = foot(left), fr = foot(right);
      // de frente, na passada, só o pé que vai à frente aparece rosa (o outro fica escuro, atrás): o que não aparece é o
      // que está levantado
      const fL = fl ?? (fr ? { x: 2 * cx - fr.x, bottom: fr.bottom - 2 } : { x: cx - 4, bottom: lastBoot });
      const fR = fr ?? { x: 2 * cx - fL.x, bottom: fL.bottom - 2 };
      const ground = Math.max(fL.bottom, fR.bottom), floor = y0 + rows + 2, side = !!h && h.kind === 'side', spread = side ? 1.5 : 1.1, gap = side ? 0 : 3, apart = side && Math.abs(fR.x - fL.x) > 5;
      for (const f of [{ ...fL, s: -1 }, { ...fR, s: 1 }]) {
        const bxr = Math.round(cx + f.s * Math.max(gap, Math.abs(f.x - cx) * spread));
        // de frente: o pé que sobe sobe mais (a passada é exagerada) e fica atrás da barriga, só aparece o que sobra por baixo.
        // de lado: nos quadros de passada aberta o pé da frente pisa e o de trás descola do chão (2 linhas, à vista); com os pés
        // juntos as botas se sobrepõem — nunca duas botas abrindo e fechando por igual
        const lift = side ? (apart && f.s !== h!.face ? 2 : 0) : Math.min(3, Math.round((ground - f.bottom) * 2)), by = floor - lift;
        const draw = (x: number, y: number, v: number): void => { if (lift === 0 || side || out[y * W + x] === 0) put(x, y, v); };
        for (let dx = -2; dx <= 2; dx++) {
          draw(bxr + dx, by - 1, Math.abs(dx) === 2 ? 1 : 7);
          draw(bxr + dx, by, Math.abs(dx) === 2 ? 1 : 6);
          draw(bxr + dx, by + 1, 1);
        }
      }
    }
  }
  // volume: o lado direito das listras brancas fica em cinza claro
  for (let y = y0; y < y0 + rows + 1 && y < W; y++) for (let x = Math.round(cx + rx * 0.45); x < W; x++)
    if (out[y * W + x] === 14) out[y * W + x] = 13;
  // braços: de frente ou de costas as mãos ficam atrás da barriga e só aparece um pontinho rosa (2 pixels) de cada lado,
  // dentro da barriga, para lembrar a mão; de lado as luvas originais ficam sobre a barriga, como mãos apoiadas nela
  if (h && h.kind !== 'side') {
    for (const s of [-1, 1]) {
      const x = Math.round(cx + s * (rx - 2.5));
      out[(y0 + 3) * W + x] = 7;
      out[(y0 + 4) * W + x] = 6;
    }
  } else {
    for (let y = y0; y <= y0 + 4 && y < W; y++) for (let x = 0; x < W; x++) {   // só as linhas das luvas (as botas já foram refeitas)
      const v = px[y * W + x];
      if (v === 6 || v === 7) out[y * W + x] = v;  // luvas por cima da barriga
    }
  }
  // a cabeça fica um pouco menor (92%) e assenta na barriga, 2 linhas abaixo do queixo original (sem pescoço: um gordo quase não
  // tem); cada pixel novo fica com a cor mais comum entre os de origem, com o contorno ganhando o desempate
  const sink = 2, sh = 0.92, hc = h ? h.hc : cx, bottom = y0 + sink - 1;
  for (let y = 0; y < y0; y++) for (let x = 0; x < W; x++) out[y * W + x] = 0;
  const votes = new Uint8Array(W * W * 16);
  for (let y = 0; y < y0; y++) for (let x = 0; x < W; x++) {
    const v = px[y * W + x];
    if (!v) continue;
    const dx = Math.floor(hc + (x - hc) * sh + 0.5), dy = Math.floor(bottom - (y0 - 1 - y) * sh + 0.5);
    if (dx >= 0 && dx < W && dy >= 0 && dy < W) votes[(dy * W + dx) * 16 + v]++;
  }
  for (let i = 0; i < out.length; i++) {
    let best = 0, bv = 0;
    for (let v = 1; v < 16; v++) {
      const n = votes[i * 16 + v] * (v === 1 ? 1.5 : 1);
      if (n > bv) { bv = n; best = v; }
    }
    if (best) out[i] = best;
  }
  // um pouco mais alto (pés no mesmo lugar): repete uma linha a cada ~10
  const by = b.y1, kv = 1.1, tall = new Uint8Array(out.length);
  for (let y = 0; y < W; y++) {
    const sy = Math.round(by - (by - y) / kv);
    if (sy < 0 || sy > by) continue;
    tall.set(out.subarray(sy * W, sy * W + W), y * W);
  }
  return tall;
}

/** Escalas do pequeno: do corpo e da cabeça (a cabeça perde menos, para o rosto continuar legível). */
export const SMALL = { body: 0.55, head: 0.92 };

/** Pequeno: o boneco reduzido, com os pés no mesmo lugar. A cabeça (da antena ao queixo) tem a escala própria
 *  `SMALL.head` e assenta no corpo reduzido. Cada pixel novo fica com a cor mais comum entre os de origem (o contorno
 *  ganha o desempate, para a silhueta não desmanchar). */
function makeSmall(px: Uint8Array, b: Box): Uint8Array {
  const h = findHead(px, b), cx = (b.x0 + b.x1) / 2, by = b.y1, sb = SMALL.body, sh = h ? SMALL.head : SMALL.body;
  const y0 = h ? h.t + 11 : b.y0;                  // 1ª linha do corpo (abaixo do queixo)
  const yb0 = by + (y0 - by) * sb;                 // onde ela cai depois de reduzida
  const hx = h ? cx + (h.hc - cx) * sb : cx;       // onde cai o centro da cabeça
  const votes = new Uint8Array(W * W * 16);
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
    const v = px[y * W + x];
    if (!v) continue;
    const head = !!h && y < y0;
    const dx = Math.floor((head ? hx + (x - h!.hc) * sh : cx + (x - cx) * sb) + 0.5);
    const dy = Math.floor((head ? yb0 - (y0 - y) * sh : by + (y - by) * sb) + 0.5);
    if (dx >= 0 && dx < W && dy >= 0 && dy < W) votes[(dy * W + dx) * 16 + v]++;
  }
  const out = new Uint8Array(px.length);
  for (let i = 0; i < out.length; i++) {
    let best = 0, bv = 0;
    for (let v = 1; v < 16; v++) {
      const n = votes[i * 16 + v] * (v === 1 ? 1.5 : 1);
      if (n > bv) { bv = n; best = v; }
    }
    out[i] = best;
  }
  return out;
}

const SHAPES: Record<SkinShape, (px: Uint8Array, b: Box) => Uint8Array> = {
  hat: addHat, small: makeSmall, suit: addSuit, fat: makeFat,
  crown: (px, b) => addArt(px, b, ART_CROWN), cowboy: (px, b) => addArt(px, b, ART_COWBOY), chef: addChef,
  ninja: addNinja, pirate: addPirate, cape: addCape, tall: makeTall, bighead: makeBighead,
  antenna: (px, b) => addArt(px, b, ART_ANTENNA), bow: (px, b) => addArt(px, b, ART_BOW), mohawk: addMohawk,
  wizard: (px, b) => addArt(px, b, ART_WIZARD), safari: (px, b) => addArt(px, b, ART_SAFARI),
  plume: (px, b) => addArt(px, b, ART_PLUME), bubble: addBubble, board: addBoard,
};
const apply = (px: Uint8Array, b: Box, shape: SkinShape): Uint8Array => SHAPES[shape](px, b);

/** Quadro 32×32 com a(s) forma(s) da skin, aplicadas em ordem; quadros que não são de corpo inteiro voltam como vieram. */
export function reshapeFrame(px: Uint8Array, shape: SkinShape | readonly SkinShape[]): Uint8Array {
  let cur = px;
  for (const s of typeof shape === 'string' ? [shape] : shape) {
    const b = bounds(cur);
    if (!b || b.y1 - b.y0 + 1 < MIN_BODY_H || b.y0 >= 16) return cur;
    cur = apply(cur, b, s);
  }
  return cur;
}

// ======================================================================================================================
// Mais skins (todas a partir do Blanco): acessórios na cabeça, fantasias no corpo e outras formas. Mesmas regras de
// cima: só índices da paleta do Blanco, nada de cor nova; a cor do time (8–10, 5) continua dizendo de quem é o boneco.
// ======================================================================================================================

/** Cores do corpo do Blanco que mudam com o time (macacão). */
const TEAM_BODY = (v: number): boolean => v === 8 || v === 9 || v === 10;

// --- coroa: dourada, 3 pontas e uma pedra na cor do acento do time -----------------------------------------------------
const ART_CROWN: Art = {
  ax: 5, ay: 3,
  rows: [
    '.1...1...1.',
    '1y1.1y1.1y1',
    '1yy1yyy1yy1',
    '1yyyyryyyy1',
    '11111111111',
  ],
};

// --- chapéu de caubói: copa com faixa escura e aba larga e curvada nas pontas ----------------------------------------------
const ART_COWBOY: Art = {
  ax: 8, ay: 4,
  rows: [
    '.....1111111.....',
    '....1yyyyyyy1....',
    '....1yyy1yyy1....',
    '....1kkkkkkk1....',
    '11..1yyyyyyy1..11',
    '1y111yyyyyyy111y1',
    '.1yyyyyyyyyyyyy1.',
    '..1111111111111..',
  ],
};

// --- chapéu de cozinheiro: alto, branco, com dobras e faixa ------------------------------------------------------------
const ART_CHEF: Art = {
  ax: 5, ay: 6,
  rows: [
    '..111.111..',
    '.1www1www1.',
    '1wwwwwwwww1',
    '1whwwwwhww1',
    '.1whwwwhw1.',
    '.1wwwwwww1.',
    '.1hhhhhhh1.',
    '.111111111.',
  ],
};

/** Acessório desenhado na cabeça (quadros sem cabeça inteira ficam como estão). */
function addArt(px: Uint8Array, b: Box, art: Art): Uint8Array {
  const h = findHead(px, b);
  if (!h) return px;
  const out = px.slice();
  stamp(out, art, h.hc, h.t, h.kind === 'side' && h.face < 0);
  return out;
}

/** Linhas [lo, hi] (colunas) de cada linha do quadro com algum pixel; `null` nas vazias. */
function spans(px: Uint8Array, y0: number, y1: number): ([number, number] | null)[] {
  const out: ([number, number] | null)[] = [];
  for (let y = y0; y <= y1; y++) {
    let lo = W, hi = -1;
    for (let x = 0; x < W; x++) if (px[y * W + x]) { if (x < lo) lo = x; if (x > hi) hi = x; }
    out.push(hi < 0 ? null : [lo, hi]);
  }
  return out;
}

/** Primeira linha do tronco (abaixo do queixo) e a última antes das botas. */
function torso(px: Uint8Array, b: Box, h: Head): { y0: number; y1: number } {
  let y0 = -1, y1 = -1;
  for (let y = h.t + 9; y <= b.y1; y++) for (let x = 0; x < W; x++) {
    const v = px[y * W + x];
    if (TEAM_BODY(v)) { if (y0 < 0) y0 = y; y1 = y; }
  }
  return { y0, y1 };
}

/** Faixa amarrada na cabeça (2 linhas a partir de `y`), na cor `ink`, com as pontas soltas atrás. */
function headband(out: Uint8Array, px: Uint8Array, h: Head, y: number, top: number, bottom: number): void {
  for (const [dy, v] of [[0, top], [1, bottom]] as const) {
    const yy = y + dy;
    for (let x = 0; x < W; x++) {
      const c = px[yy * W + x];
      if (!c) continue;
      const left = !px[yy * W + x - 1], right = !px[yy * W + x + 1];
      out[yy * W + x] = left || right ? 1 : v;   // a borda da cabeça continua contorno
    }
  }
  // pontas: de frente e de costas, saem pela direita; de lado, para trás
  const s = spans(px, y, y)[0];
  if (!s) return;
  const put = (x: number, yy: number, v: number): void => { if (x >= 0 && x < W && yy >= 0 && yy < W && !px[yy * W + x]) out[yy * W + x] = v; };
  const dir = h.kind === 'side' ? -h.face : 1, x0 = dir > 0 ? s[1] : s[0];
  for (let k = 1; k <= 4; k++) {
    put(x0 + dir * k, y + Math.floor(k / 2), top);
    put(x0 + dir * k, y + Math.floor(k / 2) + 1, k === 4 ? 1 : bottom);
    put(x0 + dir * k, y + Math.floor(k / 2) + 2, 1);
  }
  put(x0 + dir * 5, y + 2, 1); put(x0 + dir * 5, y + 3, 1);
}

/** Ninja: roupa preta (o macacão do time escurece) e a faixa na cor do time amarrada na testa. */
function addNinja(px: Uint8Array, b: Box): Uint8Array {
  const h = findHead(px, b);
  const out = px.slice();
  for (let i = 0; i < out.length; i++) {
    const k = SUIT_BODY.indexOf(out[i] as 8 | 9 | 10);
    if (k >= 0) out[i] = SUIT_DARK[k];
  }
  if (h) headband(out, px, h, h.t + 2, INK.T, INK.t);
  return out;
}

/** Olho do lado de cá: a coluna do 1º olho (pixel de contorno entre dois de pele) na altura da viseira. */
function eyeColumn(px: Uint8Array, h: Head): { x: number; y0: number; y1: number } | null {
  const hits: number[] = [];
  let y0 = W, y1 = -1;
  for (let y = h.t + 3; y <= h.t + 9; y++) for (let x = 1; x < W - 1; x++) {
    if (px[y * W + x] === 1 && px[y * W + x - 1] === 4 && px[y * W + x + 1] === 4) { hits.push(x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  if (!hits.length) return null;
  const xs = [...new Set(hits)].sort((a, c) => a - c);
  // de frente, o olho da esquerda; de lado, o mais perto do centro da cabeça (o outro fica na beirada da viseira)
  const x = h.kind === 'side' ? xs.reduce((a, c) => (Math.abs(c - h.hc) < Math.abs(a - h.hc) ? c : a)) : xs[0];
  return { x, y0, y1 };
}

/** Pirata: lenço na cor do acento do time cobrindo o alto da cabeça (com o nó atrás), tapa-olho e camisa listrada. */
function addPirate(px: Uint8Array, b: Box): Uint8Array {
  const h = findHead(px, b);
  if (!h) return px;
  const out = px.slice();
  // lenço: as 3 primeiras linhas da cabeça, com pintinhas brancas; a linha de baixo é a tira do tapa-olho
  for (let y = h.t; y <= h.t + 2; y++) for (let x = 0; x < W; x++) {
    const v = px[y * W + x];
    if (!v || v === 1 || !px[y * W + x - 1] || !px[y * W + x + 1] || !px[(y - 1) * W + x]) continue;
    out[y * W + x] = (x + 2 * y) % 5 === 0 ? INK.w : INK.r;
  }
  headband(out, px, h, h.t + 3, INK.r, 1);
  if (h.kind !== 'back') {
    const e = eyeColumn(px, h);
    if (e) for (let y = e.y0 - 1; y <= e.y1 + 1; y++) for (let x = e.x - 1; x <= e.x + 1; x++) out[y * W + x] = 1;
  }
  // camisa listrada: linhas alternadas de branco e cor do time no tronco
  const tr = torso(px, b, h);
  if (tr.y0 >= 0) for (let y = tr.y0; y <= Math.min(tr.y1, tr.y0 + 4); y++) for (let x = 0; x < W; x++)
    if (TEAM_BODY(px[y * W + x])) out[y * W + x] = (y - tr.y0) % 2 === 0 ? INK.w : INK.t;
  return out;
}

/** Super-herói: capa na cor do acento do time atrás do corpo (de frente, aparece dos lados; de lado, voa para trás;
 *  de costas, cobre as costas) e um losango dourado no peito. */
function addCape(px: Uint8Array, b: Box): Uint8Array {
  const h = findHead(px, b);
  if (!h) return px;
  const tr = torso(px, b, h);
  if (tr.y0 < 0) return px;
  const out = px.slice(), y0 = tr.y0, y1 = Math.min(b.y1 - 3, tr.y1 + 3);
  const sp = spans(px, y0, y1), cx = Math.round(h.hc);
  const put = (x: number, y: number, v: number): void => { if (x >= 0 && x < W && y >= 0 && y < W && !px[y * W + x]) out[y * W + x] = v; };
  for (let y = y0; y <= y1; y++) {
    const s = sp[y - y0];
    if (!s) continue;
    const k = y - y0, last = y === y1;
    if (h.kind === 'back') {
      // de costas: a capa cobre o tronco e abre um pouco para os lados
      for (let x = s[0]; x <= s[1]; x++) if (px[y * W + x] && px[y * W + x] !== 1 && px[y * W + x] !== 6 && px[y * W + x] !== 7) out[y * W + x] = last ? 1 : INK.r;
      const w = 1 + (k >> 2);
      for (let d = 1; d <= w; d++) { put(s[0] - d, y, d === w || last ? 1 : INK.r); put(s[1] + d, y, d === w || last ? 1 : INK.r); }
      continue;
    }
    const dirs = h.kind === 'side' ? [-h.face] : [-1, 1], w = h.kind === 'side' ? 1 + Math.round(k * 0.6) : 1 + (k >> 2);
    for (const dir of dirs) {
      const x0 = dir < 0 ? s[0] : s[1];
      for (let d = 1; d <= w; d++) put(x0 + dir * d, y, d === w || last ? 1 : INK.r);
    }
  }
  if (h.kind === 'front') {   // losango no peito
    const y = y0 + 1;
    for (const [dx, dy, v] of [[0, -1, 4], [-1, 0, 4], [0, 0, 5], [1, 0, 4], [0, 1, 4]] as const)
      if (TEAM_BODY(px[(y + dy) * W + cx + dx])) out[(y + dy) * W + cx + dx] = v;
  }
  return out;
}

/** Cozinheiro: chapéu alto branco e, de frente, avental branco sobre o macacão. */
function addChef(px: Uint8Array, b: Box): Uint8Array {
  const h = findHead(px, b);
  if (!h) return px;
  const out = px.slice();
  stamp(out, ART_CHEF, h.hc, h.t);
  if (h.kind === 'back') return out;
  const tr = torso(px, b, h);
  if (tr.y0 < 0) return out;
  const c = Math.round(h.kind === 'side' ? h.hc + h.face * 2 : h.hc), half = h.kind === 'side' ? 2 : 3;
  for (let y = tr.y0 + 1; y <= tr.y1; y++) for (let x = c - half; x <= c + half; x++) {
    const v = px[y * W + x];
    if (TEAM_BODY(v) || v === 2 || v === 3) out[y * W + x] = x === c + half || (h.kind !== 'side' && x === c - half) ? INK.h : INK.w;
  }
  return out;
}

/** Altão: o mesmo boneco com o tronco e as pernas esticados (1,5×); a cabeça sobe junto e os pés ficam no lugar. */
function makeTall(px: Uint8Array, b: Box): Uint8Array {
  const h = findHead(px, b);
  if (!h) return px;
  // trecho esticado: do queixo até logo acima das botas (as botas, a sombra e a cabeça não mudam de tamanho)
  // botas: o bloco de linhas com rosa (6/7) mais embaixo (o de cima são as luvas)
  const pink = (y: number): boolean => { for (let x = 0; x < W; x++) if (px[y * W + x] === 6 || px[y * W + x] === 7) return true; return false; };
  let boots = b.y1;
  while (boots > h.t + 11 && !pink(boots)) boots--;
  while (boots > h.t + 12 && pink(boots - 1)) boots--;
  const r0 = h.t + 11, r1 = boots - 1, n = r1 - r0 + 1;
  if (n < 3) return px;
  const grow = Math.min(h.t, Math.round(n * 0.5)), m = n + grow;   // não passa do topo do quadro
  const out = new Uint8Array(px.length);
  for (let y = boots; y < W; y++) out.set(px.subarray(y * W, y * W + W), y * W);
  for (let k = 0; k < m; k++) {
    const sy = r0 + Math.min(n - 1, Math.floor(k * n / m));
    out.set(px.subarray(sy * W, sy * W + W), (r0 - grow + k) * W);
  }
  for (let y = 0; y < r0; y++) if (y - grow >= 0) out.set(px.subarray(y * W, y * W + W), (y - grow) * W);
  return out;
}

/** Cabeção: a cabeça 1,35× maior (assentada no mesmo pescoço), o corpo igual. */
function makeBighead(px: Uint8Array, b: Box): Uint8Array {
  const h = findHead(px, b);
  if (!h) return px;
  const neck = h.t + 10, s = 1.35, out = px.slice();
  for (let y = 0; y <= neck; y++) out.fill(0, y * W, y * W + W);
  for (let y = 0; y <= neck; y++) for (let x = 0; x < W; x++) {
    const sx = Math.round(h.hc + (x - h.hc) / s), sy = Math.round(neck - (neck - y) / s);
    if (sx < 0 || sx >= W || sy < 0 || sy > neck) continue;
    const v = px[sy * W + sx];
    if (v) out[y * W + x] = v;
  }
  return out;
}

// ======================================================================================================================
// Lote 2 (temas): antenas, laço, moicano, mago, safári, pluma, astronauta (bolha) e prancha. Mesmas regras: só índices
// da paleta do Blanco; o que é "do time" (T/t/u/r) continua mostrando de quem é o boneco.
// ======================================================================================================================

const ART_ANTENNA: Art = {
  ax: 5, ay: 6,
  rows: [
    '.111...111.',
    '.1r1...1r1.',
    '.111...111.',
    '..1.....1..',
    '..1.....1..',
    '..1.....1..',
  ],
};
const ART_BOW: Art = {
  ax: 5, ay: 4,
  rows: [
    '11.......11',
    '1r11...11r1',
    '1rrr1r1rrr1',
    '1rr1rrr1rr1',
    '1r11.1.11r1',
    '11.......11',
  ],
};
const ART_MOHAWK: Art = {
  ax: 2, ay: 5,
  rows: [
    '..1..',
    '.1r1.',
    '.1r1.',
    '1rrr1',
    '1rrr1',
  ],
};
const ART_MOHAWK_SIDE: Art = {
  ax: 6, ay: 4,
  rows: [
    '.1...1...1...',
    '1r1.1r1.1r1..',
    '1rr1rrr1rrr1.',
    '1rrrrrrrrrrr1',
  ],
};
const ART_WIZARD: Art = {
  ax: 7, ay: 7,
  rows: [
    '.......1.......',
    '......1T1......',
    '......1T1......',
    '.....1TyT1.....',
    '.....1TTt1.....',
    '....1TTTtt1....',
    '....1uuuuu1....',
    '1TTTTTTTTTTTTT1',
    '.1111111111111.',
  ],
};
const ART_SAFARI: Art = {
  ax: 7, ay: 5,
  rows: [
    '.........1r1...',
    '.....11111r1...',
    '....1wwwww1....',
    '....1wwwww1....',
    '....1kkkkk1....',
    '1hhhhhhhhhhhhh1',
    '.1111111111111.',
  ],
};
const ART_PLUME: Art = {
  ax: 8, ay: 6,
  rows: [
    '...11111.....',
    '..1wwwww11...',
    '.1wwhhwwww1..',
    '1whw11hwwww1.',
    '1h1...1hwww1.',
    '.1.....1ww1..',
    '........11...',
  ],
};

/** Moicano: crista de frente/de costas estreita; de lado, comprida (da testa à nuca). */
function addMohawk(px: Uint8Array, b: Box): Uint8Array {
  const h = findHead(px, b);
  if (!h) return px;
  const out = px.slice();
  if (h.kind === 'side') stamp(out, ART_MOHAWK_SIDE, h.hc, h.t, h.face < 0);
  else stamp(out, ART_MOHAWK, h.hc, h.t);
  return out;
}

/** Astronauta: bolha de vidro em volta da cabeça (1 px de folga, vidro cinza-claro, contorno e um brilho). */
function addBubble(px: Uint8Array, b: Box): Uint8Array {
  const h = findHead(px, b);
  if (!h) return px;
  const y0 = h.t, y1 = Math.min(W - 1, h.t + 10);
  const head = new Uint8Array(W * W);
  for (let y = y0; y <= y1; y++) for (let x = 0; x < W; x++) if (px[y * W + x]) head[y * W + x] = 1;
  const grow = (m: Uint8Array): Uint8Array => {
    const o = m.slice();
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (m[y * W + x])
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy;
        if (X >= 0 && X < W && Y >= 0 && Y <= y1) o[Y * W + X] = 1;
      }
    return o;
  };
  const d1 = grow(head), d2 = grow(d1), d3 = grow(d2);
  const out = px.slice();
  let hl = 0;
  for (let y = 0; y <= y1; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (px[i]) continue;
    if (d2[i] && !d1[i]) {
      out[i] = INK.h;
      if (hl < 3 && y <= y0 && x < h.hc) { out[i] = INK.w; hl++; }   // brilho no alto, à esquerda
    } else if (d3[i] && !d2[i]) out[i] = 1;
  }
  return out;
}

/** Prancha: uma prancha na cor do time debaixo das botas (de frente e de lado, sempre deitada). */
function addBoard(px: Uint8Array, b: Box): Uint8Array {
  const h = findHead(px, b);
  if (!h) return px;
  // logo abaixo das botas (rosa, 6/7): as linhas de baixo do quadro são a sombra, que o jogo desenha à parte
  let y = -1;
  for (let yy = b.y1; yy > h.t + 11 && y < 0; yy--) for (let x = 0; x < W; x++) if (px[yy * W + x] === 6 || px[yy * W + x] === 7) { y = yy + 1; break; }
  if (y < 0 || y + 2 >= W) return px;
  const out = px.slice(), c = Math.round(h.hc), half = h.kind === 'side' ? 11 : 9;
  for (let x = c - half; x <= c + half; x++) {
    if (x < 0 || x >= W) continue;
    const end = x === c - half || x === c + half;
    out[y * W + x] = end ? 1 : INK.T;               // tampo (claro) e lateral (média), pontas arredondadas
    out[(y + 1) * W + x] = end ? 0 : x === c - half + 1 || x === c + half - 1 ? 1 : INK.t;
    if (!end && x !== c - half + 1 && x !== c + half - 1) out[(y + 2) * W + x] = 1;
  }
  return out;
}
