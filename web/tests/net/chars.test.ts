import { CHAR_MAX } from '../../server/chars.mjs';
import { CHAR_COUNT } from '../../src/render/art/charskins';

it('a sala aceita todos os personagens (originais + skins)', () => {
  expect(CHAR_MAX).toBe(CHAR_COUNT - 1);
});
