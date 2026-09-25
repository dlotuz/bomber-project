"""Renderizacao de conferencia das 10 arenas feita SO com dados da ROM (sem VRAM/CGRAM do emulador).
Uso: python render_rom.py  -> analise/extraido/arenas-cenario/render/arena_NN_rom.png (+ comparacoes)
"""
from ac import *
from arena_rom import *
from PIL import Image
import os

HUD_MAP, HUD_TBL = 0xD68EEC, 0xD68F72
# color math por arena (medido nas tabelas HDMA $7E9EB0.. da area de jogo): (TS, CGADSUB)
COLOR_MATH = {2: (0x02, 0x41), 6: (0x02, 0x41), 10: (0x02, 0x01)}

def tile_px(buf, t):
    return decode_tile(buf, t * 32, 4)

def draw_layer(buf, pal, entries, cols, rows, big, ox, oy, y0, y1, out, prio_out, layer_id):
    """desenha um BG em 'out' (dict (x,y)->(rgb, prio, layer)) nas linhas [y0,y1)."""
    ts = 16 if big else 8
    cache = {}
    for sy in range(y0, y1):
        my = sy + oy
        for sx in range(256):
            mx = sx + ox
            tx, ty = (mx // ts) % cols, (my // ts) % rows
            e = entries[ty * cols + tx]
            t = e & 0x3FF; p = (e >> 10) & 7; pr = (e >> 13) & 1; hf = (e >> 14) & 1; vf = (e >> 15) & 1
            px_, py_ = mx % ts, my % ts
            if hf: px_ = ts - 1 - px_
            if vf: py_ = ts - 1 - py_
            sub = t + (px_ // 8) + 16 * (py_ // 8) if big else t
            sub &= 0x3FF
            if sub not in cache: cache[sub] = tile_px(buf, sub)
            v = cache[sub][py_ % 8][px_ % 8]
            if v:
                out[(sx, sy)] = (snes_rgb(pal[p * 16 + v]), pr, layer_id)

def hud_entries():
    codes, _ = decode_map(HUD_MAP)
    ent = map_to_entries(codes, HUD_TBL)
    hud = [(v + 0x2200) & 0xFFFF for v in ent[:96]]           # C418A3: linhas 0-2, +$2200
    # conteudo dinamico escrito pelo jogo (relogio 3:00, rostos P1..P5, contador de coroas 0)
    def put(row, col, tile):
        hud[row * 32 + col] = (hud[row * 32 + col] & 0xFC00) | (0x200 + tile)
    for r in range(3):
        put(r, 4, 0x32 + 0x10 * r); put(r, 5, 0x3A + 0x10 * r); put(r, 6, 0x39 + 0x10 * r); put(r, 7, 0x39 + 0x10 * r)
        for k in range(5):
            put(r, 10 + 4 * k, 0x01 + 2 * k + 0x10 * r); put(r, 11 + 4 * k, 0x02 + 2 * k + 0x10 * r)
    for k in range(5): put(1, 12 + 4 * k, 0x4F)
    return hud + [0] * (1024 - 96)

import sys as _sys
_sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'graficos-formato'))

def arena9_post_local(buf):
    """pos-processamento de tiles da arena 9 (frente graficos-formato, decomp.arena9_post)"""
    try:
        from decomp import arena9_post
        return arena9_post(buf)
    except Exception as ex:
        print('aviso: arena9_post indisponivel', ex); return buf

