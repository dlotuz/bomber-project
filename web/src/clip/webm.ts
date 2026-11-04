// Leitor do webm do MediaRecorder (EBML) para o anel do CLIPE (ring.ts). O Chrome grava ao vivo: o Segment e os
// Clusters vêm com tamanho desconhecido, e os filhos de cada Cluster (Timecode, SimpleBlock, BlockGroup) com tamanho
// conhecido. O vídeo vai em BlockGroup: quadro-chave = Block sem ReferenceBlock. Guarda o cabeçalho (EBML, Info,
// Tracks) e os Clusters; o clipe sai com o Segment e os Clusters de tamanho conhecido, os tempos a partir de 0 e a
// duração escrita no Info (sem ela o player não mostra o tempo nem deixa buscar).
import { concat, dropCount, startIndex, type ClipFile, type ClipRing } from './ring';

const ID = {
  EBML: 0x1a45dfa3, SEGMENT: 0x18538067, INFO: 0x1549a966, TRACKS: 0x1654ae6b, CLUSTER: 0x1f43b675,
  TIMECODE: 0xe7, SIMPLEBLOCK: 0xa3, BLOCKGROUP: 0xa0, BLOCK: 0xa1, REFERENCEBLOCK: 0xfb,
  DURATION: 0x4489, TIMECODESCALE: 0x2ad7b1, TRACKENTRY: 0xae, TRACKNUMBER: 0xd7, TRACKTYPE: 0x83,
} as const;
/** Filhos do Segment (nível 1): um deles fecha o Cluster de tamanho desconhecido. */
const LEVEL1 = new Set<number>([ID.CLUSTER, ID.INFO, ID.TRACKS, 0x114d9b74, 0x1c53bb6b, 0x1254c367, 0x1941a469, 0x1043a770]);

/** vint do EBML em `b[p]`: `len` bytes; `id` com o marcador (IDs), `val` sem ele; `unknown` = todos os bits em 1.
 *  null = faltam bytes; 'bad' = primeiro byte zero (não é EBML). */
function vint(b: Uint8Array, p: number): { len: number; id: number; val: number; unknown: boolean } | null | 'bad' {
  if (p >= b.length) return null;
  const f = b[p];
  if (f === 0) return 'bad';
  const len = Math.clz32(f) - 23;
  if (p + len > b.length) return null;
  const mask = 0xff >> len;
  let id = f, val = f & mask, ones = (f & mask) === mask;
  for (let i = 1; i < len; i++) {
    const x = b[p + i];
    id = id * 256 + x; val = val * 256 + x;
    if (x !== 0xff) ones = false;
  }
  return { len, id, val, unknown: ones };
}
interface El { id: number; start: number; data: number; end: number; unknown: boolean }
/** Cabeçalho do elemento em `p` (os dados podem ainda não ter chegado); null = faltam bytes. */
function elAt(b: Uint8Array, p: number): El | null | 'bad' {
  const id = vint(b, p);
  if (id === null || id === 'bad') return id;
  const sz = vint(b, p + id.len);
  if (sz === null || sz === 'bad') return sz;
  const data = p + id.len + sz.len;
  return { id: id.id, start: p, data, end: sz.unknown ? Infinity : data + sz.val, unknown: sz.unknown };
}
function* children(b: Uint8Array, e: El): Generator<El> {
  for (let p = e.data; p < e.end;) {
    const c = elAt(b, p);
    if (!c || c === 'bad' || c.end > e.end) return;
    yield c;
    p = c.end;
  }
}
const uint = (b: Uint8Array, s: number, e: number): number => { let v = 0; for (let i = s; i < e; i++) v = v * 256 + b[i]; return v; };
const float = (b: Uint8Array, s: number, e: number): number => {
  const dv = new DataView(b.buffer, b.byteOffset + s, e - s);
  return e - s === 4 ? dv.getFloat32(0) : dv.getFloat64(0);
};
const idBytes = (id: number): Uint8Array => {
  const out: number[] = [];
  for (; id > 0; id = Math.floor(id / 256)) out.unshift(id % 256);
  return Uint8Array.from(out);
};
/** Tamanho em 8 bytes (0x01 + 7): cabe qualquer coisa e dispensa calcular o comprimento antes. */
const size8 = (n: number): Uint8Array => {
  const o = new Uint8Array(8);
  o[0] = 0x01;
  for (let i = 7; i >= 1; i--) { o[i] = n % 256; n = Math.floor(n / 256); }
  return o;
};
const element = (id: number, data: readonly Uint8Array[]): Uint8Array[] =>
  [idBytes(id), size8(data.reduce((a, d) => a + d.length, 0)), ...data];
