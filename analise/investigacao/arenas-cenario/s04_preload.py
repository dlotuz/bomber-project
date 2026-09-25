# cria estados 'pre_loadNN' (tela preta antes de carregar a arena N) em scratchpad/rom-arenas/
from ac import *
e = DEmu()
for n in range(1, 11):
    e.loadst('st_stage%02d' % (n - 1)); e.run(1); e.tap('A')
    e.run(255)
    open(SCR + '/rom-arenas/pre_load%02d.bin' % n, 'wb').write(e.save())
    print(n, 'saved', e.nframes)
