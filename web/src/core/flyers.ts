// flyers.ts (T8) — voadores: soco, luva (levantar/arremessar/soltar), quique, volta pela borda e itens voando.
// Decisões 15 e 16: o voador anda a partir do tick seguinte ao da criação; um passo do script por tick
// (horizontal: x += dx, z += dy; vertical: y += dy), depois a volta pela borda; no último passo, pousa.
import { CODE, type Bomb, type FlightId, type Flyer, type GameEvent, type Player, type RoundState } from './types';
import { BOUNCE, ITEM_FLIGHT, PUNCH, THROW, type Script } from './tables/flights';
import { CHAIN_DELAY, LIFT_TICKS, PUNCH_TICKS, THROW_TICKS } from './constants';
import { SUB, WRAP_X, WRAP_Y, cellAt, cellCenter, colAt, colOf, faceStep, inField, inGrid, linAt, linOf } from './units';
import { isEggCode, isItemCode, itemCode, newId, playerCell, setAct, standing } from './state';
import { bombAt, bombById, bombOccupies, removeBomb } from './bombs';
import { hitPlayer, stunPlayer } from './hit';

/** Quiques seguidos antes de a bomba sumir e voltar ao dono (proteção contra laço; 🟡). */
const MAX_BOUNCES = 32;
/** De pé e no chão (fora da mão de alguém e sem estar voando): conta como vítima e obstáculo. */
const grounded = (q: Player): boolean => standing(q) && q.heldBy < 0 && !q.flying;

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
  f.glove = false;   // quicou: sem reflect — cai como bomba comum (atordoa quem estiver segurando bomba)
  if (f.kind !== 'item') f.script++;
  if (f.kind === 'bomb') ev.push({ type: 'bomb_bounce', cell });
}

/** Rearremessa `f` da mão de `q` no sentido contrário, mirando como um arremesso normal dele. */
function reflect(s: RoundState, f: Flyer, q: Player, ev: GameEvent[]): void {
  const dir = ((f.dir + 2) & 3) as 0 | 1 | 2 | 3;
  const cell = playerCell(q);
  const n = aimThrow(s, cell, dir << 1, q.slot);
  const [x, y] = cellCenter(cell);
  Object.assign(f, handFrom(x, y, dir), { dir, flight: `throw${n}` as FlightId, i: 0 });
  ev.push({ type: 'throw', slot: q.slot });
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
  if (f.kind === 'player') { landPlayer(s, f, cell, out, v, ev); return; }
  const b = bombById(s, f.ref);
  if (!b) { drop(); return; }
  if (!out && v === CODE.BURNING) { drop(); removeBomb(s, b, true); return; }
  // $C1:27A4: casa com bit $0800 (bomba $C900, bloco, item, caveira) ou com bomba chutada ([$38] bit $4000) quica
  // ($C1:2868) antes do teste de jogador ($C1:280B → $C1:294D): quem está sobre uma bomba não é atordoado.
  const blocked = out || (v & 0x0800) !== 0 || bombOccupies(s, cell);
  const victims = blocked ? [] : s.players.filter(q => grounded(q) && playerCell(q) === cell);
  // Reflect: bomba da luva caindo em quem segura bomba com a luva volta na direção de quem jogou (só luva × luva)
  const reflector = f.glove ? victims.find(q => q.carry >= 0) : undefined;
  if (reflector) { reflect(s, f, reflector, ev); return; }
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

/** Jogador arremessado com a luva: bloco de pressão mata; chão livre (piso, chama, item, ovo), pousa; parede, bloco,
 *  bomba ou outro jogador (atordoados só com Rules.throwStun), quica e segue na mesma direção — pela borda, volta para a arena. */
function landPlayer(s: RoundState, f: Flyer, cell: number, out: boolean, v: number, ev: GameEvent[]): void {
  const q = s.players[f.ref];
  const settle = (c: number): void => {
    s.flyers.splice(s.flyers.indexOf(f), 1);
    if (!q) return;
    q.flying = false; q.z = 0;
    if (c >= 0) [q.x, q.y] = cellCenter(c);
    setAct(s, q, 'idle', 0);
    if (f.hit) stunPlayer(s, q, ev);
  };
  if (!q || !standing(q)) { settle(-1); return; }
  if (!out && v === CODE.PRESSURE) { settle(cell); hitPlayer(s, q, 'pressure', ev); return; }
  const others = out ? [] : s.players.filter(o => o !== q && grounded(o) && playerCell(o) === cell);
  const onBomb = !out && bombOccupies(s, cell);
  const free = !out && (v === CODE.FLOOR || v === CODE.FLAME || isItemCode(v) || isEggCode(v)) && !onBomb;
  if (!others.length && free) { settle(cell); return; }
  // Outro jogador na casa: quica; com Rules.throwStun, ele e o arremessado (ao pousar) ficam atordoados — menos quem
  // está parado sobre uma bomba (como a bomba que cai, $C1:27A4: a casa da bomba quica antes do teste de jogador)
  if (others.length && s.rules.throwStun && !onBomb) { for (const o of others) stunPlayer(s, o, ev); f.hit = true; }
  bounce(f, cell, ev);
  if (f.script > MAX_BOUNCES) settle(cell);
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
    if (f.kind === 'player') { const q = s.players[f.ref]; if (q) { q.x = f.x; q.y = f.y; q.z = Math.max(0, -f.z); } }
    if (f.i >= sc.length) land(s, f, ev);
  }
}

