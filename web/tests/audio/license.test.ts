import { fs } from './node';

const read = (p: string) => new TextDecoder().decode(fs.readFileSync(new URL(`../../${p}`, import.meta.url)));

describe('LGPL do módulo S-DSP no jogo publicado (I2)', () => {
  it('os 2 arquivos do DSP abrem com um comentário /*! … @license */ (o minificador o preserva)', () => {
    for (const f of ['src/audio/apu/dsp/spc-dsp.ts', 'src/audio/apu/dsp/tables.ts']) {
      const s = read(f);
      expect(s.startsWith('/*!')).toBe(true);
      const head = s.slice(0, s.indexOf('*/'));
      expect(head).toContain('@license LGPL-2.1-or-later');
      expect(head).toContain('Shay Green');
    }
  });
  it('LICENSE e NOTICE.txt vão ao build (public/licenses) iguais aos de vendor/snes_spc', () => {
    for (const f of ['LICENSE', 'NOTICE.txt']) expect(read(`public/licenses/${f}`)).toBe(read(`vendor/snes_spc/${f}`));
    expect(read('public/licenses/LICENSE')).toContain('GNU LESSER GENERAL PUBLIC LICENSE');
    expect(read('public/licenses/index.html')).toContain('https://github.com/dlotuz/bomber-project');
  });
  it('a página do jogo tem o aviso visível com o link para as licenças e a fonte', () => {
    const html = read('index.html');
    expect(html).toMatch(/<a [^>]*href="licenses\/index.html"[^>]*>[^<]*LGPL/);
  });
});
