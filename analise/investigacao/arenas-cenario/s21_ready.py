# gera scratchpad/rom-arenas/readyNN.bin (= freshNN + 60 frames; jogadores ja aceitam comando). Rodar depois de s04 e s17.
from ac import *
for n in range(1, 11):
    e = DEmu(); e.load(open(SCR + '/rom-arenas/fresh%02d.bin' % n, 'rb').read()); e.run(60)
    open(SCR + '/rom-arenas/ready%02d.bin' % n, 'wb').write(e.save())
