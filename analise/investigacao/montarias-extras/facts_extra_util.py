def tile4(v, a):
    out = []
    for r in range(8):
        b0, b1, b2, b3 = v[a + 2 * r], v[a + 2 * r + 1], v[a + 16 + 2 * r], v[a + 17 + 2 * r]
        for c in range(8):
            s = 7 - c; out.append(((b0 >> s) & 1) | ((b1 >> s) & 1) << 1 | ((b2 >> s) & 1) << 2 | ((b3 >> s) & 1) << 3)
    return out
