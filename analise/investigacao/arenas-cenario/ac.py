"""Ferramentas da frente arenas-cenario: emulador com hooks de debug + parser de savestate snes9x."""
import os, sys, struct, ctypes as C
HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
SCR = '/private/tmp/claude-501/-Users-dlotuz-Projetos-Claude-Bomber-Project/189281cc-52ae-4614-9c45-1f93ec4bdecb/scratchpad'
os.environ.setdefault('SNES9X_CORE', SCR + '/rom-arenas/snes9x/libretro/snes9x_libretro.dylib')
sys.path.insert(0, os.path.join(PROJ, 'analise', 'ferramentas'))
from emu import Emu  # noqa
ROM = open(os.path.join(PROJ, 'Super Bomberman 4 (USA).sfc'), 'rb').read()
EST = os.path.join(PROJ, 'analise', 'estados')
OUT = os.path.join(PROJ, 'analise', 'extraido', 'arenas-cenario')

def f2s(off):  # file offset -> HiROM $C0+ address
    return 0xC00000 + off
def s2f(a):
    b, o = a >> 16, a & 0xFFFF
    if b >= 0xC0: return ((b - 0xC0) << 16) | o
    if 0x40 <= b < 0x7E: return ((b - 0x40) << 16) | o
    if o >= 0x8000: return ((b & 0x3F) << 16) | o
    return None

def blocks(st):
    """parse snes9x snapshot -> dict name->bytes"""
    assert st[:8] == b'#!s9xsnp', st[:16]
    i = st.index(b'\n') + 1
    d = {}
    while i + 11 <= len(st):
        name = st[i:i+3].decode('latin1')
        if st[i+3:i+4] != b':': break
        sz = st[i+4:i+10]
        if sz[:2] == b'--':
            n = int.from_bytes(st[i+6:i+10], 'big')
        else:
            n = int(sz)
        d[name] = st[i+11:i+11+n]
        i += 11 + n
    return d

class PPUState:
    def __init__(self, st):
        b = blocks(st)
        self.vram = b['VRA']; self.ram = b['RAM']; self.fil = b['FIL']
        p = b['PPU']
        o = 14
        self.bg = []
        for n in range(4):
            scb, ho, vo = struct.unpack('>HHH', p[o:o+6]); bgs = p[o+6]; nb, scs = struct.unpack('>HH', p[o+7:o+11])
            self.bg.append(dict(SCBase=scb, HOfs=ho, VOfs=vo, BGSize=bgs, NameBase=nb, SCSize=scs)); o += 11
        self.bgmode = p[o]; self.bg3prio = p[o+1]; o += 6
        self.cg = [struct.unpack('>H', p[o+2*i:o+2*i+2])[0] for i in range(256)]; o += 512
        o += 128 * 11
        o += 3 + 2 + 2 + 1  # OBJThroughMain..OBJSizeSelect  (1,1,1,2,2,1)
        # OAMAddr 2, SavedOAMAddr 2, PriorityRotation1, OAMFlip1, OAMReadFlip1, OAMTileAddress2, OAMWriteRegister2
        o += 2 + 2 + 1 + 1 + 1 + 2 + 2
        self.oam = p[o:o+544]
    def reg(self, a): return self.fil[a]
    def rgb(self, i):
        v = self.cg[i]; return ((v & 31) << 3, ((v >> 5) & 31) << 3, ((v >> 10) & 31) << 3)

class DEmu(Emu):
    def __init__(self, **kw):
        super().__init__(**kw)
        L = self.lib
        L.dbg_open.argtypes = [C.c_char_p]
        L.dbg_add.argtypes = [C.c_int, C.c_uint, C.c_uint]
        L.dbg_set_max.argtypes = [C.c_long]
        L.dbg_cgram.restype = C.c_void_p; L.dbg_oam.restype = C.c_void_p; L.dbg_fillram.restype = C.c_void_p
    def log(self, path): self.lib.dbg_open(path.encode())
    def close(self): self.lib.dbg_close()
    def flush(self): self.lib.dbg_flush()
    def watch(self, kind, lo, hi=None):
        k = dict(ww=1, wr=2, rom=3, ex=4, io=5)[kind] if isinstance(kind, str) else kind
        self.lib.dbg_add(k, lo, lo if hi is None else hi)
    def clear(self): self.lib.dbg_clear()
    def dma(self, v=1): self.lib.dbg_set_dma(v)
    def trace(self, v=1): self.lib.dbg_set_trace(v)
    def setmax(self, n): self.lib.dbg_set_max(n)
    def cgram(self): return C.string_at(self.lib.dbg_cgram(), 512)
    def fillram(self): return C.string_at(self.lib.dbg_fillram(), 0x8000)
    def vram(self):
        self.lib.retro_get_memory_data.restype = C.c_void_p
        return C.string_at(self.lib.retro_get_memory_data(3), 0x10000)
    def loadst(self, name):
        self.load(open(os.path.join(EST, name if name.endswith('.bin') else name + '.bin'), 'rb').read())

