// Atraso do lockstep da sala online (server/sala.mjs): ping de cada jogador e atraso de cada vaga. Separado para os
// testes (tests/net/delay.test.ts) importarem sem subir o servidor.

export const MIN_DELAY = 4, MAX_DELAY = 20;
/** Quantas medidas de ping guardar de cada jogador: o atraso usa a mediana delas (um pico isolado não pesa). */
export const RTT_WINDOW = 9;

/** Ping de um jogador: mediana das últimas medidas (null antes da 1ª). */
export function rttOf(peer) {
  const r = peer.rtts ?? [];
  if (!r.length) return null;
  const s = [...r].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}

/** Atraso de cada vaga (ticks de 60 Hz): o botão de um jogador vai até o servidor (meio ping dele) e daí ao mais lento
 *  dos outros (meio ping daquele), mais 2 de folga. Quem tem ping baixo (o anfitrião, em localhost) fica com atraso
 *  menor: cada um espera só o caminho dos próprios botões. `fixed` (SALA_DELAY) vale para todos. */
export function delaysFor(peers, fixed = null) {
  const list = [...peers];
  const out = [MIN_DELAY, MIN_DELAY, MIN_DELAY, MIN_DELAY, MIN_DELAY];
  for (const p of list) {
    if (p.slot < 0) continue;
    if (fixed !== null) { out[p.slot] = fixed; continue; }
    const mine = rttOf(p) ?? 150;
    const others = list.filter(q => q !== p && q.slot >= 0).map(q => rttOf(q) ?? 150);
    const far = others.length ? Math.max(...others) : 0;
    out[p.slot] = Math.min(MAX_DELAY, Math.max(MIN_DELAY, Math.ceil((mine + far) / 2 / (1000 / 60)) + 2));
  }
  return out;
}
