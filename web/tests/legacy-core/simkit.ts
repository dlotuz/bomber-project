import { createRound, step } from '../../src/legacy-core/round';
import { createAi, aiInputs, dangerMap, type AiState } from '../../src/legacy-core/ai';
import { cellX, cellY, idx } from '../../src/legacy-core/grid';
import { CELL, DX, DY, defaultRules, type Rules, type RoundState } from '../../src/legacy-core/types';

/** Causa de uma morte numa rodada simulada: dono da bomba que começou a cadeia de explosões que matou.
 *  `mate` = bomba de um colega de time. `trapped` = a própria bomba matou, mas o jogador estava cercado: alguma
 *  bomba de outro jogador (já no chão naquele tick) também pegaria a casa dele. */
export type DeathCause = 'own' | 'trapped' | 'mate' | 'enemy' | 'pressure' | 'unknown';

export interface Death { victim: number; by: number; cause: DeathCause; doomed: boolean }

export interface SimOpts {
  seed: number;
  stage?: number;
  rules?: Partial<Rules>;
  /** Nível da IA por slot; `null` = slot desligado. */
  levels: (number | null)[];
  /** Limite de frames da simulação (padrão: tempo da rodada + folga). */
  maxFrames?: number;
  /** Ajustes no estado depois do intro (ex.: itens, doenças). */
  setup?: (s: RoundState) => void;
  /** Chamado antes de cada tick com as entradas decididas (para depurar). */
  before?: (s: RoundState, inputs: number[], ais: AiState[]) => void;
  /** Chamado a cada morte já com a causa atribuída (para depurar). */
  onDeath?: (s: RoundState, d: Death) => void;
}

export interface SimResult {
  frames: number;          // frames jogados (sem o intro)
  finished: boolean;       // chegou em 'result'
  timeUp: boolean;         // acabou por tempo (relógio zerado)
  winners: number[];
  /** `doomed`: bombas de outros donos (que não o da cadeia que matou) também pegariam a casa em até TRAP_WINDOW ticks. */
  deaths: Death[];
  bombs: number[];         // bombas colocadas por slot
  maxOsc: number[];        // maior sequência de frames em que a posição alternou A,B,A,B
  state: RoundState;
}

/** Uma bomba de outro dono que pegaria a casa em até este número de ticks conta como "cercado". */
const TRAP_WINDOW = 60;

