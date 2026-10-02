from plib import *
def go(tag, script, n=60, lo=44):
    e = new(); mount(e, 4)
    e.run(2, p0=['RIGHT'])
    print('==', tag)
    print('\n'.join(l for l in compress(trace(e, script, n)).split('\n') if int(l[:3]) >= lo))
go('DOWN segurado desde 40', {0: ['Y'], **{f: ['DOWN'] for f in range(40, 60)}})
go('LEFT segurado desde 40', {0: ['Y'], **{f: ['LEFT'] for f in range(40, 60)}})
go('Y segurado desde 40', {0: ['Y'], **{f: ['Y'] for f in range(40, 60)}})
go('Y apertado em 49', {0: ['Y'], 49: ['Y']})
go('Y apertado em 50', {0: ['Y'], 50: ['Y']})
go('A apertado em 49', {0: ['Y'], 49: ['A']})
