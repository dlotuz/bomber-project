import { fromRows, makePix, flipH, setPx, alphaAt, blit } from '../../src/render/art/pix';
import { CHARACTERS, bomberFrame, headIcon } from '../../src/render/art/bomber';
import { bombPix, itemIcon } from '../../src/render/art/items';
import { flamePiece, type FlamePart } from '../../src/render/art/flames';
import { THEMES, stageTiles } from '../../src/render/art/tiles';
import { textPix, textWidth, hasGlyph } from '../../src/render/art/font';
import { crownPix, trophyPix, clockPix } from '../../src/render/art/trophy';
import { STAGE_NAMES } from '../../src/core';

const opaque = (p: { w: number; h: number; data: Uint8ClampedArray }) => {
  let n = 0; for (let i = 3; i < p.data.length; i += 4) if (p.data[i]) n++; return n;
};

describe('pix', () => {
  it('fromRows respeita a paleta e a transparência', () => {
    const p = fromRows(['a.', '.a'], { '.': null, a: '#ff0000' });
    expect([p.w, p.h]).toEqual([2, 2]);
    expect(alphaAt(p, 0, 0)).toBe(255);
    expect(alphaAt(p, 1, 0)).toBe(0);
    expect(Array.from(p.data.slice(0, 3))).toEqual([255, 0, 0]);
  });
  it('fromRows rejeita linhas de tamanhos diferentes', () => {
    expect(() => fromRows(['aa', 'a'], { a: '#ffffff' })).toThrow();
  });
  it('flipH espelha e blit respeita transparência', () => {
    const p = makePix(3, 1); setPx(p, 0, 0, '#ffffff');
    expect(alphaAt(flipH(p), 2, 0)).toBe(255);
    const dst = makePix(3, 1); setPx(dst, 1, 0, '#00ff00');
    blit(dst, p, 0, 0);
    expect(alphaAt(dst, 1, 0)).toBe(255);
    expect(dst.data[4 + 1]).toBe(255); // pixel verde não foi apagado pelo transparente
  });
  it('alphaAt retorna 0 para coordenadas fora dos limites', () => {
    const p = makePix(2, 2);
    expect(alphaAt(p, -1, 0)).toBe(0);
    expect(alphaAt(p, 2, 0)).toBe(0);
    expect(alphaAt(p, 0, -1)).toBe(0);
    expect(alphaAt(p, 0, 2)).toBe(0);
  });
});

describe('personagens', () => {
  it('6 personagens, todas as direções e quadros em 16×20 com conteúdo', () => {
    expect(CHARACTERS).toHaveLength(6);
    for (let c = 0; c < 6; c++) for (let d = 1; d <= 4; d++) for (let f = 0; f < 3; f++) {
      const p = bomberFrame(c, d, f);
      expect([p.w, p.h]).toEqual([16, 20]);
      expect(opaque(p)).toBeGreaterThan(100);
    }
  });
  it('esquerda é o espelho da direita', () => {
    expect(Array.from(bomberFrame(0, 3, 0).data)).toEqual(Array.from(flipH(bomberFrame(0, 4, 0)).data));
  });
  it('personagens diferentes geram sprites diferentes', () => {
    const keys = new Set([0, 1, 2, 3, 4, 5].map(c => Array.from(bomberFrame(c, 2, 0).data).join()));
    expect(keys.size).toBe(6);
  });
  it('ícone de cabeça 16×14', () => {
    const h = headIcon(2);
    expect([h.w, h.h]).toEqual([16, 14]);
  });
});

