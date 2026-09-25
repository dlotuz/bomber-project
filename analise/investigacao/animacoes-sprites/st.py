"""Helpers: parse snes9x savestate blocks (PPU->OAM/CGRAM, VRAM, RAM)."""
import sys, os
sys.path.insert(0, "/Users/dlotuz/Projetos Claude/Bomber Project/analise/ferramentas")
ROOT = "/Users/dlotuz/Projetos Claude/Bomber Project/analise"
EST = ROOT + "/estados/"
OUT = ROOT + "/extraido/animacoes-sprites/"
ROM = open("/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc", "rb").read()

def blocks(s):
    p = 14; B = {}
    while p < len(s) - 10:
        name = s[p:p+3].decode(); ln = int(s[p+4:p+10]); B[name] = s[p+11:p+11+ln]; p += 11 + ln
    return B

def rom(addr, n=1):
    """HiROM: $C0-$FF:xxxx and $40-$7D, $80-$BF:8000+"""
    b = (addr >> 16) & 0x3F; o = (b << 16) | (addr & 0xFFFF)
    return ROM[o:o+n]

def fileoff(addr):
    return ((addr >> 16) & 0x3F) << 16 | (addr & 0xFFFF)

CORE_DBG = "/private/tmp/claude-501/-Users-dlotuz-Projetos-Claude-Bomber-Project/189281cc-52ae-4614-9c45-1f93ec4bdecb/scratchpad/rom-animacoes/snes9x/libretro/snes9x_libretro.dylib"

def emu(dbg=False, state=None):
    import ctypes as C
    if dbg: os.environ["SNES9X_CORE"] = CORE_DBG
    from emu import Emu
    e = Emu()
    if dbg:
        L = e.lib
        L.dbg_ptr.restype = C.c_void_p
        L.dbg_open.argtypes = [C.c_char_p]; L.dbg_mark.argtypes = [C.c_char_p]
        L.dbg_set_ranges.argtypes = [C.c_uint32] * 6
        e.dbg_open = lambda p: L.dbg_open(p.encode() if p else None)
        e.writer = lambda: (C.c_uint32 * 0x20000).from_address(L.dbg_ptr(0))
        e.reader = lambda: (C.c_uint32 * 0x400000).from_address(L.dbg_ptr(1))
        e.execd = lambda: (C.c_uint8 * 0x400000).from_address(L.dbg_ptr(2))
    if state:
        e.load(open(EST + state + ".bin", "rb").read() if "/" not in state else open(state, "rb").read())
    return e

def oam(e):
    """shadow OAM at $7F:0000 -> list of (i,x,y,tile,attr,big)"""
    w = e.wram(); o = w[0x10000:0x10220]; out = []
    for i in range(128):
        x, y, t, a = o[4*i:4*i+4]
        hb = (o[0x200 + i // 4] >> (2 * (i % 4))) & 3
        if hb & 1: x -= 256
        out.append((i, x, y, t | ((a & 1) << 8), a, (hb >> 1) & 1))
    return out

def cgram(e):
    w = e.wram(); return [w[0x8E00 + 2*i] | (w[0x8E01 + 2*i] << 8) for i in range(256)]
