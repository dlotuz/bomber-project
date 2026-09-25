import { fromRows, makePix, fillRect, blit, type Pix } from './pix';

const BOMB_ROWS = [
  '...........yy...', '..........ywy...', '.........f.yy...', '........f.......',
  '.....kkkkf......', '...kkbbbbkk.....', '..kbbbbbbbbk....', '.kbWWbbbbbbbk...',
  '.kbWbbbbbbbbk...', '.kbbbbbbbbbbk...', '.kbbbbbbbbbbk...', '.kbbbbbbbbbBk...',
  '..kbbbbbbbBk....', '...kkbbbBBk.....', '.....kkkkk......', '................',
];

/** Bomba 16×16. frame 0/1 alterna a faísca e a cor do corpo (pulsar). */
export function bombPix(frame: number): Pix {
  return fromRows(BOMB_ROWS, {
    '.': null, k: '#0b0b14', b: frame ? '#34406a' : '#27304f', B: '#151a2e', W: '#c9d6ff',
    f: '#b0773a', y: frame ? '#ff7a1a' : '#ffd23f', w: '#ffffff',
  });
}

/** Glifos 12×12 dos itens, na ordem do ITEM do core (1..8). */
const ICONS: Record<number, string[]> = {
  1: ['....kkk.y...', '...k...ky...', '..kkkkkk....', '.kaaaaaak...', 'kaawaaaaak..', 'kawaaaaaak..', 'kaaaaaaaak..', 'kaaaaaaaak..', '.kaaaaaak...', '..kkkkkk....', '............', '............'],
  2: ['.....k......', '....kak.....', '....kaak....', '...kacak....', '..kaccak.k..', '..kacccakak.', '.kacccccaak.', '.kaccwccak..', '.kacwwwcak..', '..kacwcak...', '...kaaak....', '....kkk.....'],
  3: ['......kkkkk.', '.....kaaak..', '....kaaak...', '...kaaak....', '..kaaakkkk..', '.kaaaaaaak..', '.kkkkaaak...', '....kaak....', '...kaak.....', '..kaak......', '.kak........', '.kk.........'],
  4: ['....kkk.....', '...kaaak....', '...kaaak....', '...kaaak....', '...kaaakkk..', '..kaaaaaaak.', '..kaaaaaaaak', '.kaaaaaaaaak', '.kccccccccck', '.kkkkkkkkkk.', '............', '............'],
  5: ['...kkkkkk...', '..kwwwwwwk..', '.kwwwwwwwwk.', '.kwkkwwkkwk.', '.kwkkwwkkwk.', '.kwwwkkwwwk.', '..kwwwwwwk..', '...kwkwkwk..', '...kkkkkk...', '............', '............', '............'],
  6: ['............', '..kkkkkkk...', '.kaakaakak..', '.kaakaakaak.', '.kaaaaaaaak.', '.kaaaaaaaak.', '.kaaaaaaak..', '..kaaaaaak..', '...kccccck..', '...kccccck..', '...kkkkkkk..', '............'],
  7: ['..k.k.k.....', '.kakakak....', '.kakakak.k..', '.kakakakak..', '.kaaaaaaak..', '.kaaaaaaak..', '.kaaaaaak...', '..kaaaaak...', '..kcccccck..', '..kcccccck..', '..kkkkkkkk..', '............'],
  8: ['............', '..kkkkkkk...', '..kaaaaaak..', '..kaakkkaak.', '..kaak.kaak.', '..kaakkkaak.', '..kaaaaaak..', '..kaakkkk...', '..kaak......', '..kaak......', '..kkkk......', '............'],
};
/** [fundo, borda clara, cor a, cor c] de cada item. */
const STYLE: Record<number, [string, string, string, string]> = {
  1: ['#2d6bff', '#9fc0ff', '#1b1f33', '#ffffff'],
  2: ['#ff7a1a', '#ffd08a', '#ffd23f', '#ff3b1a'],
  3: ['#28c2b0', '#aef5ea', '#ffe45a', '#ffffff'],
  4: ['#8f5cff', '#d7c4ff', '#e8403a', '#ffffff'],
  5: ['#3a1d4a', '#b58cff', '#ffffff', '#ffffff'],
  6: ['#ff4f7a', '#ffc2d2', '#ffe7c7', '#e8403a'],
  7: ['#2fa84f', '#b5f2c4', '#2d6bff', '#ffffff'],
  8: ['#ffb000', '#ffe29a', '#e8403a', '#ffffff'],
};

/** Placa de item 16×16. */
export function itemIcon(item: number): Pix {
  const [bg, border, a, c] = STYLE[item];
  const p = makePix(16, 16);
  fillRect(p, 0, 0, 16, 16, '#0b0b14');
  fillRect(p, 1, 1, 14, 14, border);
  fillRect(p, 2, 2, 12, 12, bg);
  blit(p, fromRows(ICONS[item], { '.': null, k: '#0b0b14', a, c, w: '#ffffff', y: '#ffd23f' }), 2, 2);
  return p;
}
