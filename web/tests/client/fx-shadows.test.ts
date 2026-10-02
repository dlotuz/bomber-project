import { createRound, defaultRules, invisibleVisible, makeRng, type RoundState } from '../../src/core';
import { shadowSpots } from '../../src/render/fx/shadows';
import { entX, entY } from '../../src/render/fx/coords';

/** Rodada só com jogadores vivos (sem bombas nem objetos em voo): cada sombra é de um personagem. */
function round(): RoundState {
  const r = createRound(1, defaultRules(), makeRng());
  r.bombs = []; r.flyers = [];
  return r;
}
const alive = (r: RoundState) => r.players.filter(p => p.present && p.state === 'alive');
const at = (r: RoundState, slot: number) => [entX(r.players[slot].x), entY(r.players[slot].y) + 6];

describe('fx: sombra suave dos personagens', () => {
  it('uma sombra por personagem vivo, sob os pés', () => {
    const r = round();
    const spots = shadowSpots(r);
    expect(alive(r).length).toBeGreaterThan(1);
    expect(spots).toHaveLength(alive(r).length);
    for (const p of alive(r)) expect(spots.filter(s => s.x === at(r, p.slot)[0] && s.y === at(r, p.slot)[1])).toHaveLength(1);
  });

  it('invisível ($29): a sombra some nos mesmos quadros em que o jogador some, e volta com ele', () => {
    const r = round();
    const p = r.players[0];
    p.disease = 0x29;
    let hidden = 0, shown = 0;
    for (let t = 0; t < 256; t++) {
      p.diseaseT = t;
      const mine = shadowSpots(r).filter(s => s.x === at(r, 0)[0] && s.y === at(r, 0)[1]);
      expect(mine).toHaveLength(invisibleVisible(p) ? 1 : 0);
      if (invisibleVisible(p)) shown++; else hidden++;
      expect(shadowSpots(r)).toHaveLength(alive(r).length - (invisibleVisible(p) ? 0 : 1));   // os outros continuam
    }
    expect(hidden).toBeGreaterThan(0);
    expect(shown).toBeGreaterThan(0);
  });

  it('piscando da invencibilidade (inv & 2): sem sombra, como o sprite', () => {
    const r = round();
    r.players[0].inv = 2;
    expect(shadowSpots(r)).toHaveLength(alive(r).length - 1);
    r.players[0].inv = 4;
    expect(shadowSpots(r)).toHaveLength(alive(r).length);
  });

  it('com os sprites da ROM: no lugar da elipse que a ROM desenhava (Y+0..Y+4 a pé; Y+2..Y+7 montado)', () => {
    const r = round();
    const p = r.players[0];
    expect(shadowSpots(r, true).find(s => s.x === entX(p.x))!.y).toBe(entY(p.y) + 1);
    p.mount = { type: 2, slot: 1, phase: 'riding', t0: 0, reserves: [], trail: [], cooldown: 0, remount: false, remountFx: null };
    expect(shadowSpots(r, true).find(s => s.x === entX(p.x))!.y).toBe(entY(p.y) + 4);
    expect(shadowSpots(r, false).find(s => s.x === entX(p.x))!.y).toBe(entY(p.y) + 6);   // arte própria: como sempre
  });

  it('jogador cuja elipse da ROM ficou no sprite (sem encaixe certo): sem a suave, para não haver duas', () => {
    const r = round();
    expect(shadowSpots(r, true, new Set([0]))).toHaveLength(alive(r).length - 1);
    const p0 = r.players[0];
    expect(shadowSpots(r, true, new Set([0])).some(s => s.x === entX(p0.x) && s.y === entY(p0.y) + 1)).toBe(false);
    expect(shadowSpots(r, false, new Set([0]))).toHaveLength(alive(r).length);   // arte própria: não há elipse da ROM
  });
});
