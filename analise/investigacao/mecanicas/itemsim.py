"""Modelo do sorteio de itens escondidos ($C4:121D) e do RNG ($C3:54B3)."""
from mec import ROM, rom24
import struct
def rng(seed, n):
    s = ((seed | 1) * 0x383) & 0xFFFF
    return s, (s * (n & 0xFF)) >> 16
FALLBACK = []
fo = rom24(0xC41327)
while True:
    v = ROM[fo] | ROM[fo + 1] << 8
    if v == 0xFFFF: break
    FALLBACK.append(v); fo += 2
def rd24(fo): return ROM[fo] | ROM[fo + 1] << 8 | ROM[fo + 2] << 16
def stage_list(stage):  # 1..10, variante A
    tA = rom24(0xC36233); rec = rd24(tA + 3 * (stage - 1)); il = rd24(rom24(rec) + 24)
    out = []; fo = rom24(il)
    while True:
        c, v = struct.unpack_from('<HH', ROM, fo)
        if c == 0xFFFF: break
        out.append((c, v)); fo += 4
    return out
def build(soft_cells, entries, seed):
    """soft_cells: set de offsets de casa ($2800) com soft block. retorna (tabela [(cell,item)], seed)."""
    table = []
    used = set()
    for cell, item in entries:
        if cell == 0x44:
            placed = None
            for _ in range(15):
                seed, c = rng(seed, 13)
                seed, r = rng(seed, 11)
                off = r * 64 + c * 2 + 0x44
                if off in soft_cells and off not in used:
                    placed = off; break
            if placed is None:
                for off in FALLBACK:
                    if off in soft_cells and off not in used: placed = off; break
            if placed is None: continue
        else:
            if cell not in soft_cells: continue
            placed = cell
        used.add(placed); table.append((placed, item))
    return table, seed

SPAWN_CELLS = [(2, 1), (14, 11), (14, 1), (2, 11), (8, 6)]   # (col, lin) no grid $2800 (col 2..14, lin 1..11)
CLEAR = [(0, 0), (0, -1), (1, -1), (1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1)]

def carve(soft, active=(True,) * 5):
    """remove soft blocks num quadrado 3x3 em volta de cada spawn de jogador ativo ($C4:1824)."""
    s = set(soft)
    for k, (c, r) in enumerate(SPAWN_CELLS):
        if not active[k]: continue
        for dc, dr in CLEAR:
            s.discard((r + dr) * 64 + (c + dc) * 2)
    return s

def remove_random(soft, n, seed):
    """$C4:179C: remove n soft blocks aleatórios (15 tentativas cada; senão lista fixa $C4:1327)."""
    s = set(soft)
    for _ in range(n):
        placed = None
        for _ in range(15):
            seed, c = rng(seed, 13)
            seed, r = rng(seed, 11)
            off = r * 64 + c * 2 + 0x44
            if off in s: placed = off; break
        if placed is None:
            for off in FALLBACK:
                if off in s: placed = off; break
        if placed is None: break
        s.discard(placed)
    return s, seed
