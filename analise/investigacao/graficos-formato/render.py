"""Renderização de tiles SNES (2bpp/4bpp planar) e paletas BGR555 para PNG."""
import numpy as np
from PIL import Image

def pal_rgb(b):
    """bytes BGR555 (LE) -> lista de (r,g,b)"""
    out = []
    for i in range(0, len(b) - 1, 2):
        v = b[i] | (b[i + 1] << 8)
        r, g, bl = v & 31, (v >> 5) & 31, (v >> 10) & 31
        out.append(((r << 3) | (r >> 2), (g << 3) | (g >> 2), (bl << 3) | (bl >> 2)))
    return out

GRAY16 = [(i * 17, i * 17, i * 17) for i in range(16)]
GRAY4 = [(0, 0, 0), (85, 85, 85), (170, 170, 170), (255, 255, 255)]

def tile_4bpp(t):
    """32 bytes -> array 8x8 de índices 0..15 (planos 0/1 intercalados nos bytes 0-15, 2/3 nos 16-31)"""
    a = np.zeros((8, 8), np.uint8)
    for y in range(8):
        p0, p1, p2, p3 = t[2*y], t[2*y + 1], t[16 + 2*y], t[17 + 2*y]
        for x in range(8):
            s = 7 - x
            a[y, x] = ((p0 >> s) & 1) | (((p1 >> s) & 1) << 1) | (((p2 >> s) & 1) << 2) | (((p3 >> s) & 1) << 3)
    return a

def tile_2bpp(t):
    a = np.zeros((8, 8), np.uint8)
    for y in range(8):
        p0, p1 = t[2*y], t[2*y + 1]
        for x in range(8):
            s = 7 - x
            a[y, x] = ((p0 >> s) & 1) | (((p1 >> s) & 1) << 1)
    return a

def sheet(data, bpp=4, cols=16, pal=None, pals=None, transparent0=False, scale=1):
    """data: bytes de tiles; pal: lista de cores; pals: paleta por tile (lista paralela) opcional."""
    tb = 8 * bpp
    n = len(data) // tb
    rows = (n + cols - 1) // cols
    img = np.zeros((rows * 8, cols * 8, 3), np.uint8)
    img[:] = (255, 0, 255) if transparent0 else (0, 0, 0)
    dec = tile_4bpp if bpp == 4 else tile_2bpp
    for i in range(n):
        idx = dec(data[i * tb:(i + 1) * tb])
        p = (pals[i] if pals is not None and pals[i] is not None else pal) or (GRAY16 if bpp == 4 else GRAY4)
        lut = np.array(p + [(0, 0, 0)] * (16 - len(p)), np.uint8)
        blk = lut[idx]
        if transparent0:
            blk = np.where((idx == 0)[..., None], np.array([255, 0, 255], np.uint8), blk)
        y, x = (i // cols) * 8, (i % cols) * 8
        img[y:y + 8, x:x + 8] = blk
    im = Image.fromarray(img, 'RGB')
    if scale != 1: im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    return im
