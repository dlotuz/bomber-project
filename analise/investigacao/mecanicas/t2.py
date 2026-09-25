from mec import *
e = Dbg("st_arena01"); e.run(2)
a = e.obj(0)
e.loadf("st_arena05"); e.run(2)
b = e.obj(0)
for i in range(0,256,16):
    print(f"{i:02X}: "+" ".join(f"{x:02X}" for x in a[i:i+16])+"   "+" ".join(f"{x:02X}" if x!=a[i+j] else '..' for j,x in enumerate(b[i:i+16])))
