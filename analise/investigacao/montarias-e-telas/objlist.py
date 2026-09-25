import mt
def objs(e, lo=0x0800, hi=0x1c00):
    """percorre a lista encadeada de objetos a partir de $1400 (+4 prev, +6 next)"""
    w = e.wram(); out = []; seen=set()
    a = 0x0800
    # heurística: varre de $10 em $10 procurando cabeçalhos válidos com flag $80
    for a in range(lo, hi, 0x10):
        rt = w[a] | w[a+1] << 8 | w[a+2] << 16
        nx = w[a+6] | w[a+7] << 8; pv = w[a+4] | w[a+5] << 8
        if 0xC0 <= (rt >> 16) <= 0xC5 and (rt & 0xFFFF) and w[a+3] & 0x80:
            out.append(dict(a=a, rt=rt, flags=w[a+3], prev=pv, next=nx, x=w[a+0x12]|w[a+0x13]<<8, y=w[a+0x16]|w[a+0x17]<<8, t=w[a+0x18]))
    return out
