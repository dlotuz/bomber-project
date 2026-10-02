// Carregador do pacote de arte HD: lê `pacote.json`, confere o formato básico e carrega as imagens.
// A validação completa (lista de encomenda, cobertura) é de outra frente; aqui só o que o desenho precisa para não
// quebrar. Pacote inválido → aviso no console e `null` (o jogo segue com a ROM/arte simples).
import type { HdAnim, HdManifest, HdPack } from './types';

/** Carrega uma imagem do pacote (padrão: fetch + createImageBitmap, ou <img> sem createImageBitmap). */
export type HdImageLoader = (url: string) => Promise<CanvasImageSource>;

export interface HdLoadDeps {
  fetch?: (url: string) => Promise<{ ok: boolean; status?: number; json(): Promise<unknown> }>;
  loadImage?: HdImageLoader;
  warn?: (msg: string, e?: unknown) => void;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const nums = (v: unknown, n: number): boolean => Array.isArray(v) && v.length === n && v.every(isNum);

/** Problema no formato básico do manifesto, ou `null` se ele serve para o desenho. */
export function manifestProblem(m: unknown): string | null {
  if (!isObj(m)) return 'pacote.json não é um objeto';
  if (m.format !== 1) return `formato ${String(m.format)} não suportado (esperado 1)`;
  if (!isStr(m.name) || !m.name) return 'falta "name"';
  if (!isStr(m.credits) || !m.credits) return 'falta "credits"';
  if (!isStr(m.license) || !m.license) return 'falta "license"';
  if (!isNum(m.cell) || m.cell <= 0) return '"cell" tem de ser um número positivo';
  if (!isObj(m.images) || !Object.values(m.images).every(isStr)) return '"images" tem de mapear nome → arquivo';
  if (!isObj(m.anims)) return 'falta "anims"';
  for (const [key, a] of Object.entries(m.anims)) {
    if (!isObj(a) || !Array.isArray(a.frames) || !a.frames.length) return `animação "${key}" sem quadros`;
    if (!Array.isArray(a.ticks) || a.ticks.length !== a.frames.length || !a.ticks.every(t => isNum(t) && t > 0)) {
      return `animação "${key}": "ticks" tem de ter um número positivo por quadro`;
    }
    if (typeof a.loop !== 'boolean') return `animação "${key}": falta "loop"`;
    for (const f of a.frames as unknown[]) {
      if (!isObj(f) || !isStr(f.img) || !(f.img in m.images)) return `animação "${key}": quadro com imagem desconhecida`;
      if (!nums(f.rect, 4) || (f.rect as number[])[2] <= 0 || (f.rect as number[])[3] <= 0) return `animação "${key}": "rect" inválido`;
      if (!nums(f.anchor, 2)) return `animação "${key}": "anchor" inválido`;
    }
  }
  return null;
}

/** Pacote pronto a partir do manifesto e das imagens já carregadas. Animação que usa imagem ausente = sem desenho. */
export function makeHdPack(manifest: HdManifest, images: ReadonlyMap<string, CanvasImageSource>): HdPack {
  const ok = new Map<string, HdAnim>();
  for (const [key, a] of Object.entries(manifest.anims)) if (a.frames.every(f => images.has(f.img))) ok.set(key, a);
  return { manifest, images, anim: key => ok.get(key) ?? null };
}

async function defaultLoadImage(url: string): Promise<CanvasImageSource> {
  if (typeof createImageBitmap === 'function' && typeof fetch === 'function') {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return createImageBitmap(await r.blob());
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('imagem não carregou'));
    img.src = url;
  });
}

/** Lê `<baseUrl>pacote.json` e as imagens. `null` se o manifesto não carrega ou é inválido; imagem que falha só tira
 *  do pacote as animações que dependem dela (o resto continua valendo). */
export async function loadHdPack(baseUrl: string, deps: HdLoadDeps = {}): Promise<HdPack | null> {
  const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  const warn = deps.warn ?? ((msg: string, e?: unknown) => console.warn(msg, e ?? ''));
  const get = deps.fetch ?? ((u: string) => fetch(u));
  const loadImage = deps.loadImage ?? defaultLoadImage;
  let m: unknown;
  try {
    const r = await get(base + 'pacote.json');
    if (!r.ok) { warn(`Crown Blast: pacote de arte HD não encontrado em ${base} (HTTP ${r.status ?? '?'}).`); return null; }
    m = await r.json();
  } catch (e) {
    warn(`Crown Blast: não deu para ler ${base}pacote.json.`, e);
    return null;
  }
  const bad = manifestProblem(m);
  if (bad) { warn(`Crown Blast: pacote de arte HD inválido (${base}): ${bad}.`); return null; }
  const manifest = m as HdManifest;
  const images = new Map<string, CanvasImageSource>();
  await Promise.all(Object.entries(manifest.images).map(async ([id, file]) => {
    try { images.set(id, await loadImage(base + file)); }
    catch (e) { warn(`Crown Blast: imagem "${file}" do pacote HD não carregou; os desenhos dela ficam com a arte base.`, e); }
  }));
  return makeHdPack(manifest, images);
}
