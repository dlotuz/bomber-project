// Contrato do "pacote de arte HD" (opção 5): arte nova e original, em alta resolução, que substitui o desenho da
// partida elemento por elemento. Quem não está no pacote continua vindo da ROM (ou da arte simples sem ROM).
// Este arquivo é o contrato compartilhado entre o carregador/validador, o desenho e o pacote provisório: mudar um
// nome ou campo aqui exige mudar os três.
import type { PlayerAct } from '../../core/types';
import type { MountPhase } from '../../core/mounts/types';

/** Direções da arte (face do núcleo 0/2/4/6 → cima/direita/baixo/esquerda). */
export type HdDir = 'up' | 'right' | 'down' | 'left';
export const HD_DIRS: readonly HdDir[] = ['up', 'right', 'down', 'left'];
export const faceToHdDir = (face: number): HdDir => HD_DIRS[(face >> 1) & 3];

/** Peças da chama: centro, braço horizontal/vertical e as quatro pontas. */
export type HdFlamePart = 'center' | 'h' | 'v' | 'up' | 'down' | 'left' | 'right';

/** Peças fixas de cada arena (uma casa de 16 px do original = `cell` px do pacote). */
export type HdTile = 'floor' | 'floorAlt' | 'hard' | 'wall' | 'soft' | 'burning' | 'pressure';

/**
 * Chaves dos desenhos (string, para o manifesto ser JSON simples):
 *  - `char/<personagem 0..>/<ação>/<dir>`        ação = PlayerAct; `dir` omitido nas ações sem direção (`dying`, `victory`)
 *  - `mount/<tipo hex 1..f>/<fase>/<dir>`         fase = MountPhase; a montaria é desenhada atrás do cavaleiro
 *  - `rider/<personagem>/<dir>`                   cavaleiro montado (só a metade de cima aparece)
 *  - `bomb/<tipo 0..2>`                           0 normal, 1 remota, 2 perfurante (pulsa: animação em loop)
 *  - `flame/<peça>`                               HdFlamePart (a chama encolhe no fim: animação sem loop)
 *  - `item/<código hex 01..30>`                   itens no chão (ITEM do núcleo)
 *  - `stage/<1..10>/<peça>`                       HdTile; elementos especiais: `stage/<n>/x/<nome>` (setas, esteira…)
 *  - `egg/<tipo hex>`                             ovo de montaria no chão
 *  - `hud/<nome>`                                 relógio, coroa, cabeça `hud/head/<personagem>` etc.
 *  - `fx/<nome>`                                  nuvem, notas da dança, faíscas…
 */
export type HdKey = string;

export const charKey = (ch: number, act: PlayerAct, dir?: HdDir): HdKey => (dir ? `char/${ch}/${act}/${dir}` : `char/${ch}/${act}`);
export const mountKey = (type: number, phase: MountPhase, dir: HdDir): HdKey => `mount/${type.toString(16)}/${phase}/${dir}`;
export const stageKey = (stage: number, tile: HdTile): HdKey => `stage/${stage}/${tile}`;
export const itemKey = (code: number): HdKey => `item/${code.toString(16).padStart(2, '0')}`;

/** Um quadro: recorte `[x, y, w, h]` (px) numa imagem do pacote e o ponto de apoio `[ax, ay]` (px, dentro do recorte),
 *  que vai no ponto do jogo: pés do personagem / centro da casa / centro da bomba. */
export interface HdFrame { img: string; rect: readonly [number, number, number, number]; anchor: readonly [number, number] }

/** Animação: quadros e duração de cada um em ticks de 60 Hz (o ritmo do original vem na lista de encomenda).
 *  `loop: false` para no último quadro. Um desenho parado é uma animação de 1 quadro. */
export interface HdAnim { frames: readonly HdFrame[]; ticks: readonly number[]; loop: boolean }

/** Manifesto `pacote.json` na raiz do pacote. */
export interface HdManifest {
  /** Versão do formato (hoje 1). */
  format: 1;
  name: string;
  /** Autor(es) e licença da arte — obrigatório: o pacote só entra no projeto se a arte for original. */
  credits: string;
  license: string;
  /** Pixels do pacote por casa do jogo (uma casa = 16 px do original). Recomendado 64 (4×). */
  cell: number;
  /** Imagens (PNG/WebP) relativas à pasta do pacote. */
  images: Readonly<Record<string, string>>;
  anims: Readonly<Record<HdKey, HdAnim>>;
}

/** Pacote carregado: manifesto + imagens prontas para `drawImage`. */
export interface HdPack {
  manifest: HdManifest;
  images: ReadonlyMap<string, CanvasImageSource>;
  /** Animação de `key`, ou `null` se o pacote não tem esse desenho (o elemento cai para a ROM/arte simples). */
  anim(key: HdKey): HdAnim | null;
}

/** Quadro da animação no tick `t` contado desde o início dela. */
export function frameAt(a: HdAnim, t: number): HdFrame {
  const total = a.ticks.reduce((s, d) => s + d, 0);
  let k = a.loop && total > 0 ? ((t % total) + total) % total : Math.max(0, t);
  for (let i = 0; i < a.frames.length; i++) {
    if (k < a.ticks[i]) return a.frames[i];
    k -= a.ticks[i];
  }
  return a.frames[a.frames.length - 1];
}
