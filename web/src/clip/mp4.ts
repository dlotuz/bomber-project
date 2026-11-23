// Leitor do MP4 fragmentado do MediaRecorder (caixas ISO BMFF) para o anel do CLIPE (ring.ts). O Chrome grava
// `ftyp` + `moov` (com `mvex`) e depois um par `moof` + `mdat` por fragmento (um por segundo, começando no
// quadro-chave). O clipe sai com o cabeçalho e os fragmentos a partir do quadro-chave escolhido, com o `tfdt` de cada
// trilha descontado do primeiro (os tempos começam em 0).
import { concat, dropCount, startIndex, type ClipFile, type ClipRing } from './ring';

interface Box { type: string; start: number; data: number; end: number }

/** Caixa em `p` (os dados podem ainda não ter chegado); null = faltam bytes; 'bad' = tamanho impossível. */
function boxAt(b: Uint8Array, p: number): Box | null | 'bad' {
  if (p + 8 > b.length) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let n = dv.getUint32(p), h = 8;
  const type = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]);
  if (n === 1) {
    if (p + 16 > b.length) return null;
    n = Number(dv.getBigUint64(p + 8)); h = 16;
  } else if (n === 0) return 'bad';   // "até o fim do arquivo": impossível num fluxo ao vivo
  if (n < h) return 'bad';
  return { type, start: p, data: p + h, end: p + n };
}
function* boxes(b: Uint8Array, s: number, e: number): Generator<Box> {
  for (let p = s; p < e;) {
    const x = boxAt(b, p);
    if (!x || x === 'bad' || x.end > e) return;
    yield x;
    p = x.end;
  }
}
const child = (b: Uint8Array, x: Box, type: string): Box | null => {
  for (const c of boxes(b, x.data, x.end)) if (c.type === type) return c;
  return null;
};
const view = (b: Uint8Array): DataView => new DataView(b.buffer, b.byteOffset, b.byteLength);
/** Bit `sample_is_non_sync_sample` das flags de amostra: desligado = quadro-chave. */
const NON_SYNC = 0x10000;

interface Track { scale: number; video: boolean; dur: number; flags: number }
interface Frag { bytes: Uint8Array; tfdt: Map<number, number>; key: boolean; start: number; end: number }
const seg = (f: Frag): { key: boolean; start: number } => ({ key: f.key, start: f.start });

export class Mp4Ring implements ClipRing {
  broken = false;
  private pend: Uint8Array = new Uint8Array(0);
  private header: Uint8Array[] = [];
  private tracks = new Map<number, Track>();
  private moof: Uint8Array | null = null;
  private readonly frags: Frag[] = [];

  /** `keepMs`: quanto guardar (o clipe mais longo pedido e uma folga). */
  constructor(private readonly keepMs: number) {}

  push(chunk: Uint8Array): void {
    if (this.broken || !chunk.length) return;
    this.pend = this.pend.length ? concat([this.pend, chunk]) : chunk.slice();
    let p = 0;
    for (;;) {
      const x = boxAt(this.pend, p);
      if (x === 'bad' || (x && !this.header.length && x.type !== 'ftyp')) { this.fail(); return; }
      if (!x || x.end > this.pend.length) break;
      const raw = this.pend.slice(x.start, x.end);
      if (x.type === 'ftyp') this.header.push(raw);
      else if (x.type === 'moov') { this.header.push(raw); this.readMoov(raw); }
      else if (x.type === 'moof') this.moof = raw;
      else if (x.type === 'mdat' && this.moof) { this.addFrag(this.moof, raw); this.moof = null; }
      p = x.end;   // free, skip, sidx…: descartados
    }
    this.pend = this.pend.slice(p);
  }

  private fail(): void { this.broken = true; this.pend = new Uint8Array(0); }

  private readMoov(m: Uint8Array): void {
    const dv = view(m), moov = boxAt(m, 0) as Box;
    for (const trak of boxes(m, moov.data, moov.end)) {
      if (trak.type !== 'trak') continue;
      const tkhd = child(m, trak, 'tkhd'), mdia = child(m, trak, 'mdia');
      const mdhd = mdia && child(m, mdia, 'mdhd'), hdlr = mdia && child(m, mdia, 'hdlr');
      if (!tkhd || !mdhd || !hdlr) continue;
      const id = dv.getUint32(tkhd.data + (m[tkhd.data] === 1 ? 20 : 12));
      const scale = dv.getUint32(mdhd.data + (m[mdhd.data] === 1 ? 20 : 12)) || 1000;
      const video = String.fromCharCode(...m.subarray(hdlr.data + 8, hdlr.data + 12)) === 'vide';
      this.tracks.set(id, { scale, video, dur: 0, flags: 0 });
    }
    const mvex = child(m, moov, 'mvex');
    if (mvex) for (const trex of boxes(m, mvex.data, mvex.end)) {
      if (trex.type !== 'trex') continue;
      const t = this.tracks.get(dv.getUint32(trex.data + 4));
      if (t) { t.dur = dv.getUint32(trex.data + 12); t.flags = dv.getUint32(trex.data + 20); }
    }
  }

