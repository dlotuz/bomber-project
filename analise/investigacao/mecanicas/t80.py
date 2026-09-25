from mec import *
e=TDbg(OUT+'st_badactive.bin'); e.run(1)
for i in range(40): e.step()
seq=[('UP',120),('RIGHT',260),('DOWN',260),('LEFT',260),('UP',260)]
for b,n in seq:
    pts=[]
    for i in range(n):
        e.step(p1=[b]); pts.append(pos(e,1))
    # print turning points
    print(b, pts[0], pts[len(pts)//4], pts[len(pts)//2], pts[-1])
