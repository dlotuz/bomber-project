// Paleta das cópias de fase (game/stages.ts): mesma arena, outras cores. Só o desenho muda; o núcleo joga a base.
//
// Linhas da CGRAM do BG da fase 1 (medido): 0 = decoração da borda (BG1), 1 = HUD, 5 = blocos fixos e paredes da
// borda (os "quadrados"), 7 = piso e blocos quebráveis; as cores do piso (índices 13–15) se repetem nas linhas 2, 3 e
// 6, que a bomba e o fogo parados usam (o piso vem desenhado no próprio tile).

interface Skin {
  /** Giro de matiz em graus nas linhas `rows` (o cinza não muda: só as cores com matiz giram). */
  hue: number;
  /** Aperta as matizes em volta da do verde do piso girado (1 = só gira; 0,3 = tudo bem perto dela): as 3 cores do
   *  piso da fase 1 vão de ~100° a ~160°, e girando para o laranja a de 160° caía num amarelo-oliva que parece verde. */
  spread?: number;
  rows: readonly number[];
  /** Linhas pintadas por cima (cinza também): cada cor vira matiz `hue` e saturação `sat` (0–1), com o mesmo brilho. */
  tint?: { rows: readonly number[]; hue: number; sat: number };
}
const SKINS: Readonly<Record<number, Skin>> = {
  11: { hue: 150, rows: [0, 5, 6, 7] },                                     // piso roxo
  12: { hue: 75, rows: [0, 6, 7], tint: { rows: [5], hue: 212, sat: 0.55 } }, // piso ciano, quadrados azuis
  13: { hue: -100, spread: 0.3, rows: [0, 6, 7], tint: { rows: [5], hue: 12, sat: 0.45 } }, // piso laranja, quadrados de rocha avermelhada
};

/** Fase da partida em andamento (a da interface, não a do núcleo); quem cria a partida avisa. */
let current = 0;
export function setBattleStage(stage: number): void { current = stage; }
export const battleSkin = (): number => current;

type Hsl = [number, number, number];
function toHsl(v: number): Hsl {
  const r = (v & 31) / 31, g = ((v >> 5) & 31) / 31, b = ((v >> 10) & 31) / 31;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [((h * 60) % 360 + 360) % 360, s, l];
}
function fromHsl([h, s, l]: Hsl): number {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const q = (n: number): number => Math.max(0, Math.min(31, Math.round((n + m) * 31)));
  return q(r1) | (q(g1) << 5) | (q(b1) << 10);
}

/** Cor RGB555 do SNES com a matiz girada `deg` graus (mantém luminância e saturação; cinza fica igual). */
export function rotateHue(v: number, deg: number, spread = 1): number {
  const [h, s, l] = toHsl(v);
  if (s === 0) return v & 0x7fff;
  const d = ((h - GREEN + 540) % 360) - 180;   // distância (com sinal) da matiz do verde do piso
  return fromHsl([(((GREEN + deg + d * spread) % 360) + 360) % 360, s, l]);
}
/** Matiz do verde do piso da fase 1 (centro do `spread`). */
const GREEN = 120;
/** Cor RGB555 pintada com matiz `hue` e saturação `sat`, mantendo o brilho (pinta também o cinza). */
export function tintColor(v: number, hue: number, sat: number): number {
  return fromHsl([hue, sat, toHsl(v)[2]]);
}

/** Cópia da CGRAM com as linhas da arena na paleta de `stage` (a mesma CGRAM se a fase não tem paleta própria). */
export function skinCgram(cg: Uint16Array, stage: number): Uint16Array {
  const sk = SKINS[stage];
  if (!sk) return cg;
  const out = cg.slice();
  const map = new Map<number, number>();   // cor original → nova, das linhas da arena
  const own = new Set([...sk.rows, ...(sk.tint?.rows ?? [])]);
  for (const row of own) for (let i = row * 16 + 1; i < row * 16 + 16 && i < out.length; i++) {
    const v = sk.tint?.rows.includes(row) ? tintColor(cg[i], sk.tint.hue, sk.tint.sat) : rotateHue(cg[i], sk.hue, sk.spread);
    if (v !== cg[i] && !map.has(cg[i])) map.set(cg[i], v);
    out[i] = v;
  }
  // As outras linhas do BG (bomba e fogo parados no BG2 trazem o piso desenhado no próprio tile) repetem as cores do
  // piso: elas mudam junto, só onde a cor é exatamente uma das da arena. O HUD (linha 1) fica como está.
  for (let row = 0; row < 8; row++) {
    if (row === 1 || own.has(row)) continue;
    for (let i = row * 16 + 1; i < row * 16 + 16 && i < out.length; i++) { const v = map.get(cg[i]); if (v !== undefined) out[i] = v; }
  }
  return out;
}

/** As 16 cores de uma prévia (tela de seleção) na paleta de `stage`. A prévia reaproveita as cores da arena
 *  (`arena`, CGRAM do BG da fase base): cada cor que existe lá muda igual à arena; as outras só giram a matiz. */
export function skinColors(pal: Uint16Array, stage: number, arena?: Uint16Array): Uint16Array {
  const sk = SKINS[stage];
  if (!sk) return pal;
  const map = new Map<number, number>();
  if (arena) {
    const out = skinCgram(arena, stage);
    for (let i = 0; i < arena.length; i++) if (out[i] !== arena[i] && !map.has(arena[i])) map.set(arena[i], out[i]);
  }
  return pal.map(v => map.get(v) ?? rotateHue(v, sk.hue, sk.spread));
}
