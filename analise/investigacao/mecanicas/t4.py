from mec import *
e = Dbg("st_arena01"); e.run(1)
w=e.wram()
for base in (0x2400,0x2C00,0x3000,0x3400,0x3800,0x3C00):
    print(hex(base))
    for r in range(0,13):
        print(r, " ".join(f"{w[base+r*0x40+c*2]:02X}{w[base+1+r*0x40+c*2]:02X}" for c in range(16)))