describe('itens, bomba e chamas', () => {
  it('8 ícones 16×16 com borda opaca', () => {
    for (let i = 1; i <= 8; i++) {
      const p = itemIcon(i);
      expect([p.w, p.h]).toEqual([16, 16]);
      expect(alphaAt(p, 0, 0)).toBe(255);
    }
  });
  it('bomba pulsa (quadros diferentes)', () => {
    expect(Array.from(bombPix(0).data)).not.toEqual(Array.from(bombPix(1).data));
  });
  it('peças de chama', () => {
    const parts: FlamePart[] = ['center', 'h', 'v', 'up', 'down', 'left', 'right'];
    for (const part of parts) for (let s = 0; s <= 3; s++) {
      const p = flamePiece(part, s);
      expect([p.w, p.h]).toEqual([16, 16]);
      expect(opaque(p)).toBeGreaterThan(0);
    }
    expect(alphaAt(flamePiece('h', 0), 15, 8)).toBe(255);
    expect(alphaAt(flamePiece('right', 0), 15, 8)).toBe(0);
    expect(alphaAt(flamePiece('right', 0), 0, 8)).toBe(255);
    expect(alphaAt(flamePiece('up', 0), 8, 0)).toBe(0);
    expect(alphaAt(flamePiece('up', 0), 8, 15)).toBe(255);
    expect(opaque(flamePiece('h', 3))).toBeLessThan(opaque(flamePiece('h', 0)));
  });
});

describe('arenas', () => {
  it('10 temas; piso, bloco fixo e parede totalmente opacos', () => {
    expect(THEMES).toHaveLength(10);
    for (let st = 1; st <= 10; st++) {
      const t = stageTiles(st);
      for (const p of [t.floor, t.floorAlt, t.hard, t.wall]) expect(opaque(p)).toBe(256);
      expect(opaque(t.soft)).toBeGreaterThan(80);
      expect(t.bg).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('fonte', () => {
  it('largura e altura', () => {
    expect(textWidth('AB')).toBe(11);
    const p = textPix('AB', '#ffffff', null);
    expect([p.w, p.h]).toEqual([11, 10]);
    const s = textPix('AB', '#ffffff');
    expect([s.w, s.h]).toEqual([13, 12]);
  });
  it('acentos ficam acima da letra', () => {
    const p = textPix('Á', '#ffffff', null);
    expect(alphaAt(p, 3, 0)).toBe(255);
  });
  it('todos os textos do jogo têm glifos', () => {
    const texts = [...STAGE_NAMES, 'PRONTOS?', 'JÁ!', 'PAUSA', 'EMPATE!', 'P1 VENCEU!', 'TIME VERMELHO VENCEU!',
      'TIME BRANCO VENCEU!', 'PLACAR', 'VITÓRIA!', 'É O CAMPEÃO!', 'PRESSIONE START', 'CROWN BLAST', '--:--',
      'ENTER / START NO CONTROLE', '0123456789'];
    for (const t of texts) for (const ch of t.toUpperCase()) expect(hasGlyph(ch), `${t}: ${ch}`).toBe(true);
  });
});

describe('visual da arena clássica', () => {
  it('fase 1: chão sem xadrez, pilar chapado e parede de placa', () => {
    const t = stageTiles(1);
    expect(Array.from(t.floorAlt.data)).toEqual(Array.from(t.floor.data));
    expect(Array.from(t.hard.data)).not.toEqual(Array.from(t.wall.data));
    expect(opaque(t.hard)).toBe(256);
  });
  it('as outras fases continuam alternando o piso', () => {
    const t = stageTiles(2);
    expect(Array.from(t.floorAlt.data)).not.toEqual(Array.from(t.floor.data));
  });
  it('relógio do HUD 16×16', () => {
    const c = clockPix();
    expect([c.w, c.h]).toEqual([16, 16]);
    expect(opaque(c)).toBeGreaterThan(150);
  });
});

describe('coroa e troféu', () => {
  it('tamanhos', () => {
    expect([crownPix().w, crownPix().h]).toEqual([12, 8]);
    const t = trophyPix();
    expect([t.w, t.h]).toEqual([24, 24]);
    expect(opaque(t)).toBeGreaterThan(200);
  });
});
