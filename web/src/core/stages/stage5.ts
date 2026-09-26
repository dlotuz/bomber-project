import type { StageModule } from '../hooks';
import type { Player } from '../types';
import { colAt, linAt } from '../units';
import { px, shock, standing } from './kit';

/** $C2:319B (empurrado na borda indo para a cerca) ou $C2:20DF (fora da caixa de pixels). */
export function fenceHit(p: Player): boolean {
  const x = px(p.x), y = px(p.y);
  if (x < 24 || x >= 232 || y < 40 || y >= 216) return true;
  const col = colAt(p.x), lin = linAt(p.y);
  return (col === 2 && p.push.vx < 0) || (col === 14 && p.push.vx > 0)
    || (lin === 1 && p.push.vy < 0) || (lin === 11 && p.push.vy > 0);
}

/** Arena 5: cerca elétrica. Golpe P: só a vítima (act `pushed`) é checada — o avanço de 16px do
 *  próprio golpeador (act `pPunch`) reaproveita o mesmo campo `push` (§ startPPunch), mas o teste
 *  medido no emulador (Step 1 do brief) só espera choque na vítima; sem esta exclusão o golpeador
 *  também levaria choque ao atravessar a borda durante o próprio avanço (🟡 desvio mínimo). */
export const stage5: StageModule = {
  outOfBounds(s, p, ev) {
    if (!standing(p) || p.act === 'shocked' || p.act === 'stunned' || p.act === 'pPunch') return;
    if (fenceHit(p)) shock(s, p, ev);
  },
};
