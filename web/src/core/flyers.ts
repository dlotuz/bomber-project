// flyers.ts (T8) — handFrom, launchBomb e spawnItemFlyer já são reais (T10, T11 e T15 criam voadores)
import { CODE, type Bomb, type FlightId, type Flyer, type GameEvent, type Player, type RoundState } from './types';
import { SUB, cellCenter } from './units';
import { newId } from './state';
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
  // ITEM_FLIGHT[script].dir === script & 3 (tabela de T2: dirs 0,1,2,3 repetidos); sem importar tables/ aqui (T2 é paralela).
  const dir = (script & 3) as 0 | 1 | 2 | 3;
  const [cx, cy] = cellCenter(cell);
  const from = handFrom(cx, cy, dir);
  const f: Flyer = { id: newId(s), kind: 'item', ref: item, x: from.x, y: from.y, z: from.z, dir, flight: 'item', script, i: 0, born: s.tick };
  s.flyers.push(f);
  return f;
}
export function aimThrow(_s: RoundState, _cell: number, _face: number, _self: number): 2 | 3 | 4 | 5 { return 5; }
export function punchBomb(_s: RoundState, _p: Player, _ev: GameEvent[]): boolean { return false; }
export function startLift(_s: RoundState, _p: Player, _ev: GameEvent[]): boolean { return false; }
export function throwHeld(_s: RoundState, _p: Player, _ev: GameEvent[]): void {}
export function dropHeld(_s: RoundState, _p: Player): void {}
export function tickFlyers(_s: RoundState, _ev: GameEvent[]): void {}
