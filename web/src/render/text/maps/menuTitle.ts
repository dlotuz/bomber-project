import type { StyleRomDef } from '../types';
import { CURSIVE_BASE, CURSIVE_STRIPS, cursiveCut as c } from './menuItem';
/** Títulos dos menus: a mesma fonte cursiva de `menuItem` (ver lá as regras de recorte, kerning e sombra), na linha
 * 0 da paleta das cenas de menu (o azul de "Select a VS mode!", "Decide on the players!", "Configure the rules!").
 * Cada letra é recortada de um título da ROM (preferindo "Select a VS mode!", a frase que o teste de fidelidade
 * compara); "O" vem de "Off" (regras). E, j, q e os acentos ficam em `extra/menuTitle.ts`. */
export const DEF: StyleRomDef = {
  ...CURSIVE_BASE,
  strips: { vs: CURSIVE_STRIPS.vs, players: CURSIVE_STRIPS.players, rules: CURSIVE_STRIPS.rules },
  cuts: [
    c('S', 'vs', 1, 8, 0, [[4, 1]]),   // Select a VS mode!
    c('e', 'vs', 10, 16, 0, [[12, 5]]),   // Select a VS mode!
    c('l', 'vs', 18, 20, 0, [[18, 1]]),   // Select a VS mode!
    c('c', 'vs', 30, 36, 0, [[33, 5]]),   // Select a VS mode!
    c('t', 'vs', 38, 44, 0, [[41, 3]]),   // Select a VS mode!
    c('a', 'vs', 51, 57, 0, [[53, 5]]),   // Select a VS mode!
    c('V', 'vs', 64, 71, 0, [[64, 1]]),   // Select a VS mode!
    c('m', 'vs', 87, 97, 0, [[89, 5]]),   // Select a VS mode!
    c('o', 'vs', 99, 105, 0, [[102, 5]]),   // Select a VS mode!
    c('d', 'vs', 107, 113, 0, [[112, 1]]),   // Select a VS mode!
    c('!', 'vs', 123, 125, 0, [[124, 9], [124, 1]]),   // Select a VS mode!
    c('D', 'players', 3, 10, 0, [[5, 1]]),   // Decide on the players!
    c('i', 'players', 28, 30, 0, [[29, 5], [29, 1]]),   // Decide on the players!
    c('n', 'players', 60, 66, 0, [[62, 5]]),   // Decide on the players!
    c('h', 'players', 81, 87, 0, [[83, 1]]),   // Decide on the players!
    c('p', 'players', 102, 108, 0, [[104, 5]]),   // Decide on the players!
    c('s', 'players', 145, 151, 0, [[147, 5]]),   // Decide on the players!
    c('r', 'players', 138, 144, 0, [[140, 5]]),   // Decide on the players!
    c('C', 'rules', 9, 16, 0, [[12, 1]]),   // Configure the rules!
    c('f', 'rules', 34, 40, 0, [[38, 1]]),   // Configure the rules!
    c('g', 'rules', 45, 51, 0, [[48, 5]]),   // Configure the rules!
    c('u', 'rules', 53, 59, 0, [[54, 5]]),   // Configure the rules!
    c('O', 'rules', 1, 8, 11, [[4, 1]]),   // Off
  ],
  palette: { kind: 'scene', scene: 'vsmode', row: 0, size: 16 },
};
