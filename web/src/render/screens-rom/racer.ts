// Corrida Bônus (T21, provisória — A2): sem cena da ROM catalogada para esta tela (o original monta a arte na hora,
// nunca capturada pelo CAT). O único uso da ROM aqui é o personagem do campeão, decodificado do quadro cru do
// personagem (`character(c).frame(g)`) com a paleta do slot dele — mesma fonte de `assets.character` do plano 5/13.
import type { RomAssets } from '../../rom/types';
import { bgr555ToRgba } from '../../app/rom-api';
import { pixToCanvas, type Img } from '../sprite-bank';

/**
 * Quadro `g` do personagem `c` (folha $C2:0730+3c), colorido pela paleta do slot `slot` (0..4); índice 0 = transparente.
 * Canvas 32×32. Sem geometria catalogada de direção/passo para esta tela: `g` é escolhido por quem chama (ver
 * `screens/racer.ts`), como um ciclo de passos provisório.
 */
export function racerChampionImg(a: RomAssets, c: number, slot: number, g: number): Img {
  const ch = a.character(c);
  const frame = ch.frame(g);
  const pal = ch.palettes[slot] ?? ch.palettes[0];
  const data = new Uint8ClampedArray(32 * 32 * 4);
  for (let i = 0; i < frame.length; i++) {
    const v = frame[i];
    if (!v) continue;
    const [r, g2, b] = bgr555ToRgba(pal[v] ?? 0);
    data.set([r, g2, b, 255], i * 4);
  }
  return pixToCanvas({ w: 32, h: 32, data });
}
