// Varredura "bomba chutada parando sem motivo" (aj/stop2). Para cada tick: toda bomba que estava rolando ('kicked') e
// virou parada ('idle') precisa de um motivo físico ou do X do DONO ($C1:38CE → $C2:5A77). Motivos aceitos:
//  - donoX: o dono (bomba +$20) com X segurado neste tick;
//  - corpo: jogador de pé na casa da bomba ou na da frente ($C1:3644, $C1:36AC, $C1:3403);
//  - bloco: casa da frente com parede/bloco/pressão (bits $8400), ovo, outra bomba, ou a arena manda parar;
//  - fusao: extra das bombas em movimento que se batem (a atingida evolui e para).
// Qualquer outra parada é uma violação. Também confere a cada tick que ninguém (sem atravessa-bomba nem tipo 1) entrou
// andando na casa do centro de uma bomba rolando: a ROM barra o movimento ($C2:3287 → $C2:3566).
import { appendFileSync } from 'node:fs';
import { arena, put, C } from './kit';
import { ride } from '../mounts/helpers';
import { step } from '../../src/core/step';
import { addBomb, bombOccupies } from '../../src/core/bombs';
import { createMatch, finishRound, startRound } from '../../src/core/match';
import { aiInputs, createAi } from '../../src/core/ai';
import { BTN, CODE, type Bomb, type RoundState, type Rules } from '../../src/core/types';
import { SUB, cellAt, faceStep } from '../../src/core/units';
import { kickPending } from '../../src/core/bombs';
import { passesBomb } from '../../src/core/movement';
import { isEggCode, playerCell, standing } from '../../src/core/state';
import { STAGES } from '../../src/core/stages';
import { rules } from './kit';

interface Pre { cell: number; dir: number; level: number; owner: number; kickedBy: number }
export interface Stop { tick: number; id: number; owner: number; kickedBy: number; cell: number; reason: string }

const body = (s: RoundState, c: number): boolean =>
  s.players.some(q => standing(q) && q.heldBy < 0 && !q.flying && playerCell(q) === c);

function blockedAt(s: RoundState, b: Bomb, f: number): boolean {
  if (f < 0) return true;
  const v = s.grid[f] ?? 0xec40;
  // CODE.FALLING ($0001): bloco de pressão caindo; a bomba não estaciona nele e volta para a casa anterior (`park`)
  return (v & 0x8400) !== 0 || v === CODE.FALLING || isEggCode(v) || bombOccupies(s, f, b)
    || STAGES[s.stage]?.kickedBombEnter?.(s, b, f) === 'stop';
}

/** Motivo da parada da bomba `b` (rolava antes deste tick: `pre`), ou null se não há motivo. */
export function stopReason(s: RoundState, b: Bomb, pre: Pre): string | null {
  if ((s.players[b.owner]?.prevBtn ?? 0) & BTN.X) return 'donoX';
  if ((b.level ?? 0) > pre.level) return 'fusao';
  const dirs = [...new Set([b.dir, pre.dir])];
  if (body(s, b.cell) || dirs.some(d => body(s, faceStep(b.cell, d)))) return 'corpo';
  if (dirs.some(d => blockedAt(s, b, faceStep(b.cell, d)))) return 'bloco';
  return null;
}

/** Um passo, devolvendo as paradas de bombas chutadas deste tick (com o motivo; `reason: '???'` = violação) e as
 *  entradas proibidas (jogador que anda dentro da casa do centro de uma bomba rolando: `reason: 'entrou'`). */
