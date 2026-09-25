"""Folhas de conferência dos objetos de cenário (tiles 16x16 de BG2 e sprites fixos), renderizados
da VRAM/CGRAM de cada savestate st_arenaNN (o gráfico vem da VRAM carregada pela fase)."""
from vram import *
from PIL import ImageDraw
from render import sheet

BOMB_SCRIPTS = [(0, 0xC15739), (1, 0xC15753), (2, 0xC15761), (3, 0xC156EB), (4, 0xC15705), (5, 0xC1571F)]
def parse_script(a):
    out = []; p = a
    while True:
        w = rom(p, 2); v = w[0] | w[1] << 8
        if v in (0xFFFF, 0xFFFE): break
        out.append((v, rom(p+2, 1)[0])); p += 3
    return out

def strip16(v, cg, words, labels=None, scale_cell=20):
    img = Image.new('RGBA', (len(words)*scale_cell, scale_cell + 10), (48, 48, 64, 255)); d = ImageDraw.Draw(img)
    for i, wd in enumerate(words):
        draw_bg16(v, cg, wd, img, i*scale_cell + 2, 2)
        if labels: d.text((i*scale_cell + 1, scale_cell - 1), str(labels[i]), fill=(255, 255, 0, 255))
    return img

def objstrip(v, cg, specs, cell=20):
    img = Image.new('RGBA', (len(specs)*cell, cell + 10), (48, 48, 64, 255))
    for i, (t, a) in enumerate(specs): draw_obj(v, cg, t, a, 16, img, i*cell + 2, 2)
    return img

def main():
    for n in range(1, 11):
        e = emu(False, f'st_arena{n:02d}'); e.run(2)
        v, cg, F = snap(e)
        rows = []
        for bt, a in BOMB_SCRIPTS:
            sc = parse_script(a)[:4]
            rows.append((f'bomba tipo {bt}\n{a:06X}', strip16(v, cg, [w for w, _ in sc], [d for _, d in sc])))
        # chamas: fases A(+0x00) B(+0x20) C(+0x40) sobre base 0x0F60
        parts = [('centro', 0x0F6C), ('braco H', 0x0F6A), ('ponta dir', 0x0F66), ('ponta esq', 0x4F66),
                 ('braco V', 0x0F68), ('ponta cima', 0x0F60), ('ponta baixo', 0x8F60)]
        for nm, wd in parts:
            rows.append((f'chama {nm}\nA,B,C', strip16(v, cg, [wd, wd + 0x20, wd + 0x40], ['A', 'B', 'C'])))
        rows.append(('soft block\nqueimando', strip16(v, cg, [0x0C20 + 2*i for i in range(6)], [4]*6)))
        rows.append(('item/obj\nqueimando', strip16(v, cg, [0x0F2E + 0x20*i for i in range(5)], [4]*5)))
        rows.append(('bloco pressao\n(BG pousado)', strip16(v, cg, [0x082E], ['BG'])))
        rows.append(('sprites: sombra,\nbloco caindo,bomba', objstrip(v, cg, [(0x4E, 0x2E), (0x4C, 0x2E), (0x180, 0x2E)])))
        items = [0x1280, 0x1282, 0x12A2, 0x12A6, 0x12EC, 0x12A4, 0x12A8, 0x128A]
        rows.append(('itens\n(borda azul)', strip16(v, cg, items)))
        cg2 = list(cg); cg2[79] = 0x00BF
        rows.append(('itens\n(borda verm.)', strip16(v, cg2, items)))
        # pagina inteira de itens (tiles 0x280-0x2FE)
        rows.append(('tiles 0x280..\n0x29E', strip16(v, cg, [0x1280 + 2*i for i in range(16)])))
        rows.append(('tiles 0x2A0..\n0x2BE', strip16(v, cg, [0x12A0 + 2*i for i in range(16)])))
        rows.append(('tiles 0x2E0..\n0x2FE', strip16(v, cg, [0x12E0 + 2*i for i in range(16)])))
        sheet(rows, OUT + f'bg_objetos_arena{n:02d}.png', scale=3, labelw=100)
        del e

if __name__ == '__main__':
    main()
