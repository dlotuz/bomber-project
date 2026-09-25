# screenshot de cada st_arenaNN + registradores PPU
from ac import *
import sys
e = DEmu()
for n in range(1, 11):
    nm = 'st_arena%02d' % n
    e.loadst(nm); e.run(1)
    e.shot(OUT + '/shots/%s.png' % nm)
    st = e.save(); p = PPUState(st)
    r = lambda a: p.reg(a)
    print(nm, 'arena_id($1E?)', 'mode=%02X' % r(0x2105), 'SC=%02X %02X %02X %02X' % tuple(r(0x2107+i) for i in range(4)),
          'NBA=%02X %02X' % (r(0x210B), r(0x210C)), 'TM=%02X TS=%02X' % (r(0x212C), r(0x212D)), 'OBSEL=%02X' % r(0x2101),
          'CGWSEL=%02X CGADSUB=%02X' % (r(0x2130), r(0x2131)), 'W=%02X%02X%02X' % (r(0x2123), r(0x2124), r(0x2125)),
          'scroll', [(b['HOfs'], b['VOfs']) for b in p.bg][:3])
