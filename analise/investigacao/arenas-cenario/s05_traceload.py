# rastreia o carregamento da arena N: DMAs + escritas em $2000-$2BFF,$3800-$3BFF,$8E00-$8FFF
from ac import *
import sys
n = int(sys.argv[1]); nf = int(sys.argv[2]) if len(sys.argv) > 2 else 120
e = DEmu(); e.load(open(SCR + '/rom-arenas/pre_load%02d.bin' % n, 'rb').read())
e.log(SCR + '/rom-arenas/load%02d.log' % n); e.dma(1)
e.watch('ww', 0x2000, 0x2BFF); e.watch('ww', 0x3800, 0x3BFF); e.watch('ww', 0x8E00, 0x8FFF)
for i in range(nf):
    e.run(1)
e.close(); e.shot(OUT + '/shots/afterload%02d.png' % n)
print('clock', e.r8(0x1ed2), e.r8(0x1ed0))
