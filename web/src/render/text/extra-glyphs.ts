import type { ExtraGlyph, TextStyleId } from './types';
import { EXTRA as titleMenu } from './extra/titleMenu';
import { EXTRA as menuTitle } from './extra/menuTitle';
import { EXTRA as menuItem } from './extra/menuItem';
import { EXTRA as ascii8 } from './extra/ascii8';
import { EXTRA as banner } from './extra/banner';
import { EXTRA as spriteBlue } from './extra/spriteBlue';
import { EXTRA as bigBattle } from './extra/bigBattle';
import { EXTRA as bigScore } from './extra/bigScore';
import { EXTRA as bigVictory } from './extra/bigVictory';
import { EXTRA as bigDraw } from './extra/bigDraw';
export const EXTRA_GLYPHS: Record<TextStyleId, readonly ExtraGlyph[]> =
  { titleMenu, menuTitle, menuItem, ascii8, banner, spriteBlue, bigBattle, bigScore, bigVictory, bigDraw };
