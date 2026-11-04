"""Helpers do ajuste aj-fogo (cruzamento de chamas). Usa os helpers de ../aj-socoluva/h.py (core de debug de
analise/extraido/cores/rom-mecanicas). Ponteiros da explosão (página direta, medidos em st_arena01):
[$24] = $7E:2000 tilemap do campo (1 palavra por casa), [$28] = $7E:2800 grade lógica, [$2C] = $7E:3000 dona da casa
(endereço do objeto da explosão), [$30] = $7E:4000 / [$34] = $7E:3800 piso lógico / tile do piso para restaurar."""
import sys, os
BASE = "/Users/dlotuz/Projetos Claude/Bomber Project/analise/investigacao"
sys.path.insert(0, BASE + "/aj-socoluva")
from h import *  # noqa
TM, GR, OW = 0x2000, 0x2800, 0x3000
MASK = 0xC30E
def off(c, r): return r * 0x40 + c * 2

def setup(st="st_arena01"):
    """carrega a arena, limpa os blocos moles (grade e tilemap = piso) e tira os jogadores do caminho."""
    e = TDbg(st); e.run(1)
    for r in range(14):
        for c in range(16):
            o = off(c, r)
            if e.r16(GR + o) == 0xCC80:
                e.w16(GR + o, e.r16(0x4000 + o)); e.w16(TM + o, e.r16(0x3800 + o))
    e.run(1)
    return e

def inv(e):
    for n in range(5): e.w16(0x396 + n * 0x100, 200)

def bomb_objs(e):
    w = e.wram(); out = {}
    for a in range(0x800, 0x1400, 0x30):
        if w[a + 2] == 0xC1 and (w[a] | w[a + 1] << 8) not in (0, 0x5051) or (w[a] | w[a + 1] << 8) == 0x5051:
            out[a] = dict(rt=w[a + 2] << 16 | w[a + 1] << 8 | w[a], cell=e.r16(a + 0x2A), fuse=w[a + 0x1A], st=w[a + 0x1C],
                          typ=w[a + 0x22], fire=w[a + 0x23], ctr=w[a + 0x2C], rng=w[a + 0x2D])
    return out

def find_bomb(e, c, r):
    for a, b in bomb_objs(e).items():
        if b['cell'] == off(c, r) and b['rt'] != 0xC15051: return a
    return None

def place(e, n, c, r, rng=None, fuse=None, typ=None, park=(14, 11)):
    """o jogador n põe bomba em (c,r); ajusta o alcance (+$2D, copiado de $C1:1A77[+$23] ao pôr), o pavio (+$1A) e
    o tipo (+$22); volta para `park`."""
    tele(e, n, c, r); e.run(1); inv(e)
    e.run(2, **{f"p{n}": ['A']}); e.run(1); inv(e)
    a = find_bomb(e, c, r)
    assert a, f"bomba não apareceu em {c},{r}"
    if rng is not None: e.w8(a + 0x2D, rng)
    if fuse is not None: e.w8(a + 0x1A, fuse)
    if typ is not None: e.w8(a + 0x22, typ)
    tele(e, n, *park); e.run(1)
    return a

def line(e, cells):
    """estado de cada casa: '.' sem chama, senão tile&$C30E e dona (2 últimos dígitos)."""
    out = []
    for c, r in cells:
        o = off(c, r); g = e.r16(GR + o)
        if g & 0x1000: out.append(f"{e.r16(TM + o) & MASK:04X}/{e.r16(OW + o) & 0xFFFF:04X}")
        elif (g & 0xEFC0) == 0xC900: out.append("  BOMBA  ")
        else: out.append("    .    ")
    return " ".join(out)
