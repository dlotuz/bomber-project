"""Helpers da frente montarias-e-telas: Emu com core instrumentado (cobertura de PC + log de leitura/escrita)."""
import os, sys, ctypes as C
SP = "/private/tmp/claude-501/-Users-dlotuz-Projetos-Claude-Bomber-Project/189281cc-52ae-4614-9c45-1f93ec4bdecb/scratchpad"
os.environ.setdefault("SNES9X_CORE", SP + "/rom-montarias/snes9x/libretro/snes9x_libretro.dylib")
BASE = "/Users/dlotuz/Projetos Claude/Bomber Project/analise"
sys.path.insert(0, BASE + "/ferramentas")
from emu import Emu  # noqa
EST = BASE + "/estados/"
OUT = BASE + "/extraido/montarias-e-telas/"
ROM = open("/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc", "rb").read()

def rom_off(addr):  # HiROM
    return addr & 0x3FFFFF

def new(state=None):
    e = Emu()
    L = e.lib
    L.mt_log_ptr.restype = C.POINTER(C.c_uint32)
    L.mt_cov_ptr.restype = C.POINTER(C.c_uint8)
    L.mt_get_logn.restype = C.c_uint32
    if state:
        e.load(open(EST + state + ".bin", "rb").read() if not state.startswith("/") else open(state, "rb").read())
        e.run(1)
    return e

def watch(e, wlo=1, whi=0, rlo=1, rhi=0, cov=0):
    e.lib.mt_set(wlo, whi, rlo, rhi, cov)
    e.lib.mt_reset_log()

def log(e):
    n = e.lib.mt_get_logn()
    p = e.lib.mt_log_ptr()
    return [(p[i*3] & 0xFFFFFF, p[i*3] >> 24, p[i*3+1], p[i*3+2]) for i in range(n)]  # (pc, kind 0=w 1=r, addr, val)

def cov_reset(e): e.lib.mt_reset_cov()

def cov(e):
    p = e.lib.mt_cov_ptr()
    buf = C.string_at(p, 1 << 24)
    return buf

def cov_set(e):
    b = cov(e)
    import re
    return {m.start() for m in re.finditer(b'\x01', b)}

# ---- savestate blocks (snes9x) ----
def blocks(st):
    i = st.find(b"\n") + 1  # after '#!s9xsnp:xxxx\n'
    out = {}
    while i < len(st) - 11:
        name = st[i:i+3].decode('latin1'); ln = int(st[i+4:i+10]); i += 11
        out[name] = st[i:i+ln]; i += ln
    return out