/** Alcance do arremesso: 2, 3 ou 4 se o 1º jogador de pé na direção estiver a essa distância; senão 5. */
export function aimThrow(s: RoundState, cell: number, face: number, self: number): 2 | 3 | 4 | 5 {
  let c = cell;
  for (let k = 1; k <= 4; k++) {
    c = faceStep(c, face);
    if (!inGrid(colOf(c), linOf(c))) break;
    if (k >= 2 && s.players.some(q => q.slot !== self && grounded(q) && playerCell(q) === c)) return k as 2 | 3 | 4;
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
  launchBomb(s, b, `throw${n}` as FlightId, dir, handFrom(x, y, dir)).glove = true;
  setAct(s, p, 'throw', THROW_TICKS);
  ev.push({ type: 'throw', slot: p.slot });
}

/** Luva, B: a bomba sai da mão quicando 1 casa para a frente; o pouso (`land`) cuida do resto — parede ou bomba:
 *  quica mais uma casa; jogador: fica atordoado e ela quica para a casa seguinte. */
export function tossHeld(s: RoundState, p: Player): void {
  const b = bombById(s, p.carry);
  p.carry = -1; p.throwQueued = false;
  if (!b) return;
  const [x, y] = cellCenter(playerCell(p));
  launchBomb(s, b, 'bounce', (p.face >> 1) as 0 | 1 | 2 | 3, { x, y, z: 0 }).glove = true;   // caindo direto: reflete
}

/** Atordoado segurando bomba: ela cai na casa da frente (piso livre, sem bomba nem jogador); senão, como `dropHeld`. */
export function dropFront(s: RoundState, p: Player): void {
  const b = bombById(s, p.carry);
  const c = faceStep(playerCell(p), p.face);
  if (!b || c < 0 || s.grid[c] !== CODE.FLOOR || bombOccupies(s, c) || s.players.some(q => grounded(q) && playerCell(q) === c)) {
    dropHeld(s, p);
    return;
  }
  p.carry = -1; p.throwQueued = false;
  b.state = 'idle'; b.cell = c; [b.x, b.y] = cellCenter(c); s.grid[c] = CODE.BOMB;
}

/** Solta a bomba da mão: cai na casa se estiver livre; senão some e volta ao dono. */
export function dropHeld(s: RoundState, p: Player): void {
  const b = bombById(s, p.carry);
  p.carry = -1; p.throwQueued = false;
  if (!b) return;
  const c = playerCell(p);
  if (c >= 0 && s.grid[c] === CODE.FLOOR && !bombOccupies(s, c)) {
    b.state = 'idle'; b.cell = c; [b.x, b.y] = cellCenter(c); s.grid[c] = CODE.BOMB;
  } else removeBomb(s, b, true);
}
