// Anel dos últimos segundos gravados (CLIPE). O MediaRecorder entrega o arquivo em pedaços que não são decodificáveis
// sozinhos; o anel lê o contêiner (webm.ts ou mp4.ts) elemento a elemento, guarda o cabeçalho e os segmentos (Cluster
// do webm, moof+mdat do MP4) dos últimos `keepMs`, e monta um arquivo completo a partir de um segmento que começa num
// quadro-chave (o gravador põe um a cada segundo).

/** Arquivo montado: os pedaços (para o `Blob`) e a duração, com os tempos já começando em 0. */
export interface ClipFile { parts: Uint8Array[]; durMs: number }

export interface ClipRing {
  /** Mais bytes do gravador, na ordem em que chegaram (qualquer corte). */
  push(chunk: Uint8Array): void;
  /** Arquivo com os últimos `ms` (começando no quadro-chave mais próximo antes disso); null = ainda não há o que montar.
   *  `title`: título gravado no arquivo (só o MP4; o webm sai sem). */
  build(ms: number, title?: string): ClipFile | null;
  /** O fluxo não é o contêiner esperado (o anel parou de ler). */
  readonly broken: boolean;
  /** Segmentos guardados (inclui o que ainda está chegando) e quantos começam num quadro-chave. */
  readonly segments: number;
  readonly keySegments: number;
  /** O primeiro segmento guardado começa num quadro-chave. */
  readonly firstKey: boolean;
  /** Tempo do início do primeiro segmento guardado e do fim do último quadro visto, em ms. */
  readonly startMs: number;
  readonly endMs: number;
  /** Bytes dos segmentos guardados (o cabeçalho, pequeno, fica de fora). */
  readonly bytesHeld: number;
}

/** Junta pedaços num só (o anel acumula os bytes que ainda não formam um elemento inteiro). */
export function concat(parts: readonly Uint8Array[]): Uint8Array {
  if (parts.length === 1) return parts[0];
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let k = 0;
  for (const p of parts) { out.set(p, k); k += p.length; }
  return out;
}

/** Índice do segmento onde o clipe de `ms` começa: o último com quadro-chave que começa até `end − ms`; se a gravação
 *  for mais curta, o primeiro com quadro-chave; -1 = nenhum. */
export function startIndex(segs: readonly { key: boolean; start: number }[], end: number, ms: number): number {
  let first = -1, pick = -1;
  for (let i = 0; i < segs.length; i++) {
    if (!segs[i].key) continue;
    if (first < 0) first = i;
    if (segs[i].start <= end - ms) pick = i;
  }
  return pick >= 0 ? pick : first;
}

/** Quantos segmentos do começo podem sair do anel: tudo antes do último quadro-chave que ainda cobre `end − keep`. */
export function dropCount(segs: readonly { key: boolean; start: number }[], end: number, keep: number): number {
  let n = 0;
  for (let i = 1; i < segs.length; i++) if (segs[i].key && segs[i].start <= end - keep) n = i;
  return n;
}
