import { BTN, CODE, type Bomb, type GameEvent, type Player, type RoundState } from './types';
import { KICK_DIRBIT, KICK_MASK } from './tables/movement';
import { KICK_STEP } from './tables/flights';
import { FUSE, KICK_STEPS, MAX_LEVEL } from './constants';
import { SUB, cellAt, cellCenter, faceStep, subX, subY } from './units';
import { isEggCode, isItemCode, playerCell, standing } from './state';
import { bombAt, bombOccupies, removeBomb } from './bombs';
import { STAGES } from './stages';
import { MOUNTS } from './mounts';

/** Chuta: o item Chute vale também montado (extra: qualquer montaria), ou a montaria que chuta (A). */
export const canKick = (p: Player): boolean => p.kick || !!MOUNTS.current.kicks?.(p);
/** Extra: o dono segurando X (parar chute) tranca as próprias bombas contra o chute dos outros (o soco ainda vale). */
export const kickLocked = (s: RoundState, p: Player, b: Bomb): boolean =>
  b.owner !== p.slot && !!(s.players[b.owner]?.prevBtn & BTN.X);

/** Jogador de pé na casa `c` (a grade de ocupação $7F:1000, bits $90/$92 do objeto do jogador, marcados em
 *  $C2:33FC/$C2:5E84 na casa +$80 do centro). */
export const playerOn = (s: RoundState, c: number): boolean =>
  s.players.some(q => standing(q) && q.heldBy < 0 && !q.flying && playerCell(q) === c);

/** `p` pode chutar a bomba parada `b`: pavio > 1 ($C2:43A3), dono sem X segurado (extra) e ninguém de pé na casa dela:
 *  o deslize ($C1:34D0) chama $C1:33FD, que lê a ocupação da própria casa (AND #$3FF0) e, com jogador nela, desiste
 *  ($C1:352A: estado 0, sem o som $0D). Medido: o dono parado sobre a bomba, o outro empurra 30 ticks e ela não sai. */
export const kickable = (s: RoundState, p: Player, b: Bomb): boolean =>
  b.fuse > 1 && !kickLocked(s, p, b) && !playerOn(s, b.cell);

/** Chute automático ($C2:4307): depois do movimento, olhando para uma bomba parada vizinha. */
export function tryKick(s: RoundState, p: Player, ev: GameEvent[]): boolean {
  if (!canKick(p)) return false;
  const here = playerCell(p);
  if (here < 0 || !(KICK_MASK[subY(p.y) * 16 + subX(p.x)] & KICK_DIRBIT[p.face >> 1])) return false;
  const n = faceStep(here, p.face);
  if (s.grid[n] !== CODE.BOMB) return false;
  const b = bombAt(s, n);
  if (!b || !kickable(s, p, b)) return false;
  b.state = 'kicked'; b.dir = p.face; b.step = 0; b.kickedBy = p.slot; b.turn = -1;
  s.grid[n] = CODE.FLOOR;
  ev.push({ type: 'bomb_kicked', slot: p.slot });
  return true;
}

const parkable = (s: RoundState, b: Bomb, c: number): boolean =>
  c >= 0 && (s.grid[c] === CODE.FLOOR || s.grid[c] === CODE.FLAME) && !bombOccupies(s, c, b);

/** Estaciona a bomba chutada em `cell`; se a casa está ocupada por outra bomba ou não é piso/chama (ex.: a pressão
 *  $EE80 caiu nela), na casa anterior do deslize. Se nenhuma serve, devolve false e a bomba continua chutada. */
function park(s: RoundState, b: Bomb, cell: number): boolean {
  const back = faceStep(cell, (b.dir + 4) & 7);
  const c = parkable(s, b, cell) ? cell : parkable(s, b, back) ? back : -1;
  if (c < 0) return false;
  if (s.grid[c] === CODE.FLAME && !b.chainAt) b.chainAt = s.tick + 1;
  b.state = 'idle'; b.step = 0; b.cell = c; b.turn = -1;
  [b.x, b.y] = cellCenter(c);
  s.grid[c] = CODE.BOMB;
  return true;
}

/** Extra: nível de duas bombas EM MOVIMENTO que se batem, ou -1 se não fundem: comum + comum = D, D + comum = S,
 *  S + comum = H. Qualquer outra combinação (e bomba parada) só bate e para. */
export function mergedLevel(a: Bomb, b: Bomb): number {
  const la = a.level ?? 0, lb = b.level ?? 0;
  const hi = Math.max(la, lb);
  return Math.min(la, lb) === 0 && hi < MAX_LEVEL ? hi + 1 : -1;
}

/** Outra bomba deslizando que ocupa (ou está entrando em) `c`. */
function movingAt(s: RoundState, b: Bomb, c: number): Bomb | undefined {
  return s.bombs.find(x => x !== b && x.state === 'kicked'
    && (x.cell === c || cellAt(x.x, x.y) === c || (x.step > 0 && faceStep(x.cell, x.dir) === c)));
}

/** Um tick do deslize ($C1:34D0/$C1:35E1). */
export function slideStep(s: RoundState, b: Bomb, _ev: GameEvent[]): void {
  if (b.step === 0) {
    const next = faceStep(b.cell, b.dir);
    // Duas em movimento se batendo fundem: a atingida evolui, para onde está e reinicia o pavio (no vídeo a D explode
    // ~1,6 s depois da fusão); a outra volta ao dono. Parada não funde: vale a colisão normal logo abaixo.
    const o = movingAt(s, b, next);
    const lv = o ? mergedLevel(b, o) : -1;
    if (o && lv > 0) {
      o.level = lv; o.fuse = FUSE;
      removeBomb(s, b, true);
      park(s, o, cellAt(o.x, o.y));
      return;
    }
    const v = s.grid[next] ?? CODE.HARD;
    const blocked = (v & 0x8400) !== 0 || isEggCode(v)
      || bombOccupies(s, next, b)
      || playerOn(s, next);
    const verdict = blocked ? 'stop' : STAGES[s.stage]?.kickedBombEnter?.(s, b, next) ?? 'go';
    if (verdict === 'stop') { park(s, b, b.cell); return; }      // sem casa para parar: tenta de novo no próximo tick
    if (typeof verdict === 'object') b.turn = verdict.turn;
    if (isItemCode(v)) s.grid[next] = CODE.FLOOR;         // item esmagado
    if (v === CODE.FLAME) b.chainAt = s.tick + 1;
  }
  const [dx, dy] = KICK_STEP[b.dir >> 1][b.step];
  b.x += dx * SUB; b.y += dy * SUB;
  if (++b.step === KICK_STEPS) {
    b.step = 0;
    b.cell = faceStep(b.cell, b.dir);
    [b.x, b.y] = cellCenter(b.cell);
    if (b.turn >= 0) { b.dir = b.turn as 0 | 2 | 4 | 6; b.turn = -1; }
  }
}

/** Botão X: para as bombas chutadas por `p` na casa do centro delas. */
export function stopKick(s: RoundState, p: Player): void {
  for (const b of s.bombs) if (b.state === 'kicked' && b.kickedBy === p.slot) park(s, b, cellAt(b.x, b.y));
}
