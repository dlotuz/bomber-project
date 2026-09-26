import { GRID_W, GRID_H, T } from './constants';

export const idx = (gx: number, gy: number): number => gy * GRID_W + gx;
export const centerX = (gx: number): number => (gx + 1) * T;
export const centerY = (gy: number): number => (gy + 2) * T;
export const cellX = (x: number): number => Math.floor((x + T / 2) / T) - 1;
export const cellY = (y: number): number => Math.floor((y + T / 2) / T) - 2;
export const inPlayfield = (gx: number, gy: number): boolean =>
  gx >= 1 && gx <= GRID_W - 2 && gy >= 1 && gy <= GRID_H - 2;
