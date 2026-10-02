// Pacote parcial, categoria por categoria: a cada quadro decide o que o pacote HD cobre por completo (todas as peças
// da arena, todos os itens em campo, todos os jogadores com a ação atual…). O desenho base (ROM ou arte simples) pula
// essas categorias e o HD as desenha em resolução nativa.
//
// Camadas: a base 256×224 é um quadro só. Uma categoria HD que fica ABAIXO de tudo o que a base ainda desenha vai
// por baixo da base (que fica transparente onde pulou); uma que fica ACIMA de tudo vai por cima da base. Uma categoria
// coberta "no meio" (com categorias da base abaixo e acima dela) não teria como ficar na ordem certa, então continua
// na base. A ordem (de baixo para cima) segue a do original: arena (BG), itens, chamas e bombas na grade (BG), ovos e
// jogadores (sprites), HUD.
import { CLOCK_FROZEN_FROM, CODE, isEggCode, isItemCode, itemOfCode, type Player, type RoundState } from '../../core';
import { rider } from '../../core/mounts/types';
import { flamePart } from '../view';
import { charKey, faceToHdDir, itemKey, mountKey, stageKey, type HdKey, type HdPack, type HdTile } from './types';

export type HdCategory = 'arena' | 'items' | 'flames' | 'bombs' | 'eggs' | 'players' | 'hud';
/** Ordem de desenho (de baixo para cima). */
export const HD_CATEGORIES: readonly HdCategory[] = ['arena', 'items', 'flames', 'bombs', 'eggs', 'players', 'hud'];
/** O que o desenho base pula neste quadro. */
export type HdSkip = ReadonlySet<HdCategory>;
export const NO_SKIP: HdSkip = new Set();

/** Peças obrigatórias da arena (`floorAlt` é opcional: sem ela, o xadrez usa `floor`). */
export const ARENA_TILES: readonly HdTile[] = ['floor', 'hard', 'wall', 'soft', 'burning', 'pressure'];

/** Categoria do que está numa casa da grade (ovo = `eggs`; queimando = arena). */
export function cellCategory(code: number): HdCategory {
  if (code === CODE.BOMB) return 'bombs';
  if (code === CODE.FLAME) return 'flames';
  if (isEggCode(code)) return 'eggs';
  if (isItemCode(code)) return 'items';
  return 'arena';
}

export const flameKey = (piece: number): HdKey => `flame/${flamePart(piece)}`;
export const bombKey = (type: number): HdKey => `bomb/${type}`;
export const eggKey = (type: number): HdKey => `egg/${type.toString(16)}`;
export const riderKey = (ch: number, face: number): HdKey => `rider/${ch}/${faceToHdDir(face)}`;
export const hudHeadKey = (ch: number): HdKey => `hud/head/${ch}`;
export const hudCrownKey = (n: number): HdKey => `hud/crown/${n}`;
export const hudDigitKey = (d: number): HdKey => `hud/digit/${d}`;
/** Fundo da barra do HUD (256×24 px de base) e ícone do relógio; obrigatórios para o HUD HD. */
export const HUD_KEYS: readonly HdKey[] = ['hud/bar', 'hud/clock'];

/** Relógio do HUD como na ROM (hud.ts `hudWords`): colunas 3..7 = dezena dos minutos (só ≥ 10), minutos, dois-pontos,
 *  dezena e unidade dos segundos; `null` nas colunas em branco. Tempo infinito: `infinity`. */
export function hudClockGlyphs(sec: number): (HdKey | null)[] | 'infinity' {
  if (sec >= CLOCK_FROZEN_FROM) return 'infinity';
  const t = Math.max(0, sec), m = Math.floor(t / 60), ss = t % 60;
  return [m >= 10 ? hudDigitKey(Math.floor(m / 10) % 10) : null, hudDigitKey(m % 10), 'hud/colon', hudDigitKey(Math.floor(ss / 10)), hudDigitKey(ss % 10)];
}

/** Ações em que o traje (item da arena 10) não tem desenho próprio no original: o jogador aparece normal. */
const COSTUME_OFF = new Set<Player['act']>(['punch', 'pPunch', 'throw', 'dying']);
export const costumeKey = (p: Player): HdKey =>
  `costume/${p.costume & 7}/${p.moveDir !== 8 ? 'walk' : 'idle'}/${faceToHdDir(p.face)}`;
/** Ações sem direção na arte. */
const NO_DIR = new Set<Player['act']>(['dying', 'victory']);

