// flyers.ts (T8) — voadores: soco, luva (levantar/arremessar/soltar), quique, volta pela borda e itens voando.
// Decisões 15 e 16: o voador anda a partir do tick seguinte ao da criação; um passo do script por tick
// (horizontal: x += dx, z += dy; vertical: y += dy), depois a volta pela borda; no último passo, pousa.
import { CODE, type Bomb, type FlightId, type Flyer, type GameEvent, type Player, type RoundState } from './types';
import { BOUNCE, ITEM_FLIGHT, PUNCH, THROW, type Script } from './tables/flights';
import { CHAIN_DELAY, LIFT_TICKS, PUNCH_TICKS, THROW_TICKS } from './constants';
import { SUB, WRAP_X, WRAP_Y, cellAt, cellCenter, colAt, colOf, faceStep, inField, inGrid, linAt, linOf } from './units';
import { itemCode, newId, playerCell, setAct, standing } from './state';
import { bombAt, bombById, bombOccupies, removeBomb } from './bombs';
import { stunPlayer } from './hit';

/** Quiques seguidos antes de a bomba sumir e voltar ao dono (proteção contra laço; 🟡). */
const MAX_BOUNCES = 32;

/** Ponto de partida de um arremesso a partir da mão em (x, y): horizontal com altura −16; vertical 16 px acima. */
export function handFrom(x: number, y: number, dir: 0 | 1 | 2 | 3): { x: number; y: number; z: number } {
  return dir === 0 || dir === 2 ? { x, y: y - 16 * SUB, z: 0 } : { x, y, z: -16 };
}
/** Tira a bomba da grade e a põe no ar. */
export function launchBomb(s: RoundState, b: Bomb, flight: FlightId, dir: 0 | 1 | 2 | 3, from: { x: number; y: number; z: number }): Flyer {
  if (b.state === 'idle' && s.grid[b.cell] === CODE.BOMB) s.grid[b.cell] = CODE.FLOOR;
  b.state = 'air';
  const f: Flyer = { id: newId(s), kind: 'bomb', ref: b.id, x: from.x, y: from.y, z: from.z, dir, flight, script: 0, i: 0, born: s.tick };
  s.flyers.push(f);
  return f;
}
/** Item (ou caveira) voando de `cell` pelo script ITEM_FLIGHT[script] (3, 4 ou 5 casas), saindo da altura da mão. */
export function spawnItemFlyer(s: RoundState, item: number, cell: number, script: number): Flyer {
  const dir = ITEM_FLIGHT[script].dir;
  const [cx, cy] = cellCenter(cell);
  const from = handFrom(cx, cy, dir);
  const f: Flyer = { id: newId(s), kind: 'item', ref: item, x: from.x, y: from.y, z: from.z, dir, flight: 'item', script, i: 0, born: s.tick };
  s.flyers.push(f);
  return f;
}

function scriptOf(f: Flyer): Script {
  switch (f.flight) {
    case 'punch': return PUNCH[f.dir];
    case 'bounce': return BOUNCE[f.dir];
    case 'item': return ITEM_FLIGHT[f.script].script;
    default: return THROW[Number(f.flight.slice(5)) as 2 | 3 | 4 | 5][f.dir];
  }
}
const vertical = (dir: number): boolean => dir === 0 || dir === 2;

function wrap(f: Flyer): void {
  const col = colAt(f.x), lin = linAt(f.y);
  if (col > 16) f.x -= WRAP_X; else if (col < 0) f.x += WRAP_X;
  if (lin > 12) f.y -= WRAP_Y; else if (lin < 0) f.y += WRAP_Y;
}

/** Recomeça do centro da casa com o script BOUNCE na mesma direção (bombas contam os quiques em `script`). */
function bounce(f: Flyer, cell: number, ev: GameEvent[]): void {
  [f.x, f.y] = cellCenter(cell); f.z = 0; f.flight = 'bounce'; f.i = 0;
  if (f.kind === 'bomb') { f.script++; ev.push({ type: 'bomb_bounce', cell }); }
}

