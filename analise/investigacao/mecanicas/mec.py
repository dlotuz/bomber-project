"""Helpers da frente 'mecanicas': core snes9x próprio com watchpoints/breakpoints/trace."""
import os, sys, ctypes as C, struct
SCR = "/private/tmp/claude-501/-Users-dlotuz-Projetos-Claude-Bomber-Project/189281cc-52ae-4614-9c45-1f93ec4bdecb/scratchpad"
os.environ.setdefault("SNES9X_CORE", SCR + "/rom-mecanicas/snes9x/libretro/snes9x_libretro.dylib")
BASE = "/Users/dlotuz/Projetos Claude/Bomber Project/analise"
sys.path.insert(0, BASE + "/ferramentas")
from emu import Emu  # noqa
import dis65816  # noqa
ROM = dis65816.ROM
EST = BASE + "/estados/"
OUT = BASE + "/extraido/mecanicas/"
REC = struct.Struct("<11I")
TYPES = {1: "W8", 2: "W16", 3: "R8", 4: "R16", 8: "EXEC", 9: "TR"}

class Dbg(Emu):
    def __init__(self, st=None):
        super().__init__()
        L = self.lib
        L.dbg_records.restype = C.c_void_p
        L.dbg_count.restype = C.c_uint32
        L.dbg_reset()
        if st: self.loadf(st)
    def loadf(self, name):
        p = name if name.startswith("/") else EST + name + (".bin" if not name.endswith(".bin") else "")
        self.load(open(p, "rb").read())
    def reset_dbg(self): self.lib.dbg_reset()
    def ww(self, lo, hi=None): self.lib.dbg_watch_w(lo, hi if hi is not None else lo)
    def rw(self, lo, hi=None): self.lib.dbg_watch_r(lo, hi if hi is not None else lo)
    def bp(self, pc): self.lib.dbg_bp(pc)
    def trace(self, on): self.lib.dbg_set_trace(1 if on else 0)
    def clear(self): self.lib.dbg_clear()
    def run(self, n=1, **held):
        for _ in range(n):
            self.lib.dbg_set_frame(self.nframes)
            super().run(1, **held)
    def log(self):
        n = self.lib.dbg_count(); p = self.lib.dbg_records()
        raw = C.string_at(p, n * REC.size) if n else b""
        out = []
        for i in range(n):
            t, pc, addr, val, a, x, y, d, dbp, s, fr = REC.unpack_from(raw, i * REC.size)
            out.append(dict(t=TYPES.get(t, t), pc=pc, addr=addr, val=val, a=a, x=x, y=y, d=d, db=dbp >> 8, p=dbp & 0xff, s=s, f=fr))
        return out
    def obj(self, n):  # jogador n (0..4) bytes
        w = self.wram(); return w[0x300 + n * 0x100:0x400 + n * 0x100]

def fmt(r):
    return f"f{r['f']:6d} {r['t']:4s} pc={r['pc']:06X} addr={r['addr']:05X} val={r['val']:04X} A={r['a']:04X} X={r['x']:04X} Y={r['y']:04X} D={r['d']:04X} DB={r['db']:02X} P={r['p']:02X}"

def dis(addr, n=40, m=1, x=1):
    return dis65816.disasm(addr, n, m, x, stop_on_ret=False, out=True)

def rom24(addr): return dis65816.snes2file(addr)

def pos(e, n=0):
    return (e.r16(0x311 + n * 0x100) / 256, e.r16(0x315 + n * 0x100) / 256)

def walk_to(e, n, tx=None, ty=None, maxf=300, extra=None):
    """anda o jogador n até X=tx (se dado) e depois Y=ty. extra: dict de outros botões por porta."""
    for axis, t in (("x", tx), ("y", ty)):
        if t is None: continue
        for _ in range(maxf):
            x, y = pos(e, n); c = x if axis == "x" else y
            if abs(c - t) < 0.01: break
            d = ("RIGHT" if c < t else "LEFT") if axis == "x" else ("DOWN" if c < t else "UP")
            held = {f"p{n}": [d]}
            if extra: held.update(extra)
            e.run(1, **held)
        else:
            return False
    return True

def cell(x, y):
    return (int(x) + 1) // 16, (int(y) + 1) // 16 - 2

