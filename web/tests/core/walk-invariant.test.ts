// Invariante "ninguém entra andando numa bomba": jogador sem atravessa-bomba, de pé e no chão, que muda de casa não
// pode cair numa casa onde já havia uma bomba parada (a mesma) antes do tick. Estar sobre a própria bomba recém-posta
// ou sobre bomba que parou/pousou embaixo dele é legal — só a entrada vinda de outra casa conta.
// Fuzz com entradas aleatórias (direcional com diagonais, metade das vezes contra a bomba mais próxima, A/B/Y/X),
// itens sorteados (chute, luva, soco, P, velocidade), montarias e coração renovado para a rodada não acabar cedo.
import { createMatch, startRound } from '../../src/core/match';
import { step } from '../../src/core/step';
import { BTN, CODE, type RoundState } from '../../src/core/types';
import { cellAt, faceStep } from '../../src/core/units';
import type { MountRider } from '../../src/core/mounts/types';
import { rules } from './kit';
import { st9 } from '../../src/core/stages/stage9';

function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const DIRS = [BTN.UP, BTN.DOWN, BTN.LEFT, BTN.RIGHT, BTN.UP | BTN.LEFT, BTN.UP | BTN.RIGHT, BTN.DOWN | BTN.LEFT, BTN.DOWN | BTN.RIGHT, 0];
const FACE_BTN = [BTN.UP, 0, BTN.RIGHT, 0, BTN.DOWN, 0, BTN.LEFT];
const MOUNT_TYPES = [2, 3, 0xa, 0xc, 0xd, 0xe, 0xf];

/** No pulo da gangorra da arena 9 (passa por cima de parede, soft e bomba — §7.6 do relatório de arenas). */
const jumping = (s: RoundState, slot: number): boolean => s.stage === 9 && st9(s).jumps.some(j => j.slot === slot);
/** No chão e sujeito à regra. */
const subject = (s: RoundState, slot: number): boolean => {
  const p = s.players[slot];
  return p.present && p.state === 'alive' && p.heldBy < 0 && !p.flying && !p.passBomb && !jumping(s, slot);
};
const idleBombs = (s: RoundState): Map<number, number> => new Map(s.bombs.filter(b => b.state === 'idle').map(b => [b.cell, b.id]));

/** Joga `ticks` ticks de entradas aleatórias; devolve as violações. */
function fuzz(stage: number, seed: number, ticks: number): string[] {
  const out: string[] = [];
  const rnd = prng(seed * 7919 + stage);
  const s = startRound(createMatch(rules({ timeIdx: 4 }), stage, seed));
  while (s.phase === 'intro') step(s, [0, 0, 0, 0, 0]);
  for (const p of s.players) {
    p.kick = rnd() < 0.6; p.glove = rnd() < 0.5; p.punch = rnd() < 0.5; p.pItem = rnd() < 0.3;
    p.bombsCap = p.bombsFree = 2 + Math.floor(rnd() * 6); p.fire = Math.floor(rnd() * 3); p.speedLv = 1 + Math.floor(rnd() * 5);
    if (rnd() < 0.3) {
      p.mount = { type: MOUNT_TYPES[Math.floor(rnd() * MOUNT_TYPES.length)], slot: 1, phase: 'riding', t0: s.tick,
        reserves: rnd() < 0.5 ? [2] : [], trail: [], cooldown: 0, remount: false, remountFx: null } satisfies MountRider;
    }
  }
  const ctl = s.players.map(() => ({ dir: 0, hold: 0, a: 0 }));
  for (let i = 0; i < ticks && s.phase === 'play'; i++) {
    const inputs = s.players.map((p, k) => {
      const q = ctl[k];
      if (q.hold-- <= 0) {
        q.hold = 1 + Math.floor(rnd() * 25);
        const here = cellAt(p.x, p.y);
        const near = (f: number): boolean => s.bombs.some(b => b.state === 'idle' && (faceStep(here, f) === b.cell || faceStep(faceStep(here, f), f) === b.cell));
        const f = [0, 2, 4, 6].find(near);
        if (f !== undefined && rnd() < 0.6) {
          const side = rnd() < 0.3 ? (f === 0 || f === 4 ? (rnd() < 0.5 ? BTN.LEFT : BTN.RIGHT) : (rnd() < 0.5 ? BTN.UP : BTN.DOWN)) : 0;
          q.dir = FACE_BTN[f] | side;
        } else q.dir = DIRS[Math.floor(rnd() * DIRS.length)];
      }
      let b = q.dir;
      if (q.a > 0) { q.a--; b |= BTN.A; } else if (rnd() < 0.04) q.a = rnd() < 0.5 ? 1 : Math.floor(rnd() * 40);
      if (rnd() < 0.02) b |= BTN.B;
      if (rnd() < 0.02) b |= BTN.Y;
      if (rnd() < 0.01) b |= BTN.X;
      return b;
    });
    for (const p of s.players) p.heart = true;
    const before = idleBombs(s), cells = s.players.map(p => cellAt(p.x, p.y)), ok = s.players.map((_, k) => subject(s, k));
    step(s, inputs);
    const after = idleBombs(s);
    for (let k = 0; k < 5; k++) {
      const c1 = cellAt(s.players[k].x, s.players[k].y);
      if (!ok[k] || !subject(s, k) || c1 === cells[k] || c1 < 0) continue;
      const id = before.get(c1);
      // Arena 3: a bola que para numa casa grava $0F41 por cima de tudo ($C3:082F/$C3:0847, sem olhar a bomba posta
      // enquanto ela rolava para lá) e, quando volta a rolar, repõe o piso ($C3:085A → $C1:532C): a bomba fica fora da
      // grade e passável — a ROM faz o mesmo (ver AJUSTE-WALK.md). Fora disso, é violação.
      const orbGhost = stage === 3 && s.grid[c1] !== CODE.BOMB;
      if (id !== undefined && after.get(c1) === id && !orbGhost) {
        out.push(`fase ${stage}, semente ${seed}, tick ${s.tick}: P${k + 1} ${cells[k]} → ${c1} (bomba ${id})`);
      }
    }
  }
  return out;
}

describe('ninguém entra andando numa bomba parada (fuzz de entradas aleatórias)', () => {
  it('10 fases × 2 sementes × 4000 ticks, 5 jogadores com itens e montarias', () => {
    const errs: string[] = [];
    for (let stage = 1; stage <= 10; stage++) for (const seed of [1000, 1001]) errs.push(...fuzz(stage, seed, 4000));
    expect(errs).toEqual([]);
  }, 120_000);
});
