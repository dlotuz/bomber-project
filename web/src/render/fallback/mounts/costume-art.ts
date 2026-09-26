import { makePix, setPx, fillRect, type Pix } from '../../art/pix';

/** Chapéu/roupa do traje (0..7), 16×10, desenho original (sem pixels da ROM), um por traje. */
export function costumePix(c: number): Pix {
  const p = makePix(16, 10);
  switch (c & 7) {
    case 0:   // cartola preta
      fillRect(p, 3, 0, 10, 6, '#101010');
      fillRect(p, 1, 6, 14, 2, '#1a1a1a');
      fillRect(p, 3, 1, 10, 1, '#3f3f3f');
      break;
    case 1:   // coroa dourada
      fillRect(p, 2, 5, 12, 3, '#f0c020');
      for (let i = 0; i < 4; i++) fillRect(p, 2 + i * 3, 1, 3, 4, '#f0c020');
      fillRect(p, 6, 3, 2, 2, '#d02040');
      break;
    case 2:   // chapéu de palha
      fillRect(p, 0, 6, 16, 2, '#d8b860');
      fillRect(p, 4, 1, 8, 5, '#e8cc80');
      fillRect(p, 3, 6, 10, 1, '#7a5a20');
      break;
    case 3:   // capacete cinza
      for (let y = 0; y < 6; y++) for (let x = 0; x < 16; x++) {
        const d = ((x - 8) / 8) ** 2 + ((y - 8) / 8) ** 2;
        if (d <= 1) setPx(p, x, y, y >= 5 ? '#5a5a5a' : '#909090');
      }
      fillRect(p, 6, 6, 4, 3, '#5a5a5a');
      break;
    case 4:   // laço rosa
      fillRect(p, 1, 2, 5, 6, '#ff6fb0');
      fillRect(p, 10, 2, 5, 6, '#ff6fb0');
      fillRect(p, 6, 3, 4, 4, '#ff2f8f');
      break;
    case 5:   // turbante roxo
      fillRect(p, 1, 3, 14, 5, '#6a2f9f');
      fillRect(p, 3, 1, 10, 3, '#8a4fbf');
      fillRect(p, 13, 2, 2, 2, '#f0c020');
      break;
    case 6:   // boné vermelho
      fillRect(p, 2, 1, 11, 5, '#d81818');
      fillRect(p, 9, 5, 7, 2, '#a80f0f');
      break;
    default:  // gorro azul com pompom
      fillRect(p, 3, 2, 10, 5, '#2050c0');
      fillRect(p, 6, 0, 4, 3, '#2050c0');
      fillRect(p, 6, 0, 4, 1, '#e8e8e8');
      break;
  }
  return p;
}
