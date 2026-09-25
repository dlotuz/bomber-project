"""Ferramentas de medição de telas: OAM (sombra em $7F:0000), brilho ($01BD), timeline e mosaicos."""
import mt
from PIL import Image, ImageDraw
def oam(e):
    w = e.wram(); o = w[0x10000:0x10220]; out = []
    for i in range(128):
        x, y, t, a = o[i*4:i*4+4]
        hi = (o[512 + i//4] >> ((i % 4) * 2)) & 3
        x |= (hi & 1) << 8
        if x >= 256: x -= 512
        if y >= 224 and y < 240: continue
        if y >= 240: y -= 256
        out.append(dict(i=i, x=x, y=y, tile=t | ((a & 1) << 8), pal=(a >> 1) & 7, pri=(a >> 4) & 3, hf=(a >> 6) & 1, vf=a >> 7, big=hi >> 1))
    return out
def bright(e):
    v = e.r8(0x1BD); return (v & 0x0F) if not (v & 0x80) else -1
class Rec:
    """grava brilho e hash de tela por frame"""
    def __init__(self, e): self.e = e; self.log = []; self.f = 0
    def run(self, n=1, **held):
        for _ in range(n):
            self.e.run(1, **held); self.f += 1
            d = self.e.frame[0]
            self.log.append((self.f, bright(self.e), hash(d)))
    def transitions(self):
        out = []; pb = None
        for f, b, h in self.log:
            if b != pb: out.append((f, b)); pb = b
        return out
def sheet(paths, out, cols=4, scale=1, labels=None):
    ims = [Image.open(p) for p in paths]; w, h = ims[0].size
    rows = (len(ims) + cols - 1) // cols
    m = Image.new('RGB', (w * cols, (h + 10) * rows), (40, 40, 40)); d = ImageDraw.Draw(m)
    for i, im in enumerate(ims):
        x, y = (i % cols) * w, (i // cols) * (h + 10)
        m.paste(im, (x, y + 10))
        if labels: d.text((x + 2, y), labels[i], fill=(255, 255, 0))
    if scale != 1: m = m.resize((m.width * scale, m.height * scale), Image.NEAREST)
    m.save(out)

def sfx_poll(e, st):
    """st: dict com 'c2' anterior. Retorna novos ids de SFX da fila $7E:A28E e música ($DE)."""
    w = e.wram(); new = []
    c2 = w[0xC2]
    i = st.get('c2', c2)
    while i != c2:
        new.append(w[0xA28E + i]); i = (i + 1) & 0x3F
    if len(new) > 8: new = ['reset']
    st['c2'] = c2
    m = w[0xDE]
    mus = None
    if st.get('de') is not None and m != st['de']: mus = m
    st['de'] = m
    return new, mus

def probe(e, base, btn, player=0, hold=2, n=120, shot=None):
    """carrega base, aperta btn e registra: sfx, música, brilho, mudança de OAM/tela."""
    e.load(base); e.run(1)
    st = {}; sfx_poll(e, st)
    o0 = oam(e); h0 = hash(e.frame[0])
    ev = []; first_change = None; pb = bright(e)
    for f in range(n):
        e.run(1, **({f'p{player}': [btn]} if f < hold else {}))
        s, m = sfx_poll(e, st)
        if s: ev.append((f, 'sfx', s))
        if m is not None: ev.append((f, 'music', m))
        b = bright(e)
        if b != pb: ev.append((f, 'bright', b)); pb = b
        if first_change is None and hash(e.frame[0]) != h0: first_change = f
    o1 = oam(e)
    if shot: e.shot(shot)
    return dict(ev=ev, first_change=first_change, o0=o0, o1=o1)

def oam_moves(o0, o1):
    k0 = {(s['tile'], s['pal']): (s['x'], s['y']) for s in o0}
    k1 = {(s['tile'], s['pal']): (s['x'], s['y']) for s in o1}
    return [(k, k0.get(k), k1.get(k)) for k in set(k0) | set(k1) if k0.get(k) != k1.get(k)]

def compress_ev(ev):
    """junta rampas de brilho: (f0,f1,b0->b1)"""
    out = []; ramp = None
    for x in ev:
        if x[1] == 'bright':
            if ramp and x[0] <= ramp[1] + 4 and abs(x[2]-ramp[3])==1: ramp = (ramp[0], x[0], ramp[2], x[2])
            else:
                if ramp: out.append(('bright', ramp))
                ramp = (x[0], x[0], x[2], x[2])
        else:
            if ramp: out.append(('bright', ramp)); ramp = None
            out.append(x)
    if ramp: out.append(('bright', ramp))
    return out