def snes_rgb(v):
    return ((v & 31) << 3 | (v & 31) >> 2, ((v >> 5) & 31) << 3 | ((v >> 5) & 31) >> 2, ((v >> 10) & 31) << 3 | ((v >> 10) & 31) >> 2)

def decode_tile(vram, addr_bytes, bpp):
    """returns 8x8 list of color indices; addr_bytes = byte address in VRAM"""
    px = [[0]*8 for _ in range(8)]
    for y in range(8):
        planes = []
        for p in range(0, bpp, 2):
            base = addr_bytes + p * 8 + y * 2
            planes.append(vram[base & 0xFFFF]); planes.append(vram[(base + 1) & 0xFFFF])
        for x in range(8):
            v = 0
            for k in range(bpp):
                v |= ((planes[k] >> (7 - x)) & 1) << k
            px[y][x] = v
    return px

def tilemap_entry(vram, scbase_w, scsize, tx, ty):
    """entrada do tilemap (unidades de tile do mapa, 32x32 por tela)"""
    base = scbase_w * 2
    scr = 0
    if tx >= 32:
        tx -= 32; scr += 1
    if ty >= 32:
        ty -= 32; scr += 2 if scsize == 3 else (1 if scsize == 2 else 0)
    if scsize == 0: scr = 0
    if scsize == 1: scr = scr & 1
    a = base + scr * 0x800 + (ty * 32 + tx) * 2
    return vram[a & 0xFFFF] | (vram[(a + 1) & 0xFFFF] << 8)

def render_bg(vram, cg, bg, bpp, big, cols=32, rows=32, only_prio=None, tcache=None):
    """render do mapa inteiro (cols x rows entradas). retorna PIL RGBA"""
    from PIL import Image
    ts = 16 if big else 8
    img = Image.new('RGBA', (cols * ts, rows * ts), (0, 0, 0, 0)); px = img.load()
    nb = bg['NameBase'] * 2; tb = 8 * bpp
    tc = {} if tcache is None else tcache
    for ty in range(rows):
        for tx in range(cols):
            e = tilemap_entry(vram, bg['SCBase'], bg['SCSize'], tx, ty)
            if only_prio is not None and ((e >> 13) & 1) != only_prio: continue
            t = e & 0x3FF; pal = (e >> 10) & 7; hf = (e >> 14) & 1; vf = (e >> 15) & 1
            pbase = pal * (1 << bpp)
            for sy in range(ts // 8):
                for sx in range(ts // 8):
                    ssx = (ts // 8 - 1 - sx) if hf else sx; ssy = (ts // 8 - 1 - sy) if vf else sy
                    tn = (t + ssx + ssy * 16) & 0x3FF
                    key = (nb, tn, bpp)
                    if key not in tc: tc[key] = decode_tile(vram, nb + tn * tb, bpp)
                    tile = tc[key]
                    for y in range(8):
                        for x in range(8):
                            v = tile[7 - y if vf else y][7 - x if hf else x]
                            if v: px[tx * ts + sx * 8 + x, ty * ts + sy * 8 + y] = snes_rgb(cg[pbase + v]) + (255,)
    return img

def dma_channels(st):
    d = blocks(st)['DMA']; out = []
    for ch in range(8):
        r = d[ch*19:(ch+1)*19]
        out.append(dict(rev=r[0], indirect=r[1], mode=r[5], B=0x2100 + r[6], A=(r[9] << 16) | (r[7] << 8) | r[8],
                        count=(r[10] << 8) | r[11], indbank=r[12], addr=(r[13] << 8) | r[14]))
    return out
