"""Helpers do ajuste aj-socoluva (Y do soco com bomba na mão). Usa o core de debug de analise/extraido/cores/rom-mecanicas."""
import os, sys
os.environ['SNES9X_CORE'] = "/Users/dlotuz/Projetos Claude/Bomber Project/analise/extraido/cores/rom-mecanicas/snes9x/libretro/snes9x_libretro.dylib"
os.environ.setdefault('SB4_ROM', "/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc")
sys.path.insert(0, "/Users/dlotuz/Projetos Claude/Bomber Project/analise/investigacao/mecanicas")
from mec import *  # noqa
def ob(n): return 0x300 + n * 0x100
def rt(e, n): w = e.wram(); b = ob(n); return w[b+2] << 16 | w[b+1] << 8 | w[b]
def bombs(e):
    """objetos de bomba ativos: (endereço, rotina, x, y, +1A, +1C, +1D)"""
    w = e.wram(); out = []
    for a in range(0x800, 0x1400, 0x30):
        r = w[a+2] << 16 | w[a+1] << 8 | w[a]
        if w[a+2] == 0xC1 and w[a+0x1B] == 0x7E or r in (0xC13BE5, 0xC12798, 0xC135E1):
            out.append((hex(a), f'{r:06X}', e.r16(a+0x12), e.r16(a+0x16), w[a+0x1C], w[a+0x1D]))
    return out
