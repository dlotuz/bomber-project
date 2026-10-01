import { colOf, linOf, px } from '../../core';

/** Centro da casa no canvas de base (o mesmo mapeamento de draw-game.ts: tile em 16·col − 8, 16·lin + 24). */
export const cellX = (cell: number): number => 16 * colOf(cell);
export const cellY = (cell: number): number => 16 * linOf(cell) + 32;
/** Centro de uma entidade (1/256 px) no canvas de base; o fallback desenha o sprite 16×16 em px − 7. */
export const entX = (x: number): number => px(x) + 1;
export const entY = (y: number): number => px(y) + 1;
/** Acima desta linha é o HUD: clima, luz e flash não passam dela. */
export const FIELD_TOP = 24;
