// Rastreio de leitura da ROM, para gerar o pacote embutido (scripts/rom-pack): a imagem vira um Proxy que marca cada
// byte lido (índice, slice, subarray). Só ferramenta de desenvolvimento: nos testes (tests/rom/trace.ts, SB4_TRACE) e no
// jogo em dev com ?romtrace=<url da ROM> (main.ts); o jogo publicado nunca passa por aqui.

/** Uma cópia deste tamanho ou maior é da ROM inteira (ou quase: hash, validação), não de um asset; não conta. */
const WHOLE = 0x100000;

export interface RomTrace {
  /** Use no lugar da ROM: lê igual, marcando o que foi lido. */
  view: Uint8Array;
  /** Faixas [início, fim) lidas até agora. */
  ranges(): [number, number][];
  /** Pilhas das cópias da ROM inteira, que ficaram de fora. */
  whole: string[];
}

export function traceRom(rom: Uint8Array): RomTrace {
  const seen = new Uint8Array(rom.length);
  const whole: string[] = [];
  const span = (len: number, start?: number, end?: number): [number, number] => {
    const norm = (v: number | undefined, d: number): number => (v === undefined ? d : v < 0 ? Math.max(0, len + v) : Math.min(v, len));
    return [norm(start, 0), norm(end, len)];
  };
  const view = new Proxy(rom, {
    get(t, k) {
      if (typeof k === 'string' && k.length && k.charCodeAt(0) >= 48 && k.charCodeAt(0) <= 57) {
        const i = Number(k);
        if (Number.isInteger(i)) { if (i < seen.length) seen[i] = 1; return t[i]; }
      }
      if (k === 'slice' || k === 'subarray') {
        return (a?: number, b?: number) => {
          const [s, e] = span(t.length, a, b);
          if (e - s >= WHOLE) whole.push(new Error().stack ?? '?'); else seen.fill(1, s, e);
          return t[k](s, e);
        };
      }
      const v = Reflect.get(t, k, t);
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
  const ranges = (): [number, number][] => {
    const out: [number, number][] = [];
    for (let i = 0; i < seen.length;) {
      if (!seen[i]) { i++; continue; }
      let j = i;
      while (j < seen.length && seen[j]) j++;
      out.push([i, j]);
      i = j;
    }
    return out;
  };
  return { view, ranges, whole };
}
