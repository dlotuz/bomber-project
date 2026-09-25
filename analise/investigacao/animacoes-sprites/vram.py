"""Render sprites/BG tiles from a live emulator's VRAM + CGRAM (for reference sheets)."""
from rec import *
from gfx import tile4, bgr
from PIL import Image
def snap(e):
    B = blocks(e.save()); ppu = B['PPU']; cg = ppu[64:576]
    cgram = [cg[2*i] << 8 | cg[2*i+1] for i in range(256)]   # big-endian in snapshot
    return B['VRA'], cgram, B['FIL']
def draw_tile8(vram, byteaddr, pal, img, x, y, hf=False, vf=False):
    px = tile4(vram, byteaddr & 0xFFFF)
    for i, c in enumerate(px):
        if c == 0: continue
        xx, yy = i & 7, i >> 3
        if hf: xx = 7 - xx
        if vf: yy = 7 - yy
        if 0 <= x+xx < img.width and 0 <= y+yy < img.height: img.putpixel((x+xx, y+yy), bgr(pal[c]) + (255,))
def draw_obj(vram, cgram, tile, attr, size, img, x, y, obase=0xC000, gap=0x2000):
    """tile: 9-bit name; attr: OAM byte 3; size in px (8/16/32)."""
    pal = cgram[128 + 16*((attr >> 1) & 7):][:16]; hf = attr & 0x40; vf = attr & 0x80
    n = size // 8
    for ty in range(n):
        for tx in range(n):
            t = tile; col = ((t & 0xF) + tx) & 0xF; row = ((t >> 4) + ty) & 0xF
            tt = (t & 0x100) | (row << 4) | col
            addr = obase + (tt & 0xFF) * 32 + (gap if tt & 0x100 else 0)
            dx = (n-1-tx) if hf else tx; dy = (n-1-ty) if vf else ty
            draw_tile8(vram, addr, pal, img, x + dx*8, y + dy*8, bool(hf), bool(vf))
def draw_bg16(vram, cgram, word, img, x, y, chrbase=0x0000, palbase=0):
    """16x16 BG tile from tilemap word (mode-1 4bpp)."""
    t = word & 0x3FF; pal = cgram[palbase + 16*((word >> 10) & 7):][:16]
    hf = bool(word & 0x4000); vf = bool(word & 0x8000)
    for ty in range(2):
        for tx in range(2):
            sub = t + tx + ty*16
            dx = (1-tx) if hf else tx; dy = (1-ty) if vf else ty
            draw_tile8(vram, chrbase + sub*32, pal, img, x + dx*8, y + dy*8, hf, vf)
