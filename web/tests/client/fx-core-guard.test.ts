import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (d: string): string[] => readdirSync(d).flatMap(f => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));

describe('núcleo não depende do render (spec efeitos §2.1)', () => {
  it('nenhum arquivo de src/core importa de render/', () => {
    const bad = walk(join(__dirname, '../../src/core')).filter(f => /from ['"][^'"]*render\//.test(readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });
});
