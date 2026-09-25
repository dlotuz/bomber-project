"""Modelo do movimento do jogador (SB4), reconstruído das rotinas $C2:2F3A/$C2:3F44/$C2:3287/$C2:3339/$C2:3566.
Unidades: posição em 1/256 px (X = px*256 + frac). Centro da casa (col,lin) em px: (16*col-1, 16*(lin+2)-1)."""
from mec import ROM, rom24
import struct
def _b(a, n): fo = rom24(a); return ROM[fo:fo + n]
SPEED = [[struct.unpack_from('<hh', _b(0xC32A50 + lv * 64, 64), d * 4) for d in range(9)] for lv in range(8)]
DPAD = list(_b(0xC32C50, 16))
CODE = list(_b(0xC32520, 256))
TBL = {0: _b(0xC32C60, 0x70), 1: _b(0xC32D40, 0x70), 2: _b(0xC32CD0, 0x70), 3: _b(0xC32C60, 0x70)}
A20 = struct.unpack('<32h', _b(0xC32A20, 64))   # A20[i] (i=sub 0..15) e A30 = A20[8+i]
DIAM = [struct.unpack_from('<hh', _b(0xC32620, 1024), i * 4) for i in range(256)]
PAR = list(_b(0xC24F25, 4))
NB = [-64, 2, 64, 64, -2, -2, -64, -64]  # N NE E SE S SW W NW (cumulativo)
BTN = dict(RIGHT=1, LEFT=2, DOWN=4, UP=8)

def cell_of(xp, yp):
    return (((yp - 0x18) & 0xF0) << 2) + (((xp + 8) & 0x1F0) >> 3)

def blocked(v):
    lo = v & 0xEFC0
    if lo == 0: return False, False
    if lo == 0xC900: return True, True          # bomba (sem passa-bomba)
    if lo == 0xCC80: return True, False         # soft block (sem passa-parede)
    return bool(v & 0x8000), False

def neigh(grid, cell):
    """grid: dict offset->word. retorna ($82,$86)."""
    b82 = b86 = 0; c = cell
    for i, d in enumerate(NB):
        c += d
        bl, bo = blocked(grid.get(c, 0))
        if bl: b82 |= 1 << i
        if bo: b86 |= 1 << i
    return b82, b86

def step(X, Y, dpad, level, grid):
    """um tick. X,Y em 1/256 px. dpad: bitmask U8 D4 L2 R1. retorna (X,Y,dir)."""
    xp, yp = X >> 8, Y >> 8
    din = DPAD[dpad & 15]
    if din == 8:
        return X & ~0xFF, Y & ~0xFF, 8   # sem velocidade: zera frações ($11/$15)
    cell0 = cell_of(xp, yp)
    b82, _ = neigh(grid, cell0)
    xs, ys = (xp - 8) & 15, (yp - 8) & 15
    code = CODE[ys * 16 + xs] & 15
    ci = (((yp + 8) & 0x10) | (((xp + 8) & 0x10) >> 1)) >> 3 & 3
    p84 = PAR[ci]
    t = TBL[p84 & 3]
    v = t[code * 8 + din]; d = v & 15
    if v & 0xF0:
        if (1 << (v >> 4)) & b82:
            d = 8
            if p84: d = t[0x68 + (din & 7)] & 15
    vx, vy = SPEED[level][d] if d < 9 else (0, 0)
    # posição tentativa
    tx, ty = X + vx, Y + vy
    txp, typ = tx >> 8, ty >> 8
    tcell = cell_of(txp, typ)
    if tcell != cell0 and (grid.get(tcell, 0) & 0xEFC0) == 0xC900:
        return X, Y, d          # entrar numa casa com bomba: velocidade zerada ($50 != 0)
    b82, b86 = neigh(grid, tcell)
    ys, xs = (typ - 8) & 15, (txp - 8) & 15
    px = py = 0
    if b82 & 0x01: py = A20[ys]
    if py == 0 and b82 & 0x10: py = A20[8 + ys]
    if b82 & 0x04: px = A20[8 + xs]
    if px == 0 and b82 & 0x40: px = A20[xs]
    if b86 & 0x01 and A20[ys]:
        if vy < 0: vy = 0
        py = 0
    if b86 & 0x04 and A20[8 + xs]:
        if vx >= 0: vx = 0
        px = 0
    if b86 & 0x10 and A20[8 + ys]:
        if vy >= 0: vy = 0
        py = 0
    if b86 & 0x40 and A20[xs]:
        if vx < 0: vx = 0
        px = 0
    q84 = PAR[(((typ + 8) & 0x10) | (((txp + 8) & 0x10) >> 1)) >> 3 & 3]
    if q84 == 0 and px == 0 and py == 0:
        px, py = DIAM[ys * 16 + xs]
    vx += (px & 0xFF) << 8 if px >= 0 else -((-px) << 8)
    vy += (py & 0xFF) << 8 if py >= 0 else -((-py) << 8)
    X += vx; Y += vy
    if vx == 0 and vy == 0: X &= ~0xFF; Y &= ~0xFF
    return X, Y, d