  private addFrag(moofB: Uint8Array, mdat: Uint8Array): void {
    const dv = view(moofB), moof = boxAt(moofB, 0) as Box;
    const f: Frag = { bytes: concat([moofB, mdat]), tfdt: new Map(), key: false, start: 0, end: 0 };
    for (const traf of boxes(moofB, moof.data, moof.end)) {
      if (traf.type !== 'traf') continue;
      const tfhd = child(moofB, traf, 'tfhd');
      if (!tfhd) continue;
      const id = dv.getUint32(tfhd.data + 4), tf = dv.getUint32(tfhd.data) & 0xffffff;
      const t = this.tracks.get(id) ?? { scale: 1000, video: false, dur: 0, flags: 0 };
      let q = tfhd.data + 8;
      if (tf & 0x01) q += 8;   // base_data_offset
      if (tf & 0x02) q += 4;   // sample_description_index
      const defDur = tf & 0x08 ? dv.getUint32(q) : t.dur;
      if (tf & 0x08) q += 4;
      if (tf & 0x10) q += 4;   // default_sample_size
      const defFlags = tf & 0x20 ? dv.getUint32(q) : t.flags;
      const tfdt = child(moofB, traf, 'tfdt');
      const base = tfdt ? (moofB[tfdt.data] === 1 ? Number(dv.getBigUint64(tfdt.data + 4)) : dv.getUint32(tfdt.data + 4)) : 0;
      f.tfdt.set(id, base);
      let dur = 0, first = defFlags;
      for (const trun of boxes(moofB, traf.data, traf.end)) {
        if (trun.type !== 'trun') continue;
        const rf = dv.getUint32(trun.data) & 0xffffff, n = dv.getUint32(trun.data + 4);
        let r = trun.data + 8;
        if (rf & 0x001) r += 4;   // data_offset
        const firstFlags = rf & 0x004 ? dv.getUint32(r) : null;
        if (rf & 0x004) r += 4;
        for (let i = 0; i < n; i++) {
          dur += rf & 0x100 ? dv.getUint32(r) : defDur;
          if (i === 0) first = firstFlags ?? (rf & 0x400 ? dv.getUint32(r + (rf & 0x100 ? 4 : 0) + (rf & 0x200 ? 4 : 0)) : defFlags);
          r += (rf & 0x100 ? 4 : 0) + (rf & 0x200 ? 4 : 0) + (rf & 0x400 ? 4 : 0) + (rf & 0x800 ? 4 : 0);
        }
        break;   // o Chrome põe um trun por traf; os tempos do fragmento saem do primeiro
      }
      if (t.video) {
        f.start = (base * 1000) / t.scale;
        f.end = ((base + dur) * 1000) / t.scale;
        f.key = (first & NON_SYNC) === 0;
      }
    }
    this.frags.push(f);
    this.frags.splice(0, dropCount(this.frags.map(seg), f.end, this.keepMs));
  }

  get segments(): number { return this.frags.length; }
  get keySegments(): number { return this.frags.filter(f => f.key).length; }
  get firstKey(): boolean { return this.frags[0]?.key ?? false; }
  get startMs(): number { return this.frags[0]?.start ?? 0; }
  get endMs(): number { return this.frags.reduce((m, f) => Math.max(m, f.end), 0); }
  get bytesHeld(): number { return this.frags.reduce((n, f) => n + f.bytes.length, 0); }

  build(ms: number, title?: string): ClipFile | null {
    if (this.broken || this.header.length < 2) return null;
    const end = this.endMs;
    const i = startIndex(this.frags.map(seg), end, ms);
    if (i < 0) return null;
    const first = this.frags[i];
    const out = this.frags.slice(i).map(f => this.rebased(f, first.tfdt));
    const head = title ? this.header.map(h => (boxAt(h, 0) as Box).type === 'moov' ? withTitle(h, title) : h) : this.header;
    return { parts: [...head, ...out], durMs: end - first.start };
  }

  /** Cópia do fragmento com o `tfdt` de cada trilha menos o do primeiro fragmento do clipe. */
  private rebased(f: Frag, zero: ReadonlyMap<number, number>): Uint8Array {
    const b = f.bytes.slice(), dv = view(b), moof = boxAt(b, 0) as Box;
    for (const traf of boxes(b, moof.data, moof.end)) {
      if (traf.type !== 'traf') continue;
      const tfhd = child(b, traf, 'tfhd'), tfdt = child(b, traf, 'tfdt');
      if (!tfhd || !tfdt) continue;
      const id = dv.getUint32(tfhd.data + 4);
      const t = Math.max(0, (f.tfdt.get(id) ?? 0) - (zero.get(id) ?? 0));
      if (b[tfdt.data] === 1) dv.setBigUint64(tfdt.data + 4, BigInt(t));
      else dv.setUint32(tfdt.data + 4, t);
    }
    return b;
  }
}

const ascii = (s: string): number[] => [...s].map(c => c.charCodeAt(0) & 0xff);
function mkBox(type: number[], ...payload: Uint8Array[]): Uint8Array {
  const body = concat(payload), out = new Uint8Array(8 + body.length);
  view(out).setUint32(0, out.length);
  out.set(type, 4);
  out.set(body, 8);
  return out;
}
/** `moov` com o título (`udta/meta/ilst/©nam`, o "Título" que o Windows, o VLC e os players mostram). Sem mexer nos
 *  fragmentos: no MP4 fragmentado os `trun` apontam para o próprio `moof`, nada aponta para dentro do `moov`. */
export function withTitle(moov: Uint8Array, title: string): Uint8Array {
  const m = boxAt(moov, 0);
  if (!m || m === 'bad' || m.data !== 8 || child(moov, m, 'udta')) return moov;
  const zeros = (n: number) => new Uint8Array(n);
  const hdlr = mkBox(ascii('hdlr'), zeros(8), new Uint8Array(ascii('mdirappl')), zeros(9));
  const dataHead = new Uint8Array(8);
  view(dataHead).setUint32(0, 1);   // tipo 1 = texto UTF-8; locale 0
  const nam = mkBox([0xa9, ...ascii('nam')], mkBox(ascii('data'), dataHead, new TextEncoder().encode(title)));
  const udta = mkBox(ascii('udta'), mkBox(ascii('meta'), zeros(4), hdlr, mkBox(ascii('ilst'), nam)));
  return mkBox(ascii('moov'), moov.subarray(8, m.end), udta);
}
