// Ovos reserva andando atrás do dono (objeto $C2:62D7): medido que o ovo anda 1 px/tick até a casa-alvo
// (fx.reserveEgg: x 56→47), em vez de pular de casa em casa. Estado só visual, fora do core.

interface Pt { x: number; y: number; f: number }
interface St { px: number; py: number; f: number; pts: Pt[] }

/** Tick sem desenho acima disso (pausa, troca de tela): recomeça no alvo. */
const MAX_GAP = 30;

function toward(from: number, to: number, budget: number): number {
  return from + Math.sign(to - from) * Math.min(Math.abs(to - from), budget);
}

/** Um seguidor por camada de desenho. `step(key, px, py, frame)` abre o tick do dono (posição em px) e devolve
 *  `at(i, tx, ty)`: a posição do ovo `i` indo até (tx, ty) a max(1 px, velocidade do dono) por tick. */
export function follower() {
  const st = new WeakMap<object, St>();
  return (key: object, px: number, py: number, frame: number) => {
    let s = st.get(key);
    if (!s) st.set(key, s = { px, py, f: frame, pts: [] });
    const dt = frame - s.f;
    const speed = dt > 0 ? Math.max(1, (Math.abs(px - s.px) + Math.abs(py - s.py)) / dt) : 1;
    s.px = px; s.py = py; s.f = frame;
    const pts = s.pts;
    return (i: number, tx: number, ty: number): { x: number; y: number } => {
      const p = pts[i];
      const d = p ? frame - p.f : -1;
      if (!p || d < 0 || d > MAX_GAP) { pts[i] = { x: tx, y: ty, f: frame }; return { x: tx, y: ty }; }
      let budget = d * speed;   // fracionário (patins: 1,125 px/tick); só o desenho arredonda
      const x = toward(p.x, tx, budget);
      budget -= Math.abs(x - p.x);
      const y = toward(p.y, ty, budget);
      pts[i] = { x, y, f: frame };
      return { x: Math.round(x), y: Math.round(y) };
    };
  };
}
