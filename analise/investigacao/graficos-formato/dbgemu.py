"""Wrapper do emu.py compartilhado usando o core instrumentado desta frente (log de DMA/VRAM/CGRAM,
escritor de cada byte da WRAM, leitor de cada byte da ROM, bitmap de PCs executados)."""
import os, sys, ctypes as C
SCRATCH = "/private/tmp/claude-501/-Users-dlotuz-Projetos-Claude-Bomber-Project/189281cc-52ae-4614-9c45-1f93ec4bdecb/scratchpad"
os.environ["SNES9X_CORE"] = SCRATCH + "/rom-graficos/snes9x/libretro/snes9x_libretro.dylib"
BASE = "/Users/dlotuz/Projetos Claude/Bomber Project/analise"
sys.path.insert(0, BASE + "/ferramentas")
from emu import Emu  # noqa
import numpy as np
EST = BASE + "/estados"
OUT = BASE + "/extraido/graficos-formato"

class DEmu(Emu):
    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        L = self.lib
        L.dbg_ptr.restype = C.c_void_p
        L.dbg_open.argtypes = [C.c_char_p, C.c_char_p]
        L.dbg_mark.argtypes = [C.c_char_p]
    def _arr(self, which, n, dt):
        p = self.lib.dbg_ptr(which)
        return np.ctypeslib.as_array((dt * n).from_address(p))
    def wram_writer(self): return self._arr(0, 0x20000, C.c_uint32)
    def rom_reader(self): return self._arr(1, 0x400000, C.c_uint32)
    def exec_bits(self): return self._arr(2, 0x200000, C.c_uint8)
    def cgram(self): return bytes(self._arr(4, 256, C.c_uint16).astype('<u2').tobytes())
    def vram(self): return bytes(self._arr(5, 0x10000, C.c_uint8))
    def oam(self): return bytes(self._arr(6, 544, C.c_uint8))
    def log_open(self, path, binpath=None):
        return self.lib.dbg_open(path.encode(), binpath.encode() if binpath else None)
    def log_close(self): self.lib.dbg_close()
    def mark(self, s): self.lib.dbg_mark(s.encode())
    def loadst(self, name):
        self.load(open(f"{EST}/{name}.bin", "rb").read())

def frame_img(e):
    from PIL import Image
    data, w, h, pitch = e.frame
    a = np.frombuffer(data, dtype='<u2').reshape(h, pitch // 2)[:, :w].astype(np.uint32)
    if e.fmt == 2:
        r, g, b = (a >> 11) & 31, (a >> 5) & 63, a & 31; rgb = np.stack([r << 3, g << 2, b << 3], -1)
    else:
        r, g, b = (a >> 10) & 31, (a >> 5) & 31, a & 31; rgb = np.stack([r << 3, g << 3, b << 3], -1)
    return Image.fromarray(rgb.astype(np.uint8), 'RGB')

def mosaic(ims, path, cols=4, scale=1):
    from PIL import Image
    w, h = ims[0].size; rows = (len(ims) + cols - 1) // cols
    m = Image.new('RGB', (w * cols, h * rows))
    for i, im in enumerate(ims): m.paste(im, ((i % cols) * w, (i // cols) * h))
    if scale != 1: m = m.resize((int(m.width * scale), int(m.height * scale)))
    m.save(path)

def set_bps(e, pcs):
    m = e._arr(7, 0x200000, C.c_uint8); m[:] = 0
    for pc in pcs: m[pc >> 3] |= 1 << (pc & 7)
DEmu.bps = set_bps

def parse_log(path):
    out = []
    for ln in open(path):
        t = ln.split()
        if not t: continue
        d = {'type': t[0]}
        for kv in t[1:]:
            if '=' in kv:
                k, v = kv.split('=', 1); d[k] = v
        out.append(d)
    return out

def dp(d, off, n=2):
    s = d['dp']; i = (off - 0x40) * 2
    return int.from_bytes(bytes.fromhex(s[i:i + 2 * n]), 'little')

def ppuregs(e):
    """Últimos valores escritos em $2100-$21FF (Memory.FillRAM)."""
    return bytes(e._arr(8, 0x2200, C.c_uint8)[0x2100:0x2200])
