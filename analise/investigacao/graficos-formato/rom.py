ROMPATH = "/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc"
ROM = open(ROMPATH, 'rb').read()
def fo(a):
    b, o = a >> 16, a & 0xFFFF
    if b >= 0xC0: return ((b - 0xC0) << 16) | o
    if 0x40 <= b < 0x7E: return ((b - 0x40) << 16) | o
    if o >= 0x8000: return ((b & 0x3F) << 16) | o
    raise ValueError(hex(a))
def rd(a, n): return ROM[fo(a):fo(a) + n]
def r8(a): return ROM[fo(a)]
def r16(a): return int.from_bytes(rd(a, 2), 'little')
def r24(a): return int.from_bytes(rd(a, 3), 'little')
def hx(a): return f"${a >> 16:02X}:{a & 0xFFFF:04X}"
