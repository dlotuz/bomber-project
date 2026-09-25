# screenshots de referencia: rodada 1 a partir do boot (semente $0012), 420 frames apos pre_loadNN; salva tambem o estado
from ac import *
e = DEmu()
for n in range(1, 11):
    e.load(open(SCR + '/rom-arenas/pre_load%02d.bin' % n, 'rb').read()); e.run(420)
    e.shot(OUT + '/render/arena_%02d_emu.png' % n)
    open(SCR + '/rom-arenas/fresh%02d.bin' % n, 'wb').write(e.save())
    print(n, 'relogio %d:%02d' % (e.r8(0x1ED2), e.r8(0x1ED0)), 'BG1HOFS %X' % e.r16(0x9EDC))
