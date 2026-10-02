// Validador do pacote de arte HD: confere um `pacote.json` (e o tamanho das imagens) contra o contrato (`types.ts`)
// e o catálogo (`catalog.ts`), e monta um relatório em PT-BR com erros, avisos, cobertura por grupo e o que falta por
// prioridade. Função pura: quem chama (script `scripts/arte-hd/validar.ts`, carregador no navegador, testes) informa
// o tamanho de cada imagem.
import { HD_CATALOG, HD_CELL, HD_GROUPS, HD_PRIORITIES, GROUP_LABEL, PRIORITY_LABEL, type HdCatalogEntry, type HdGroup,
  type HdPriority } from './catalog';
import type { HdKey } from './types';

export interface HdImageInfo { w: number; h: number }
export interface HdIssue { onde: string; msg: string }
export interface HdCoverage {
  group: HdGroup; total: number; presentes: number;
  porPrioridade: Readonly<Record<HdPriority, { total: number; presentes: number }>>;
}
export interface HdValidationReport {
  /** Sem erros (avisos e falta de desenhos não reprovam: o pacote pode ser parcial). */
  ok: boolean;
  nome: string;
  erros: HdIssue[];
  avisos: HdIssue[];
  cobertura: HdCoverage[];
  /** Chaves do catálogo que o pacote não tem, por prioridade (na ordem do catálogo). */
  faltando: Readonly<Record<HdPriority, HdKey[]>>;
  /** Chaves do pacote que o jogo nunca pede. */
  desconhecidas: HdKey[];
  totais: { catalogo: number; presentes: number };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const filled = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const tuple = (v: unknown, n: number): v is number[] => Array.isArray(v) && v.length === n && v.every(num);

/** Caminho relativo seguro dentro da pasta do pacote (sem `..`, sem raiz, sem `\`). */
export function safeImagePath(p: string): boolean {
  if (!p || p.startsWith('/') || p.includes('\\') || /^[a-z]+:/i.test(p)) return false;
  return p.split('/').every(seg => seg !== '' && seg !== '..' && seg !== '.');
}
const IMAGE_EXT = /\.(png|webp)$/i;

/**
 * Confere o manifesto `manifest` (JSON já lido) contra o catálogo.
 * `imageInfo(arquivo)` devolve o tamanho da imagem (caminho relativo como está no manifesto) ou `null` se ela não
 * existe ou não é PNG/WebP legível.
 */
export function validatePack(manifest: unknown, imageInfo: (file: string) => HdImageInfo | null,
  catalog: readonly HdCatalogEntry[] = HD_CATALOG): HdValidationReport {
  const erros: HdIssue[] = [];
  const avisos: HdIssue[] = [];
  const err = (onde: string, msg: string) => erros.push({ onde, msg });
  const warn = (onde: string, msg: string) => avisos.push({ onde, msg });
  const byKey = new Map(catalog.map(e => [e.key, e]));
  const presentes = new Set<HdKey>();
  const desconhecidas: HdKey[] = [];
  let nome = '(sem nome)';

  if (!isObj(manifest)) {
    err('pacote.json', 'o manifesto precisa ser um objeto JSON ({ "format": 1, … })');
  } else {
    if (manifest.format !== 1) err('format', `formato ${JSON.stringify(manifest.format)} desconhecido (use 1)`);
    if (filled(manifest.name)) nome = manifest.name.trim(); else err('name', 'preencha o nome do pacote');
    if (!filled(manifest.credits)) err('credits', 'obrigatório: autor(es) da arte — o pacote só entra se a arte for original');
    if (!filled(manifest.license)) err('license', 'obrigatório: licença da arte (ex.: CC BY 4.0, ou "todos os direitos reservados — uso no Crown Blast")');
    if (!num(manifest.cell) || !Number.isInteger(manifest.cell) || manifest.cell <= 0) {
      err('cell', 'precisa ser um inteiro > 0 (pixels do pacote por casa do jogo; recomendado 64)');
    } else if (manifest.cell !== HD_CELL) {
      warn('cell', `${manifest.cell} px por casa; o catálogo recomenda ${HD_CELL} (os tamanhos recomendados mudam na mesma proporção)`);
    }

    // Imagens.
    const sizes = new Map<string, HdImageInfo | null>();
    if (!isObj(manifest.images)) {
      err('images', 'precisa ser um objeto { "id": "arquivo.png" }');
    } else {
      for (const [id, file] of Object.entries(manifest.images)) {
        const onde = `images.${id}`;
        if (typeof file !== 'string' || !safeImagePath(file)) { err(onde, 'caminho inválido (relativo à pasta do pacote, sem "..")'); sizes.set(id, null); continue; }
        if (!IMAGE_EXT.test(file)) warn(onde, `"${file}" não termina em .png ou .webp`);
        const info = imageInfo(file);
        if (!info) err(onde, `imagem "${file}" não encontrada ou não é PNG/WebP legível`);
        sizes.set(id, info);
      }
    }

    // Animações.
    const usadas = new Set<string>();
    if (!isObj(manifest.anims)) {
      err('anims', 'precisa ser um objeto { "chave": { frames, ticks, loop } }');
    } else {
      for (const [key, anim] of Object.entries(manifest.anims)) {
        if (!byKey.has(key)) { desconhecidas.push(key); warn(key, 'chave desconhecida: o jogo nunca pede este desenho (erro de digitação?)'); }
        if (checkAnim(key, anim, sizes, usadas, err, warn) && byKey.has(key)) presentes.add(key);
      }
    }
    for (const id of sizes.keys()) if (!usadas.has(id)) warn(`images.${id}`, 'imagem declarada e não usada por nenhum quadro');
  }

  const faltando: Record<HdPriority, HdKey[]> = { essencial: [], bom: [], raro: [] };
  for (const e of catalog) if (!presentes.has(e.key)) faltando[e.priority].push(e.key);
  const cobertura: HdCoverage[] = HD_GROUPS.map(group => {
    const g = catalog.filter(e => e.group === group);
    const pp = Object.fromEntries(HD_PRIORITIES.map(p => {
      const gp = g.filter(e => e.priority === p);
      return [p, { total: gp.length, presentes: gp.filter(e => presentes.has(e.key)).length }];
    })) as Record<HdPriority, { total: number; presentes: number }>;
    return { group, total: g.length, presentes: g.filter(e => presentes.has(e.key)).length, porPrioridade: pp };
  });
  return { ok: erros.length === 0, nome, erros, avisos, cobertura, faltando, desconhecidas,
    totais: { catalogo: catalog.length, presentes: presentes.size } };
}

/** Confere uma animação; devolve true se ela é utilizável (sem erro). */
function checkAnim(key: string, anim: unknown, sizes: ReadonlyMap<string, HdImageInfo | null>, usadas: Set<string>,
  err: (onde: string, msg: string) => void, warn: (onde: string, msg: string) => void): boolean {
  let ok = true;
  const e = (onde: string, msg: string) => { ok = false; err(onde, msg); };
  if (!isObj(anim)) { e(key, 'a animação precisa ser um objeto { frames, ticks, loop }'); return false; }
  const frames = anim.frames;
  const ticks = anim.ticks;
  if (!Array.isArray(frames) || frames.length === 0) e(key, '"frames" precisa ser uma lista com pelo menos 1 quadro');
  if (!Array.isArray(ticks)) e(key, '"ticks" precisa ser uma lista (duração de cada quadro em ticks de 60 Hz)');
  else {
    if (Array.isArray(frames) && ticks.length !== frames.length) e(key, `"ticks" tem ${ticks.length} valores e "frames" tem ${frames.length} quadros (precisam ser iguais)`);
    ticks.forEach((t, i) => { if (!num(t) || !Number.isInteger(t) || t <= 0) e(`${key} ticks[${i}]`, `duração ${JSON.stringify(t)} inválida (inteiro > 0)`); });
  }
  if (typeof anim.loop !== 'boolean') e(key, '"loop" precisa ser true ou false');
  if (!Array.isArray(frames)) return false;
  frames.forEach((f, i) => {
    const onde = `${key} frames[${i}]`;
    if (!isObj(f)) { e(onde, 'o quadro precisa ser { img, rect, anchor }'); return; }
    if (typeof f.img !== 'string' || !sizes.has(f.img)) { e(onde, `imagem ${JSON.stringify(f.img)} não está em "images"`); }
    else usadas.add(f.img);
    if (!tuple(f.rect, 4)) { e(onde, '"rect" precisa ser [x, y, largura, altura]'); return; }
    const [x, y, w, h] = f.rect;
    if (w <= 0 || h <= 0 || x < 0 || y < 0) { e(onde, `recorte [${f.rect.join(', ')}] inválido (posição ≥ 0, tamanho > 0)`); return; }
    if (![x, y, w, h].every(Number.isInteger)) warn(onde, 'recorte com valores fracionários (use pixels inteiros)');
    const info = typeof f.img === 'string' ? sizes.get(f.img) : null;
    if (info && (x + w > info.w || y + h > info.h)) {
      e(onde, `recorte [${f.rect.join(', ')}] sai da imagem "${f.img}" (${info.w}×${info.h})`);
    }
    if (!tuple(f.anchor, 2)) { e(onde, '"anchor" precisa ser [x, y] (ponto de apoio dentro do recorte)'); return; }
    const [ax, ay] = f.anchor;
    if (ax < 0 || ay < 0 || ax > w || ay > h) e(onde, `ponto de apoio [${ax}, ${ay}] fora do recorte ${w}×${h}`);
  });
  return ok;
}

const pct = (a: number, b: number): string => (b === 0 ? '—' : `${Math.floor((100 * a) / b)}%`);

/** Relatório em PT-BR. `maxLista` limita quantas chaves faltando aparecem por prioridade (Infinity = todas). */
export function formatReport(r: HdValidationReport, maxLista = 30, catalog: readonly HdCatalogEntry[] = HD_CATALOG): string {
  const out: string[] = [];
  out.push(`Pacote "${r.nome}": ${r.totais.presentes} de ${r.totais.catalogo} desenhos do catálogo (${pct(r.totais.presentes, r.totais.catalogo)})`);
  out.push('');
  out.push(r.erros.length ? `ERROS (${r.erros.length}):` : 'ERROS: nenhum');
  for (const i of r.erros) out.push(`  ✗ ${i.onde}: ${i.msg}`);
  out.push(r.avisos.length ? `AVISOS (${r.avisos.length}):` : 'AVISOS: nenhum');
  for (const i of r.avisos) out.push(`  ! ${i.onde}: ${i.msg}`);
  out.push('');
  out.push('COBERTURA POR GRUPO:');
  const w = Math.max(...r.cobertura.map(c => GROUP_LABEL[c.group].length));
  for (const c of r.cobertura) {
    const pp = HD_PRIORITIES.filter(p => c.porPrioridade[p].total > 0)
      .map(p => `${p} ${c.porPrioridade[p].presentes}/${c.porPrioridade[p].total}`).join(', ');
    out.push(`  ${GROUP_LABEL[c.group].padEnd(w)}  ${String(c.presentes).padStart(4)}/${String(c.total).padEnd(4)} (${pct(c.presentes, c.total)})  ${pp}`);
  }
  const groupOf = new Map(catalog.map(e => [e.key, e.group]));
  for (const p of HD_PRIORITIES) {
    const keys = r.faltando[p];
    out.push('');
    if (!keys.length) { out.push(`FALTANDO — ${PRIORITY_LABEL[p]}: nada`); continue; }
    const porGrupo = HD_GROUPS.map(g => [g, keys.filter(k => groupOf.get(k) === g).length] as const).filter(([, n]) => n > 0);
    out.push(`FALTANDO — ${PRIORITY_LABEL[p]} (${keys.length}): ${porGrupo.map(([g, n]) => `${GROUP_LABEL[g]} ${n}`).join(', ')}`);
    for (const k of keys.slice(0, maxLista)) out.push(`  - ${k}`);
    if (keys.length > maxLista) out.push(`  … e mais ${keys.length - maxLista} (use --tudo para ver todas)`);
  }
  out.push('');
  out.push(r.ok ? 'RESULTADO: pacote válido' + (r.faltando.essencial.length ? ' (parcial: o que falta vem da ROM ou da arte simples)' : '')
    : `RESULTADO: pacote com ${r.erros.length} erro(s) — corrija antes de usar`);
  return out.join('\n');
}

/** Tamanho de uma imagem PNG ou WebP lendo só o cabeçalho (sem decodificar); `null` se não reconhecer. */
export function readImageSize(b: Uint8Array): HdImageInfo | null {
  const u32be = (o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  const ascii = (o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));
  if (b.length >= 24 && b[0] === 0x89 && ascii(1, 3) === 'PNG' && ascii(12, 4) === 'IHDR') {
    const w = u32be(16), h = u32be(20);
    return w > 0 && h > 0 ? { w, h } : null;
  }
  if (b.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const chunk = ascii(12, 4);
    if (chunk === 'VP8 ' && b.length >= 30) return { w: (b[26] | (b[27] << 8)) & 0x3fff, h: (b[28] | (b[29] << 8)) & 0x3fff };
    if (chunk === 'VP8L' && b[20] === 0x2f) {
      const v = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return { w: (v & 0x3fff) + 1, h: ((v >>> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8X') return { w: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), h: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
  }
  return null;
}
