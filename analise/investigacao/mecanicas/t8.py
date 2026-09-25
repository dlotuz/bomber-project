from mec import *
e = Dbg("st_arena01"); e.run(1)
w=e.wram()
i=0x8000; out=[]
while True:
    c=w[i]|w[i+1]<<8
    if c==0xFFFF: break
    v=w[i+2]|w[i+3]<<8
    out.append((c,v)); i+=4
print(len(out))
for c,v in out: print(f"cell {c:04X} (row {c//0x40} col {(c%0x40)//2}) item {v:04X}")
