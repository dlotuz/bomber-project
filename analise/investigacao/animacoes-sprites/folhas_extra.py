"""Coroa do placar (anim C3:DA94), cabeças do placar, efeito caveira e invencibilidade."""
import sys
from vram import *
from anims import *
from render import sheet, render_ms
from PIL import ImageDraw
SB = sys.argv[1]   # savestate do placar (gerado por um round de CPU; ver RELATORIO)

def objanim_strip(v, cg, anim, tilebase, palattr, cell=40):
    fr = parse_anim(anim)
    img = Image.new('RGBA', (len(fr)*cell, cell + 12), (48, 48, 64, 255)); d = ImageDraw.Draw(img)
    for i, f in enumerate(fr):
        for p in reversed(parse_ms(f['ms'])):
            size = 32 if p['b12'] else 16
            t = (tilebase + p['gfx']) & 0x1FF
            attr = (palattr & 0x0E) | (0x40 if p['hf'] else 0) | (0x80 if p['vf'] else 0) | (t >> 8)
            draw_obj(v, cg, t, attr, size, img, i*cell + cell//2 + p['dx'], cell//2 + 4 + p['dy'])
        d.text((i*cell + 2, cell + 1), str(f['dur']), fill=(255, 255, 0, 255))
    return img

e = emu(False, SB); e.run(1)
v, cg, F = snap(e)
rows = [('coroa placar\nC3DA94', objanim_strip(v, cg, 0xC3DA94, 0x100, 0x0A))]
heads = Image.new('RGBA', (5*36, 36), (48, 48, 64, 255))
for i, (t, a) in enumerate([(0x80, 0x30), (0x84, 0x32), (0x88, 0x34), (0xC4, 0x36), (0xC8, 0x38)]):
    draw_obj(v, cg, t, a, 32, heads, i*36, 2)
rows.append(('cabecas placar\nOBJ 32x32', heads))
sheet(rows, OUT + 'placar_coroa_cabecas.png', scale=3, labelw=100)

# efeitos: caveira (paleta preta a cada 4 quadros) e invencibilidade (2 visivel / 2 invisivel)
from gfx import block
base = char_base(0); _, _, pal = char_pal(0, 0); black = [0]*16
img = Image.new('RGBA', (32*34, 2*44 + 20), (48, 48, 64, 255)); d = ImageDraw.Draw(img)
for k in range(32):
    block(base + gfx_off(6), 4, 4, 0x200, black if (k // 4) % 2 else pal, img, k*34, 10)
    if (k // 2) % 2 == 0: block(base + gfx_off(6), 4, 4, 0x200, pal, img, k*34, 10 + 44 + 10)
    d.text((k*34 + 2, 0), str(k), fill=(255, 255, 0, 255))
d.text((2, 44), 'caveira: 4 normal / 4 preto (fase depende de $016C)', fill=(255, 255, 255, 255))
d.text((2, 44 + 44 + 10), 'invencivel: 2 visivel / 2 oculto (bit1 de +$96)', fill=(255, 255, 255, 255))
img.resize((img.width*2, img.height*2), Image.NEAREST).save(OUT + 'efeitos_caveira_invencivel.png')
