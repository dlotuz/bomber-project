import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildBattleFrame } from '../../src/render/rom/battle';
import { renderPpu } from '../../src/render/ppu';
import { blankImage } from './fakes';
import { ASSETS } from './rom-fixture';
import { BTN, newRound, stepN, toPlay } from './core-fixture';
import { encodePng } from './png';

const OUT = process.env.SHOTS_DIR ?? join(tmpdir(), 'crown-blast-shots');

describe.skipIf(!ASSETS || !process.env.SHOTS)('screenshots das 10 arenas com a ROM (§11, aceite 7)', () => {
  it('3 imagens por arena: início, bomba acesa com jogadores andando, explosão', () => {
    mkdirSync(OUT, { recursive: true });
    const img = blankImage();
    for (let stage = 1; stage <= 10; stage++) {
      const s = newRound(stage);
      toPlay(s);
      const shot = (name: string, frame: number) => {
        renderPpu(buildBattleFrame(s, { crowns: [0, 1, 2, 0, 3] }, ASSETS!, frame), img);
        writeFileSync(join(OUT, `arena-${String(stage).padStart(2, '0')}-${name}.png`), encodePng(256, 224, img.data));
      };
      shot('inicio', 0);
      stepN(s, 1, [BTN.A, 0, 0, 0, 0]);
      stepN(s, 40, [BTN.DOWN, BTN.LEFT, BTN.DOWN, BTN.UP, BTN.RIGHT]);
      shot('bomba', 41);
      stepN(s, 90, [0, BTN.LEFT, 0, BTN.UP, 0]);
      shot('explosao', 131);
    }
    expect(readdirSync(OUT).filter(f => /^arena-\d\d-/.test(f)).length).toBeGreaterThanOrEqual(30);
  });
});
