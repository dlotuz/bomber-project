import type { Pix } from './art/pix';
import { bomberFrame, headIcon } from './art/bomber';
import { bombPix, itemIcon } from './art/items';
import { flamePiece, type FlamePart } from './art/flames';
import { stageTiles } from './art/tiles';
import { textPix } from './art/font';
import { crownPix, trophyPix, clockPix } from './art/trophy';

export type Img = HTMLCanvasElement;

export interface TileImgs { floor: Img; floorAlt: Img; hard: Img; wall: Img; soft: Img; burning: [Img, Img]; bg: string }

export function pixToCanvas(p: Pix): Img {
  const c = document.createElement('canvas');
  c.width = p.w; c.height = p.h;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(p.data), p.w, p.h), 0, 0);
  return c;
}

/** Converte a arte pura em canvases, uma única vez por chave. */
export class SpriteBank {
  private cache = new Map<string, Img>();
  private tileCache = new Map<number, TileImgs>();

  private get(key: string, make: () => Pix): Img {
    let c = this.cache.get(key);
    if (!c) { c = pixToCanvas(make()); this.cache.set(key, c); }
    return c;
  }

  bomber(ch: number, dir: number, frame: number): Img { return this.get(`b${ch}:${dir}:${frame}`, () => bomberFrame(ch, dir, frame)); }
  head(ch: number): Img { return this.get(`h${ch}`, () => headIcon(ch)); }
  bomb(frame: number): Img { return this.get(`bomb${frame}`, () => bombPix(frame)); }
  item(item: number): Img { return this.get(`i${item}`, () => itemIcon(item)); }
  flame(part: FlamePart, shrink: number): Img { return this.get(`f${part}${shrink}`, () => flamePiece(part, shrink)); }
  crown(): Img { return this.get('crown', crownPix); }
  trophy(): Img { return this.get('trophy', trophyPix); }
  clock(): Img { return this.get('clock', clockPix); }
  text(s: string, color: string): Img { return this.get(`t${color}:${s}`, () => textPix(s, color)); }
  /** Texto sem contorno (para desenhar ampliado sem ficar pesado). */
  plainText(s: string, color: string): Img { return this.get(`p${color}:${s}`, () => textPix(s, color, null)); }

  tiles(stage: number): TileImgs {
    let t = this.tileCache.get(stage);
    if (!t) {
      const s = stageTiles(stage);
      t = {
        floor: pixToCanvas(s.floor), floorAlt: pixToCanvas(s.floorAlt), hard: pixToCanvas(s.hard),
        wall: pixToCanvas(s.wall), soft: pixToCanvas(s.soft),
        burning: [pixToCanvas(s.burning[0]), pixToCanvas(s.burning[1])], bg: s.bg,
      };
      this.tileCache.set(stage, t);
    }
    return t;
  }
}
