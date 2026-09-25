"""Leitura das tabelas de arena direto da ROM (SB4)."""
from ac import ROM, s2f
ARENA_VARIANT_TABLE = 0xC40074   # 4 ponteiros (variante = ($24A ou $24C) & 3)
REC_SIZE = 0x22

def p24(a):
    o = s2f(a); return ROM[o] | ROM[o+1] << 8 | ROM[o+2] << 16
def w16(a):
    o = s2f(a); return ROM[o] | ROM[o+1] << 8

def arena_record(idx, variant=0):
    tbl = p24(ARENA_VARIANT_TABLE + 3 * variant)
    rec = p24(tbl + 3 * idx)
    o = s2f(rec); raw = ROM[o:o + REC_SIZE]
    g = lambda k: raw[k] | raw[k+1] << 8 | raw[k+2] << 16
    return dict(addr=rec, tiles=g(0), bg1_map=g(3), bg1_tbl=g(6), bg2_map=g(9), floor_map=g(0xC), bg2_tbl=g(0xF),
                obj12=g(0x12), b15=raw[0x15], b16=raw[0x16], b17=raw[0x17], anim18=g(0x18), obj1B=g(0x1B), b1E=raw[0x1E], p1F=g(0x1F), raw=raw)

def decode_map(src, n=32 * 32):
    """formato de C408D3/C40901: 1 byte ignorado; tokens de 16 bits: bits0-9 codigo, bits10-15 = repeticoes extras."""
    o = s2f(src) + 1; out = []
    while len(out) < n:
        w = ROM[o] | ROM[o+1] << 8; o += 2
        code = w & 0x3FF; rep = w >> 10
        out.extend([code] * (1 + rep))
    return out[:n], o - s2f(src)

def map_to_entries(codes, tbl):
    return [w16(tbl + 2 * c) for c in codes]

LOGIC_TBL = 0xC40892
def logic_of(code):
    return w16(LOGIC_TBL + 2 * code) if code < 16 else 0xEC40

class SB4Rng:
    """RNG C354B3: seed=$AE; seed=(seed|1)*$0383 mod 2^16; retorno=(seed*n)>>16 (0..n-1)."""
    def __init__(self, seed=0x0012): self.seed = seed & 0xFFFF
    def next(self, n):
        self.seed = ((self.seed | 1) * 0x0383) & 0xFFFF
        return (self.seed * (n & 0xFF)) >> 8 >> 8 if False else ((self.seed * ((n & 0xFF) << 8)) >> 16) >> 8

CLEAR_PATH = [0x0000, -0x40, 0x0002, 0x0040, 0x0040, -0x2, -0x2, -0x40, -0x40]   # C41865 (cumulativo): 3x3
FALLBACK_LIST = 0xC41327
DEFAULT_SPAWNS = [(1, 2), (11, 14), (1, 14), (11, 2), (6, 8)]   # (linha, coluna) P1..P5

def fallback_offsets():
    o = s2f(FALLBACK_LIST); out = []
    while True:
        v = ROM[o] | ROM[o+1] << 8; o += 2
        if v == 0xFFFF: return out
        out.append(v)