function land(s: RoundState, f: Flyer, ev: GameEvent[]): void {
  const cell = cellAt(f.x, f.y);
  const out = cell < 0 || !inField(colOf(cell), linOf(cell));
  const v = out ? CODE.HARD : s.grid[cell];
  const drop = (): void => { s.flyers.splice(s.flyers.indexOf(f), 1); };
  if (f.kind === 'item') {
    if (!out && v === CODE.BURNING) { drop(); return; }
    if (!out && v === CODE.FLOOR) { s.grid[cell] = itemCode(f.ref); s.cellT0[cell] = s.tick; drop(); return; }
    bounce(f, cell, ev);
    return;
  }
  const b = bombById(s, f.ref);
  if (!b) { drop(); return; }
  if (!out && v === CODE.BURNING) { drop(); removeBomb(s, b, true); return; }
  const victims = out ? [] : s.players.filter(q => standing(q) && playerCell(q) === cell);
  if (victims.length) { for (const q of victims) stunPlayer(s, q, ev); bounce(f, cell, ev); }
  else if (!out && (v === CODE.FLOOR || v === CODE.FLAME) && !bombOccupies(s, cell)) {
    drop();
    b.state = 'idle'; b.cell = cell; [b.x, b.y] = cellCenter(cell);
    s.grid[cell] = CODE.BOMB;
    if (v === CODE.FLAME) b.chainAt = s.tick + CHAIN_DELAY;
    ev.push({ type: 'bomb_landed', cell });
    return;
  } else bounce(f, cell, ev);
  if (f.script > MAX_BOUNCES) { drop(); removeBomb(s, b, true); }
}

export function tickFlyers(s: RoundState, ev: GameEvent[]): void {
  if (s.phase === 'won') return;
  for (const f of [...s.flyers]) {
    if (f.born === s.tick || !s.flyers.includes(f)) continue;
    const sc = scriptOf(f);
    const [dx, dy] = sc[f.i++];
    f.x += dx * SUB;
    if (vertical(f.dir)) f.y += dy * SUB; else f.z += dy;
    wrap(f);
    if (f.i >= sc.length) land(s, f, ev);
  }
}

/** Alcance do arremesso: 2, 3 ou 4 se o 1º jogador de pé na direção estiver a essa distância; senão 5. */
export function aimThrow(s: RoundState, cell: number, face: number, self: number): 2 | 3 | 4 | 5 {
  let c = cell;
  for (let k = 1; k <= 4; k++) {
    c = faceStep(c, face);
    if (!inGrid(colOf(c), linOf(c))) break;
    if (k >= 2 && s.players.some(q => q.slot !== self && standing(q) && playerCell(q) === c)) return k as 2 | 3 | 4;
  }
  return 5;
}

/** Soco: pose de 8 ticks mesmo sem bomba; a bomba à frente sai do centro da casa com z = 0. */
export function punchBomb(s: RoundState, p: Player, ev: GameEvent[]): boolean {
  if (!p.punch) return false;
  setAct(s, p, 'punch', PUNCH_TICKS);
  const n = faceStep(playerCell(p), p.face);
  const b = bombAt(s, n);
  if (!b) return false;
  const [x, y] = cellCenter(n);
  launchBomb(s, b, 'punch', (p.face >> 1) as 0 | 1 | 2 | 3, { x, y, z: 0 });
  ev.push({ type: 'punch', slot: p.slot });
  return true;
}

/** Luva: levanta a bomba da própria casa (sai da grade) em 4 ticks. */
export function startLift(s: RoundState, p: Player, _ev: GameEvent[]): boolean {
  if (!p.glove || p.carry >= 0) return false;
  const b = bombAt(s, playerCell(p));
  if (!b) return false;
  s.grid[b.cell] = CODE.FLOOR;
  b.state = 'held'; p.carry = b.id; p.throwQueued = false;
  setAct(s, p, 'lift', LIFT_TICKS);
  return true;
}

/** Arremesso da bomba na mão, com a mira de `aimThrow`; pose de 20 ticks. */
export function throwHeld(s: RoundState, p: Player, ev: GameEvent[]): void {
  const b = bombById(s, p.carry);
  p.carry = -1; p.throwQueued = false;
  if (!b) return;
  const cell = playerCell(p);
  const dir = (p.face >> 1) as 0 | 1 | 2 | 3;
  const n = aimThrow(s, cell, p.face, p.slot);
  const [x, y] = cellCenter(cell);
  launchBomb(s, b, `throw${n}` as FlightId, dir, handFrom(x, y, dir));
  setAct(s, p, 'throw', THROW_TICKS);
  ev.push({ type: 'throw', slot: p.slot });
}

/** Solta a bomba da mão: cai na 1ª casa livre de `cells` (padrão: a do jogador); senão some e volta ao dono. */
export function dropHeld(s: RoundState, p: Player, cells: readonly number[] = [playerCell(p)]): void {
  const b = bombById(s, p.carry);
  p.carry = -1; p.throwQueued = false;
  if (!b) return;
  const c = cells.find(c => c >= 0 && s.grid[c] === CODE.FLOOR && !bombOccupies(s, c)) ?? -1;
  if (c >= 0) {
    b.state = 'idle'; b.cell = c; [b.x, b.y] = cellCenter(c); s.grid[c] = CODE.BOMB;
  } else removeBomb(s, b, true);
}
