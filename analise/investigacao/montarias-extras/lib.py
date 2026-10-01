"""Frente montarias-extras: caminhos desta máquina + Emu com core de debug (patch de arenas-cenario)."""
import os, sys, ctypes as C
HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
SCR = '/private/tmp/claude-501/-Users-diegodias-bomber-project/cd72a288-1331-4828-9689-6a3b9f37277c/scratchpad'
os.environ.setdefault('SB4_ROM', '/Users/diegodias/Downloads/Super Bomberman 4 (USA).sfc')
os.environ.setdefault('SNES9X_CORE', SCR + '/snes9x-dbg/libretro/snes9x_libretro.dylib')
sys.path.insert(0, os.path.join(PROJ, 'analise', 'ferramentas'))
from emu import Emu  # noqa
ROM = open(os.environ['SB4_ROM'], 'rb').read()
EST = os.path.join(PROJ, 'analise', 'estados') + '/'
OUT = os.path.join(PROJ, 'analise', 'extraido', 'montarias-extras') + '/'
P1 = 0x300

def rom(a, n=1):
    o = a & 0x3FFFFF
    return ROM[o:o + n]

def new(state=None):
    e = Emu()
    if state:
        e.load(open(EST + state + '.bin', 'rb').read()); e.run(1)
    return e

def save(e, name): open(EST + name + '.bin', 'wb').write(e.save())

def dbg(e, path):
    L = e.lib; L.dbg_open(path.encode()); return L

# ---- montaria (mesmo harness de montarias-e-telas/mount_lib.py) ----
def cell(x, y): return 0x2800 + (y // 16 - 2) * 0x40 + (x // 16) * 2
def clear_soft(e):
    for r in range(14):
        for c in range(16):
            a = 0x2800 + r * 0x40 + c * 2
            if e.r16(a) == 0xCC80: e.w16(a, 0)
def pl(e, b=P1):
    w = e.wram()
    return dict(rt=w[b+2] << 16 | w[b+1] << 8 | w[b], x=w[b+0x12] | w[b+0x13] << 8, y=w[b+0x16] | w[b+0x17] << 8,
                t5c=w[b+0x5c], r5d=w[b+0x5d], f51=w[b+0x51], f32=w[b+0x32], spd=w[b+0x40], e8=w[b+0xe8],
                i96=w[b+0x96] | w[b+0x97] << 8, d=w[b+0x62], c6=w[b+0xc6] | w[b+0xc7] << 8)
def mount(e, t, state='mx_arena01', clear=True, maxf=200):
    e.load(open(EST + state + '.bin', 'rb').read()); e.run(1)
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
