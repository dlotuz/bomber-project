import type { RoundState, Player, GameEvent } from '../types';
import { rider, mstate, sameClass, MAX_ACTIVE, MAX_RESERVES, MOUNTING_TICKS, type MountRider, type MountState } from './types';
import { EGG_TYPES, rnd, lockAct, isEggCode, cellAt, centerX, centerY, colOf, linOf } from './core-api';
import { mev } from './events';
import { dropHeld } from '../flyers';
import { releaseGrab } from '../grab';

export function eggsOnGrid(s: RoundState): number {
  let n = 0;
  for (const c of s.grid) if (isEggCode(c)) n++;
  return n;
}

/** $1ED4 derivado (L2) — fonte única: o `eggsInPlay` do plano 8 (caça-níquel) usa esta conta. Referências da ROM:
 *  +1 revelação ($C1:5E3D) e caça-níquel ($C3:19C5, ovo voando); +1 ao montar ($C1:64BF) e −1 no fim da explosão
 *  do choco ($C1:5FD9) — o ovo pisado conta junto com a montaria durante `mounting` (medido: 41–45 ticks; core: a
 *  fase inteira, 42); 0 ao virar reserva ($C1:6417); −1 no início de qualquer perda por $C2:4B89 ($C2:60B9), então
 *  quem desmonta sem reserva e o míssil D em voo NÃO contam; −1 reserva queimada ($C2:6680, L22). */
export function activeCount(s: RoundState): number {
  let n = eggsOnGrid(s);
  for (const f of s.flyers) if (f.kind === 'item' && f.ref >= 0x30 && f.ref <= 0x3f) n++;
  for (const p of s.players) {
    const r = rider(p);
    if (!r) continue;
    if (r.phase === 'mounting') n += 2;
    else if (r.phase === 'riding' || r.remount) n++;
    n += r.reserves.length;
  }
  n += (s.mountState as MountState | null)?.bursts?.length ?? 0;   // leitura sem criar o estado (L22)
  return n;
}

/** Menor vaga de sprite livre (L3). */
export function freeSlot(s: RoundState): 0 | 1 | 2 {
  const used = new Set<number>();
  for (const p of s.players) { const r = rider(p); if (r && r.slot) used.add(r.slot); }
  for (const pr of mstate(s).projectiles) if (pr.state !== 'done' && pr.slot) used.add(pr.slot);
  return !used.has(1) ? 1 : !used.has(2) ? 2 : 0;
}

export function revealEgg(s: RoundState, cell: number, ev: GameEvent[]): void {
  if (activeCount(s) >= MAX_ACTIVE) return;              // JML $C3:50C9: o bloco não dá nada
  const t = EGG_TYPES[rnd(s.rng, 14)];
  s.grid[cell] = 0x0970 + t;
  ev.push(mev({ id: 'egg_revealed', cell, mount: t }));
}

export function stepOnEgg(s: RoundState, p: Player, cell: number, ev: GameEvent[]): void {
  const code = s.grid[cell];
  if (!isEggCode(code) || p.state !== 'alive') return;
  const t = code & 0x0f;
  const r = rider(p);
  if (!r) {
    s.grid[cell] = 0;
    const nr: MountRider = { type: t, slot: freeSlot(s) || 1, phase: 'mounting', t0: s.tick, reserves: [], trail: [], cooldown: 0, remount: false, remountFx: null };
    p.mount = nr;
    p.x = centerX(colOf(cell)); p.y = centerY(linOf(cell));   // choca embaixo: o jogador vai para o centro do ovo
    if (p.carry >= 0) dropHeld(s, p);   // montado não usa luva: a bomba da mão fica na casa do ovo
    if (p.grab >= 0) releaseGrab(s, p);   // ... e quem estava na mão é solto
    lockAct(s, p, 'mounting', MOUNTING_TICKS);
    ev.push(mev({ id: 'mount_start', slot: p.slot, mount: t }));
    return;
  }
  if (r.phase === 'riding' && sameClass(t, r.type) && r.reserves.length < MAX_RESERVES) {   // ROM: só t < 8
    s.grid[cell] = 0;
    r.reserves.push(t);
    ev.push(mev({ id: 'egg_reserved', slot: p.slot, mount: t }));
  }
}

/** Extra: pode receber um ovo do tipo `t` (a pé monta; montado na mesma classe e com vaga, vira reserva). */
function canTake(p: Player, t: number): boolean {
  const r = rider(p);
  return !r || (r.phase === 'riding' && sameClass(t, r.type) && r.reserves.length < MAX_RESERVES);
}

/** Extra: outro jogador que pisa na casa de um ovo reserva (`trail[i + 1]`) rouba esse ovo, se puder recebê-lo. */
export function stealReserves(s: RoundState, ev: GameEvent[]): void {
  for (const p of s.players) {
    const r = rider(p);
    if (!r) continue;
    for (let i = 0; i < r.reserves.length; i++) {
      const cell = r.trail[i + 1];
      if (cell === undefined) continue;
      const t = r.reserves[i];
      const q = s.players.find(o => o !== p && o.state === 'alive' && o.heldBy < 0 && !o.flying
        && cellAt(o.x, o.y) === cell && canTake(o, t));
      if (!q) continue;
      r.reserves.splice(i, 1); i--;
      ev.push(mev({ id: 'egg_stolen', slot: q.slot, from: p.slot, mount: t }));
      const code = s.grid[cell];
      s.grid[cell] = 0x0970 + t;                           // passa pelo caminho normal de pisar no ovo
      stepOnEgg(s, q, cell, ev);
      s.grid[cell] = code;                                 // o ovo não estava na grade: a casa volta ao que era
    }
  }
}
