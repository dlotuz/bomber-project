// IA das CPUs no núcleo fiel. Determinística (só estado + AiState; sorteio por aiRoll) e sem ler `hidden` nem `rng`.
import { BTN, CODE, DIR_BTNS, DISEASE, type Player, type RoundState } from '../types';
import { FLAME_TICKS } from '../constants';
import { standing, playerCell } from '../state';
import { faceStep } from '../units';
import { blockedFor } from '../movement';
import { MOUNTS } from '../mounts';
import { AI_LEVELS } from './level';
import { centered, enterTicks, faceTo, passable, steer } from './nav';
import { newBrain, think, walkBlocked, type Brain } from './brain';
import { decideActions } from './actions';
import { badInputs } from './bad';

export { AI_LEVELS, aiRoll, type AiLevel } from './level';
export { SAFE, dangerMap } from './danger';
export type { Brain } from './brain';

/** Memória das CPUs (caminho planejado, próxima decisão, botões do tick anterior). Fica fora do RoundState de
 *  propósito; um rollback online que restaure um RoundState antigo precisa clonar e restaurar esta memória junto. */
export interface AiState { round: RoundState | null; brains: Brain[]; lastOut: number[]; bombsSig: number; seed: number }

/** `seed`: varia os sorteios da IA (aiRoll) entre rodadas; 0 = padrão. */
export function createAi(seed = 0): AiState {
  return { round: null, brains: [], lastOut: [0, 0, 0, 0, 0], bombsSig: 0, seed };
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
  if (brain.push >= 0) {                                    // chute planejado: aponta para a bomba até ela sair
    if (s.grid[faceStep(here, brain.push)] === CODE.BOMB) return FACE_BTN[brain.push];
    brain.push = -1; brain.nextThink = s.tick + 1;
  }
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
  const kicks = (p.kick && !p.mount) || !!MOUNTS.current.kicks?.(p);
  for (const face of [0, 2, 4, 6]) {
    const v = s.grid[faceStep(here, face)] ?? CODE.HARD;
    if (v === CODE.BOMB ? !kicks && !p.passBomb : blockedFor(p, v)[0]) return FACE_BTN[face];
  }
  return 0;
}

/** Parada exigida por uma ação (mira/face): sem direção; com a caveira $26, empurra a casa bloqueada da frente (não
 *  muda a face) ou, se não houver, uma parede vizinha. */
function hold(s: RoundState, p: Player): number {
  if (p.disease !== DISEASE.NO_STOP) return 0;
  const v = s.grid[faceStep(playerCell(p), p.face)] ?? CODE.HARD;
  const kicks = (p.kick && !p.mount) || !!MOUNTS.current.kicks?.(p);
  if (v === CODE.BOMB ? !kicks && !p.passBomb : blockedFor(p, v)[0]) return FACE_BTN[p.face];
  return brake(s, p);
}

/**
 * Entradas das CPUs para este tick. `cpu[i]` diz se o slot i é controlado pela IA; os demais recebem 0.
 * Determinístico: depende só do estado da rodada e de `ai`.
 */
export function aiInputs(s: RoundState, ai: AiState, cpu: readonly boolean[], levelIdx: number): number[] {
  if (ai.round !== s) {
    ai.round = s; ai.brains = s.players.map(() => newBrain(ai.seed)); ai.lastOut = [0, 0, 0, 0, 0]; ai.bombsSig = 0;
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
    if (!cpu[p.slot]) continue;
    if (p.state === 'bad') { out[p.slot] = badInputs(s, p.slot, level, ai.seed); continue; }
    if (!standing(p)) continue;
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
      const act = decideActions(s, p, level, brain, ai);
      if (brain.still) btn = hold(s, p);
      btn |= act;
    }
    if (p.disease === DISEASE.REVERSE || p.effect.kind === 0x0a) btn = swapDirs(btn);
    out[p.slot] = btn;
  }
  ai.lastOut = out.slice();
  return out;
}