def build_arena(idx, variant=0, seed=0xC689, players=DEFAULT_SPAWNS):
    """reproduz C40080..C4179C: retorna (bg2 entries[1024], logic[1024], floor entries[1024], seed_final)"""
    R = arena_record(idx, variant)
    codes, _ = decode_map(R['bg2_map']); fcodes, _ = decode_map(R['floor_map'])
    tbl = R['bg2_tbl']
    ent = map_to_entries(codes, tbl); logic = [logic_of(c) for c in codes]
    fent = map_to_entries(fcodes, tbl)
    def clear(i):
        ent[i] = fent[i]; logic[i] = logic_of(fcodes[i])
    for (r, c) in players:
        off = r * 0x40 + c * 2
        for d in CLEAR_PATH:
            off += d; clear(off // 2)
    rng = SB4Rng(seed); left = R['b1E']
    fb = fallback_offsets()
    while left:                       # C4179C
        for _ in range(15):           # $4C = 16, DEC antes do teste -> 15 tentativas
            col = rng.next(13); row = rng.next(11)
            off = row * 0x40 + col * 2 + 0x44
            if logic[off // 2] == 0xCC80:
                clear(off // 2); left -= 1; break
        else:                         # C417FB: primeira casa soft da lista fixa
            for off in fb:
                if logic[off // 2] == 0xCC80:
                    clear(off // 2); left -= 1; break
            else:
                break                 # lista sem soft -> termina
    return ent, logic, fent, rng.seed

def rd(a, n):
    o = s2f(a); return ROM[o:o + n]

def decode_tile_block(src):
    """C409A5: [marcador_zero][marcador_fim] e depois: byte==marcador_zero -> tile 4bpp vazio (32 bytes 0);
    byte==marcador_fim -> fim; senao copia 32 bytes crus."""
    o = s2f(src); mz, mf = ROM[o], ROM[o + 1]; o += 2; out = bytearray()
    while True:
        b = ROM[o]
        if b == mz: out += bytes(32); o += 1
        elif b == mf: return bytes(out), o + 1 - s2f(src)
        else: out += ROM[o:o + 32]; o += 32

def composite_items(buf):
    """C44BDD: tiles $300-$3FF (buf $6000-$7FFF): pixels cor 0 recebem o pixel do tile de piso 16x16 n.8 (8,9,$18,$19)."""
    buf = bytearray(buf)
    for t in range(0x300, 0x400):
        k = t - 0x300
        src_tile = 8 + (k & 1) + (0x10 if (k >> 4) & 1 else 0)
        d = t * 32; s = src_tile * 32
        for row in range(8):
            p = [buf[d + row*2], buf[d + row*2 + 1], buf[d + 16 + row*2], buf[d + 16 + row*2 + 1]]
            m = 0
            for x in range(8):
                bit = 0x80 >> x
                if not any(pl & bit for pl in p): m |= bit
            for off in (row*2, row*2 + 1, 16 + row*2, 16 + row*2 + 1):
                buf[d + off] = (buf[d + off] & ~m & 0xFF) | (buf[s + off] & m)
    return bytes(buf)

def arena_gfx(idx, variant=0):
    """retorna (vram_bg_tiles 32KB p/ VRAM $0000, bg_palettes 128 cores) montados so da ROM"""
    R = arena_record(idx, variant); lst = R['tiles']
    buf = bytearray()
    for i in range(8):
        blk, _ = decode_tile_block(p24(lst + 3 * i))
        blk = blk[:0x1000] + bytes(max(0, 0x1000 - len(blk)))
        buf += blk
    buf = composite_items(buf)
    pal = []
    for i in range(8):
        pa = p24(lst + 3 * (8 + i)); raw = rd(pa, 32)
        pal += [raw[2*k] | raw[2*k + 1] << 8 for k in range(16)]
    for k in (13, 14, 15):          # C44E2F: cores 13-15 da paleta 7 -> paletas 2 e 3
        pal[32 + k] = pal[112 + k]; pal[48 + k] = pal[112 + k]
    return bytes(buf), pal

def decode_anim_script(addr, max_cmds=400):
    """script de animacao de tiles (rec+$12), interpretado por $C4:0ED1 (1 comando por frame):
    [W:2][op:1] op=$A0: espera W frames | op=$80: volta ao inicio | op=$90: fim |
    senao: [src:2][bank:1] -> DMA 16x16: 64 bytes src->VRAM W e 64 bytes src+$200 -> VRAM W+$100"""
    o = s2f(addr); out = []
    for _ in range(max_cmds):
        w = ROM[o] | ROM[o+1] << 8; op = ROM[o+2]
        if op == 0xA0: out.append(('wait', w)); o += 3
        elif op == 0x80: out.append(('loop',)); break
        elif op == 0x90: out.append(('end',)); break
        else:
            src = ROM[o+3] | ROM[o+4] << 8 | ROM[o+5] << 16
            out.append(('dma', w, src)); o += 6
    return out