const uintData = (v: number): Uint8Array => {
  const d: number[] = [];
  do { d.unshift(v % 256); v = Math.floor(v / 256); } while (v > 0);
  return Uint8Array.from(d);
};

interface Cluster { tc: number; blocks: Uint8Array[]; bytes: number; key: boolean; sawVideo: boolean; last: number }
const seg = (c: Cluster): { key: boolean; start: number } => ({ key: c.key, start: c.tc });

export class WebmRing implements ClipRing {
  broken = false;
  private pend: Uint8Array = new Uint8Array(0);
  private base = 0;                         // posição no fluxo do pend[0]
  private started = false;                  // já leu o cabeçalho EBML
  private inSegment = false;
  private ebml: Uint8Array | null = null;
  private info: Uint8Array | null = null;
  private tracks: Uint8Array | null = null;
  private video = -1;                       // número da trilha de vídeo
  private scale = 1_000_000;                // ns por unidade de tempo (TimecodeScale)
  private cur: Cluster | null = null;
  private curEnd = Infinity;                // fim do Cluster atual no fluxo (tamanho conhecido)
  private readonly clusters: Cluster[] = [];

  /** `keepMs`: quanto guardar (o clipe mais longo pedido e uma folga). */
  constructor(private readonly keepMs: number) {}

  push(chunk: Uint8Array): void {
    if (this.broken || !chunk.length) return;
    this.pend = this.pend.length ? concat([this.pend, chunk]) : chunk.slice();
    let p = 0;
    for (;;) {
      const e = elAt(this.pend, p);
      if (e === 'bad') { this.fail(); return; }
      if (!e) break;
      if (this.cur && (LEVEL1.has(e.id) || this.base + p >= this.curEnd)) { this.finish(); continue; }
      if (!this.started) {
        if (e.id !== ID.EBML) { this.fail(); return; }
        if (e.end > this.pend.length) break;
        this.ebml = this.pend.slice(e.start, e.end);
        this.started = true; p = e.end; continue;
      }
      if (!this.inSegment) {
        if (e.id !== ID.SEGMENT) { this.fail(); return; }
        this.inSegment = true; p = e.data; continue;
      }
      if (e.id === ID.CLUSTER) {
        this.cur = { tc: 0, blocks: [], bytes: 0, key: false, sawVideo: false, last: 0 };
        this.curEnd = e.unknown ? Infinity : this.base + e.end;
        p = e.data; continue;
      }
      if (e.unknown) { this.fail(); return; }   // só o Segment e o Cluster podem ter tamanho desconhecido
      if (e.end > this.pend.length) break;
      if (this.cur) this.clusterChild(e);
      else if (e.id === ID.INFO) this.readInfo(e);
      else if (e.id === ID.TRACKS) this.readTracks(e);
      p = e.end;   // SeekHead, Cues, Tags, Void…: descartados
    }
    this.base += p;
    this.pend = this.pend.slice(p);
  }

  private fail(): void { this.broken = true; this.pend = new Uint8Array(0); }

  private clusterChild(e: El): void {
    const c = this.cur!, b = this.pend;
    if (e.id === ID.TIMECODE) { c.tc = uint(b, e.data, e.end); return; }
    if (e.id !== ID.SIMPLEBLOCK && e.id !== ID.BLOCKGROUP) return;
    let blk = e.data, key = false;
    if (e.id === ID.BLOCKGROUP) {
      key = true;
      for (const k of children(b, e)) {
        if (k.id === ID.BLOCK) blk = k.data;
        else if (k.id === ID.REFERENCEBLOCK) key = false;
      }
    }
    const tn = vint(b, blk);
    if (!tn || tn === 'bad' || blk + tn.len + 3 > e.end) return;
    const rel = new DataView(b.buffer, b.byteOffset + blk + tn.len, 2).getInt16(0);
    if (e.id === ID.SIMPLEBLOCK) key = (b[blk + tn.len + 2] & 0x80) !== 0;
    const raw = b.slice(e.start, e.end);
    c.blocks.push(raw); c.bytes += raw.length;
    c.last = Math.max(c.last, c.tc + rel);
    if (tn.val === this.video && !c.sawVideo) { c.sawVideo = true; c.key = key; }
  }

