// Rosto chorando no HUD da partida (frente aj-hudcry).
//
// ROM: o acerto fatal põe o estado do jogador em $C2:10F9 (tick H); no tick seguinte $C2:121E liga o bit 3 de +$C0.
// Quem troca o rosto é a atualização do HUD $C4:52BC → $C4:58BE…$C4:5A03: para cada slot com +$C0 bit 3 e a flag
// $7F:2083+k ainda zerada, sobe os 6 tiles da entrada `c·5 + slot` de $C4:617F (rosto chorando; o normal é
// `(6+c)·5 + slot`) para os tiles $201+2·slot ($C4:60D1) e marca a flag. Nada desfaz isso na rodada: o rosto fica
// chorando durante o pós-morte, como Bad Bomber e até o fim; a próxima rodada recarrega os normais ($C1:02EC zera
// $7F:2088 → $C4:5A08).
// A atualização do HUD não roda todo tick: o relógio ($C1:09BE, antes dos objetos no tick) a chama a cada 60 ticks,
// junto com a troca do segundo ($C1:0AA6); com a rodada ganha ($9E < 0) o relógio para e ela passa a rodar a cada 32
// quadros ($C1:09DF: $016A & $1F = 0).
// Emulador (st_arena05, P2 morto pela bomba do P1): acerto no tick 126 (chamada 126 do relógio), troca dos tiles na
// chamada 182 do relógio, a mesma em que o relógio vai de 2:57 para 2:56; o rosto aparece na tela 1 quadro antes dos
// dígitos (estes vão pelo mapa no NMI seguinte).
import type { Player, RoundState } from '../core';
import { INTRO_CLOCK_TICKS, INTRO_TICKS } from '../core/constants';

/** Período da atualização do HUD pelo relógio (ticks) e com a rodada ganha (quadros ≈ ticks). */
export const HUD_REFRESH_EVERY = 60;
export const HUD_REFRESH_WON_EVERY = 32;
/** O bit 3 de +$C0 sobe 1 tick depois do acerto, e o relógio roda antes dos objetos: a 1ª atualização que o vê é ≥ H+2. */
export const HUD_CRY_FROM = 2;

const mod = (a: number, m: number): number => ((a % m) + m) % m;

/** Tick em jogo em que o relógio troca o segundo (e o HUD atualiza): o relógio corre nos 10 primeiros ticks da intro
 *  (troca no tick 1) e de novo a partir do 1º tick de `play` — a mesma cadência também com o tempo ∞ (o $1ECE da ROM
 *  continua contando) e em 0:00. */
const PLAY_REFRESH_PHASE = mod(INTRO_TICKS - INTRO_CLOCK_TICKS + 1, HUD_REFRESH_EVERY);

export function isPlayRefreshTick(t: number): boolean { return mod(t - PLAY_REFRESH_PHASE, HUD_REFRESH_EVERY) === 0; }

/** Primeiro tick ≥ `t` em que a atualização do HUD roda com o relógio andando. */
export function nextPlayRefresh(t: number): number { return t + mod(PLAY_REFRESH_PHASE - t, HUD_REFRESH_EVERY); }

/** O rosto do jogador no HUD já está chorando neste estado? */
export function hudCrying(s: RoundState, p: Player): boolean {
  if (!p.present || p.state === 'alive' || p.hitT0 < 0) return false;
  const from = p.hitT0 + HUD_CRY_FROM;
  const t = s.tick;
  if (from > t) return false;
  // `won`/`timeUp`: o relógio parou no tick da troca de fase; dali em diante, a cada 32
  const stop = s.phase === 'won' || s.phase === 'timeUp' ? Math.min(s.phaseT0, t) : t;
  if (nextPlayRefresh(from) <= stop) return true;
  if (stop >= t) return false;
  const b = Math.max(from, stop + 1);
  return b + mod(-b, HUD_REFRESH_WON_EVERY) <= t;
}
