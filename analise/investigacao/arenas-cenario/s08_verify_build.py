# confere build_arena (ROM + RNG) contra a WRAM real depois do carregamento de cada arena (semente de boot $0012)
from ac import *
from arena_rom import *
e = DEmu()
for n in range(1, 11):
    e.load(open(SCR + '/rom-arenas/pre_load%02d.bin' % n, 'rb').read()); e.run(300)
    w = e.wram()
    W = lambda a: [w[a + 2*i] | w[a + 2*i + 1] << 8 for i in range(32 * 13)]
    ent, logic, fent, sd = build_arena(n - 1)
    g2, gl, g38 = W(0x2000), W(0x2800), W(0x3800)
    cols = lambda i: (i % 32) < 17
    m2 = [i for i in range(32 * 13) if cols(i) and ent[i] != g2[i]]
    ml = [i for i in range(32 * 13) if cols(i) and logic[i] != gl[i]]
    mf = [i for i in range(32 * 13) if cols(i) and fent[i] != g38[i]]
    soft = sum(1 for v in gl if v == 0xCC80)
    print(n, 'soft', soft, 'mism bg2', len(m2), 'logic', len(ml), 'floor', len(mf), 'seedROM %04X seedWRAM %04X' % (sd, e.r16(0xAE)),
          ['%d,%d:%04X/%04X' % (i // 32, i % 32, ent[i], g2[i]) for i in m2[:6]], ['%d,%d:%04X/%04X' % (i // 32, i % 32, logic[i], gl[i]) for i in ml[:6]])