/** Roda uma rodada só de CPUs, atribuindo cada morte à bomba que começou a cadeia de explosões. */
export function simulate(o: SimOpts): SimResult {
  const active = o.levels.map(l => l !== null);
  const rules: Rules = { ...defaultRules(), ...o.rules, active };
  const s = createRound(o.stage ?? 1, rules, o.seed);
  while (s.phase === 'intro') step(s, [0, 0, 0, 0, 0]);
  o.setup?.(s);

  // uma memória de IA por nível (aiInputs recebe um nível só)
  const byLevel = new Map<number, { ai: AiState; mask: boolean[] }>();
  o.levels.forEach((l, slot) => {
    if (l === null) return;
    if (!byLevel.has(l)) byLevel.set(l, { ai: createAi(), mask: [false, false, false, false, false] });
    byLevel.get(l)!.mask[slot] = true;
  });
  const groups = [...byLevel.entries()].sort((a, b) => a[0] - b[0]);

  const n = s.arena.flame.length;
  const flameOwner = new Int32Array(n).fill(-1);
  const res: SimResult = {
    frames: 0, finished: false, timeUp: false, winners: [], deaths: [], bombs: [0, 0, 0, 0, 0],
    maxOsc: [0, 0, 0, 0, 0], state: s,
  };
  const hist = s.players.map(p => [p.x * 4096 + p.y, p.x * 4096 + p.y]);
  const osc = [0, 0, 0, 0, 0];
  const limit = o.maxFrames ?? (s.timeLeft < 0 ? 60 * 60 * 10 : s.timeLeft + 600);

  for (let f = 0; f < limit && s.phase !== 'result'; f++) {
    const inputs = [0, 0, 0, 0, 0];
    for (const [lvl, g] of groups) {
      const out = aiInputs(s, g.ai, g.mask, lvl);
      g.mask.forEach((m, i) => { if (m) inputs[i] = out[i]; });
    }
    o.before?.(s, inputs, groups.map(g => g[1].ai));
    const pre = s.bombs.map(b => ({ owner: b.owner, x: b.x, y: b.y, fuse: b.fuse, slide: b.slide, free: !b.carried && !b.flight }));
    const preFlame = s.arena.flame.slice();
    const preBombs = s.bombs.map(b => ({ ...b }));
    const ev = step(s, inputs);
    res.frames++;

    // explosões deste frame → dono da bomba que iniciou a cadeia
    const ex = ev.filter(e => e.type === 'explosion') as { gx: number; gy: number; arms: number[] }[];
    const used = new Set<number>();
    const info = ex.map(e => {
      let k = pre.findIndex((b, j) => !used.has(j) && b.free &&
        ((cellX(b.x) === e.gx && cellY(b.y) === e.gy) ||
         (cellX(b.x + DX[b.slide] * 16) === e.gx && cellY(b.y + DY[b.slide] * 16) === e.gy)));
      if (k >= 0) used.add(k);
      const cells = [idx(e.gx, e.gy)];
      for (let d = 1; d <= 4; d++) for (let r = 1; r <= e.arms[d - 1]; r++) cells.push(idx(e.gx + DX[d] * r, e.gy + DY[d] * r));
      return { k, c: idx(e.gx, e.gy), cells, root: -2 };
    });
    const rootOf = (i: number, depth: number): number => {
      const x = info[i];
      if (x.root !== -2) return x.root;
      if (depth > 20) return -1;
      const b = x.k >= 0 ? pre[x.k] : null;
      let r = -1;
      if (b && b.fuse - 1 <= 0) r = b.owner;
      // entrou (chutada/arremessada) numa chama que já estava acesa: a nova cadeia é dela
      else if (preFlame[x.c] > 1) r = b ? b.owner : flameOwner[x.c];
      else {
        const j = info.findIndex((y, jj) => jj !== i && y.cells.includes(x.c));
        r = j >= 0 ? rootOf(j, depth + 1) : (b ? b.owner : -1);
      }
      x.root = r;
      return r;
    };
    info.forEach((x, i) => { const r = rootOf(i, 0); for (const c of x.cells) flameOwner[c] = r; });

    for (const e of ev) {
      if (e.type === 'bomb_placed') res.bombs[e.slot]++;
      if (e.type === 'player_hit') {
        const p = s.players[e.slot];
        const c = idx(cellX(p.x), cellY(p.y));
        let by = -1, cause: DeathCause = 'unknown', doomed = false;
        if (s.arena.cells[c] === CELL.HARD) cause = 'pressure';
        else if (s.arena.flame[c] > 0) {
          by = flameOwner[c];
          // bombas de outros donos (já no chão neste tick) também pegariam a casa em breve?
          const noFlame = { ...s.arena, flame: preFlame.map(() => 0) };
          const others = dangerMap({ ...s, timeLeft: -1, arena: noFlame, bombs: preBombs.filter(b => b.owner !== by) });
          doomed = others[c] <= TRAP_WINDOW;
          if (by === e.slot) cause = doomed ? 'trapped' : 'own';
          else if (by >= 0 && rules.mode === 'team' && rules.teams[by] === rules.teams[e.slot]) cause = 'mate';
          else if (by >= 0) cause = 'enemy';
        }
        res.deaths.push({ victim: e.slot, by, cause, doomed });
        o.onDeath?.(s, { victim: e.slot, by, cause, doomed });
      }
    }

    for (const p of s.players) {
      if (!p.active || !p.alive || p.dying > 0) { osc[p.slot] = 0; continue; }
      const h = hist[p.slot], cur = p.x * 4096 + p.y;
      if (cur === h[0] && cur !== h[1]) osc[p.slot]++; else osc[p.slot] = 0;
      res.maxOsc[p.slot] = Math.max(res.maxOsc[p.slot], osc[p.slot]);
      h[0] = h[1]; h[1] = cur;
    }
  }
  res.finished = s.phase === 'result';
  res.timeUp = res.finished && s.timeLeft === 0;
  res.winners = [...s.winners];
  return res;
}
