"""Alinha trechos do WAV do spchost com o áudio do jogo (snes9x completo) por correlação cruzada no nível de amostra."""
import numpy as np, wave, sys
X = '/Users/dlotuz/Projetos Claude/Bomber Project/analise/extraido/audio/'
def load(p):
    w = wave.open(p); return np.frombuffer(w.readframes(10**8), dtype=np.int16).reshape(-1, 2).astype(np.float64)
g = load(X + (sys.argv[1] if len(sys.argv) > 1 else 'jogo_battle_14.wav')); h = load(X + (sys.argv[2] if len(sys.argv) > 2 else 'battle_14.wav'))
G = g[:, 0]
for t0 in [float(x) for x in (sys.argv[3].split(",") if len(sys.argv) > 3 else "1,5,10,20".split(","))]:
    s = h[int(t0 * 32000):int(t0 * 32000) + 4000, 0]; L = len(s); n = len(G) + L
    c = np.fft.irfft(np.fft.rfft(G, n) * np.conj(np.fft.rfft(s, n)), n)[:len(G) - L + 1]
    cs = np.cumsum(np.concatenate([[0], G ** 2])); en = np.sqrt(np.maximum(cs[L:] - cs[:-L], 0))
    r = c / (en * np.linalg.norm(s) + 1e-9); r[en < 0.05 * en.max()] = 0
    k = int(np.argmax(r))
    seg = g[k:k + L, :]; hs = h[int(t0 * 32000):int(t0 * 32000) + L, :]
    err = np.abs(seg - hs)
    print('host t=%4.1fs -> jogo +%.1f ms  r=%.5f  |dif| média=%.1f máx=%.0f (amplitude média %.0f)' % (t0, (k - t0 * 32000) / 32, r[k], err.mean(), err.max(), np.abs(hs).mean()))
