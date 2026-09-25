"""Tiny headless libretro frontend around the snes9x core (ctypes)."""
import ctypes as C, os

SCR = os.path.dirname(os.path.abspath(__file__))
CORE = os.environ.get("SNES9X_CORE", os.path.join(SCR, "snes9x_libretro.dylib"))
ROMP = "/Users/dlotuz/Projetos Claude/Bomber Project/Super Bomberman 4 (USA).sfc"

B = dict(B=0, Y=1, SELECT=2, START=3, UP=4, DOWN=5, LEFT=6, RIGHT=7, A=8, X=9, L=10, R=11)

class GameInfo(C.Structure):
    _fields_ = [("path", C.c_char_p), ("data", C.c_void_p), ("size", C.c_size_t), ("meta", C.c_char_p)]

ENV_CB = C.CFUNCTYPE(C.c_bool, C.c_uint, C.c_void_p)
VID_CB = C.CFUNCTYPE(None, C.c_void_p, C.c_uint, C.c_uint, C.c_size_t)
AUD_CB = C.CFUNCTYPE(None, C.c_int16, C.c_int16)
AUDB_CB = C.CFUNCTYPE(C.c_size_t, C.c_void_p, C.c_size_t)
POLL_CB = C.CFUNCTYPE(None)
STATE_CB = C.CFUNCTYPE(C.c_int16, C.c_uint, C.c_uint, C.c_uint, C.c_uint)

class Emu:
    def __init__(self, multitap=True):
        self.lib = C.CDLL(CORE)
        self.pressed = [set() for _ in range(5)]
        self.frame = None
        self.fmt = 0
        self.sysdir = C.c_char_p(SCR.encode())
        self._cbs = [ENV_CB(self._env), VID_CB(self._vid), AUD_CB(lambda l, r: None),
                     AUDB_CB(lambda d, n: n), POLL_CB(lambda: None), STATE_CB(self._state)]
        L = self.lib
        L.retro_set_environment(self._cbs[0])
        L.retro_init()
        L.retro_set_video_refresh(self._cbs[1]); L.retro_set_audio_sample(self._cbs[2])
        L.retro_set_audio_sample_batch(self._cbs[3]); L.retro_set_input_poll(self._cbs[4])
        L.retro_set_input_state(self._cbs[5])
        self.romdata = open(ROMP, "rb").read()
        self._buf = C.create_string_buffer(self.romdata, len(self.romdata))
        gi = GameInfo(ROMP.encode(), C.cast(self._buf, C.c_void_p), len(self.romdata), None)
        assert L.retro_load_game(C.byref(gi)), "load failed"
        L.retro_set_controller_port_device(0, 1)
        if multitap:
            L.retro_set_controller_port_device(1, (1 << 8) | 1)
        L.retro_get_memory_data.restype = C.c_void_p
        L.retro_get_memory_size.restype = C.c_size_t
        L.retro_serialize_size.restype = C.c_size_t
        self.wram_ptr = L.retro_get_memory_data(2)
        self.wram_size = L.retro_get_memory_size(2)
        self.nframes = 0

    def _env(self, cmd, data):
        cmd &= 0xFFFF
        if cmd == 10:  # SET_PIXEL_FORMAT
            self.fmt = C.cast(data, C.POINTER(C.c_int))[0]; return True
        if cmd in (9, 31):  # GET_SYSTEM_DIRECTORY / GET_SAVE_DIRECTORY
            C.cast(data, C.POINTER(C.c_char_p))[0] = self.sysdir.value; return True
        if cmd == 3:  # GET_CAN_DUPE
            C.cast(data, C.POINTER(C.c_bool))[0] = True; return True
        return False

    def _vid(self, data, w, h, pitch):
        if data:
            self.frame = (C.string_at(data, pitch * h), w, h, pitch)

    def _state(self, port, device, index, id_):
        if port < 5 and device == 1:
            return 1 if id_ in self.pressed[port] else 0
        return 0

    def run(self, n=1, **held):
        """held: p0=['A','START'] etc."""
        for p in range(5):
            self.pressed[p] = {B[k] for k in held.get(f"p{p}", [])}
        for _ in range(n):
            self.lib.retro_run(); self.nframes += 1
        for p in range(5): self.pressed[p] = set()

    def tap(self, btns, player=0, hold=3, after=10):
        self.run(hold, **{f"p{player}": btns if isinstance(btns, list) else [btns]})
        self.run(after)

    def wram(self):
        return C.string_at(self.wram_ptr, self.wram_size)

    def r8(self, a): return self.wram()[a]
    def r16(self, a): w = self.wram(); return w[a] | (w[a + 1] << 8)
    def w8(self, a, v): C.memmove(self.wram_ptr + a, bytes([v & 0xFF]), 1)
    def w16(self, a, v): C.memmove(self.wram_ptr + a, bytes([v & 0xFF, (v >> 8) & 0xFF]), 2)

    def save(self):
        n = self.lib.retro_serialize_size(); buf = C.create_string_buffer(n)
        assert self.lib.retro_serialize(buf, n); return buf.raw

    def load(self, st):
        buf = C.create_string_buffer(st, len(st)); assert self.lib.retro_unserialize(buf, len(st))

    def shot(self, path):
        from PIL import Image
        data, w, h, pitch = self.frame
        img = Image.new("RGB", (w, h)); px = img.load()
        for y in range(h):
            row = data[y * pitch:(y * pitch) + w * 2]
            for x in range(w):
                v = row[2 * x] | (row[2 * x + 1] << 8)
                if self.fmt == 2:  # RGB565
                    r, g, b = (v >> 11) & 31, (v >> 5) & 63, v & 31; px[x, y] = (r << 3, g << 2, b << 3)
                else:
                    r, g, b = (v >> 10) & 31, (v >> 5) & 31, v & 31; px[x, y] = (r << 3, g << 3, b << 3)
        img.save(path)
