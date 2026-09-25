from mec import *
e = Dbg("st_arena01")
e.run(1); e.shot(OUT + "t0_arena01.png")
for n in range(5):
    o = e.obj(n); print(n, o[:3].hex(), "x", o[0x12]|o[0x13]<<8, "y", o[0x16]|o[0x17]<<8, "spd", o[0x40], "b", o[0x41], o[0x42], "f", o[0x44])
print("tempo", e.r8(0x1ED2), e.r8(0x1ED0), e.r8(0x1ECE), "vivos", e.r8(0x1EA0))
