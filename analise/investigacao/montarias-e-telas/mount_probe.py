import mt, sys, mount_lib as M, objlist
from PIL import Image
t=int(sys.argv[1],16)
e=mt.new()
seq=M.mount(e,t)
base=e.save()
print('type',hex(t),'ride after',len(seq),'frames; routines:',sorted(set(hex(p['rt']) for p in seq)))
# velocidade
e.load(base)
xs=[]
for f in range(90):
    e.run(1,p0=['RIGHT']); xs.append(M.pl(e)['x'])
print('RIGHT x:',xs[:10],'...',xs[-5:], 'px/frame (30..90):', (xs[89]-xs[29])/60)
e.load(base)
for f in range(60): e.run(1,p0=['DOWN'])
print('DOWN y after 60:', M.pl(e)['y'])
# botões
for b in ['A','B','Y','X','L','R']:
    e.load(base)
    o0=[(o['a'],o['rt']) for o in objlist.objs(e)]
    e.run(1,p0=['RIGHT'])
    trace=[]
    for f in range(40):
        e.run(1,p0=[b] if f<6 else [])
        p=M.pl(e); trace.append((hex(p['rt']),p['x'],p['y']))
    o1=[(o['a'],hex(o['rt']),o['x'],o['y']) for o in objlist.objs(e) if (o['a'],o['rt']) not in o0]
    rts=[]
    for tr in trace:
        if not rts or rts[-1][0]!=tr[0]: rts.append(tr)
    print(b,'rt seq',rts[:6],'end',trace[-1],'new objs',o1[:4])
