// Gera a lista de encomenda da arte HD para o artista (docs/arte-hd/ENCOMENDA.md) e o manifesto-modelo com todas as
// chaves (docs/arte-hd/pacote-modelo.json), a partir do catálogo (web/src/render/hdart/catalog.ts).
// Uso: node scripts/arte-hd/encomenda.ts            (grava os dois arquivos)
//      node scripts/arte-hd/encomenda.ts --conferir (só confere se os arquivos versionados estão em dia; código 1 se não)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { importar, WEB } from './carregar.ts';

type Prio = 'essencial' | 'bom' | 'raro';
interface Ritmo { frames: number; ticks: readonly number[]; loop: boolean; distinct: number | null; fonte: string }
interface Entry { key: string; group: string; desc: string; size: readonly [number, number]; anchor: readonly [number, number]; ritmo: Ritmo; priority: Prio }
interface GroupCount { group: string; total: number; essencial: number; bom: number; raro: number }
interface Catalog {
  HD_CATALOG: readonly Entry[]; HD_CELL: number; HD_GROUPS: readonly string[]; GROUP_LABEL: Record<string, string>;
  PRIORITY_LABEL: Record<Prio, string>; FEET_BELOW_CENTER: number; ACT_INFO: Record<string, { desc: string; dir: boolean }>;
  countByGroup(): GroupCount[]; modelManifest(): { manifest: unknown; sheets: Map<string, { w: number; h: number }> };
}

/** Onde o jogo procura os pacotes para `?arte=<nome>` (carregador da frente de render/carregamento). */
const PASTA_PACOTES = 'web/public/arte';
const DOCS = WEB + '../docs/arte-hd/';
const DIR_ARROW: Record<string, string> = { up: '↑', right: '→', down: '↓', left: '←' };

const cell = (s: string): string => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const sum = (t: readonly number[]): number => t.reduce((a, b) => a + b, 0);

function fmtTicks(r: Ritmo): string {
  if (r.frames === 1 && !r.loop) return 'parado';
  const t = r.ticks;
  const body = t.length > 1 && t.every(x => x === t[0]) ? `${t.length} × ${t[0]}` : t.join(', ');
  return t.length > 1 ? `${body} (= ${sum(t)})` : body;
}
function fmtFrames(r: Ritmo): string {
  return r.distinct !== null && r.distinct < r.frames ? `${r.frames} (${r.distinct} desenho${r.distinct > 1 ? 's' : ''})` : String(r.frames);
}
const fmtSize = (e: Entry): string => `${e.size[0]}×${e.size[1]}`;
const fmtAnchor = (e: Entry): string => `${e.anchor[0]}, ${e.anchor[1]}`;
const same = (a: Ritmo, b: Ritmo): boolean => a.loop === b.loop && a.ticks.join() === b.ticks.join() && a.distinct === b.distinct;

interface Row { chave: string; desc: string; e: Entry; ritmo: string; frames: string }

/** Junta as 4 direções de um mesmo desenho numa linha (`…/<dir>`); se o ritmo varia por direção, mostra cada uma. */
function collapse(entries: readonly Entry[], norm: (key: string) => string = k => k, descOf: (e: Entry) => string = e => e.desc): Row[] {
  const order: string[] = [];
  const by = new Map<string, Entry[]>();
  for (const e of entries) {
    const k = norm(e.key);
    const m = e.desc.includes('olhando para') ? /^(.*)\/(up|right|down|left)$/.exec(k) : null;   // só junta direções do mesmo desenho
    const tpl = m ? `${m[1]}/<dir>` : k;
    if (!by.has(tpl)) { by.set(tpl, []); order.push(tpl); }
    const list = by.get(tpl)!;
    if (!list.some(x => x.key === e.key) && (!m || !list.some(x => x.key.endsWith('/' + m[2])))) list.push(e);
  }
  return order.map(tpl => {
    const list = by.get(tpl)!;
    const e0 = list[0];
    const uniform = list.every(x => same(x.ritmo, e0.ritmo));
    const ritmo = uniform ? fmtTicks(e0.ritmo)
      : list.map(x => `${DIR_ARROW[/\/(up|right|down|left)$/.exec(x.key)?.[1] ?? ''] ?? ''} ${fmtTicks(x.ritmo)}`).join('<br>');
    const frames = uniform ? fmtFrames(e0.ritmo) : list.map(x => `${DIR_ARROW[/\/(up|right|down|left)$/.exec(x.key)?.[1] ?? '']} ${fmtFrames(x.ritmo)}`).join('<br>');
    return { chave: tpl, desc: descOf(e0).replace(/, olhando para .*?(?=\. |$)/, ''), e: e0, ritmo, frames };
  });
}

