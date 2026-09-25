from mec import *
a=Dbg("st_c0"); a.run(5); a.tap('A',hold=3,after=120); wa=a.wram()
b=Dbg("st_c0"); b.run(5); b.tap('DOWN',hold=3,after=20); b.tap('A',hold=3,after=120); wb=b.wram()
d=[(hex(i),wa[i],wb[i]) for i in range(0x20000) if wa[i]!=wb[i] and not(0x100<=i<0x200) and not (0x2000<=i<0x4000) and not (0x10000<=i<0x11000)]
print(len(d)); print([x for x in d if 0x1e00<=int(x[0],16)<0x2000 or int(x[0],16)>=0x12000][:60])
