"""Teste de ponta a ponta do catálogo: usando SÓ catalogo.json + ROM (como o futuro carregador TypeScript),
reconstrói VRAM/CGRAM e compara com o que o emulador tinha em cada captura."""
import sys, json; sys.path.insert(0, '.')
from rom import ROM, fo, rd
from decomp import decode_zte, composite_floor, arena9_post, arena_bg_palettes, decode_m7rle
CEN = "/Users/dlotuz/Projetos Claude/Bomber Project/analise/extraido/graficos-formato/cenas"
cat = json.load(open('catalogo.json'))
def A(s): return int(s.replace('$', '').replace(':', '').split()[0], 16)
zcache = {}
def z(a):
    if a not in zcache: zcache[a] = decode_zte(a)[0]
    return zcache[a]
def cmp(name, mine, real, ranges):
    tot = eq = 0
    for lo, hi in ranges:
        for i in range(lo, hi):
            if mine[i] is None: continue
            tot += 1; eq += mine[i] == real[i]
    return f'{name}: {eq}/{tot}'
# arenas
for ar in cat['arenas']['lista']:
    k = ar['arena']
    buf = b''.join(z(A(b['rom'])) for b in ar['blocos_bg'])
    buf = composite_floor(buf)
    if 'arena9_post' in ar['pos_processamento']: buf = arena9_post(buf)
    real = open(f'{CEN}/arena{k:02d}.vram', 'rb').read()
    mine = [None] * 0x10000
    for i in range(0x8000): mine[i] = buf[i]
    for b in cat['partida_comum']['bg3']:
        d = rd(A(b['rom']), b['bytes']); o = 2 * A(b['vram_word'])
        for i in range(len(d)): mine[o + i] = d[i]
    for b in cat['partida_comum']['obj'][:5]:
        d = z(A(b['rom'])); o = 2 * A(b['vram_word'])
        if k == 3 and o == 0xF800: continue  # arena 3 mistura $C8:FA44 aqui
        for i in range(len(d)): mine[o + i] = d[i]
    # arena 9: bloco de VRAM com animação de BG ($C5:FE5C) e cabeças do HUD são sobrescritos em jogo -> excluir
    excl = set()
    for s in cat['partida_comum']['vram_observada_arena01']:
        pass
    res = cmp('BG tiles', mine, real, [(0, 0x8000)])
    res2 = cmp('BG3', mine, real, [(0xA000, 0xA800)]); res3 = cmp('OBJ comuns', mine, real, [(0xD000, 0xD800), (0xE000, 0x10000)])
    cg = open(f'{CEN}/arena{k:02d}.cgram', 'rb').read(); pal = arena_bg_palettes(A(ar['script_gfx']))
    peq = sum(pal[2*i:2*i+2] == cg[2*i:2*i+2] for i in range(128))
    print(f'arena {k:2d}: {res}  {res2}  {res3}  cores BG: {peq}/128')
# cenas
for tag, sc in cat['cenas'].items():
    real = open(f'{CEN}/{tag}.vram', 'rb').read()
    mine = [None] * 0x10000
    for s in sc['vram']:
        o = A(s['vram_byte']); n = s['bytes']
        if s['tipo'] == 'zte': d = z(A(s['origem']))[s['offset']:s['offset'] + n]
        elif s['tipo'] == 'raw': d = rd(A(s['origem']) + s['offset'], n)
        elif s['tipo'] == 'zero': d = bytes(n)
        elif s['tipo'] == 'fill': d = bytes([s['valor']]) * n
        else: continue
        for i in range(n): mine[(o + i) & 0xFFFF] = d[i]
    cg = open(f'{CEN}/{tag}.cgram', 'rb').read()
    ok = sum(1 for r in sc['cgram'] if r['rom'] and rd(A(r['rom']) + (0 if r['busca'] == 'exato' else 0), 32)[(0 if r['busca']=='exato' else 2):] == cg[32*r['paleta'] + (0 if r['busca']=='exato' else 2):32*r['paleta']+32])
    print(f'{tag:10s}: {cmp("VRAM (segmentos do catálogo)", mine, real, [(0, 0x10000)])}  paletas achadas na ROM: {ok}/16')
