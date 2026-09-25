# trace de chamadas (JSR/JSL) + leituras de ROM durante o carregamento da arena N
from ac import *
import sys
n = int(sys.argv[1]); f0 = int(sys.argv[2]); f1 = int(sys.argv[3])
e = DEmu(); e.load(open(SCR + '/rom-arenas/pre_load%02d.bin' % n, 'rb').read())
e.run(f0)
e.log(SCR + '/rom-arenas/load2_%02d.log' % n); e.setmax(4000000); e.dma(1); e.trace(2)
e.watch('rom', 0, 0x3FFFFF); e.watch('ww', 0x2000, 0x3BFF)
e.run(f1 - f0)
e.close()