export function stepWatch(s: RoundState, inputs: readonly number[]): Stop[] {
  const pre = new Map<number, Pre>();
  for (const b of s.bombs) if (b.state === 'kicked') pre.set(b.id, { cell: b.cell, dir: b.dir, level: b.level ?? 0, owner: b.owner, kickedBy: b.kickedBy });
  // casa do centro (conta da ROM) de cada bomba rolando na vez dos jogadores: a ocupação $4000 que barra quem anda
  const rolling = new Map<number, Bomb>();
  for (const b of s.bombs) if (b.state === 'kicked' && !kickPending(s, b)) rolling.set(cellAt(b.x + SUB, b.y + SUB), b);
  const was = s.players.map(q => playerCell(q));
  const walked = s.players.map(q => standing(q) && q.heldBy < 0 && !q.flying && !passesBomb(q) && q.push.left <= 0 && q.act !== 'pPunch');
  step(s, inputs);
  const out: Stop[] = [];
  for (const b of s.bombs) {
    const p = pre.get(b.id);
    if (p && b.state === 'idle') out.push({ tick: s.tick, id: b.id, owner: b.owner, kickedBy: p.kickedBy, cell: b.cell, reason: stopReason(s, b, p) ?? '???' });
  }
  for (const q of s.players) {
    const c = playerCell(q), b = rolling.get(c);
    if (b && walked[q.slot] && standing(q) && !passesBomb(q) && q.push.left <= 0 && c !== was[q.slot]) {
      out.push({ tick: s.tick, id: b.id, owner: b.owner, kickedBy: b.kickedBy, cell: c, reason: `entrou(P${q.slot + 1})` });
    }
  }
  return out;
}

/** Gerador determinístico (LCG) para a entrada "caótica". */
function lcg(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 2 ** 32; };
}
const ACTION_BTNS = [BTN.A, BTN.B, BTN.X, BTN.Y, BTN.POWER, BTN.L, BTN.R];
const DIRS = [BTN.UP, BTN.DOWN, BTN.LEFT, BTN.RIGHT];

/** Entrada caótica de um humano: direção + ações seguradas por trechos de 1–30 ticks. `noX` tira o X. */
function chaos(seed: number, noX: boolean): () => number {
  const r = lcg(seed);
  let cur = 0, left = 0;
  return () => {
    if (left-- <= 0) {
      left = 1 + Math.floor(r() * 30);
      cur = r() < 0.8 ? DIRS[Math.floor(r() * 4)] : 0;
      for (const a of ACTION_BTNS) if (r() < 0.15 && !(noX && a === BTN.X)) cur |= a;
    }
    return cur;
  };
}

/** Rodadas com CPUs e humanos caóticos; devolve as paradas sem motivo e a contagem de motivos (bombas alheias). */
function sweep(o: { stage: number; seed: number; r?: Partial<Rules>; humans: number[]; noX: boolean; rounds?: number }) {
  const m = createMatch(rules({ cpuLevel: (o.seed % 3) as 0 | 1 | 2, ...o.r }), o.stage, o.seed);
  const bad: string[] = [];
  const count: Record<string, number> = {};
  for (let k = 0; k < (o.rounds ?? 1); k++) {
    const s = startRound(m);
    if (s.rules.powerKey) s.rules.powerKey = o.humans.map((_, i) => i % 2 === 0) as boolean[];
    const ai = createAi(o.seed + k);
    const cpu = [0, 1, 2, 3, 4].map(i => !o.humans.includes(i));
    const pads = [0, 1, 2, 3, 4].map(i => chaos(o.seed * 7 + i * 131 + k, o.noX));
    for (let i = 0; i < 8000 && s.phase !== 'over'; i++) {
      // humanos: dá chute/soco/luva/P para exercitar tudo
      for (const h of o.humans) { const p = s.players[h]; if (p && i === 0) { p.kick = true; p.punch = (h & 1) === 0; p.glove = (h & 1) === 1; p.pItem = h >= 2; } }
      const inp = aiInputs(s, ai, cpu, m.rules.cpuLevel);
      for (const h of o.humans) inp[h] = pads[h]();
      for (const st of stepWatch(s, inp)) {
        const alien = st.kickedBy !== st.owner;
        const ow = s.players[st.owner];
        const who = st.reason !== 'donoX' ? '' : !standing(ow) ? '(morto)' : o.humans.includes(st.owner) ? '(humano)' : '(cpu)';
        const key = `${st.reason}${who}${alien ? ':alheia' : ':propria'}`;
        count[key] = (count[key] ?? 0) + 1;
        // a CPU não para com o X a bomba dela que outro chutou (a CPU original nunca aperta X: ajstop2/cpux.py)
        if (st.reason === '???' || st.reason.startsWith('entrou') || (who === '(cpu)' && alien)) bad.push(`${st.reason} fase ${o.stage} semente ${o.seed} rodada ${k} tick ${st.tick}: bomba ${st.id} (dono ${st.owner}, chutada por ${st.kickedBy}) parou na casa ${st.cell}`);
      }
    }
    finishRound(m, s);
  }
  return { bad, count };
}

