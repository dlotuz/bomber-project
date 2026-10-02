// Modo de arte HD (opção 5): pacote escolhido pela URL e o estado do quadro da partida, no estilo de hd-menu.ts.
// Sem `?arte=…` nada é carregado e `hdBattleSkip` devolve sempre a lista vazia: o desenho base fica exatamente como
// antes. Com o pacote carregado, o desenho base da partida (ROM ou arte simples) chama `hdBattleSkip` para saber o que
// pular e registra a rodada; `present` chama `drawHdBattleLayer` por baixo e por cima da base.
import type { RoundState } from '../../core';
import type { HdPack } from './types';
import { hdCoverage, hdPlan, NO_SKIP, type HdPlan, type HdSkip } from './cover';
import { drawHdBattle, hdClock } from './draw';
import { loadHdPack, type HdLoadDeps } from './load';

/** Nome do pacote pedido na URL: `?arte=hd` → `provisorio`; `?arte=<nome>` → `<nome>` (letras, dígitos, - e _);
 *  sem o parâmetro (ou `?arte=0`/`rom`) → `null`, modo HD desligado. */
export function hdArtName(search: string): string | null {
  const v = new URLSearchParams(search).get('arte');
  if (v === null || v === '' || v === '0' || v === 'rom') return null;
  if (v === 'hd') return 'provisorio';
  return /^[a-z0-9_-]+$/i.test(v) ? v : null;
}

/** Pasta do pacote servido em `web/public/arte-hd/<nome>/`. */
export const hdPackUrl = (name: string, base = './'): string => `${base}arte-hd/${name}/`;

let pack: HdPack | null = null;
export const hdPack = (): HdPack | null => pack;
/** Troca o pacote (testes; `null` desliga o modo HD). */
export function setHdPack(p: HdPack | null): void { pack = p; }

/** Lê `?arte=` e carrega o pacote em segundo plano (a partida começa com a base e passa ao HD quando ele chega). */
export async function startHdArt(search: string, base = './', deps?: HdLoadDeps): Promise<HdPack | null> {
  const name = hdArtName(search);
  if (!name) return null;
  const p = await loadHdPack(hdPackUrl(name, base), deps);
  if (p) { pack = p; console.info(`Crown Blast: arte HD "${p.manifest.name}" (${p.manifest.credits}).`); }
  return p;
}

interface FrameState { on: boolean; round: RoundState | null; crowns: readonly number[]; plan: HdPlan | null }
const state: FrameState = { on: false, round: null, crowns: [], plan: null };

/** Zera o quadro (chamar antes de cada `app.draw`, junto do `hdBegin` dos menus). */
export function hdBattleBegin(): void { state.on = false; state.round = null; state.plan = null; }
export const hdBattleActive = (): boolean => state.on;
export const hdBattlePlan = (): HdPlan | null => state.plan;

/** Chamado pelo desenho base da partida (quadro principal, com atores): decide o que o pacote cobre neste quadro,
 *  guarda a rodada para a apresentação e devolve o que a base deve pular. Sem pacote: lista vazia, nada guardado. */
export function hdBattleSkip(round: RoundState, crowns: readonly number[]): HdSkip {
  if (!pack) return NO_SKIP;
  const plan = hdPlan(hdCoverage(round, pack, crowns));
  state.on = true; state.round = round; state.crowns = [...crowns]; state.plan = plan;
  return plan.skip;
}

/** Gancho da apresentação: `under` por baixo da base (que fica transparente onde pulou), `over` por cima dela e antes
 *  dos efeitos. `fade` (brilho 0..1) só importa em `over` — a passada `under` já escurece com a base. */
export function drawHdBattleLayer(out: CanvasRenderingContext2D, sx: number, sy: number, ox: number, oy: number,
  pass: 'under' | 'over', fade = 1): boolean {
  if (!state.on || !pack || !state.round || !state.plan) return false;
  const cats = new Set(pass === 'under' ? state.plan.under : state.plan.over);
  if (!cats.size) return false;
  drawHdBattle(out, state.round, pack, sx, sy, ox, oy, hdClock(state.round), { cats, crowns: state.crowns, fade: pass === 'over' ? fade : 1 });
  return true;
}
