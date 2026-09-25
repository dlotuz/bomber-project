from mec import *
a=Dbg(OUT+'st_r_normal.bin'); a.run(1); wa=a.wram()
b=Dbg(OUT+'st_r_racer.bin'); b.run(1); wb=b.wram()
d=[(hex(i),wa[i],wb[i]) for i in range(0x20000) if wa[i]!=wb[i] and not (0x2000<=i<0x2c00) and not(0x100<=i<0x200)]
print(len(d)); print(d[:80])
