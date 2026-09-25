from mec import *
e = Dbg(OUT+"st_s1_after600.bin")
for i in range(130):
    e.run(1, p0=['DOWN'])
    if i>=10 and i%4==0: e.shot(OUT+f"s3_{600+i+1:04d}.png")
