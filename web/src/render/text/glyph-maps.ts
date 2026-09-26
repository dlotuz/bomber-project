import type { StyleRomDef, TextStyleId } from './types';
import { DEF as titleMenu } from './maps/titleMenu';
import { DEF as menuTitle } from './maps/menuTitle';
import { DEF as menuItem } from './maps/menuItem';
import { DEF as ascii8 } from './maps/ascii8';
import { DEF as banner } from './maps/banner';
import { DEF as spriteBlue } from './maps/spriteBlue';
import { DEF as bigBattle } from './maps/bigBattle';
import { DEF as bigScore } from './maps/bigScore';
import { DEF as bigVictory } from './maps/bigVictory';
import { DEF as bigDraw } from './maps/bigDraw';
export const GLYPH_MAPS: Record<TextStyleId, StyleRomDef | null> =
  { titleMenu, menuTitle, menuItem, ascii8, banner, spriteBlue, bigBattle, bigScore, bigVictory, bigDraw };
