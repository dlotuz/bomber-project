from plib import *
def setup(xstop=95):
    e = new(); mount(e, 4)
    e.run(2, p0=['A']); e.run(2)
    for i in range(200):
        if pl(e)['x'] >= xstop: break
        e.run(1, p0=['RIGHT'])
    e.run(1, p0=['LEFT'])
    return e
def bombs(e): return ' B' + str([(o['x'], o['y']) for o in objs(e) if o['rt'] >> 8 == 0xC13B])
if __name__ == "__main__":
  e = setup()
  print('pre', fmt(pl(e)), [(hex(o['rt']), o['x'], o['y']) for o in objs(e)], 'grid', hex(e.r16(cellr(31, 47))))
  print(compress(trace(e, {0: ['Y'], **{f: ['DOWN'] for f in range(18, 40)}}, 40)))