/** Chave do corpo do jogador a pé (ou montando/desmontando, que usam a ação do núcleo). */
export function bodyKey(p: Player): HdKey {
  return NO_DIR.has(p.act) ? charKey(p.char, p.act) : charKey(p.char, p.act, faceToHdDir(p.face));
}

/** Desenhos de um jogador em campo: montaria (atrás) e corpo (de traje quando o original troca o desenho). */
export function playerKeys(p: Player): { mount: HdKey | null; body: HdKey } {
  const r = rider(p);
  if (!r) return { mount: null, body: p.costume >= 0 && p.state === 'alive' && !COSTUME_OFF.has(p.act) ? costumeKey(p) : bodyKey(p) };
  const dir = faceToHdDir(p.face);
  return { mount: mountKey(r.type, r.phase, dir), body: r.phase === 'riding' ? riderKey(p.char, p.face) : bodyKey(p) };
}

/** Jogadores desenhados como jogadores (vivos ou morrendo; o Bad Bomber vem de `s.bad`). */
export const fieldPlayers = (s: RoundState): Player[] => s.players.filter(p => p.present && (p.state === 'alive' || p.state === 'dying'));

/** Tipo da bomba `id` (voando/na mão), 0 se já sumiu. */
export const bombTypeOf = (s: RoundState, id: number): number => s.bombs.find(b => b.id === id)?.type ?? 0;

/** Chaves que cada categoria precisa neste quadro (categoria sem nada em campo = lista vazia = coberta).
 *  Opcionais com substituto (não entram aqui): `stage/<n>/floorAlt` (→ floor), `fx/pressure-block` (→ peça
 *  `pressure`), `fx/pressure-shadow`, `fx/item-burn` (→ peça `burning`). */
export function requiredKeys(s: RoundState, crowns: readonly number[] = []): Record<HdCategory, HdKey[]> {
  const req: Record<HdCategory, HdKey[]> = { arena: [], items: [], flames: [], bombs: [], eggs: [], players: [], hud: [] };
  req.arena = ARENA_TILES.map(t => stageKey(s.stage, t));
  s.grid.forEach((v, c) => {
    if (v === CODE.FLAME) req.flames.push(flameKey(s.cellAux[c]));
    else if (isEggCode(v)) req.eggs.push(eggKey(v & 0xf));
    else if (isItemCode(v)) req.items.push(itemKey(itemOfCode(v)));
    // queimando (bloco ou item): peça `burning` da arena
  });
  for (const b of s.bombs) if (b.state !== 'air') req.bombs.push(bombKey(b.type));
  for (const f of s.flyers) {
    if (f.kind === 'bomb') req.bombs.push(bombKey(bombTypeOf(s, f.ref)));
    else if (f.kind === 'item') req.items.push(itemKey(f.ref));
  }
  for (const p of fieldPlayers(s)) {
    const k = playerKeys(p);
    req.players.push(k.body);
    if (k.mount) req.players.push(k.mount);
  }
  for (const b of s.bad) {
    const p = s.players[b.slot];
    if (p) req.players.push(charKey(p.char, 'bad', faceToHdDir(b.face)));
  }
  const clock = hudClockGlyphs(s.clock.sec);
  req.hud = [...HUD_KEYS, ...(clock === 'infinity' ? ['hud/infinity'] : clock.filter((k): k is HdKey => k !== null))];
  s.players.forEach((p, i) => { if (p.present) req.hud.push(hudHeadKey(p.char), hudCrownKey(crowns[i] ?? 0)); });
  return req;
}

/** Categorias que o pacote cobre por completo neste quadro (`crowns`: coroas de cada slot, para o HUD). */
export function hdCoverage(s: RoundState, pack: HdPack, crowns: readonly number[] = []): Set<HdCategory> {
  const req = requiredKeys(s, crowns);
  const out = new Set<HdCategory>();
  for (const c of HD_CATEGORIES) if (req[c].every(k => pack.anim(k) !== null)) out.add(c);
  return out;
}

/** `under`: desenhadas pelo HD por baixo da base; `over`: por cima; `skip` = as duas (o que a base pula). */
export interface HdPlan { under: readonly HdCategory[]; over: readonly HdCategory[]; skip: HdSkip }

/** Prefixo coberto (de baixo para cima) vai por baixo da base; sufixo coberto vai por cima; o meio fica na base. */
export function hdPlan(covered: ReadonlySet<HdCategory>): HdPlan {
  const C = HD_CATEGORIES;
  let i = 0;
  while (i < C.length && covered.has(C[i])) i++;
  let j = C.length;
  while (j > i && covered.has(C[j - 1])) j--;
  const under = C.slice(0, i), over = C.slice(j);
  return { under, over, skip: new Set([...under, ...over]) };
}
