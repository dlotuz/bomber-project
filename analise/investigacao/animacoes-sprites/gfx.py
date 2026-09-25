"""Render 4bpp SNES tiles straight from ROM."""
from st import *
from PIL import Image

def bgr(v):
    return ((v & 31) << 3 | (v & 31) >> 2, ((v >> 5) & 31) << 3 | ((v >> 5) & 31) >> 2, ((v >> 10) & 31) << 3 | ((v >> 10) & 31) >> 2)

def tile4(data, off):
    """8x8 4bpp planar tile -> list of 64 color indices"""
    px = []
    for y in range(8):
        b0, b1 = data[off + 2*y], data[off + 2*y + 1]
        b2, b3 = data[off + 16 + 2*y], data[off + 16 + 2*y + 1]
        for x in range(8):
            s = 7 - x
            px.append(((b0 >> s) & 1) | (((b1 >> s) & 1) << 1) | (((b2 >> s) & 1) << 2) | (((b3 >> s) & 1) << 3))
    return px

def block(addr, w=4, h=4, stride=0x200, pal=None, img=None, ox=0, oy=0, hflip=False, vflip=False, transparent=True):
    """w x h tiles starting at 24-bit ROM address; rows 'stride' bytes apart (sheet 16 tiles wide)."""
    if img is None:
        img = Image.new('RGBA', (8*w, 8*h), (0, 0, 0, 0)); ox = oy = 0
    base = fileoff(addr)
    for ty in range(h):
        for tx in range(w):
            px = tile4(ROM, base + ty*stride + tx*32)
            for i, c in enumerate(px):
                if c == 0 and transparent: continue
                x, y = tx*8 + (i & 7), ty*8 + (i >> 3)
                if hflip: x = 8*w - 1 - x
                if vflip: y = 8*h - 1 - y
                col = bgr(pal[c]) if pal else (c*17, c*17, c*17)
                img.putpixel((ox + x, oy + y), col + (255,))
    return img
