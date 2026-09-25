"""Render animations (ROM-driven) to PNG contact sheets."""
from anims import *
from gfx import block, bgr
from PIL import Image, ImageDraw

def render_ms(ms, base, pal, img, cx, cy, extra_pal=None):
    """Draw metasprite 'ms' with its origin (object position) at (cx,cy). Pieces drawn last-first so that
    piece 0 is on top (same as OAM order: lower index = higher priority)."""
    for p in reversed(parse_ms(ms)):
        a = base + gfx_off(p['gfx'])
        pl = pal if not p['pal'] or extra_pal is None else extra_pal
        block(a, 4, 4, 0x200, pl, img, cx + p['dx'], cy + p['dy'], bool(p['hf']), bool(p['vf']))

def anim_strip(anim, base, pal, label=None, cell=40, oy=28):
    fr = parse_anim(anim)
    img = Image.new('RGBA', (max(1, len(fr)) * cell, cell + 10), (48, 48, 64, 255))
    d = ImageDraw.Draw(img)
    for i, f in enumerate(fr):
        render_ms(f['ms'], base, pal, img, i*cell + cell//2, oy)
        d.text((i*cell + 2, cell), str(f['dur']), fill=(255, 255, 0, 255))
    return img

def sheet(rows, path, scale=2, labelw=90):
    """rows: list of (label, image)"""
    W = labelw + max(im.width for _, im in rows); H = sum(im.height for _, im in rows)
    out = Image.new('RGBA', (W, H), (24, 24, 32, 255)); d = ImageDraw.Draw(out); y = 0
    for lab, im in rows:
        d.text((2, y + 4), lab, fill=(255, 255, 255, 255)); out.paste(im, (labelw, y), im); y += im.height
    out = out.resize((W*scale, H*scale), Image.NEAREST); out.save(path)
