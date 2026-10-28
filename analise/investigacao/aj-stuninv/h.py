import os, sys
os.environ['SNES9X_CORE'] = "/Users/dlotuz/Projetos Claude/Bomber Project/analise/extraido/cores/rom-mecanicas/snes9x/libretro/snes9x_libretro.dylib"
os.environ.setdefault('SB4_ROM', "/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc")
sys.path.insert(0, "/Users/dlotuz/Projetos Claude/Bomber Project/analise/investigacao/mecanicas")
from mec import *  # noqa
OCC = 0x11000
def ob(n): return 0x300 + n * 0x100
def rt(e, n): w = e.wram(); b = ob(n); return w[b+2] << 16 | w[b+1] << 8 | w[b]
def occ_of(e, n):
    """casas da grade de ocupação com bits do jogador n (+$90 | +$92)"""
    b = ob(n); bits = e.r16(b+0x90) | e.r16(b+0x92); w = e.wram(); out = []
    for off in range(0, 14*0x40, 2):
        v = w[OCC+off] | w[OCC+off+1] << 8
        if v & bits: out.append((off // 0x40, (off % 0x40)//2, hex(v & bits)))
    return out
def mount_n(e, n, t, maxf=240):
    """põe ovo do tipo t na casa do jogador n e espera montar (+$5D != 0 e rotina $C2:141C)"""
    b = ob(n); c = 0x2800 + e.r16(b+0x80)
    e.w16(c, 0x0940 + (0x30 | t))
    for f in range(maxf):
        e.step()
        if e.r8(b+0x5d) and rt(e, n) == 0xC2141C: return f + 1
    return None
def tele_m(e, n, col, row):
    """tele() que respeita a montaria: montado, a ocupação usa +$92 ($C2:33FC), não +$90"""
    tele(e, n, col, row)
    b = ob(n)
    if e.r8(b+0x5d):
        c = OCC + row*0x40 + col*2
        e.w16(c, (e.r16(c) & ~e.r16(b+0x90) & 0xFFFF) | e.r16(b+0x92))