describe('varredura: bomba chutada só para por obstáculo ou X do dono', () => {
  it('partidas de CPU + humanos caóticos (com e sem X), 10 fases, todas as montarias; a CPU não para chute alheio', () => {
    const bad: string[] = [];
    const total: Record<string, number> = {};
    for (let stage = 1; stage <= 10; stage++) {
      for (const [k, humans] of [[0, [0]], [1, [0, 1, 2]], [2, []]] as const) {
        for (const noX of [true, false]) {
          const r = sweep({ stage, seed: 200 + 10 * stage + 2 * k + (noX ? 0 : 1), r: { allMounts: k !== 0 }, humans: [...humans], noX, rounds: 2 });
          bad.push(...r.bad);
          for (const [kk, v] of Object.entries(r.count)) total[kk] = (total[kk] ?? 0) + v;
        }
      }
    }
    if (process.env.CB_STOP_LOG) appendFileSync(process.env.CB_STOP_LOG, JSON.stringify(total) + '\n');
    expect(bad).toEqual([]);
  }, 600_000);
});

// ------------------------------------------------------------------------------------------------ cenários dirigidos

/** P1 (slot 0, com chute) chuta para a direita a bomba do P2 (slot 1) na linha 1: de (2,1) a bomba vai até a coluna 14.
 *  O P2 fica longe, na (1,11); o terceiro (slot 2) fica na (13,9), fora do caminho. */
function kickScene(o: { thirdMount?: number; kickerMount?: number; ownerMount?: number } = {}) {
  const s = arena({ players: 3 });
  s.hidden = [];
  const p = put(s, 0, 1, 1); p.kick = true; p.face = 2;
  const q = put(s, 1, 1, 11);
  const t = put(s, 2, 13, 9);
  for (const x of [p, q, t]) { x.punch = true; x.glove = true; x.pItem = true; x.bombsCap = 3; x.bombsFree = 3; x.kick = true; }
  if (o.kickerMount !== undefined) ride(s, 0, o.kickerMount);
  if (o.ownerMount !== undefined) ride(s, 1, o.ownerMount);
  if (o.thirdMount !== undefined) ride(s, 2, o.thirdMount);
  const b = addBomb(s, 1, C(2, 1));
  b.fuse = 400;
  return { s, b };
}

/** Ações de um tick (segurar `held` por `n` ticks a partir do tick `at` do deslize). */
const ACTIONS: Record<string, number> = {
  A: BTN.A, B: BTN.B, Y: BTN.Y, POWER: BTN.POWER, L: BTN.L, R: BTN.R, X: BTN.X,
  'B segurado (trancar)': BTN.B, 'Y+dir': BTN.Y | BTN.DOWN, 'A+dir': BTN.A | BTN.UP,
};

/** Roda o cenário: o chutador empurra para a direita até o chute sair; depois `who` faz `btn` por `hold` ticks a
 *  partir do atraso `delay`. Devolve as paradas (sem as do obstáculo final na parede). */
