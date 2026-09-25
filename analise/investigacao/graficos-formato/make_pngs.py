"""Gera PNGs de conferência em analise/extraido/graficos-formato/png/ a partir SÓ da ROM (tiles e paletas),
usando os mapas/OAM capturados apenas para escolher a paleta de cada tile e para montar a comparação.
Também renderiza BG1+BG2 de cada arena (tiles e paletas da ROM + mapa da VRAM capturada) e compara com o
screenshot do emulador."""
import sys, os, json; sys.path.insert(0, '.')
import numpy as np
from PIL import Image, ImageDraw
from render import sheet, pal_rgb, tile_4bpp, tile_2bpp
from rom import rd, r24, hx
from decomp import decode_zte, composite_floor, arena9_post, arena_bg_palettes, decode_m7rle
BASE = "/Users/dlotuz/Projetos Claude/Bomber Project/analise/extraido/graficos-formato"
CEN = BASE + '/cenas'; PNG = BASE + '/png'; os.makedirs(PNG, exist_ok=True)
NOMES = ["The Classic", "Fast 'n' Slow", "Orb-ital Bombardment", "Don't Push Me", "School of Hard Shocks",
         "Totally Floored", "Hide and Blow Seek", "Spinny Slots", "Seesaw Yeehaw", "Sartorial Shenanigans"]

def tile_pals_from_maps(vram, maps=((0x8000, 0x800), (0x8800, 0x800)), big=True, ntiles=1024):
    """paleta usada por cada tile de BG (primeira ocorrência nos mapas BG1/BG2)."""
    tp = [None] * ntiles
    for base, n in maps:
        for i in range(0, n, 2):
            e = vram[base + i] | (vram[base + i + 1] << 8)
            t, p = e & 0x3FF, (e >> 10) & 7
            for s in ((0, 1, 16, 17) if big else (0,)):
                if t + s < ntiles and tp[t + s] is None: tp[t + s] = p
    return tp

def arena_tiles(k):
    script = r24(0xC362DB + 0x88 * (k - 1))
    buf = composite_floor(b''.join(decode_zte(r24(script + 3 * i))[0] for i in range(8)))
    if k == 9: buf = arena9_post(buf)
    return script, buf, arena_bg_palettes(script)

def render_bg(tiles, pal, vram, mapbase, sx=0, sy=0):
    """renderiza um BG 4bpp 32x32 com tiles 16x16 (512x512) -> recorte 256x224 com scroll."""
    lut = np.array(pal_rgb(pal), np.uint8)
    img = np.zeros((512, 512, 3), np.uint8); mask = np.zeros((512, 512), bool)
    cache = {}
    for my in range(32):
        for mx in range(32):
            a = mapbase + 2 * (my * 32 + mx); e = vram[a] | (vram[a + 1] << 8)
            t, p, hf, vf = e & 0x3FF, (e >> 10) & 7, (e >> 14) & 1, (e >> 15) & 1
            for sy_ in range(2):
                for sx_ in range(2):
                    q = t + (sx_ ^ hf) + 16 * (sy_ ^ vf)
                    if q not in cache: cache[q] = tile_4bpp(tiles[32 * q:32 * q + 32])
                    idx = cache[q]
                    if hf: idx = idx[:, ::-1]
                    if vf: idx = idx[::-1, :]
                    y, x = my * 16 + sy_ * 8, mx * 16 + sx_ * 8
                    img[y:y + 8, x:x + 8] = lut[p * 16 + idx]; mask[y:y + 8, x:x + 8] = idx != 0
    return img, mask

def crop(img, mask, sx, sy):
    ys = (np.arange(224) + sy) % 512; xs = (np.arange(256) + sx) % 512
    return img[ys][:, xs], mask[ys][:, xs]

def arenas():
    res = []
    for k in range(1, 11):
        script, tiles, pal = arena_tiles(k)
        vram = open(f'{CEN}/arena{k:02d}.vram', 'rb').read()
        tp = tile_pals_from_maps(vram)
        uso = {int(a): b for a, b in json.load(open(BASE + '/uso_paleta_tiles_comuns.json')).items()}
        tp = [tp[t] if tp[t] is not None else uso.get(t) for t in range(1024)]
        pals = [pal_rgb(pal[32 * p:32 * p + 32]) if p is not None else None for p in tp]
        sheet(tiles, 4, 16, pal=pal_rgb(pal[0:32]), pals=pals).save(f'{PNG}/arena{k:02d}_bg_tiles.png')
        # BG1 + BG2 renderizados com dados da ROM, comparados com o screenshot
        shot = np.asarray(Image.open(f'{CEN}/arena{k:02d}.png').convert('RGB'))
        best = None
        F2 = render_bg(tiles, pal, vram, 0x8800); F1 = render_bg(tiles, pal, vram, 0x8000)
        for sy in (-24,):
            for sx in (8,):
                b2, m2 = crop(*F2, sx, sy); b1, m1 = crop(*F1, sx, sy)
                comp = np.where(m1[..., None], b1, b2)
                eq = (np.abs(comp.astype(int) - shot.astype(int)).max(-1) <= 8)
                if best is None or eq.mean() > best[0]: best = (eq.mean(), (sx, sy), comp)
        acc, sy, comp = best
        side = Image.new('RGB', (512 + 8, 224), (40, 40, 40))
        side.paste(Image.fromarray(comp), (0, 0)); side.paste(Image.fromarray(shot), (264, 0))
        side.save(f'{PNG}/arena{k:02d}_comparacao.png')
        res.append((k, hx(script), round(100 * acc, 1), sy))
        print(f'arena {k:2d} script {hx(script)}  pixels iguais ao screenshot (BG1+BG2 da ROM, scroll (X,Y)={sy}): {100*acc:.1f}%')
    return res

