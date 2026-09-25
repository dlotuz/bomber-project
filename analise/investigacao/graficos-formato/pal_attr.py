"""Atribui cada linha de 16 cores da CGRAM capturada a um endereço da ROM (busca exata; se falhar, busca ignorando a cor 0)."""
import sys, glob, os; sys.path.insert(0, '.')
from rom import ROM, hx
OUT = "/Users/dlotuz/Projetos Claude/Bomber Project/analise/extraido/graficos-formato/cenas"
def snes(off): return 0xC00000 + off
def find_all(b, maxn=4):
    r = []; i = 0
    while len(r) < maxn:
        i = ROM.find(b, i)
        if i < 0: break
        r.append(i); i += 1
    return r
def attr(cg):
    res = []
    for row in range(16):
        b = cg[32*row:32*row+32]
        f = find_all(b)
        how = 'exato'
        if not f:
            f = [x - 2 for x in find_all(b[2:]) if x >= 2]; how = 'sem cor0'
        res.append((row, how if f else '-', [hx(snes(x)) for x in f]))
    return res
if __name__ == '__main__':
    tags = sys.argv[1:] or sorted(os.path.basename(p)[:-6] for p in glob.glob(OUT + '/*.cgram'))
    for t in tags:
        cg = open(f'{OUT}/{t}.cgram', 'rb').read()
        print('==', t)
        for row, how, f in attr(cg):
            print(f'  pal {row:2d} ({"BG" if row < 8 else "OBJ"}{row % 8}) {how:8s} {" ".join(f)}')
