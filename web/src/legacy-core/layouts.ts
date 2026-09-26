export const STAGE_NAMES = [
  'O Clássico', 'Rápido e Devagar', 'Bombardeio Orbital', 'Não Me Empurre', 'Escola de Choques',
  'Piso Traiçoeiro', 'Esconde-Explode', 'Caça-Níquel', 'Gangorra', 'Alfaiataria',
];

const BASE = [
  '..xxxx.xxxx..', '.#x#.#.#x#x#.', 'xxx.xxxxxxxxx', '.#x#x#x#x#x#x', '.xxxx...xxx.x', 'x#.#x#.#x#x#x',
  'xxxxx...x.xxx', 'x#x#x#x#x#x#x', '.x.xxxxxxxxxx', '.#x#.#x#.#.#.', '..xxxxxxxxx..',
];

export const LAYOUTS: string[][] = [
  BASE,
  BASE,
  ['..xxxx.xxxx..', '.#x#.#.#x#x#.', 'xxx.xxxxxxxxx', 'x#x#x#x#x#x#x', '.xxx?...xxxxx', 'x#.#x#.#x#x#x',
   'xxxxx...?.xxx', 'x#x#x#x#x#x#x', '.x.xxxxxxxxxx', '.#x#.#x#.#.#.', '..xxxxxxxxx..'],
  ['..xxx###xxx..', '.#x#.###x#x#.', 'xxx.xxxxxxxxx', 'x#x#x#x#x#x#x', '####x...x####', '####x#.#x####',
   'xxxxx...x.xxx', 'x#x#x#x#x#x#x', 'xxxxxxxxxxxxx', '.#x#.###x#x#.', '..xxx###xxx..'],
  ['.............', '.#.#.#.#.#.#.', '.............', '.#.#.#.#.#.#.', '.............', '.#.#.#.#.#.#.',
   '.............', '.#.#.#.#.#.#.', '.............', '.#.#.#.#.#.#.', '.............'],
  BASE,
  ['..xxxx.xxxx..', '.#x#.#.#x#x#.', 'xx?.x...xx?xx', 'x#x#x#.#x#x#x', 'x...x...x...x', 'x#.#x#.#x#.#x',
   'x...x...x...x', 'x#x#x#.#x#x#x', 'xx?xx...xx?xx', '.#x#.#.#x#x#.', '..xxxxxxxxx..'],
  ['.............', '.#.#.#.#.#.#.', '.............', '.#.#.#.#.#.#.', '.............', '.#.#.#.#.#.#.',
   '..?...?...?..', '.#.#.#.#.#.#.', '.............', '.#.#.#.#.#.#.', '.............'],
  ['..xxxx.xxxx..', '.#x#x#x#x#x#.', 'xx...xxx...xx', 'x#x#x#x#x#x#x', 'xxxxx...xxxxx', 'x#.#x#.#x#x#x',
   'xxxxx...x.xxx', 'x#x#x#x#x#x#x', 'xx...xxx...xx', '.#x#.#x#x#x#.', '..xxxxxxxxx..'],
  BASE,
];
