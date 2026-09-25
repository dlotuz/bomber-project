"""Emu com core snes9x próprio (rastreio de $2140-$2143, ganchos de PC, dump .spc, captura de áudio).

Core: scratchpad/rom-audio/snes9x/libretro/snes9x_libretro.dylib (cópia do snes9x com patch, ver RELATORIO.md §Reprodução).
Uso: um processo por instância.
"""
import os, sys, ctypes as C, wave, struct
SCR = "/private/tmp/claude-501/-Users-dlotuz-Projetos-Claude-Bomber-Project/189281cc-52ae-4614-9c45-1f93ec4bdecb/scratchpad"
os.environ.setdefault("SNES9X_CORE", SCR + "/rom-audio/snes9x/libretro/snes9x_libretro.dylib")
FERR = "/Users/dlotuz/Projetos Claude/Bomber Project/analise/ferramentas"
EST = "/Users/dlotuz/Projetos Claude/Bomber Project/analise/estados"
sys.path.insert(0, FERR)
import emu as _emu

class AEmu(_emu.Emu):
    def __init__(self, **kw):
        super().__init__(**kw)
        self.audio = bytearray(); self.capture = False
        def _batch(data, n):
            if self.capture: self.audio += C.string_at(data, n * 4)
            return n
        self._acb = _emu.AUDB_CB(_batch)
        self.lib.retro_set_audio_sample_batch(self._acb)
        L = self.lib
        L.aud_set_log.argtypes = [C.c_char_p]; L.aud_spc_dump.argtypes = [C.c_char_p]
        L.aud_add_hook.argtypes = [C.c_uint]
        L.aud_apuram.restype = C.c_void_p

    def log(self, path): self.lib.aud_set_log(path.encode() if path else None)
    def flush(self): self.lib.aud_flush()
    def hook(self, *pcs):
        for p in pcs: self.lib.aud_add_hook(p)
    def spc(self, path): return self.lib.aud_spc_dump(path.encode())
    def apuram(self): return C.string_at(self.lib.aud_apuram(), 65536)
    def state(self, name): self.load(open(os.path.join(EST, name if name.endswith('.bin') else name + '.bin'), 'rb').read())
    def wav(self, path, rate=32040):
        w = wave.open(path, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(rate)
        w.writeframes(bytes(self.audio)); w.close()

# ganchos padrão da camada de som (banco $C3) e do driver-lado-CPU (banco $C0)
HOOKS = {
    0xC34A44: 'MUSIC(A)', 0xC34A16: 'LOADBLK(A)', 0xC34A7F: 'SFXQ(A)', 0xC34AE6: 'SFXSEND(A)',
    0xC34AF9: 'STREAM(A)', 0xC349ED: 'CMD18', 0xC3492F: 'SEQ3492F', 0xC349F4: 'CMD13',
    0xC00394: 'drv_music', 0xC0040C: 'drv_upload', 0xC003D2: 'drv_sfx', 0xC003E1: 'drv_stream', 0xC00376: 'drv_init',
}