  private readInfo(e: El): void {
    this.info = this.pend.slice(e.start, e.end);
    for (const c of children(this.pend, e)) if (c.id === ID.TIMECODESCALE) this.scale = uint(this.pend, c.data, c.end) || 1_000_000;
  }

  private readTracks(e: El): void {
    this.tracks = this.pend.slice(e.start, e.end);
    for (const t of children(this.pend, e)) {
      if (t.id !== ID.TRACKENTRY) continue;
      let num = -1, type = 0;
      for (const c of children(this.pend, t)) {
        if (c.id === ID.TRACKNUMBER) num = uint(this.pend, c.data, c.end);
        else if (c.id === ID.TRACKTYPE) type = uint(this.pend, c.data, c.end);
      }
      if (type === 1 && this.video < 0) this.video = num;
    }
  }

  private finish(): void {
    if (!this.cur) return;
    this.clusters.push(this.cur);
    this.cur = null; this.curEnd = Infinity;
    const end = this.clusters[this.clusters.length - 1].last;
    this.clusters.splice(0, dropCount(this.clusters.map(seg), end, this.keepMs / this.ms(1)));
  }

  /** Unidades de tempo do arquivo → ms. */
  private ms(units: number): number { return (units * this.scale) / 1e6; }
  private all(): Cluster[] { return this.cur ? [...this.clusters, this.cur] : this.clusters; }

  get segments(): number { return this.all().length; }
  get keySegments(): number { return this.all().filter(c => c.key).length; }
  get firstKey(): boolean { return this.all()[0]?.key ?? false; }
  get startMs(): number { return this.ms(this.all()[0]?.tc ?? 0); }
  get endMs(): number { return this.ms(this.all().reduce((m, c) => Math.max(m, c.last), 0)); }
  get bytesHeld(): number { return this.all().reduce((n, c) => n + c.bytes, 0); }
  /** Duração escrita no Info (só nos arquivos já montados pelo anel); null = sem. */
  get declaredMs(): number | null {
    if (!this.info) return null;
    const e = elAt(this.info, 0);
    if (!e || e === 'bad') return null;
    for (const c of children(this.info, e)) if (c.id === ID.DURATION) return this.ms(float(this.info, c.data, c.end));
    return null;
  }

  build(ms: number): ClipFile | null {
    if (this.broken || !this.ebml || !this.info || !this.tracks) return null;
    const all = this.all();
    const end = all.reduce((m, c) => Math.max(m, c.last), 0);
    const i = startIndex(all.map(seg), end, ms / this.ms(1));
    if (i < 0) return null;
    const base = all[i].tc;
    const body: Uint8Array[] = [...this.infoWithDuration(end - base), this.tracks];
    for (const c of all.slice(i)) body.push(...element(ID.CLUSTER, [...element(ID.TIMECODE, [uintData(c.tc - base)]), ...c.blocks]));
    return { parts: [this.ebml, ...element(ID.SEGMENT, body)], durMs: this.ms(end - base) };
  }

  /** Info com o Duration (float, em unidades do TimecodeScale) trocado ou acrescentado. */
  private infoWithDuration(units: number): Uint8Array[] {
    const info = this.info!, e = elAt(info, 0) as El;
    const kids: Uint8Array[] = [];
    for (const c of children(info, e)) if (c.id !== ID.DURATION) kids.push(info.slice(c.start, c.end));
    const d = new Uint8Array(8);
    new DataView(d.buffer).setFloat64(0, units);
    kids.push(...element(ID.DURATION, [d]));
    return element(ID.INFO, kids);
  }
}
