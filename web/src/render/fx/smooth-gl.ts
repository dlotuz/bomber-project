// Filtro suave na GPU: o mesmo cálculo de `smooth.ts` (referência testada na CPU) num shader de fragmento WebGL 1,
// um pixel de saída por invocação. A base 256×224 sobe como textura a cada quadro (pequena) e sai ampliada por um
// inteiro `k` num canvas WebGL, que `present()` leva ao tamanho final com suavização, como na ampliação nítida.
import { EQ_THR, W_A, W_U, W_V, W_Y } from './smooth';

/** Fator inteiro da passada suave: o inteiro logo acima da escala vertical (Full HD: 4,82 → 5, 1280×1120), para o
 *  ajuste final só reduzir um pouco na altura (fica nítido) em vez de ampliar; entre 2 e 8. Pura (testes). */
export function smoothFactor(sy: number): number {
  return Math.min(8, Math.max(2, Math.ceil(sy - 1e-6)));
}

const f = (n: number): string => (Number.isInteger(n) ? `${n}.0` : String(n));

const VERT = `attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D T;
uniform vec2 S;    // tamanho da base em pixels
uniform float K;   // fator inteiro
uniform float OH;  // altura da saída (gl_FragCoord cresce para cima)
vec2 c0;
vec4 t(float dx, float dy) { return texture2D(T, (clamp(c0 + vec2(dx, dy), vec2(0.0), S - 1.0) + 0.5) / S); }
float d(vec4 a, vec4 b) {
  vec4 e = a - b;
  return ${f(W_Y)} * abs(dot(e.rgb, vec3(0.299, 0.587, 0.114))) + ${f(W_U)} * abs(dot(e.rgb, vec3(-0.169, -0.331, 0.5)))
       + ${f(W_V)} * abs(dot(e.rgb, vec3(0.5, -0.419, -0.081))) + ${f(W_A)} * abs(e.a);
}
bool eq(vec4 a, vec4 b) { return d(a, b) < ${f(EQ_THR)}; }
float ln(float p, float q, float c, vec2 uv) { return clamp((p * uv.x + q * uv.y - c) * inversesqrt(p * p + q * q) * K + 0.5, 0.0, 1.0); }
// Um canto de E: F ao lado, H em cima/embaixo, I na diagonal; B e D opostos a H e F; C e G as outras diagonais;
// F4/I4/H5/I5 a 2 pixels. Devolve quanto do canto vira P (a cor de F ou H mais parecida com E).
float corner(vec4 E, vec4 F, vec4 H, vec4 I, vec4 B, vec4 D, vec4 C, vec4 G, vec4 F4, vec4 I4, vec4 H5, vec4 I5,
             vec2 uv, out vec4 P) {
  P = E;
  if (eq(E, F) || eq(E, H) || !(eq(E, C) || eq(E, G))) return 0.0;
  float wd1 = d(E, C) + d(E, G) + d(I, F4) + d(I, H5) + 4.0 * d(H, F);
  float wd2 = d(H, D) + d(H, I5) + d(F, I4) + d(F, B) + 4.0 * d(E, I);
  if (!(wd1 < wd2)) return 0.0;
  float a = ln(1.0, 1.0, 0.5, uv);
  if (2.0 * d(F, G) <= d(H, C) && !eq(E, G) && !eq(D, G)) a = max(a, ln(0.5, 1.0, 0.25, uv));
  if (2.0 * d(H, C) <= d(F, G) && !eq(E, C) && !eq(B, C)) a = max(a, ln(1.0, 0.5, 0.25, uv));
  P = d(E, F) <= d(E, H) ? F : H;
  return a;
}
void main() {
  vec2 p = vec2(gl_FragCoord.x, OH - gl_FragCoord.y) / K;
  c0 = floor(p);
  vec2 q = p - c0 - 0.5;
  vec4 E = t(0.0, 0.0);
  vec4 r = t(1.0, 0.0), l = t(-1.0, 0.0), u = t(0.0, -1.0), dn = t(0.0, 1.0);
  vec4 ur = t(1.0, -1.0), ul = t(-1.0, -1.0), dr = t(1.0, 1.0), dl = t(-1.0, 1.0);
  vec4 r2 = t(2.0, 0.0), l2 = t(-2.0, 0.0), u2 = t(0.0, -2.0), d2 = t(0.0, 2.0);
  vec4 r2d = t(2.0, 1.0), r2u = t(2.0, -1.0), l2d = t(-2.0, 1.0), l2u = t(-2.0, -1.0);
  vec4 d2r = t(1.0, 2.0), d2l = t(-1.0, 2.0), u2r = t(1.0, -2.0), u2l = t(-1.0, -2.0);
  vec4 P, Q; float best = 0.0, a;
  Q = E;
  a = corner(E, r, dn, dr, u, l, ur, dl, r2, r2d, d2, d2r, vec2(q.x, q.y), P);    if (a > best) { best = a; Q = P; }
  a = corner(E, r, u, ur, dn, l, dr, ul, r2, r2u, u2, u2r, vec2(q.x, -q.y), P);   if (a > best) { best = a; Q = P; }
  a = corner(E, l, dn, dl, u, r, ul, dr, l2, l2d, d2, d2l, vec2(-q.x, q.y), P);   if (a > best) { best = a; Q = P; }
  a = corner(E, l, u, ul, dn, r, dl, ur, l2, l2u, u2, u2l, vec2(-q.x, -q.y), P);  if (a > best) { best = a; Q = P; }
  gl_FragColor = mix(E, Q, best);
}`;

interface Gl { gl: WebGLRenderingContext; canvas: HTMLCanvasElement; tex: WebGLTexture; uS: WebGLUniformLocation; uK: WebGLUniformLocation; uOH: WebGLUniformLocation }
let state: Gl | null | undefined;   // undefined = ainda não tentou; null = sem WebGL (cai no nítido)

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('Crown Blast: filtro suave indisponível.', gl.getShaderInfoLog(s)); return null; }
  return s;
}

function init(): Gl | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
  if (!gl) return null;
  const vs = compile(gl, gl.VERTEX_SHADER, VERT), fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);   // um triângulo cobre a tela
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);   // menus: a base é transparente por cima do fundo HD
  gl.uniform1i(gl.getUniformLocation(prog, 'T'), 0);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); state = null; });
  return { gl, canvas, tex, uS: gl.getUniformLocation(prog, 'S')!, uK: gl.getUniformLocation(prog, 'K')!, uOH: gl.getUniformLocation(prog, 'OH')! };
}

/** A base ampliada `k`× pelo filtro suave (canvas WebGL de `w·k × h·k`), ou `null` sem WebGL — aí vale o nítido. */
export function smoothUpscale(base: HTMLCanvasElement, k: number): HTMLCanvasElement | null {
  if (state === undefined) state = init();
  if (!state) return null;
  const { gl, canvas } = state, W = base.width * k, H = base.height * k;
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  gl.viewport(0, 0, W, H);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, base);
  gl.uniform2f(state.uS, base.width, base.height);
  gl.uniform1f(state.uK, k);
  gl.uniform1f(state.uOH, H);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  return canvas;
}
