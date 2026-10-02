from plib import *
import sys
def go(tag, script, n=70, pre=None):
    e = new(); mount(e, 4)
    if pre: pre(e)
    e.run(2, p0=['RIGHT'])
    print('==', tag, fmt(pl(e)))
    print(compress(trace(e, script, n)))
go('so Y', {0: ['Y']})
go('Y e UP segurado a partir de 40', {0: ['Y'], **{f: ['UP'] for f in range(40, 70)}})