def apply_static_objects(n, buf, bg2):
    """elementos que os objetos da arena desenham no BG2 no inicio da partida (todos com dados da ROM)"""
    if n == 7:   # setas: lista (offset, tile) em $C3:918E, escrita por $C3:0EFF/$C3:0F3F
        a = 0xC3918E
        while True:
            off = w16(a)
            if off == 0: break
            bg2[off // 2] = w16(a + 2); a += 4
    if n == 8:   # pads do caca-niquel: offsets fixos $01C8/$01D0/$01D8 no codigo $C3:1291; tile 1C6E
        for off in (0x1C8, 0x1D0, 0x1D8): bg2[off // 2] = 0x1C6E
    if n == 9:   # gangorras: lista (orientacao, offset) em $C3:9524; tiles iniciais medidos
        a = 0xC39524
        while w16(a) != 0xFFFF:
            o, off = w16(a), w16(a + 2); a += 4
            tiles = (0x08EC, 0x48E2, 0x48E0) if o == 0 else (0x08E0, 0x08E2, 0x08E4)
            for k in range(3): bg2[off // 2 + k] = tiles[k]

def render_arena(idx, seed=0xC689, bg1_hofs=8, tile_copies=()):
    n = idx + 1
    buf, pal = arena_gfx(idx)
    R = arena_record(idx)
    bg2, logic, floor, _ = build_arena(idx, seed=seed)
    apply_static_objects(n, buf, bg2)
    if n == 9:
        buf = arena9_post_local(buf)
    if tile_copies:                      # quadro de animacao de tile (script de rec+$12): copia metatile 16x16
        b = bytearray(buf)
        for dst, src in tile_copies:
            for k in (0, 1, 16, 17): b[(dst + k) * 32:(dst + k + 1) * 32] = b[(src + k) * 32:(src + k + 1) * 32]
        buf = bytes(b)
    c1, _ = decode_map(R['bg1_map']); bg1 = map_to_entries(c1, R['bg1_tbl'])
    hud = hud_entries()
    img = Image.new('RGB', (256, 224), snes_rgb(pal[0])); px = img.load()
    # campo (linhas 24-223): BG2 e BG1 em 16x16, HOFS=8, VOFS=-25 (linha 0 do mapa na tela y=24)
    L2, L1 = {}, {}
    draw_layer(buf, pal, bg2, 32, 32, True, 8, -24, 24, 224, L2, None, 2)
    draw_layer(buf, pal, bg1, 32, 32, True, bg1_hofs, -24, 24, 224, L1, None, 1)
    # HUD (linhas 0-23): BG1 8x8, HOFS=8, VOFS=-33 -> linha 0 do HUD = mapa linha 28 (copiada de $7E5700)
    H = {}
    hudmap = [0] * 1024
    for i in range(96): hudmap[28 * 32 + i] = hud[i]
    draw_layer(buf, pal, hudmap, 32, 32, False, 8, 224, 0, 24, H, None, 1)
    ts_, cga = COLOR_MATH.get(n, (0, 0))
    for y in range(224):
        for x in range(256):
            if y < 24:
                c = H.get((x, y)); 
                if c: px[x, y] = c[0]
                continue
            b2 = L2.get((x, y)); b1 = L1.get((x, y))
            # prioridade: BG1p1 > BG2p1 > BG1p0 > BG2p0
            cand = []
            if b1: cand.append(((b1[1] * 2 + 1), 'b1', b1))
            if b2: cand.append(((b2[1] * 2 + 0), 'b2', b2))
            if not cand: continue
            cand.sort(key=lambda t: -t[0]); top = cand[0]
            col = top[2][0]
            if top[1] == 'b1' and (cga & 0x01) and (ts_ & 0x02) and b2:
                s = b2[0]
                c5 = [v >> 3 for v in col]; s5 = [v >> 3 for v in s]
                if cga & 0x40: r5 = [(a + b) >> 1 for a, b in zip(c5, s5)]
                else: r5 = [min(31, a + b) for a, b in zip(c5, s5)]
                col = tuple((v << 3) | (v >> 2) for v in r5)
            px[x, y] = col
    return img

if __name__ == '__main__':
    import sys
    os.makedirs(OUT + '/render', exist_ok=True)
    arenas = [int(a) for a in sys.argv[1:]] or range(1, 11)
    for n in arenas:
        im = render_arena(n - 1)
        im.save(OUT + '/render/arena_%02d_rom.png' % n)
        print('ok', n)
