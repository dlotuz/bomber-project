// IA das CPUs no núcleo fiel. Determinística (só estado + AiState; sorteio por aiRoll) e sem ler `hidden` nem `rng`.
import { BTN, CODE, DIR_BTNS, DISEASE, type Player, type RoundState } from '../types';
import { FLAME_TICKS, FUSE } from '../constants';
import { standing, playerCell } from '../state';
import { faceStep } from '../units';
import { blockedFor } from '../movement';
import { MOUNTS } from '../mounts';
import { AI_LEVELS } from './level';
import { crossCells } from './danger';
import { centered, enterTicks, faceTo, passable, steer } from './nav';
import { newBrain, oldestRemote, think, walkBlocked, type Brain } from './brain';

export { AI_LEVELS, aiRoll, type AiLevel } from './level';
export { SAFE, dangerMap } from './danger';
export type { Brain } from './brain';

/** Memória das CPUs (caminho planejado, próxima decisão, botões do tick anterior). Fica fora do RoundState de
 *  propósito; um rollback online que restaure um RoundState antigo precisa clonar e restaurar esta memória junto. */
export interface AiState { round: RoundState | null; brains: Brain[]; lastOut: number[]; bombsSig: number }

export function createAi(): AiState {
  return { round: null, brains: [], lastOut: [0, 0, 0, 0, 0], bombsSig: 0 };
}

const STATE_CODE = { idle: 0, kicked: 1, held: 2, air: 3 } as const;
const FACE_BTN = [BTN.UP, 0, BTN.RIGHT, 0, BTN.DOWN, 0, BTN.LEFT];

function swapDirs(b: number): number {
  let out = b & ~DIR_BTNS;
  if (b & BTN.UP) out |= BTN.DOWN;
  if (b & BTN.DOWN) out |= BTN.UP;
  if (b & BTN.LEFT) out |= BTN.RIGHT;
  if (b & BTN.RIGHT) out |= BTN.LEFT;
  return out;
}

/** Segue o caminho planejado: tira as casas já alcançadas, espera o tick planejado e a chama da próxima apagar. */
function drive(s: RoundState, p: Player, brain: Brain): number {
  const here = playerCell(p);
  const near = centered(s, p);
  while (brain.path.length && brain.path[0] === here && near) { brain.path.shift(); brain.go.shift(); }
  const next = brain.path[0] ?? here;
  if (next !== here) {
    if (faceTo(here, next) < 0 || !passable(s, p, next, walkBlocked(s, p))) {
      brain.path = []; brain.go = [];                        // saiu do caminho ou apareceu um bloqueio: replaneja
    } else {
      const flameLeft = s.grid[next] === CODE.FLAME ? s.cellT0[next] + FLAME_TICKS + 1 - s.tick : 0;
      const burning = s.grid[next] === CODE.BURNING;
      if (s.tick >= (brain.go[0] ?? 0) && !burning && flameLeft <= enterTicks(s, p, next)) return steer(s, p, next);
    }
  }
  return steer(s, p, here);
}

/** Caveira $26 (não para): sem direção o jogador segue a última; para ficar parado, empurra uma parede vizinha. */
function brake(s: RoundState, p: Player): number {
  const here = playerCell(p);
  const kicks = p.kick || !!MOUNTS.current.kicks?.(p);
  for (const face of [0, 2, 4, 6]) {
    const v = s.grid[faceStep(here, face)] ?? CODE.HARD;
    if (v === CODE.BOMB ? !kicks && !p.passBomb : blockedFor(p, v)[0]) return FACE_BTN[face];
  }
  return 0;
}

/** Detona a remota mais antiga quando o pavio dela já teria acabado e ninguém do nosso lado está na cruz. */
function wantsDetonate(s: RoundState, p: Player): boolean {
  const b = oldestRemote(s, p);
  if (!b || s.tick < b.born + FUSE || b.state !== 'idle') return false;
  const cross = crossCells(s, b.cell, b.fire, false).cells;
  return !s.players.some(q => standing(q) && cross.includes(playerCell(q))
    && (q === p || (s.rules.mode === 'team' && q.team === p.team)));
}

/**
 * Entradas das CPUs para este tick. `cpu[i]` diz se o slot i é controlado pela IA; os demais recebem 0.
 * Determinístico: depende só do estado da rodada e de `ai`.
 */
export function aiInputs(s: RoundState, ai: AiState, cpu: readonly boolean[], levelIdx: number): number[] {
  if (ai.round !== s) {
    ai.round = s; ai.brains = s.players.map(() => newBrain()); ai.lastOut = [0, 0, 0, 0, 0]; ai.bombsSig = 0;
  }
  // bomba nova, explodida, chutada, arremessada ou em cadeia: antecipa a próxima decisão (conforme `alert` do nível)
  let sig = s.bombs.length;
  for (const b of s.bombs) sig = (Math.imul(sig, 31) + b.id * 8 + STATE_CODE[b.state] + (b.chainAt ? 4 : 0)) | 0;
  const changed = sig !== ai.bombsSig;
  ai.bombsSig = sig;
  const level = AI_LEVELS[Math.max(0, Math.min(AI_LEVELS.length - 1, levelIdx))];
  const out = [0, 0, 0, 0, 0];
  if (s.phase !== 'play') { ai.lastOut = out; return out; }
  for (const p of s.players) {
    if (!cpu[p.slot] || !standing(p)) continue;
    const brain = ai.brains[p.slot];
    const last = ai.lastOut[p.slot] ?? 0;
    if (changed) brain.nextThink = Math.min(brain.nextThink, s.tick + level.alert);
    const react = p.disease === DISEASE.DIARRHEA ? 1 : level.react;
    let btn: number | null = null;
    if (s.tick >= brain.nextThink) {
      think(s, p, level, brain);
      brain.nextThink = s.tick + react;
      // solta a bomba parado (neste tick não anda) para ela cair exatamente na casa planejada; A é borda
      if (brain.bomb) {
        if (last & BTN.A) { brain.nextThink = s.tick + 1; btn = 0; } else btn = BTN.A;
        if (p.disease === DISEASE.NO_STOP) btn |= brake(s, p);
      }
    }
    if (btn === null) {
      btn = drive(s, p, brain);
      if (!(btn & DIR_BTNS) && p.disease === DISEASE.NO_STOP) btn |= brake(s, p);
      if (!(last & BTN.B) && wantsDetonate(s, p)) btn |= BTN.B;
    }
    if (p.disease === DISEASE.REVERSE || p.effect.kind === 0x0a) btn = swapDirs(btn);
    out[p.slot] = btn;
  }
  ai.lastOut = out.slice();
  return out;
}
