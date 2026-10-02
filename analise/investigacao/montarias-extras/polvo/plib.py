import sys, os
PROJ = '/Users/dlotuz/Projetos Claude/Bomber Project'
sys.path.insert(0, PROJ + '/analise/ferramentas')
from emu import Emu
EST = PROJ + '/analise/estados/'
P1, P2 = 0x300, 0x400
def cell(x, y): return 0x2800 + (y // 16 - 2) * 0x40 + (x // 16) * 2
def clear_soft(e):
    for r in range(14):
        for c in range(16):
            a = 0x2800 + r * 0x40 + c * 2
            if e.r16(a) == 0xCC80: e.w16(a, 0)
def pl(e, b=P1):
    w = e.wram()
    g = lambda o: w[b+o] | w[b+o+1] << 8
    return dict(rt=w[b+2] << 16 | w[b+1] << 8 | w[b], x=g(0x12), y=g(0x16), r5d=w[b+0x5d], t5c=w[b+0x5c],
                d=w[b+0x62], i60=w[b+0x60], c58=g(0x58), v64=g(0x64), v66=g(0x66), anim=g(0x08), c0=g(0xc0), c2=g(0xc2), i96=g(0x96))
_E = None
def new(state='st_arena01'):
    global _E
    if _E is None: _E = Emu()
    e = _E
    e.load(open(EST + state + '.bin', 'rb').read()); e.run(1)
    return e
def mount(e, t, clear=True, maxf=200):
    if clear: clear_soft(e)
    p = pl(e)
    e.w16(cell(p['x'], p['y']), 0x0940 + (0x30 | t))
    for f in range(maxf):
        e.run(1); p = pl(e)
        if p['r5d'] and p['rt'] == 0xC2141C: return f + 1
    return None
def objs(e, lo=0x0800, hi=0x1c00):
    w = e.wram(); out = []
    for a in range(lo, hi, 0x10):
        rt = w[a] | w[a+1] << 8 | w[a+2] << 16
        if 0xC0 <= (rt >> 16) <= 0xC5 and (rt & 0xFFFF) and w[a+3] & 0x80:
            out.append(dict(a=a, rt=rt, x=w[a+0x12] | w[a+0x13] << 8, y=w[a+0x16] | w[a+0x17] << 8))
    return out
def fmt(p): return f"rt={p['rt']:06X} x={p['x']} y={p['y']} d={p['d']} 60={p['i60']:02X} 58={p['c58']} v=({p['v64']:04X},{p['v66']:04X}) an={p['anim']:04X}"
def trace(e, script, n, b=P1, extra=None):
    log = []
    for f in range(n):
        e.run(1, p0=script.get(f, []))
        p = pl(e, b); s = fmt(p) + (' ' + extra(e) if extra else '')
        log.append((f, s))
    return log
def compress(log):
    out = []; last = None
    for f, s in log:
        if s != last: out.append(f'{f:3d} {s}'); last = s
    return '\n'.join(out)
def cellr(x, y): return 0x2800 + ((y - 24) // 16) * 0x40 + ((x + 8) // 16) * 2
