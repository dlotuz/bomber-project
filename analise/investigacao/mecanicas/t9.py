from mec import *
for s in ["st_stage00","st_stage01","st_rules","st_game","st_matchend","st_randspawn","st_after_die","st_final_wait","st_c0","st_d0","st_b1","st_mixed","st_cp00","st_ev00"]:
    e = Dbg(s); e.run(1); e.shot(OUT+f"sh_{s}.png"); print(s, e.r8(0x1ED2), e.r8(0x1ED0), e.r8(0x1EA0))
