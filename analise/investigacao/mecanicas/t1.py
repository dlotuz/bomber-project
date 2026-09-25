from mec import *
e = Dbg("st_arena01")
# achar quando o jogo começa a aceitar input: segurar RIGHT e ver X
x0 = e.r16(0x312)
for i in range(400):
    e.run(1, p0=['DOWN'])
    if e.r16(0x316) != 48: print("comecou a mover no frame", i, e.r16(0x312), e.r16(0x316)); break
st = e.save(); open(OUT+"st_go.bin","wb").write(st)
e.ww(0x310, 0x317)
e.run(3, p0=['DOWN'])
for r in e.log(): print(fmt(r))
