// Retratos da ROM (revisão final do plano 10, I6): folha `$CD:E585` + paletas `$C1:B3C3`, conferidos contra as
// capturas do placar e da seleção de personagem (e a do RUBI numa captura de `montarias-e-telas`).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ASSETS } from './rom';
import { CAPTURES, loadCapture } from './captures';
import { decodePng, loadCapturePng, type Rgba } from './capture-png';
import {
  NO_CHAR, PORTRAIT_OF_CHAR, charselPortraitTile, portraitPalette, portraitPixels, scoreboardPortraitTile,
} from '../../src/render/screens-rom/portraits';
import { CHARSEL_PORTRAIT_PAL } from '../../src/render/screens-rom/charsel';
import { bgr555ToRgba } from '../../src/app/rom-api';

/** RGBA 32×32 do retrato (transparente = 0,0,0,0). */
function portraitRgba(char: number, slot: number): Uint8Array {
  const px = portraitPixels(ASSETS!, char), pal = portraitPalette(ASSETS!, slot, char);
  const out = new Uint8Array(32 * 32 * 4);
  px.forEach((v, i) => { if (v) out.set([...bgr555ToRgba(pal[v]), 255], i * 4); });
  return out;
}
/** Mesmo recorte de uma captura, só nos pixels opacos do retrato (os transparentes deixam ver o fundo). */
function cropLike(img: Rgba, x0: number, y0: number, mask: Uint8Array): Uint8Array {
  const out = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    if (!mask[y * 32 + x]) continue;
    const i = ((y0 + y) * img.w + x0 + x) * 4;
    out.set([img.data[i], img.data[i + 1], img.data[i + 2], 255], (y * 32 + x) * 4);
  }
  return out;
}
/** As capturas convertem BGR555 → RGB por `c << 3` (sem repetir os bits altos): normaliza os dois lados assim. */
const q = (a: Uint8Array): Uint8Array => a.map((v, i) => ((i & 3) === 3 ? v : v & 0xf8));
const sha1 = (a: Uint8Array): string => createHash('sha1').update(q(a)).digest('hex');

describe('folha de retratos: personagem → tile', () => {
  it('ordem da folha: BLANCO, GEAR, TIGRA, ×, RUBI, AERO, VERDI', () => {
    expect([0, 1, 2, 3, 4, 5].map(scoreboardPortraitTile)).toEqual([0x80, 0x84, 0x88, 0xc4, 0xc8, 0xc0]);
    expect(scoreboardPortraitTile(NO_CHAR)).toBe(0x8c);
    expect([0, 1, 2, 3, 4, 5, NO_CHAR].map(charselPortraitTile)).toEqual([0x200, 0x204, 0x208, 0x244, 0x248, 0x240, 0x20c]);
    expect(PORTRAIT_OF_CHAR[NO_CHAR]).toBe(3);
  });
});

describe.skipIf(!ASSETS)('retratos × capturas', () => {
  const sb = loadCapture('scoreboard'), cs = loadCapture('charsel');
  it.skipIf(!sb)('paletas: slot k com o personagem k = linha OBJ k do placar', () => {
    for (let k = 0; k < 5; k++) expect(Array.from(portraitPalette(ASSETS!, k, k)), `slot ${k}`).toEqual(Array.from(sb!.cgram.slice(128 + 16 * k, 144 + 16 * k)));
  });
  it.skipIf(!cs)('paletas: slot k com o personagem k = linha BG CHARSEL_PORTRAIT_PAL[k] da charsel', () => {
    for (let k = 0; k < 5; k++) {
      const row = CHARSEL_PORTRAIT_PAL[k];
      expect(Array.from(portraitPalette(ASSETS!, k, k)), `slot ${k}`).toEqual(Array.from(cs!.cgram.slice(16 * row, 16 * row + 16)));
    }
  });
  it('a tabela de paletas tem o "×" (mesma paleta) nas entradas 6–8 de cada slot', () => {
    for (let s = 0; s < 5; s++) {
      const x = Array.from(portraitPalette(ASSETS!, s, 6));
      expect(Array.from(portraitPalette(ASSETS!, s, 7))).toEqual(x);
      expect(Array.from(portraitPalette(ASSETS!, s, 8))).toEqual(x);
    }
  });
  const sbPng = loadCapturePng('scoreboard'), csPng = loadCapturePng('charsel');
  it.skipIf(!sbPng)('pixels: cada cabeça do placar (x 48, y 56 + 32·k) tem o SHA-1 do nosso retrato', () => {
    for (let k = 0; k < 5; k++) {
      const ours = portraitRgba(k, k);
      expect(sha1(cropLike(sbPng!, 48, 56 + 32 * k, portraitPixels(ASSETS!, k))), `${k + 1}P`).toBe(sha1(ours));
    }
  });
  it.skipIf(!csPng)('pixels: cada retrato da coluna da charsel (x 24, y 31 + 32·k) tem o SHA-1 do nosso retrato', () => {
    for (let k = 0; k < 5; k++) {
      const ours = portraitRgba(k, k);
      expect(sha1(cropLike(csPng!, 24, 31 + 32 * k, portraitPixels(ASSETS!, k))), `${k + 1}P`).toBe(sha1(ours));
    }
  });
  // RUBI (personagem 5) não aparece nas capturas de `cenas`; `montarias-e-telas/pr_ch_UP_p2.png` tem o 3P nele.
  const rubiPng = CAPTURES ? join(CAPTURES, '..', '..', 'montarias-e-telas', 'pr_ch_UP_p2.png') : '';
  it.skipIf(!rubiPng || !existsSync(rubiPng))('pixels: RUBI no slot 2 (retrato 4 da folha) = pr_ch_UP_p2', () => {
    const img = decodePng(new Uint8Array(readFileSync(rubiPng)));
    expect(sha1(cropLike(img, 24, 31 + 64, portraitPixels(ASSETS!, 5)))).toBe(sha1(portraitRgba(5, 2)));
  });
  it('SHA-1 dos 6 retratos no slot 0 (fixa a leitura da ROM)', () => {
    const got = [0, 1, 2, 3, 4, 5, NO_CHAR].map(c => sha1(portraitRgba(c, 0)).slice(0, 12));
    expect(got).toMatchInlineSnapshot(`
      [
        "f8f9b8a8acf9",
        "4059e2a8b8b0",
        "568d20b876a8",
        "8ff14b8ea4cc",
        "add3a6736b43",
        "2c995edfc294",
        "af009f4b9b4c",
      ]
    `);
  });
});
