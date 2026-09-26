import type { RoundState } from '../../../core/types';
import type { FallbackBattleLayer } from '../../battle-layers';
import { pixToCanvas, type Img } from '../../sprite-bank';
import { playerHidden, type FbSprite } from './sprites';
import { costumePix } from './costume-art';

/** Leitura pura (sem efeito colateral): chapéu/roupa 16×10 sobre a cabeça em (X−8, Y−26), um por jogador
 *  vivo, sem montaria, com traje (`p.costume >= 0`) e visível (mesmo predicado do jogador, `playerHidden`). */
export function fallbackCostumeSprites(s: RoundState): FbSprite[] {
  const out: FbSprite[] = [];
  for (const p of s.players) {
    if (p.costume < 0 || p.state !== 'alive' || p.mount || playerHidden(p)) continue;   // I4: some com o jogador
    const c = p.costume & 7, X = Math.floor(p.x / 256), Y = Math.floor(p.y / 256);
    out.push({ key: `costume:${c}`, make: () => costumePix(c), x: X - 8, y: Y - 26 });
  }
  return out;
}

const cache = new Map<string, Img>();
export const fallbackCostumeLayer: FallbackBattleLayer = {
  id: 'costume',
  draw(s, ctx) {
    for (const sp of fallbackCostumeSprites(s)) {
      let img = cache.get(sp.key);
      if (!img) { img = pixToCanvas(sp.make()); cache.set(sp.key, img); }
      ctx.drawImage(img, sp.x, sp.y);
    }
  },
};
