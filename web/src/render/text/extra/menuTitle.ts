import type { ExtraGlyph } from '../types';
import { CURSIVE_EXTRA } from './menuItem';
/** Mesma fonte cursiva de `menuItem`: os mesmos glifos próprios (E, j, q e os acentos sobre as letras da ROM). Os
 * que dependem de uma letra-base sem recorte neste estilo (ex.: í sobre ı) simplesmente não entram na fonte. */
export const EXTRA: readonly ExtraGlyph[] = CURSIVE_EXTRA;
