"""Parsers for the animation / metasprite formats found in the ROM."""
from st import *

def p24(a):
    d = rom(a, 3); return d[0] | d[1] << 8 | d[2] << 16

def s16(v): return v - 0x10000 if v & 0x8000 else v

def parse_anim(a):
    """anim: u8 N, then N x {ptr24 metasprite, u8 duration, u16 extra}"""
    n = rom(a, 1)[0]; fr = []
    for i in range(n):
        d = rom(a + 1 + 6*i, 6)
        fr.append(dict(ms=d[0] | d[1] << 8 | d[2] << 16, dur=d[3], extra=d[4] | d[5] << 8))
    return fr

def parse_ms(a):
    """metasprite: u8 N, then N x {s16 dx, s16 dy, u16 attr}; attr: bit15 V, bit14 H, bits 9-11 pal add, bits 0-8 gfx idx"""
    n = rom(a, 1)[0]; ps = []
    for i in range(n):
        d = rom(a + 1 + 6*i, 6)
        at = d[4] | d[5] << 8
        ps.append(dict(dx=s16(d[0] | d[1] << 8), dy=s16(d[2] | d[3] << 8), attr=at, gfx=at & 0x1FF,
                       hf=(at >> 14) & 1, vf=(at >> 15) & 1, pal=(at >> 9) & 7, b12=(at >> 12) & 1))
    return ps

GFXTAB = 0xC17D5F  # 4 bytes per index: 24-bit offset added to object base (+$A0/+$A2)
def gfx_off(idx):
    d = rom(GFXTAB + 4*idx, 4); return d[0] | d[1] << 8 | d[2] << 16 | d[3] << 24

CHARTAB = 0xC20730  # 3 bytes per character: base of 32 KB sprite sheet
def char_base(c): return p24(CHARTAB + 3*c)
PALTAB = 0xC2779D   # 32 bytes per character, 4 per player slot: ptr24 palette + attr byte (+$0E)
def char_pal(c, slot, table=PALTAB):
    d = rom(table + 32*c + 4*slot, 4); a = d[0] | d[1] << 8 | d[2] << 16
    import struct
    return a, d[3], list(struct.unpack('<16H', rom(a, 32)))

def fmt_anim(a):
    out = []
    for f in parse_anim(a):
        ps = parse_ms(f['ms'])
        pp = ';'.join(f"g{p['gfx']}({p['dx']},{p['dy']}){'H' if p['hf'] else ''}{'V' if p['vf'] else ''}{'p%d' % p['pal'] if p['pal'] else ''}" for p in ps)
        out.append(f"{f['ms']:06X}:{f['dur']}{'' if not f['extra'] else '/x%04X' % f['extra']}[{pp}]")
    return ' '.join(out)