function table(rows: readonly Row[], cat: Catalog, opts: { size?: boolean } = {}): string {
  const withSize = opts.size ?? true;
  const head = ['Chave', 'O que desenhar', ...(withSize ? ['Tamanho', 'Apoio'] : []), 'Quadros', 'Ticks por quadro (60 Hz)', 'Loop', 'Prioridade'];
  const lines = [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`];
  for (const r of rows) {
    lines.push(`| \`${r.chave}\` | ${cell(r.desc)} | ${withSize ? `${fmtSize(r.e)} | ${fmtAnchor(r.e)} | ` : ''}${r.frames} | ${r.ritmo} | ${r.e.ritmo.loop ? 'sim' : 'não'} | ${cat.PRIORITY_LABEL[r.e.priority]} |`);
  }
  return lines.join('\n');
}

/** Exemplo curto de `pacote.json` com o andar de um personagem (tamanhos e apoio recomendados). */
function exampleJson(e: Entry): string {
  const [w, h] = e.size;
  const fr = (x: number) => `        { "img": "personagem-0", "rect": [${x}, 0, ${w}, ${h}], "anchor": [${e.anchor.join(', ')}] }`;
  return [
    '{',
    '  "format": 1, "name": "meu-pacote", "credits": "Fulana de Tal", "license": "CC BY 4.0", "cell": 64,',
    '  "images": { "personagem-0": "personagem-0.png" },',
    '  "anims": {',
    '    "char/0/walk/down": {',
    '      "frames": [',
    [fr(0), fr(w), fr(0), fr(2 * w)].join(',\n'),
    '      ],',
    '      "ticks": [12, 8, 12, 8], "loop": true',
    '    }',
    '  }',
    '}',
  ].join('\n');
}

/** pacote-modelo.json legível e compacto: uma animação por linha. */
function modelJson(m: { format: number; name: string; credits: string; license: string; cell: number;
  images: Record<string, string>; anims: Record<string, unknown> }): string {
  const ent = (o: Record<string, unknown>) => Object.entries(o).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n');
  return [
    '{',
    `  "format": ${m.format},`, `  "name": ${JSON.stringify(m.name)},`, `  "credits": ${JSON.stringify(m.credits)},`,
    `  "license": ${JSON.stringify(m.license)},`, `  "cell": ${m.cell},`,
    '  "images": {', ent(m.images), '  },',
    '  "anims": {', ent(m.anims), '  }',
    '}',
  ].join('\n');
}

