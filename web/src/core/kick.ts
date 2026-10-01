import { BTN, CODE, type Bomb, type GameEvent, type Player, type RoundState } from './types';
import { KICK_DIRBIT, KICK_MASK } from './tables/movement';
import { KICK_STEP } from './tables/flights';
import { FUSE, KICK_STEPS, MAX_LEVEL } from './constants';
import { SUB, cellAt, cellCenter, faceStep, subX, subY } from './units';
import { isEggCode, isItemCode, playerCell, standing } from './state';
import { bombAt, bombOccupies, kickPending, removeBomb } from './bombs';
import { STAGES } from './stages';
import { MOUNTS } from './mounts';

/** Chuta: o item Chute vale também montado (extra: qualquer montaria), ou a montaria que chuta (A). */
export const canKick = (p: Player): boolean => (p.kick || !!MOUNTS.current.kicks?.(p)) && !MOUNTS.current.passes?.(p, 0xc900);   // tipo 1 não chuta
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
  // Como $C2:4307: só o estado e a direção. A grade continua $C900 até o deslize sair de fato (`slideStep`), então
  // quem anda depois no mesmo tick ainda esbarra nela — e, se o destino estiver bloqueado, ela nunca sai da grade.
  b.state = 'kicked'; b.dir = p.face; b.step = 0; b.kickedBy = p.slot; b.turn = -1;
  ev.push({ type: 'bomb_kicked', slot: p.slot });
  return true;
}

const parkable = (s: RoundState, b: Bomb, c: number): boolean =>
  c >= 0 && (s.grid[c] === CODE.FLOOR || s.grid[c] === CODE.FLAME) && !bombOccupies(s, c, b);

/** Estaciona a bomba chutada em `cell`; se a casa está ocupada por outra bomba ou não é piso/chama (ex.: a pressão
 *  $EE80 caiu nela), na casa anterior do deslize. Se nenhuma serve, devolve false e a bomba continua chutada. */
function park(s: RoundState, b: Bomb, cell: number): boolean {
  if (cell === b.cell && kickPending(s, b)) {      // chute que não saiu ($C1:352A): volta ao estado 0 onde está
    b.state = 'idle'; b.step = 0; b.turn = -1;
    return true;
  }
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

/** Casa do centro da bomba em movimento como a ROM a calcula ($C2:3221): no deslize o objeto fica 1 px à direita e
 *  abaixo do nosso centro (a partida $C2:3260 o põe em 16·col, 16·(lin+2)), por isso a troca de casa cai no 4º passo
 *  para a direita/baixo e no 5º para a esquerda/cima. */
const romCell = (b: Bomb): number => cellAt(b.x + SUB, b.y + SUB);

/** $C1:3403: jogador de pé na casa da frente de `at` a menos de 20 px da bomba no eixo do deslize (tabela $C1:35D1:
 *  cima Y+20 ≥ y, direita X−20 < x, baixo Y−20 < y, esquerda X+20 ≥ x; x/y da bomba na conta da ROM, +1 px). Sobre
 *  as setas (código $0040/$00C0 na casa do centro) a ROM pula este teste ($C1:36B9). */
function playerAhead(s: RoundState, b: Bomb, at: number): boolean {
  const lo = (s.grid[at] ?? 0) & 0xefc0;
  if (lo === 0x0040 || lo === 0x00c0) return false;
  const n = faceStep(at, b.dir);
  const bx = (b.x >> 8) + 1, by = (b.y >> 8) + 1;
  return s.players.some(q => standing(q) && q.heldBy < 0 && !q.flying && playerCell(q) === n && (
    b.dir === 0 ? (q.y >> 8) + 20 >= by : b.dir === 2 ? (q.x >> 8) - 20 < bx
      : b.dir === 4 ? (q.y >> 8) - 20 < by : (q.x >> 8) + 20 >= bx));
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
    if (kickPending(s, b)) s.grid[b.cell] = CODE.FLOOR;   // saiu de fato: $C1:353C → $C1:532C repõe o piso
  }
  const from = romCell(b);
  const [dx, dy] = KICK_STEP[b.dir >> 1][b.step];
  b.x += dx * SUB; b.y += dy * SUB;
  if (++b.step === KICK_STEPS) {
    b.step = 0;
    b.cell = faceStep(b.cell, b.dir);
    [b.x, b.y] = cellCenter(b.cell);
    if (b.turn >= 0) { b.dir = b.turn as 0 | 2 | 4 | 6; b.turn = -1; }
  }
  // Testes de jogador a cada tick, depois de andar ($C1:35E1). O teste da casa da frente no centro (acima) não basta:
  // quem entra no caminho durante os 8 ticks da travessia era atravessado.
  //  - entrou numa casa com jogador: volta para o centro da anterior e para ($C1:3644 → $C1:3840 → $C2:3260);
  //  - jogador na casa do centro (entrou nela com a bomba lá): para sob ele ($C1:36AC → $C1:384C);
  //  - jogador na casa da frente a menos de 20 px: para ($C1:36CC → $C1:3403 → $C1:384C).
  // Nos dois últimos a ROM deixa a bomba onde está (até 8 px fora do centro); aqui ela estaciona no centro da casa.
  const at = romCell(b);
  if (at < 0) return;
  if (at !== from && from >= 0 && playerOn(s, at)) { park(s, b, from); return; }
  if (playerOn(s, at) || playerAhead(s, b, at)) { park(s, b, at); return; }
  if (ownerHoldsX(s, b)) park(s, b, at);
}

/** Botão X ($C1:37D6 → $C1:38CE): a cada tick do deslize, depois de andar, a ROM pega o objeto do jogador da bomba
 *  +$20 — o DONO, que o chute ($C2:4307) não troca — e testa o X segurado (+$30 bit $0040); com X, alinha a bomba na
 *  casa ((x+8) AND $1F0) − 1 ($C1:3A3B, a conta da ROM com o centro +1 px) e para ($C1:384C). Quem chutou a bomba de
 *  outro não a para; o dono, de qualquer lugar, para. Medido: aj-stop/stopwho.py, snap.py. `prevBtn` já é o deste tick
 *  (os jogadores agem antes dos objetos). */
const ownerHoldsX = (s: RoundState, b: Bomb): boolean => !!((s.players[b.owner]?.prevBtn ?? 0) & BTN.X);

/** Simulação (CPU) do X de `p`: para agora as bombas dele que estão rolando, na casa do centro da conta da ROM. */
export function stopKick(s: RoundState, p: Player): void {
  for (const b of s.bombs) if (b.state === 'kicked' && b.owner === p.slot) { const c = romCell(b); if (c >= 0) park(s, b, c); }
}