def obj_sheet(tag):
    vram = open(f'{CEN}/{tag}.vram', 'rb').read(); oam = open(f'{CEN}/{tag}.oam', 'rb').read()
    cg = open(f'{CEN}/{tag}.cgram', 'rb').read()
    tp = [None] * 512
    for i in range(128):
        x, y, t, at = oam[4 * i:4 * i + 4]; hi = (oam[512 + i // 4] >> (2 * (i % 4))) & 3
        tile = t | ((at & 1) << 8); p = (at >> 1) & 7; big = hi >> 1
        n = 4 if big else 2
        for dy in range(n):
            for dx in range(n):
                q = (tile & 0x10F & ~0xF | ((tile + dx) & 0xF)) + 16 * dy
                q = ((tile & 0x100) | ((((tile >> 4) + dy) & 0xF) << 4) | ((tile + dx) & 0xF))
                if tp[q] is None: tp[q] = p
    pals = [pal_rgb(cg[256 + 32 * p:256 + 32 * p + 32]) if p is not None else None for p in tp]
    sheet(vram[0xC000:0x10000], 4, 16, pal=pal_rgb(cg[256 + 32 * 7:256 + 32 * 8]), pals=pals, transparent0=True).save(f'{PNG}/{tag}_obj_vram.png')

def scene_bg(tag, script=None):
    vram = open(f'{CEN}/{tag}.vram', 'rb').read(); cg = open(f'{CEN}/{tag}.cgram', 'rb').read()
    tp = tile_pals_from_maps(vram)
    pals = [pal_rgb(cg[32 * p:32 * p + 32]) if p is not None else None for p in tp]
    sheet(vram[0:0x8000], 4, 16, pal=pal_rgb(cg[0:32]), pals=pals).save(f'{PNG}/{tag}_bg_vram.png')
    # BG3 2bpp (word $5000 = byte $A000), paleta BG 0..7 de 4 cores
    sheet(vram[0xA000:0xA800], 2, 16, pal=pal_rgb(cg[0:8])).save(f'{PNG}/{tag}_bg3_2bpp.png')

def characters():
    chars = [('0_bomberman_branco', 0xD20000, 0xD7E7DC), ('1_ciborgue', 0xCB0000, 0xD66D9B), ('2_felino', 0xCB8000, 0xD66CDB),
             ('3_cavaleiro_alado', 0xCC0000, 0xD65FF9), ('4_verde_blindado', 0xCC8000, 0xD65E39), ('5_vermelho_roxo', 0xCD0000, 0xD65EF9)]
    for name, a, p in chars:
        sheet(rd(a, 0x8000), 4, 16, pal=pal_rgb(rd(p, 32)), transparent0=True, scale=2).save(f'{PNG}/personagem_{name}.png')
    # personagem 3: banco $CA com linhas desalinhadas (ver relatório) - folha crua do banco inteiro
    sheet(rd(0xCA0000, 0x10000), 4, 16, pal=pal_rgb(rd(0xD65FF9, 32)), transparent0=True).save(f'{PNG}/personagem_3_banco_CA_cru.png')

def zte_blocks(blocks, pal, name, transparent0=False):
    data = b''.join(decode_zte(b)[0] for b in blocks)
    sheet(data, 4, 16, pal=pal_rgb(pal), transparent0=transparent0, scale=2).save(f'{PNG}/{name}.png')

if __name__ == '__main__':
    r = arenas()
    json.dump(r, open(f'{PNG}/_arenas_comparacao.json', 'w'))
    for t in ['arena01', 'arena03', 'arena08', 'title', 'charsel', 'stagesel', 'scoreboard', 'victory', 'draw2', 'vsmode']:
        obj_sheet(t)
    for t in ['title', 'vsmode', 'rules', 'charsel', 'stagesel', 'scoreboard', 'victory', 'arena01']:
        scene_bg(t)
    characters()
    # OBJ comuns da partida, com a paleta OBJ 7 (slot 15, $D7:E6DC)
    p15 = rd(0xD7E6DC, 32)
    for b in [0xC8FD36, 0xD187CE, 0xD18F93, 0xD1967F, 0xC5013B, 0xC8FA44, 0xC7FEA1, 0xC5FE5C]:
        zte_blocks([b], p15, f'obj_{b:06X}', transparent0=True)
    # DRAW GAME (Modo 7): CHR 8bpp em planos intercalados -> imagem do mapa 128x128 tiles não; mostramos o CHR
    data, _, _ = decode_m7rle(0xCD9800, 0xD660D9)
    chr_ = bytes(data[1::2]); cg = open(f'{CEN}/draw1.cgram', 'rb').read(); lut = np.array(pal_rgb(cg), np.uint8)
    n = 256; img = np.zeros((16 * 8, 16 * 8, 3), np.uint8)
    for t in range(n):
        blk = np.frombuffer(chr_[64 * t:64 * t + 64], np.uint8).reshape(8, 8)
        img[(t // 16) * 8:(t // 16) * 8 + 8, (t % 16) * 8:(t % 16) * 8 + 8] = lut[blk]
    Image.fromarray(img).resize((256, 256), Image.NEAREST).save(f'{PNG}/drawgame_modo7_chr.png')
    mp = np.frombuffer(bytes(data[0::2]), np.uint8).reshape(128, 128)
    full = np.zeros((1024, 1024, 3), np.uint8)
    for y in range(128):
        for x in range(128):
            t = mp[y, x]; full[y * 8:y * 8 + 8, x * 8:x * 8 + 8] = img[(t // 16) * 8:(t // 16) * 8 + 8, (t % 16) * 8:(t % 16) * 8 + 8]
    Image.fromarray(full[:256, :512]).save(f'{PNG}/drawgame_modo7_mapa.png')
    print('ok')
