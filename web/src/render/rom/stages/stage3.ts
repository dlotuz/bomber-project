import { registerRomLayer } from '../../battle-layers';
import { st3 } from '../../../core/stages/stage3';
import { animFrameAt, assetsOf } from './romkit';

/** Animação da bola (objeto $C3:0796: anim $D8:D57E, atributo $0E = paleta OBJ 7). Tiles OBJ da arena 3 incluem $C8:FA44 em $7C00. */
export const ORB_ANIM = 0xd8d57e;
/** Base de tile do objeto (`+$1E = $0100`, gravado em $C3:0796; tile OAM = `+$1E + g`, ANI §2.2): bola em $1C0+ ($7C00), sombra em $12C. */
export const ORB_TILE_BASE = 0x100;

registerRomLayer({
  id: 'stage3',
  draw(s, b, a0) {
    if (s.stage !== 3) return;
    const a = assetsOf(a0);
    const f = animFrameAt(a.anim(ORB_ANIM), s.tick);
    st3(s).orbs.forEach((o, i) => {
      if (!o.alive) return;
      for (const pc of f.pieces) {
        b.sprite({ x: o.x + pc.dx, y: o.y + pc.dy, size: pc.big ? 32 : 16, pal: (7 + pc.palAdd) & 7, prio: 2,
          hflip: pc.hflip, vflip: pc.vflip, src: { tile: ORB_TILE_BASE + pc.tile } }, o.y, 100 + i);
      }
    });
  },
});
