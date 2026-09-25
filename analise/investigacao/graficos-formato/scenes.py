"""Captura cenas do Battle Mode: para cada cena grava log (DMA + breakpoints nas rotinas gráficas) e,
nos pontos de captura, VRAM/CGRAM/OAM/WRAM + screenshot em analise/extraido/graficos-formato/cenas/.
Uso: python scenes.py [nome_da_cena ...]   (sem argumentos: todas)"""
import sys, os, json; sys.path.insert(0, '.')
from dbgemu import *
CEN = OUT + '/cenas'; os.makedirs(CEN, exist_ok=True)
BPS = [0xC409A5, 0xC1874D, 0xC409D6, 0xC1876E, 0xC41986, 0xC40A05, 0xC44BDD, 0xC4096B, 0xC4092E]

def capture(e, tag):
    open(f'{CEN}/{tag}.vram', 'wb').write(e.vram())
    open(f'{CEN}/{tag}.cgram', 'wb').write(e.cgram())
    open(f'{CEN}/{tag}.oam', 'wb').write(e.oam())
    open(f'{CEN}/{tag}.wram', 'wb').write(e.wram())
    frame_img(e).save(f'{CEN}/{tag}.png')
    open(f'{CEN}/{tag}.ppu', 'wb').write(ppuregs(e))

def ldfile(e, p): e.load(open(p, 'rb').read())

def run_scene(name, start, steps):
    e = DEmu()
    if start.startswith('/'): ldfile(e, start)
    else: e.loadst(start)
    e.bps(BPS)
    e.log_open(f'{CEN}/{name}.log', f'{CEN}/{name}.bin')
    for st in steps:
        kind = st[0]
        if kind == 'w': e.run(st[1])
        elif kind == 't': e.tap(st[1], player=st[2] if len(st) > 2 else 0, hold=8, after=st[3] if len(st) > 3 else 30)
        elif kind == 'c': e.mark('capture ' + st[1]); capture(e, st[1])
        elif kind == 'poke': e.w8(st[1], st[2])
        elif kind == 'm': e.mark(st[1])
        elif kind == 'charsel':
            def is_stagesel():
                a = np.asarray(frame_img(e))[90:110, 110:150].astype(int)
                return (a[..., 1] > a[..., 0] + 40).mean() > 0.5
            done = False
            for r in range(10):
                for p in range(5):
                    e.tap('A', player=p, hold=8, after=40)
                    if is_stagesel(): done = True; break
                if done: break
    e.log_close()

SCENES = {
  'title': ('st_b1', [('t', 'B'), ('w', 300), ('c', 'title')]),
  'menus': (OUT + '/my_titlemenu.bin', [('t', 'A'), ('w', 200), ('c', 'vsmode'), ('t', 'A'), ('w', 200), ('c', 'ffa'),
            ('t', 'A'), ('w', 200), ('c', 'players'), ('t', 'A'), ('w', 200), ('c', 'rules'), ('t', 'A'), ('w', 400), ('c', 'charsel')]),
  'stagesel': (OUT + '/my_charsel2.bin', [('charsel',), ('w', 200), ('c', 'stagesel')]),
  'victory': (OUT + '/endrun2_080.st', [('w', 150 * 5), ('m', 'i5'), ('t', 'A', 0, 146), ('c', 'scoreboard'), ('w', 150), ('c', 'vict1'),
              ('t', 'A', 0, 146), ('c', 'victory'), ('w', 150), ('c', 'after_victory'), ('t', 'A', 0, 146), ('w', 300), ('c', 'after_victory2')]),
  'draw': ('st_arena01', [('poke', 0x1ED2, 0), ('poke', 0x1ED0, 1), ('w', 400), ('c', 'draw1'), ('w', 300), ('c', 'draw2')]),
}
for k in range(10):
    SCENES[f'arena{k+1:02d}'] = (OUT + '/my_stagesel.bin', [('t', 'RIGHT', 0, 60)] * k + [('w', 60), ('t', 'A'), ('w', 1000), ('c', f'arena{k+1:02d}')])

if __name__ == '__main__':
    names = sys.argv[1:] or list(SCENES)
    for n in names:
        run_scene(n, *SCENES[n]); print('ok', n)
