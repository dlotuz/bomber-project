import { fromRows, makePix, setPx, fillRect, type Pix } from './pix';

const CROWN = [
  '.k...kk...k.', 'kyk.kyyk.kyk', 'kyykyyyykyyk', 'kyyyyyyyyyyk',
  'kyyryyyyryyk', 'kyyyyyyyyyyk', 'kYYYYYYYYYYk', '.kkkkkkkkkk.',
];

/** Coroa 12×8 do placar (uma por vitória). */
export function crownPix(): Pix {
  return fromRows(CROWN, { '.': null, k: '#0b0b14', y: '#ffd23f', Y: '#c8961a', r: '#e8403a' });
}

/** Troféu 24×24 da tela de vitória, desenhado por formas. */
export function trophyPix(): Pix {
  const p = makePix(24, 24);
  const gold = '#ffd23f', shade = '#c8961a', dark = '#8a6410', ink = '#0b0b14', shine = '#fff6c0';
  // taça: meia-elipse de 16×12 com contorno
  for (let y = 0; y < 13; y++) for (let x = 0; x < 24; x++) {
    const dx = (x - 11.5) / 8.5, dy = y / 12.5;
    const r = dx * dx + dy * dy;
    if (y === 0 && Math.abs(x - 11.5) <= 8.5) setPx(p, x, y, ink);
    else if (r < 0.8) setPx(p, x, y, x < 10 ? gold : x < 15 ? shade : dark);
    else if (r < 1.0) setPx(p, x, y, ink);
  }
  fillRect(p, 5, 2, 2, 5, shine);
  // alças
  for (const [x0, dir] of [[3, -1], [20, 1]] as const) for (let y = 2; y < 9; y++) {
    const x = x0 + dir * (y > 3 && y < 7 ? 1 : 0);
    setPx(p, x, y, ink); setPx(p, x - dir, y, gold);
  }
  // haste e base
  fillRect(p, 10, 13, 4, 4, ink); fillRect(p, 11, 13, 2, 4, shade);
  fillRect(p, 6, 17, 12, 3, ink); fillRect(p, 7, 17, 10, 2, gold);
  fillRect(p, 4, 20, 16, 4, ink); fillRect(p, 5, 20, 14, 3, shade); fillRect(p, 5, 20, 14, 1, gold);
  return p;
}

/** Relógio 16×16 do HUD: aro vermelho, mostrador branco, ponteiros pretos. */
export function clockPix(): Pix {
  const p = makePix(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d < 5.2) setPx(p, x, y, '#ffffff');
    else if (d < 7) setPx(p, x, y, '#d8342c');
    else if (d < 8) setPx(p, x, y, '#0b0b14');
  }
  fillRect(p, 7, 3, 2, 5, '#0b0b14');
  fillRect(p, 8, 7, 4, 2, '#0b0b14');
  return p;
}
