import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { formatReport, readImageSize, safeImagePath, validatePack, type HdImageInfo } from '../../src/render/hdart/validate';
import { HD_CATALOG } from '../../src/render/hdart/catalog';

const WEB = fileURLToPath(new URL('../../', import.meta.url));

/** Pacote falso válido: um personagem andando, numa folha 384×128. */
function pack(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    format: 1, name: 'teste', credits: 'Fulana', license: 'CC BY 4.0', cell: 64,
    images: { p0: 'p0.png' },
    anims: {
      'char/0/walk/down': {
        frames: [0, 96, 0, 192].map(x => ({ img: 'p0', rect: [x, 0, 96, 128], anchor: [48, 108] })),
        ticks: [12, 8, 12, 8], loop: true,
      },
    },
    ...over,
  };
}
const imgs = (m: Record<string, HdImageInfo>) => (f: string): HdImageInfo | null => m[f] ?? null;
const SHEET = imgs({ 'p0.png': { w: 384, h: 128 } });
const ondes = (r: { erros: { onde: string }[] }) => r.erros.map(e => e.onde);

describe('validador do pacote HD', () => {
  it('pacote parcial bem formado: sem erros, 1 desenho presente, o resto listado como faltando', () => {
    const r = validatePack(pack(), SHEET);
    expect(r.erros).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.totais).toEqual({ catalogo: HD_CATALOG.length, presentes: 1 });
    expect(r.faltando.essencial).not.toContain('char/0/walk/down');
    expect(r.faltando.essencial).toContain('char/0/idle/down');
    const total = r.faltando.essencial.length + r.faltando.bom.length + r.faltando.raro.length;
    expect(total).toBe(HD_CATALOG.length - 1);
    const pers = r.cobertura.find(c => c.group === 'personagens')!;
    expect([pers.presentes, pers.porPrioridade.essencial.presentes]).toEqual([1, 1]);
  });

  it('manifesto que não é objeto, formato errado e nome vazio', () => {
    expect(ondes(validatePack([], SHEET))).toEqual(['pacote.json']);
    expect(ondes(validatePack(pack({ format: 2, name: ' ' }), SHEET))).toEqual(['format', 'name']);
  });

  it('credits e license são obrigatórios (arte original)', () => {
    const r = validatePack(pack({ credits: '', license: undefined }), SHEET);
    expect(ondes(r)).toEqual(['credits', 'license']);
    expect(r.ok).toBe(false);
  });

  it('cell: 0 é erro, 32 é só aviso', () => {
    expect(ondes(validatePack(pack({ cell: 0 }), SHEET))).toEqual(['cell']);
    const r = validatePack(pack({ cell: 32 }), SHEET);
    expect(r.erros).toEqual([]);
    expect(r.avisos.map(a => a.onde)).toContain('cell');
  });

  it('imagem que não existe e caminho que sai da pasta', () => {
    expect(ondes(validatePack(pack(), imgs({})))).toEqual(['images.p0']);
    const r = validatePack(pack({ images: { p0: '../fora.png' } }), SHEET);
    expect(ondes(r)).toEqual(['images.p0']);
    expect(safeImagePath('folhas/p0.png')).toBe(true);
    for (const bad of ['/abs.png', '../x.png', 'a/../../x.png', 'C:\\x.png', 'a//b.png', './x.png']) expect(safeImagePath(bad), bad).toBe(false);
  });

  it('recorte fora da imagem e ponto de apoio fora do recorte', () => {
    const base = pack();
    const anim = (base.anims as Record<string, { frames: { rect: number[]; anchor: number[] }[] }>)['char/0/walk/down'];
    anim.frames[1].rect = [300, 0, 96, 128];   // 300 + 96 > 384
    anim.frames[2].anchor = [48, 140];         // 140 > 128
    const r = validatePack(base, SHEET);
    expect(ondes(r)).toEqual(['char/0/walk/down frames[1]', 'char/0/walk/down frames[2]']);
    expect(r.erros[0].msg).toMatch(/sai da imagem/);
    expect(r.erros[1].msg).toMatch(/ponto de apoio/);
    expect(r.totais.presentes).toBe(0);   // animação com erro não conta como presente
  });

  it('ticks: tamanho diferente de frames, zero, negativo, fração; loop não booleano', () => {
    const r1 = validatePack(pack({ anims: { 'bomb/0': {
      frames: [{ img: 'p0', rect: [0, 0, 64, 64], anchor: [32, 32] }, { img: 'p0', rect: [64, 0, 64, 64], anchor: [32, 32] }],
      ticks: [10], loop: true } } }), SHEET);
    expect(r1.erros.map(e => e.msg)).toEqual([expect.stringMatching(/"ticks" tem 1 valores e "frames" tem 2/)]);
    const r2 = validatePack(pack({ anims: { 'bomb/0': {
      frames: [0, 1, 2].map(i => ({ img: 'p0', rect: [i * 64, 0, 64, 64], anchor: [32, 32] })), ticks: [0, -3, 1.5], loop: 'sim' } } }), SHEET);
    expect(ondes(r2)).toEqual(['bomb/0 ticks[0]', 'bomb/0 ticks[1]', 'bomb/0 ticks[2]', 'bomb/0']);
  });

  it('quadro com imagem fora de "images", rect malformado e frames vazio', () => {
    const r = validatePack(pack({ anims: {
      'bomb/0': { frames: [{ img: 'nada', rect: [0, 0, 64, 64], anchor: [32, 32] }], ticks: [1], loop: true },
      'bomb/1': { frames: [{ img: 'p0', rect: [0, 0, 64], anchor: [32, 32] }], ticks: [1], loop: true },
      'bomb/2': { frames: [], ticks: [], loop: true },
    } }), SHEET);
    expect(ondes(r)).toEqual(['bomb/0 frames[0]', 'bomb/1 frames[0]', 'bomb/2']);
  });

  it('chave desconhecida é aviso (e não conta) e imagem sem uso é aviso', () => {
    const r = validatePack(pack({
      images: { p0: 'p0.png', sobra: 'sobra.png' },
      anims: { 'char/0/andar/down': { frames: [{ img: 'p0', rect: [0, 0, 96, 128], anchor: [48, 108] }], ticks: [1], loop: false } },
    }), imgs({ 'p0.png': { w: 384, h: 128 }, 'sobra.png': { w: 8, h: 8 } }));
    expect(r.erros).toEqual([]);
    expect(r.desconhecidas).toEqual(['char/0/andar/down']);
    expect(r.totais.presentes).toBe(0);
    expect(r.avisos.map(a => a.onde)).toEqual(['char/0/andar/down', 'images.sobra']);
  });

  it('relatório em PT-BR com erros, cobertura e o que falta por prioridade', () => {
    const txt = formatReport(validatePack(pack({ license: '' }), SHEET), 5);
    expect(txt).toMatch(/Pacote "teste": 1 de \d+ desenhos/);
    expect(txt).toMatch(/ERROS \(1\):\n {2}✗ license:/);
    expect(txt).toMatch(/COBERTURA POR GRUPO:\n {2}Personagens/);
    expect(txt).toMatch(/FALTANDO — essencial para jogar \(\d+\): Personagens \d+/);
    expect(txt).toMatch(/… e mais \d+ \(use --tudo/);
    expect(txt).toMatch(/RESULTADO: pacote com 1 erro\(s\)/);
    expect(formatReport(validatePack(pack(), SHEET))).toMatch(/RESULTADO: pacote válido \(parcial/);
  });
});

/** Cabeçalho PNG mínimo (assinatura + IHDR) com w×h. */
function pngHeader(w: number, h: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return b;
}
function webp(chunk: string, body: number[]): Uint8Array {
  const b = new Uint8Array(40);
  b.set([...'RIFF'].map(c => c.charCodeAt(0)), 0);
  b.set([...'WEBP'].map(c => c.charCodeAt(0)), 8);
  b.set([...chunk].map(c => c.charCodeAt(0)), 12);
  b.set(body, 20);
  return b;
}

describe('tamanho de imagem pelo cabeçalho', () => {
  it('PNG, WebP (VP8X, VP8L, VP8) e lixo', () => {
    expect(readImageSize(pngHeader(384, 128))).toEqual({ w: 384, h: 128 });
    expect(readImageSize(webp('VP8X', [0, 0, 0, 0, 0x7f, 0x01, 0, 0xff, 0, 0]))).toEqual({ w: 384, h: 256 });
    // VP8L: assinatura 0x2f, 14 bits (w−1) e 14 bits (h−1): 99×49 → 98 | 48 << 14
    const v = 98 | (48 << 14);
    expect(readImageSize(webp('VP8L', [0x2f, v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff]))).toEqual({ w: 99, h: 49 });
    expect(readImageSize(webp('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, 64, 0, 32, 0]))).toEqual({ w: 64, h: 32 });
    expect(readImageSize(new TextEncoder().encode('não é imagem nenhuma, só texto'))).toBeNull();
  });
});

describe('script validar.ts', () => {
  it('pasta válida sai com 0 e imprime o relatório; com erro sai com 1', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hdpack-'));
    try {
      mkdirSync(join(dir, 'ok'));
      writeFileSync(join(dir, 'ok', 'pacote.json'), JSON.stringify(pack()));
      writeFileSync(join(dir, 'ok', 'p0.png'), pngHeader(384, 128));
      const ok = spawnSync(process.execPath, ['scripts/arte-hd/validar.ts', join(dir, 'ok')], { cwd: WEB, encoding: 'utf8' });
      expect(ok.status).toBe(0);
      expect(ok.stdout).toMatch(/Pacote "teste": 1 de/);
      expect(ok.stdout).toMatch(/RESULTADO: pacote válido/);

      mkdirSync(join(dir, 'ruim'));
      writeFileSync(join(dir, 'ruim', 'pacote.json'), JSON.stringify(pack({ credits: '' })));
      writeFileSync(join(dir, 'ruim', 'p0.png'), pngHeader(100, 100));   // pequena demais para os recortes
      const bad = spawnSync(process.execPath, ['scripts/arte-hd/validar.ts', join(dir, 'ruim')], { cwd: WEB, encoding: 'utf8' });
      expect(bad.status).toBe(1);
      expect(bad.stdout).toMatch(/✗ credits:/);
      expect(bad.stdout).toMatch(/sai da imagem "p0" \(100×100\)/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }, 60_000);
});
