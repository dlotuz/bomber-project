# screenshot do emulador SEM sprites (TM sem OBJ via tabela HDMA $7E9EBA) e diferenca contra o render da ROM
from ac import *
from PIL import Image
res = []
for n in range(1, 11):
    e = DEmu(); e.load(open(SCR + '/rom-arenas/fresh%02d.bin' % n, 'rb').read())
    e.w8(0x9EBB, 0x07); e.w8(0x9EBD, 0x07); e.run(1)
    e.shot(OUT + '/render/arena_%02d_emu_semobj.png' % n)
    a = Image.open(OUT + '/render/arena_%02d_rom.png' % n).convert('RGB').load()
    b = Image.open(OUT + '/render/arena_%02d_emu_semobj.png' % n).convert('RGB').load()
    nd_h = nd_f = 0
    for y in range(224):
        for x in range(256):
            if tuple(v >> 3 for v in a[x, y]) != tuple(v >> 3 for v in b[x, y]):
                if y < 24: nd_h += 1
                else: nd_f += 1
    print('arena %2d: diferencas sem sprites  HUD %d px  campo %d px' % (n, nd_h, nd_f))
