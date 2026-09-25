from mec import *
e = Dbg("st_arena01"); e.run(1)
w=e.wram()
for r in range(0,14):
    print(r, " ".join(f"{w[0x2800+r*0x40+c*2]:02X}{w[0x2801+r*0x40+c*2]:02X}" for c in range(16)))
print()
for r in range(0,14):
    print(r, " ".join(f"{w[0x2000+r*0x40+c*2]:02X}{w[0x2001+r*0x40+c*2]:02X}" for c in range(16)))