def grid(e, base=0x2800):
    w = e.wram()
    return [[w[base + r * 0x40 + c * 2] | (w[base + 1 + r * 0x40 + c * 2] << 8) for c in range(16)] for r in range(14)]

def gridstr(e, base=0x2800):
    g = grid(e, base)
    return "\n".join(f"{r:2d} " + " ".join(f"{v & 0xFF:02X}{v >> 8:02X}" for v in row) for r, row in enumerate(g))

def cx(col): return 16 * col - 1
def cy(row): return 16 * (row + 2) - 1

OCC = 0x11000  # $7F:1000 grade de ocupação de jogadores (bits $90/$92 do objeto)

def tele(e, n, col, row, dx=0, dy=0):
    """teleporta o jogador n e mantém a grade de ocupação $7F:1000 e o campo +$80 (casa atual) coerentes."""
    b = 0x300 + n * 0x100
    bits = e.r16(b + 0x90) | e.r16(b + 0x92)
    w = e.wram()
    for off in range(0, 14 * 0x40, 2):
        v = w[OCC + off] | w[OCC + off + 1] << 8
        if v & bits: e.w16(OCC + off, v & ~bits & 0xFFFF)
    e.w16(b + 0x12, cx(col) + dx); e.w16(b + 0x16, cy(row) + dy); e.w8(b + 0x11, 0); e.w8(b + 0x15, 0)
    cell = row * 0x40 + col * 2
    e.w16(b + 0x80, cell)
    v = e.r16(OCC + cell); e.w16(OCC + cell, v | e.r16(b + 0x90))

def bomb_at(e, n, col, row, back=None):
    """teleporta n para (col,row), solta bomba, volta para back=(col,row)."""
    tele(e, n, col, row); e.run(1)
    e.run(2, **{f"p{n}": ['A']}); e.run(1)
    if back: tele(e, n, *back); e.run(1)

class TDbg(Dbg):
    """Dbg que conta ticks lógicos do jogo (execuções do despachante de objetos com X=$0300)."""
    def __init__(self, st=None):
        super().__init__(st); self.ticks = 0; self.bp(0xC0F3DD)
    def step(self, **held):
        """roda 1 frame de vídeo; retorna nº de ticks lógicos nele (0 = frame de lag)."""
        n0 = self.lib.dbg_count()
        Dbg.run(self, 1, **held)
        L = self.log()[n0:]
        k = sum(1 for r in L if r['t'] == 'EXEC' and r['pc'] == 0xC0F3DD and r['x'] == 0x300)
        self.ticks += k
        if self.lib.dbg_count() > 1500000: self.clear()
        return k
    def tick(self, n=1, **held):
        """roda até completar n ticks lógicos."""
        t = self.ticks + n
        while self.ticks < t: self.step(**held)

RULES = 0x12017  # $7F:2017 CPU lvl, 2018 matches-1, 2019 tempo idx, 201A morte súbita, 201B bad bomber, 201C racer

def start_round(stage_state="st_stage00", sd=None, bad=None, racer=None, timeidx=None, cls=None, save_as=None):
    """parte da seleção de fase, ajusta regras e roda até o jogador poder andar (ou 900 frames)."""
    e = (cls or TDbg)(stage_state); e.run(1)
    if sd is not None: e.w8(RULES + 3, sd)
    if bad is not None: e.w8(RULES + 4, bad)
    if racer is not None: e.w8(RULES + 5, racer)
    if timeidx is not None: e.w8(RULES + 2, timeidx)
    e.run(2, p0=['A']); e.run(1)
    for i in range(900):
        e.run(1)
        if e.obj(0)[:3].hex() == '1c14c2' and e.r8(0x1EA0) not in (0, 0xFF): break
    e.run(64)  # fade-in (15) + pausa sem lógica (37) -> controle liberado
    if save_as: open(OUT + save_as, 'wb').write(e.save())
    return e

def rd(e, addr, n):
    import ctypes as C
    return C.string_at(e.wram_ptr + addr, n)

def fgrid(e, base=0x2800):
    b = rd(e, base, 14 * 0x40)
    return [[b[r * 0x40 + c * 2] | (b[r * 0x40 + c * 2 + 1] << 8) for c in range(16)] for r in range(14)]
