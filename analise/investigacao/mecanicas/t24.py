from mec import *
e=Dbg("st_arena01"); e.run(1)
tele(e,0,3,1); e.run(1)
e.ww(0x87A,0x87A); e.ww(0x2846,0x2847); e.ww(0x2006+0x40,0x2007+0x40)
for i in range(170):
    e.run(1, p0=['A'] if i<2 else [])
    if i==3: tele(e,0,2,2)
L=e.log()
for r in L[:6]+[r for r in L if r['addr'] not in (0x87A,0x2046)][:40]: print(fmt(r))
print([ (r['f'],r['val']) for r in L if r['addr']==0x87A][-5:])