function scenario(who: number, btn: number, delay: number, hold: number, o: Parameters<typeof kickScene>[0] = {}, powerKey = false) {
  const { s, b } = kickScene(o);
  s.rules.powerKey = [powerKey, powerKey, powerKey, false, false];
  const stops: Stop[] = [];
  let kicked = -1;
  for (let i = 0; i < 120; i++) {
    const inp = [0, 0, 0, 0, 0];
    if (kicked < 0) inp[0] = BTN.RIGHT;
    if (kicked >= 0 && i - kicked >= delay && i - kicked < delay + hold) inp[who] |= btn;
    stops.push(...stepWatch(s, inp));
    if (kicked < 0 && b.state === 'kicked') kicked = i;
  }
  return { s, b, stops };
}

describe('cenários dirigidos: P1 chuta a bomba do P2', () => {
  const MOUNTS_ALL = [undefined, 0x0, 0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x9, 0xa, 0xb, 0xc, 0xd, 0xe, 0xf];
  it('sem ação de ninguém, a bomba vai até a parede (coluna 14)', () => {
    const { b, stops } = scenario(2, 0, 0, 0);
    expect([b.cell, stops.map(x => x.reason)]).toEqual([C(14, 1), ['bloco']]);
  });
  for (const [who, name] of [[2, 'terceiro'], [0, 'chutador'], [1, 'dono']] as const) {
    it(`${name}: cada ação (a pé e montado) não para a bomba alheia — só o X do dono (ou o corpo no caminho)`, () => {
      const errs: string[] = [];
      const seen = new Set<string>();
      for (const mount of MOUNTS_ALL) for (const [an, btn] of Object.entries(ACTIONS)) for (const pk of [false, true]) {
        for (const delay of [0, 1, 3, 7, 12, 20]) {
          const o = who === 2 ? { thirdMount: mount } : who === 0 ? { kickerMount: mount } : { ownerMount: mount };
          const { b, stops } = scenario(who, btn, delay, an.includes('segurado') ? 60 : 1, o, pk);
          const early = stops.filter(x => !(x.reason === 'bloco' && x.cell === C(14, 1)));
          const allowed = who === 1 && btn & BTN.X ? ['donoX', 'corpo'] : ['corpo'];
          for (const e of early) {
            const line = `${name} ${an}${pk ? ' (tecla P)' : ''} montaria ${mount ?? '-'} atraso ${delay}: parou na casa ${e.cell} (${e.reason}), final ${b.cell}`;
            if (!allowed.includes(e.reason)) errs.push(line); else if (process.env.CB_STOP_LOG) seen.add(line.replace(/ atraso \d+/, ''));
          }
        }
      }
      if (seen.size && process.env.CB_STOP_LOG) appendFileSync(process.env.CB_STOP_LOG, [...seen].join('\n') + '\n');
      expect(errs).toEqual([]);
    }, 300_000);
  }
  it('terceiro atravessando o caminho (a pé e montado, com e sem Chute): sem Chute espera e a bomba segue; com Chute a desvia', () => {
    const errs: string[] = [];
    for (const mount of MOUNTS_ALL) for (const kick of [false, true]) for (let delay = 0; delay < 40; delay++) {
      const { s, b } = kickScene(mount === undefined ? {} : { thirdMount: mount });
      const t = put(s, 2, 8, 2); t.kick = kick; t.face = 0;
      let kicked = -1;
      const stops: Stop[] = [];
      for (let i = 0; i < 140; i++) {
        const inp = [kicked < 0 ? BTN.RIGHT : 0, 0, kicked >= 0 && i - kicked >= delay ? BTN.UP : 0, 0, 0];
        stops.push(...stepWatch(s, inp));
        if (kicked < 0 && b.state === 'kicked') kicked = i;
      }
      for (const e of stops) {
        if (e.reason === '???' || e.reason.startsWith('entrou')) errs.push(`montaria ${mount ?? '-'} chute ${kick} atraso ${delay}: ${e.reason} na casa ${e.cell}`);
      }
    }
    expect(errs).toEqual([]);
  }, 300_000);
});
