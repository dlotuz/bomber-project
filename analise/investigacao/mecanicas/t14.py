from mec import *
e = Dbg(OUT+"st_s1_after600.bin")
e.run(15)
e.bp(0xC4121D); e.rw(0x54,0x56)
e.run(3)
L=e.log()
for r in L:
    if 0xC41190<=r['pc']<=0xC41330: print(fmt(r))