function render(cat: Catalog, chars: readonly { name: string }[], sha1: string | null): string {
  const E = cat.HD_CATALOG;
  const G = (g: string) => E.filter(e => e.group === g);
  const counts = cat.countByGroup();
  const total = counts.reduce((a, c) => a + c.total, 0);
  const tot = (p: Prio) => counts.reduce((a, c) => a + c[p], 0);
  const C = cat.HD_CELL;
  const charE = E.find(e => e.group === 'personagens')!;
  const mountE = E.find(e => e.group === 'montarias')!;
  const out: string[] = [];
  const p = (...l: string[]) => out.push(...l);

  p('# Lista de encomenda — arte HD do Crown Blast', '',
    '> Gerado por `web/scripts/arte-hd/encomenda.ts` a partir de `web/src/render/hdart/catalog.ts`. Não edite à mão:',
    '> mude o catálogo e rode `cd web && node scripts/arte-hd/encomenda.ts`.',
    sha1 ? `> Ritmo (quadros e ticks) medido nas tabelas de animação do jogo original (ROM SHA-1 \`${sha1.slice(0, 12)}…\`); só números, nenhum pixel.`
      : '> Ritmo: valores padrão documentados (o ritmo medido no original ainda não foi gerado).',
    '',
    'O Crown Blast é uma recriação do modo Battle de um jogo de bombas para Super Nintendo. Esta lista é tudo o que a',
    'partida pode desenhar com o **pacote de arte HD**: arte nova, desenhada na resolução da tela, que substitui o',
    'desenho do jogo elemento por elemento.', '');

  p('## Atenção: a arte tem de ser ORIGINAL', '',
    '- **Personagens novos.** Não redesenhe, não decalque e não "atualize" os personagens, montarias, itens ou cenários do',
    '  Super Bomberman 4 (nem de outro jogo da série). Nada de capacete com antena-bolinha, rostos, roupas ou cores que',
    '  lembrem os originais. As vagas abaixo têm nomes provisórios do Crown Blast; você pode propor outros.',
    '- **Montarias novas**: cada uma precisa "contar" a habilidade dela (descrita na lista), com visual próprio.',
    '- **Itens**: ícones novos e legíveis; não copie os ícones originais.',
    '- **Arenas**: tema próprio para cada uma das 10, guiado pelo nome e pela mecânica, não pelo cenário original.',
    '- Nunca use sprites, prints ou recortes do jogo original como base, nem como "referência por baixo".',
    '- O `pacote.json` exige `credits` (autoria) e `license` (licença) preenchidos: sem isso o validador reprova o pacote.',
    '');

  p('## Resumo: quantos desenhos', '',
    '| Grupo | Total | Essencial para jogar | Bom ter | Raro |', '|---|---:|---:|---:|---:|',
    ...counts.map(c => `| ${cat.GROUP_LABEL[c.group]} | ${c.total} | ${c.essencial} | ${c.bom} | ${c.raro} |`),
    `| **Total** | **${total}** | **${tot('essencial')}** | **${tot('bom')}** | **${tot('raro')}** |`, '',
    '"Desenho" = uma chave do pacote (uma animação). Muitas animações reaproveitam o mesmo desenho (a coluna *Quadros*',
    'diz quantos desenhos diferentes o original usa), e um quadro pode repetir o mesmo recorte da imagem.', '',
    '- **Essencial para jogar**: aparece em quase toda partida (comece por aqui).',
    '- **Bom ter**: aparece com certas regras, arenas, itens ou montarias.',
    '- **Raro**: só com a senha das montarias extras, variações que o original desenha igual, ou casos de canto.', '',
    'O pacote pode ser **parcial**: o que não estiver nele continua vindo do desenho atual do jogo.', '');

  p('## Escala, tamanho e ponto de apoio', '',
    `- **${C} px por casa** do campo (o campo tem 13 × 11 casas; uma casa do original tem 16 px, então tudo é 4×).`,
    '  Os tamanhos abaixo já estão nessa escala. Se usar outra escala, declare em `cell` e mude tudo na mesma proporção.',
    '- **Ponto de apoio** (`anchor`): o pixel do quadro que vai exatamente no ponto do jogo.',
    '  - Personagens, cavaleiros, trajes e montarias: o **centro da sombra sob os pés** (o ponto em que o desenho toca o',
    `    chão), não o centro do quadro. O jogo alinha esse ponto ${cat.FEET_BELOW_CENTER} px do original (${cat.FEET_BELOW_CENTER * C / 16} px nesta escala) abaixo do`,
    `    centro da casa. Personagem: quadro ${fmtSize(charE)} com apoio (${fmtAnchor(charE)}); montaria: ${fmtSize(mountE)} com apoio (${fmtAnchor(mountE)}).`,
    '    O corpo pode passar da casa para cima; o cavaleiro usa o mesmo apoio no chão e é desenhado já na altura do assento.',
    '  - Bombas, chamas, itens, ovos, peças de arena e efeitos: o **centro da casa**.',
    '  - Placar (HUD): o canto de cima à esquerda.',
    '- Cada quadro pode ter o seu próprio apoio: use isso para o pulo (montar, ser largado) subir e descer sem desenhar',
    '  o personagem em posições diferentes da folha.',
    '- Peças de arena (`stage/<n>/floor`, `hard`, `wall`, `soft`…) têm de ter exatamente uma casa e encaixar lado a lado',
    '  sem emenda. A gangorra (arena 9) ocupa 3 casas.', '');

  p('## Ritmo (quadros e ticks)', '',
    '- O jogo roda a **60 ticks por segundo**. `ticks` é a duração de cada quadro em ticks (12 ticks = 0,2 s).',
    '- Os números recomendados vêm do ritmo do original, para a animação casar com o jogo (passos, pavio, chama).',
    '- Pode usar mais quadros para ficar mais suave, desde que a **soma dos ticks** (o total entre parênteses) fique igual.',
    '- **Loop**: `sim` repete; `não` para no último quadro (derrota, chama, bloco queimando, montar/desmontar).',
    '- "parado" = 1 quadro só.', '');

  p('## Regras de estilo', '',
    '- Fundo **transparente** (PNG ou WebP com alfa). Sem sombra projetada no chão: o jogo já desenha sombras suaves.',
    '- Vista de cima, levemente inclinada (vemos o topo e a frente das coisas), luz vindo de cima à esquerda.',
    '- **Legibilidade antes de detalhe**: num relance tem de dar para distinguir bomba, item, bloco destrutível, pilar e',
    '  chama. Bloco destrutível e pilar indestrutível precisam ser bem diferentes entre si em todas as arenas.',
    '- Até 5 jogadores podem usar o mesmo personagem: silhueta e rosto bem legíveis; evite depender só da cor.',
    '- Itens: ícone central forte sobre uma placa de fundo; eles piscam (2 quadros: normal e realçado).',
    '- Chama: 3 desenhos por peça (forte, média, fraca) que o jogo alterna; as peças precisam emendar umas nas outras',
    '  (centro + braços + pontas formam uma cruz contínua).',
    '- A moita da arena 7 fica **por cima** de tudo: use transparência/frestas para o jogador perceber algo embaixo.',
    '- Montarias: desenhe a montaria **sem** o cavaleiro; o cavaleiro (`rider/…`) é desenhado por cima, na altura do assento.',
    '');

  p('## Formato do pacote', '',
    'Uma pasta com `pacote.json` na raiz e as imagens (PNG ou WebP) ao lado (subpastas valem):', '',
    '```json', exampleJson(charE), '```', '',
    '- `images`: apelido → arquivo (relativo à pasta). `rect`: `[x, y, largura, altura]` do quadro na imagem.',
    '- `anchor`: ponto de apoio, em px **dentro do recorte**. `ticks`: um valor por quadro, inteiros > 0.',
    '- `docs/arte-hd/pacote-modelo.json` traz **todas** as chaves já com os quadros, apoios e ticks recomendados, numa',
    '  folha por personagem, por montaria e por arena (e uma por grupo no resto). Dá para desenhar direto nessas folhas',
    '  ou reorganizar à vontade: só valem os recortes do `pacote.json`.', '');

  p('## Como testar', '',
    `1. Copie a pasta do pacote para \`${PASTA_PACOTES}/<nome>/\` (fica \`${PASTA_PACOTES}/<nome>/pacote.json\`).`,
    '2. Confira o pacote: `cd web && node scripts/arte-hd/validar.ts public/arte/<nome>` (use `--tudo` para listar tudo o',
    '   que falta). O relatório mostra erros (recorte fora da imagem, apoio fora do recorte, ticks inválidos, chaves',
    '   desconhecidas…) e a cobertura por grupo e prioridade.',
    '3. Rode o jogo (`cd web && npm run dev`) e abra o endereço que ele mostrar com `?arte=<nome>` no fim',
    '   (ex.: `http://localhost:5173/?arte=<nome>`). O que faltar no pacote continua com o desenho atual.', '');

  p('## Lista completa', '');

  // Personagens.
  p('### Personagens', '',
    `Cada personagem tem ${G('personagens').length / chars.length} desenhos: todas as ações do jogo, nas 4 direções`,
    '(`up`, `right`, `down`, `left`), menos derrota e vitória, que não têm direção. `<p>` é o número do personagem:', '',
    '| `<p>` | Vaga (nome provisório) |', '|---|---|', ...chars.map((c, i) => `| ${i} | ${c.name} |`), '');
  const charRows = collapse(G('personagens').filter(e => e.key.startsWith('char/0/')), k => k.replace(/^char\/0\//, 'char/<p>/'),
    e => cat.ACT_INFO[e.key.split('/')[2]].desc);
  p(table(charRows, cat), '');

  p('### Cavaleiros (montados)', '', 'Metade de cima do personagem sentado; vai por cima da montaria.', '');
  p(table(collapse(G('cavaleiros').filter(e => e.key.startsWith('rider/0/')), k => k.replace(/^rider\/0\//, 'rider/<p>/'),
    () => `personagem <p> montado (só a metade de cima aparece; apoio no chão como o de pé, corpo já na altura do assento, ${C} px acima)`), cat), '');

  p('### Trajes (arena 10)', '', 'Com o item Traje o jogador veste uma roupa sorteada entre 8; parado e andando.', '');
  p(table(collapse(G('trajes')), cat), '');

  p('### Montarias', '',
    'Fases: `mounting` (surge embaixo do jogador ao pegar o ovo), `riding` (montada, andando), `dismount` (reaparece no',
    'remonte com ovo reserva). Tipos marcados "só com a senha 0164" saem apenas com a senha das montarias extras.', '');
  p(table(collapse(G('montarias')), cat), '');

  p('### Ovos', '');
  p(table(collapse(G('ovos')), cat), '');
  p('### Bombas', '', 'A mesma arte vale para a bomba parada, chutada, voando e na mão.', '');
  p(table(collapse(G('bombas')), cat), '');
  p('### Chamas', '');
  p(table(collapse(G('chamas')), cat), '');
  p('### Itens', '', 'Códigos em hexadecimal (os do jogo). As caveiras de doença `22`…`2c` são iguais à `21` no original.', '');
  p(table(collapse(G('itens')), cat), '');

  p('### Arenas', '');
  for (let n = 1; n <= 10; n++) {
    const list = G('arenas').filter(e => e.key.startsWith(`stage/${n}/`));
    const nome = /"([^"]+)"/.exec(list[0].desc)?.[1] ?? '';
    p(`#### Arena ${n} — ${nome}`, '');
    p(table(collapse(list, k => k, e => e.desc.replace(/^arena \d+ "[^"]+" — /, '')), cat), '');
  }
  p('### Placar (HUD)', '', `Faixa de cima da tela (${E.find(e => e.key === 'hud/bar')!.size.join('×')}): relógio, rostos e coroas dos 5 jogadores.`, '');
  p(table(collapse(G('hud')), cat), '');
  p('### Efeitos', '');
  p(table(collapse(G('efeitos')), cat), '');
  return out.join('\n');
}

async function main(): Promise<number> {
  const conferir = process.argv.includes('--conferir');
  const cat = await importar<Catalog>('src/render/hdart/catalog.ts');
  const { CHARACTERS } = await importar<{ CHARACTERS: readonly { name: string }[] }>('src/render/art/bomber.ts');
  const { RITMO_ROM_SHA1 } = await importar<{ RITMO_ROM_SHA1: string | null }>('src/render/hdart/catalog-ritmo.ts');
  const md = render(cat, CHARACTERS, RITMO_ROM_SHA1) + '\n';
  const { manifest } = cat.modelManifest();
  const json = modelJson(manifest as Parameters<typeof modelJson>[0]) + '\n';
  const files: [string, string][] = [[DOCS + 'ENCOMENDA.md', md], [DOCS + 'pacote-modelo.json', json]];
  if (conferir) {
    const stale = files.filter(([f, s]) => !existsSync(f) || readFileSync(f, 'utf8') !== s).map(([f]) => f);
    for (const f of stale) console.error(`desatualizado: ${f} (rode node scripts/arte-hd/encomenda.ts)`);
    return stale.length ? 1 : 0;
  }
  mkdirSync(DOCS, { recursive: true });
  for (const [f, s] of files) { writeFileSync(f, s); console.log(`gerado ${f}`); }
  const counts = cat.countByGroup();
  for (const c of counts) console.log(`  ${cat.GROUP_LABEL[c.group].padEnd(24)} ${String(c.total).padStart(4)}`);
  console.log(`  ${'Total'.padEnd(24)} ${String(counts.reduce((a, c) => a + c.total, 0)).padStart(4)}`);
  return 0;
}

process.exitCode = await main();
