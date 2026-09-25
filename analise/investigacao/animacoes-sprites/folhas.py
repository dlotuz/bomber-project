"""Gera as folhas de conferência (PNG) em analise/extraido/animacoes-sprites/.
Tudo lido direto da ROM (personagens) ou da VRAM de savestates (tiles de BG/objetos fixos)."""
from render import *
from PIL import ImageDraw
CHARS = ['0 Bomberman', '1 ciborgue', '2 felino', '3 cavaleiro', '4 verde', '5 verm/roxo']
DIRS = ['cima', 'direita', 'baixo', 'esquerda']

def strip_frames(frames, base, pal, cell=40, oy=30, label_dur=True):
    """frames: list of (ms_addr, dur, dx, dy)."""
    img = Image.new('RGBA', (max(1, len(frames)) * cell, cell + 12), (48, 48, 64, 255)); d = ImageDraw.Draw(img)
    for i, (ms, dur, mx, my) in enumerate(frames):
        render_ms(ms, base, pal, img, i*cell + cell//2, oy)
        d.text((i*cell + 2, cell + 1), str(dur) + (f' ({mx},{my})' if (mx or my) else ''), fill=(255, 255, 0, 255))
    return img

def anim_frames(a):
    return [(f['ms'], f['dur'], s8(f['extra'] & 0xFF), s8(f['extra'] >> 8)) for f in parse_anim(a)]
def s8(v): return v - 256 if v & 0x80 else v

def dir_table(first, char, idxs=(0, 1, 4, 5)):
    t = p24(first + 3*char)
    return [p24(t + 3*i) for i in idxs]

ACTIONS = [  # (arquivo, titulo, first-level table, indices do 2o nivel)
    ('parado', 'parado (C2:76C5 -> [8,9,12,13])', 0xC276C5, (8, 9, 12, 13)),
    ('andando', 'andando (C2:76C5 -> [0,1,4,5])', 0xC276C5, (0, 1, 4, 5)),
    ('luva_levantar', 'luva: levantar bomba (C2:7515)', 0xC27515, (0, 1, 4, 5)),
    ('luva_carregar_andando', 'luva: andando c/ bomba (C2:7665 -> [0,1,4,5])', 0xC27665, (0, 1, 4, 5)),
    ('luva_carregar_parado', 'luva: parado c/ bomba (C2:7665 -> [8,9,12,13])', 0xC27665, (8, 9, 12, 13)),
    ('luva_arremessar', 'luva: arremesso (C2:755D)', 0xC2755D, (0, 1, 4, 5)),
    ('soco', 'soco (item Soco + Y) (C2:746D)', 0xC2746D, (0, 1, 4, 5)),
    ('item_P_Y', 'item P + Y (C2:749D)', 0xC2749D, (0, 1, 4, 5)),
]

def main():
    # 1) paletas 6 x 5
    cell = 36
    img = Image.new('RGBA', (5*3*cell + 90, 6*(cell+4) + 14), (40, 40, 52, 255)); d = ImageDraw.Draw(img)
    for s in range(5): d.text((90 + s*3*cell, 0), f'P{s+1} (slot {s})', fill=(255, 255, 255, 255))
    for c in range(6):
        base = char_base(c); d.text((2, 14 + c*(cell+4) + 12), CHARS[c], fill=(255, 255, 255, 255))
        for s in range(5):
            _, at, pal = char_pal(c, s)
            for k, g in enumerate((6, 46, 24)):
                block(base + gfx_off(g), 4, 4, 0x200, pal, img, 90 + s*3*cell + k*cell, 14 + c*(cell+4))
    img.resize((img.width*2, img.height*2), Image.NEAREST).save(OUT + 'paletas_6personagens_x_5cores.png')

    # 2) folhas por personagem (64 quadros) com a paleta do slot 0..4 do proprio personagem (slot = c % 5)
    for c in range(6):
        base = char_base(c)
        out = Image.new('RGBA', (5*(4*34+6), 16*42), (40, 40, 52, 255)); d = ImageDraw.Draw(out)
        for s in range(5):
            _, _, pal = char_pal(c, s)
            for g in range(64):
                x = s*(4*34+6) + (g % 4)*34; y = (g//4)*42
                block(base + gfx_off(g), 4, 4, 0x200, pal, out, x, y + 9); d.text((x, y), str(g), fill=(255, 255, 0, 255))
        out.resize((out.width*2, out.height*2), Image.NEAREST).save(OUT + f'folha_personagem{c}_5cores.png')

    # 3) acoes direcionais
    for fname, title, first, idxs in ACTIONS:
        rows = []
        for c in range(6):
            base = char_base(c); _, _, pal = char_pal(c, 0)
            for di, a in enumerate(dir_table(first, c, idxs)):
                rows.append((f'{CHARS[c][:12]} {DIRS[di]}\n{a:06X}', strip_frames(anim_frames(a), base, pal)))
        sheet(rows, OUT + f'anim_{fname}.png', labelw=110)
    # 4) acoes nao direcionais
    single = [('morte', 0xD81999), ('vitoria_rodada', 0xD82A74), ('vitoria_tela_perdedor_palmas', 0xD82A81),
              ('atordoado_bomba_na_cabeca', 0xD819B2), ('botao_B', 0xD82AA7), ('eletrocutado_C26D18_4', 0xD82A9A)]
    for fname, a in single:
        rows = []
        for c in range(6):
            base = char_base(c); _, _, pal = char_pal(c, 0)
            rows.append((f'{CHARS[c]}\n{a:06X}', strip_frames(anim_frames(a), base, pal)))
        sheet(rows, OUT + f'anim_{fname}.png', labelw=110)
    # 5) tedio (1 por personagem: C2:6FA1[4+c])
    rows = []
    for c in range(6):
        base = char_base(c); _, _, pal = char_pal(c, 0); a = p24(0xC26FA1 + 3*(4 + c))
        rows.append((f'{CHARS[c]}\n{a:06X}', strip_frames(anim_frames(a), base, pal, cell=36)))
    sheet(rows, OUT + 'anim_tedio_por_personagem.png', labelw=110)
    # 6) vencedor na tela VICTORY: base C2:8EBF[c], anim C3:E7F7
    rows = []
    for c in range(6):
        base = p24(0xC28EBF + 3*c); _, _, pal = char_pal(c, 0)
        fr = anim_frames(0xC3E7F7) + [(None, 0, 0, 0)]
        im = strip_frames(anim_frames(0xC3E7F7), base, pal)
        # os 4 quadros da linha (g0..g3) para referencia
        ref = Image.new('RGBA', (4*36, 44), (48, 48, 64, 255))
        for g in range(4): block(base + gfx_off(g), 4, 4, 0x200, pal, ref, g*36, 4)
        both = Image.new('RGBA', (im.width + ref.width + 8, max(im.height, ref.height)), (24, 24, 32, 255))
        both.paste(im, (0, 0), im); both.paste(ref, (im.width + 8, 0), ref)
        rows.append((f'{CHARS[c]}\nbase {base:06X}', both))
    sheet(rows, OUT + 'anim_vitoria_tela_vencedor.png', labelw=110)

if __name__ == '__main__':
    main()
