// Catálogo do pacote de arte HD (opção 5): a lista COMPLETA de desenhos que a partida pode pedir, gerada a partir dos
// tipos e tabelas reais do núcleo e do render (personagens, PlayerAct, montarias, itens, arenas…). Para cada chave:
// descrição em PT-BR, tamanho e ponto de apoio recomendados (com `HD_CELL` px por casa), quadros e ticks recomendados
// e prioridade. O ritmo vem do original: `catalog-ritmo.ts` guarda só NÚMEROS (ticks de cada quadro) lidos das
// tabelas de animação da ROM por `scripts/arte-hd/ritmo.ts`; sem eles, valem os padrões documentados aqui.
// Nada aqui é desenho: a arte do pacote é nova e original (personagens novos, não os do Super Bomberman 4).
import { DISEASE, ITEM, type PlayerAct } from '../../core/types';
import { BURN_TICKS, STAGE_NAMES } from '../../core/constants';
import { CAPSULE_TYPES, CAPSULE_TYPES_ALL } from '../../core/tables/misc';
import { STAGE_ITEMS } from '../../core/tables/items';
import { A7_ARROWS, A8_L149F, A8_L14A9 } from '../../core/stages/tables';
import { DISMOUNT_TICKS, MOUNTING_TICKS, isMachine, type MountPhase } from '../../core/mounts/types';
import { CHARACTERS } from '../art/bomber';
import { playerAnimRef } from '../anim/player-anim';
import { FLAME_PHASE } from '../anim/grid-seq';
import {
  COSTUME_ANIMS, DANCE_ANIMS, DANCE_NOTE_FRAME_TICKS, DISMOUNT_ANIMS, EGG_ANIMS, MACHINE_EGG_ANIMS, MOUNTING_ANIMS,
  MOUNT_ANIMS, PROJ_ANIMS, REMOUNT_GLOW_ANIMS, REMOUNT_GLOW_STAGE_TICKS, REMOUNT_MOUNT_ANIMS, RIDER_ANIMS,
} from '../rom/mounts/facts';
import { RITMO_ROM } from './catalog-ritmo';
import {
  HD_DIRS, charKey, faceToHdDir, itemKey, mountKey, stageKey, type HdAnim, type HdDir, type HdFlamePart, type HdKey,
  type HdManifest, type HdTile,
} from './types';

/** Pixels do pacote por casa do jogo (uma casa = 16 px do original). Todos os tamanhos do catálogo usam este valor. */
export const HD_CELL = 64;
/** px do original → px do pacote (4×). */
const hd = (n: number): number => (n * HD_CELL) / 16;

export type HdPriority = 'essencial' | 'bom' | 'raro';
export const HD_PRIORITIES: readonly HdPriority[] = ['essencial', 'bom', 'raro'];
export const PRIORITY_LABEL: Readonly<Record<HdPriority, string>> = {
  essencial: 'essencial para jogar', bom: 'bom ter', raro: 'raro',
};

export type HdGroup = 'personagens' | 'cavaleiros' | 'trajes' | 'montarias' | 'ovos' | 'bombas' | 'chamas' | 'itens'
  | 'arenas' | 'hud' | 'efeitos';
export const HD_GROUPS: readonly HdGroup[] = ['personagens', 'cavaleiros', 'trajes', 'montarias', 'ovos', 'bombas',
  'chamas', 'itens', 'arenas', 'hud', 'efeitos'];
export const GROUP_LABEL: Readonly<Record<HdGroup, string>> = {
  personagens: 'Personagens', cavaleiros: 'Cavaleiros (montados)', trajes: 'Trajes (arena 10)', montarias: 'Montarias',
  ovos: 'Ovos', bombas: 'Bombas', chamas: 'Chamas', itens: 'Itens', arenas: 'Arenas', hud: 'Placar (HUD)',
  efeitos: 'Efeitos',
};

/** Ritmo recomendado: duração de cada quadro em ticks de 60 Hz. `distinct` = desenhos diferentes no original (um
 *  mesmo desenho pode se repetir na sequência; null = não medido). */
export interface HdRitmo { frames: number; ticks: readonly number[]; loop: boolean; distinct: number | null; fonte: string }

export interface HdCatalogEntry {
  key: HdKey;
  group: HdGroup;
  /** O que desenhar (PT-BR). */
  desc: string;
  /** Tamanho recomendado do quadro [w, h] em px, com `HD_CELL` px por casa. */
  size: readonly [number, number];
  /** Ponto de apoio recomendado [ax, ay] em px dentro do quadro (vai no ponto do jogo). */
  anchor: readonly [number, number];
  ritmo: HdRitmo;
  priority: HdPriority;
}

// ---------------------------------------------------------------------------------------------------------------
// Ritmo: fontes na ROM (lidas por scripts/arte-hd/ritmo.ts) e padrões sem ROM.

interface Padrao { ticks: readonly number[]; loop: boolean; distinct?: number }
/** Onde o original guarda a animação: tabela de jogador (`p24(p24(tab + 3c) + 3·idx)`), sequência de endereços
 *  (como `sampleSeq` das montarias: dur 255 vale 1 tick, e congela se for o último) ou script de bomba. */
export type FonteRom =
  | { kind: 'player'; tab: number; idx: number | null }
  | { kind: 'seq'; addrs: readonly number[] }
  | { kind: 'bomb'; type: number };
export interface FonteRitmo { rom: FonteRom; padrao: Padrao; /** força o loop (ex.: derrota some no fim). */ loop?: boolean }

const STILL: Padrao = { ticks: [1], loop: false, distinct: 1 };
const WALK: Padrao = { ticks: [12, 8, 12, 8], loop: true, distinct: 3 };   // spec §7.4 (`walk`)

const DIR8: Readonly<Record<HdDir, 0 | 2 | 4 | 6>> = { up: 0, right: 2, down: 4, left: 6 };
const DIR_IDX: Readonly<Record<HdDir, 0 | 1 | 2 | 3>> = { up: 0, right: 1, down: 2, left: 3 };

/** Ações do jogador. `Record<PlayerAct, …>`: o compilador exige todas as ações do núcleo. `dir: false` = sem direção
 *  na chave (contrato: `dying`, `victory`). `fonte` diz de onde vem o ritmo do original. */
interface ActInfo { desc: string; priority: HdPriority; dir: boolean; fonte: (d: HdDir) => FonteRitmo }

/** Animação que o render da ROM usa para a ação (`playerAnimRef`, personagem 0; o ritmo é igual nos 6). */
const playerFonte = (act: PlayerAct, moving: boolean, padrao: Padrao, loop?: boolean) => (d: HdDir): FonteRitmo => {
  const { ref } = playerAnimRef({ act, face: DIR8[d], char: 0, moving }, 0);
  return { rom: { kind: 'player', tab: ref.tab, idx: ref.idx }, padrao, loop };
};
const seqFonte = (addrs: (d: HdDir) => readonly number[], padrao: Padrao, loop?: boolean) => (d: HdDir): FonteRitmo =>
  ({ rom: { kind: 'seq', addrs: addrs(d) }, padrao, loop });

export const ACT_INFO: Readonly<Record<PlayerAct, ActInfo>> = {
  idle: { desc: 'parado', priority: 'essencial', dir: true, fonte: playerFonte('idle', false, STILL) },
  walk: { desc: 'andando (ciclo de passos; o ritmo não muda com a velocidade)', priority: 'essencial', dir: true,
    fonte: playerFonte('walk', true, WALK) },
  lift: { desc: 'levantando a bomba com a luva', priority: 'essencial', dir: true,
    fonte: playerFonte('lift', false, { ticks: [2, 2, 2, 2], loop: true }) },
  carryIdle: { desc: 'parado com a bomba erguida acima da cabeça', priority: 'essencial', dir: true,
    fonte: playerFonte('carryIdle', false, STILL) },
  carryWalk: { desc: 'andando com a bomba erguida acima da cabeça', priority: 'essencial', dir: true,
    fonte: playerFonte('carryWalk', true, WALK) },
  throw: { desc: 'arremessando a bomba', priority: 'essencial', dir: true,
    fonte: playerFonte('throw', false, { ticks: [20], loop: true, distinct: 1 }) },
  punch: { desc: 'socando a bomba', priority: 'essencial', dir: true,
    fonte: playerFonte('punch', false, { ticks: [2, 2, 2, 2], loop: true }) },
  pPunch: { desc: 'golpe P (avanço com o punho)', priority: 'bom', dir: true, fonte: playerFonte('pPunch', false, STILL) },
  detonate: { desc: 'apertando o detonador da bomba remota (pose de 3 ticks; segurando, congela)', priority: 'essencial',
    dir: true, fonte: playerFonte('detonate', false, STILL) },
  stunned: { desc: 'atordoado, girando (bola da arena 3, arremesso na cabeça)', priority: 'essencial', dir: true,
    fonte: playerFonte('stunned', false, { ticks: [4, 4, 4, 4], loop: true }) },
  dying: { desc: 'derrota: o personagem é atingido e some no último quadro (sem loop)', priority: 'essencial', dir: false,
    fonte: playerFonte('dying', false, { ticks: [5, 5, 6, 6], loop: false, distinct: 4 }, false) },
  victory: { desc: 'comemoração de quem venceu a rodada', priority: 'essencial', dir: false,
    fonte: playerFonte('victory', false, { ticks: [12, 12], loop: true, distinct: 2 }) },
  mounting: { desc: 'pulando para cima da montaria (o arco do pulo pode ir no ponto de apoio de cada quadro)',
    priority: 'bom', dir: true, fonte: seqFonte(() => MOUNTING_ANIMS[0x2], { ticks: [MOUNTING_TICKS], loop: false }) },
  dismount: { desc: 'perdendo a montaria: pulo para fora e volta ao chão', priority: 'bom', dir: true,
    fonte: seqFonte(() => DISMOUNT_ANIMS, { ticks: [DISMOUNT_TICKS], loop: false }) },
  launched: { desc: 'lançado pela gangorra (arena 9), no ar', priority: 'bom', dir: true,
    fonte: playerFonte('launched', false, { ticks: [7, 7], loop: true }) },
  pushed: { desc: 'escorregando no piso de listras (arena 6), sem controle', priority: 'bom', dir: true,
    fonte: playerFonte('pushed', false, { ticks: [4, 4], loop: true }) },
  shocked: { desc: 'levando choque da cerca elétrica (arena 5)', priority: 'bom', dir: true,
    fonte: playerFonte('shocked', false, { ticks: [3, 3], loop: true }) },
  dance: { desc: 'dançando sem controle (acertado pela nota da montaria F)', priority: 'bom', dir: true,
    fonte: seqFonte(() => DANCE_ANIMS, { ticks: [10, 10, 10, 10], loop: true }) },
  bad: { desc: 'Bomber Vingador: eliminado, andando pela borda de fora da arena', priority: 'bom', dir: true,
    fonte: playerFonte('bad', true, WALK) },
  held: { desc: 'preso na luva de outro jogador (ou voando, arremessado): pose parada, encolhido', priority: 'bom',
    dir: true, fonte: seqFonte(d => RIDER_ANIMS[0x2][DIR_IDX[d]].idle, STILL) },
  dropped: { desc: 'largado pela luva: pulo de volta ao chão', priority: 'bom', dir: true,
    fonte: seqFonte(() => DISMOUNT_ANIMS, { ticks: [DISMOUNT_TICKS], loop: false }) },
};
/** Todas as ações do núcleo (as chaves de `ACT_INFO`, conferidas pelo compilador). */
export const PLAYER_ACTS = Object.keys(ACT_INFO) as PlayerAct[];

const MOUNT_PHASE_INFO: Readonly<Record<MountPhase, { desc: string; fonte: (t: number, d: HdDir) => FonteRitmo }>> = {
  mounting: { desc: 'surgindo embaixo do jogador quando ele pega o ovo (parada; o jogo faz piscar e subir)',
    fonte: (t, d) => ({ rom: { kind: 'seq', addrs: MOUNT_ANIMS[t][DIR_IDX[d]].idle }, padrao: STILL }) },
  riding: { desc: 'com o jogador montado, andando (parada: o jogo mostra o 1º quadro)',
    fonte: (t, d) => ({ rom: { kind: 'seq', addrs: MOUNT_ANIMS[t][DIR_IDX[d]].walk },
      padrao: { ticks: [16, 16, 16, 16], loop: true, distinct: 3 } }) },
  dismount: { desc: 'reaparecendo no remonte (ovo reserva estoura e a montaria volta), parada',
    fonte: () => ({ rom: { kind: 'seq', addrs: REMOUNT_MOUNT_ANIMS }, padrao: STILL }) },
};
export const MOUNT_PHASES = Object.keys(MOUNT_PHASE_INFO) as MountPhase[];

/** Habilidade de cada tipo (núcleo `core/mounts/abilities/type*.ts`): a montaria nova deve "contar" o que faz. */
const MOUNT_ABILITY: Readonly<Record<number, string>> = {
  0x1: 'atravessa bombas', 0x2: 'atravessa blocos', 0x3: 'bombas perfurantes', 0x4: 'investida (Y)',
  0x5: 'varredura que queima os blocos (Y)', 0x6: 'fogo total', 0x9: 'soca a bomba da frente (Y)', 0xa: 'chuta bombas',
  0xb: 'velocidade máxima', 0xc: 'linha com todas as bombas (Y)', 0xd: 'lança a si mesma como míssil (Y)',
  0xe: 'tiro lento que vira nuvem (Y)', 0xf: 'nota musical que faz o alvo dançar (Y)',
};

/** Tipos de montaria (`$C1:5DA4` normal e `$C1:5D87` com a senha 0164), na ordem crescente. */
const uniq = (v: readonly number[]): number[] => [...new Set(v)].sort((a, b) => a - b);
export const MOUNT_TYPES_NORMAL: readonly number[] = uniq(CAPSULE_TYPES.map((v: number) => v & 0x0f));
export const MOUNT_TYPES: readonly number[] = uniq(CAPSULE_TYPES_ALL.map((v: number) => v & 0x0f));

/** Nomes dos itens (`ITEM`/`DISEASE` do núcleo; `Record` exige todos). */
const ITEM_NAME: Readonly<Record<keyof typeof ITEM, string>> = {
  BOMB: 'Bomba +1', PIERCE: 'Bomba perfurante', FIRE: 'Fogo +1', FULL_FIRE: 'Fogo total', SPEED: 'Patins (velocidade +1)',
  REMOTE: 'Bomba remota', GLOVE: 'Luva (pegar e arremessar)', VEST: 'Colete (invencível por um tempo)', HEART: 'Coração',
  PASS_SOFT: 'Atravessa bloco', PASS_BOMB: 'Atravessa bomba', CLOCK: 'Relógio', PUNCH: 'Soco', KICK: 'Chute',
  COSTUME: 'Traje (arena 10)', STAR: 'Estrela', P: 'Golpe P', SKULL: 'Caveira (doença)', EGG: 'Ovo (vira `egg/<tipo>`)',
};
const DISEASE_NAME: Readonly<Record<keyof typeof DISEASE, string>> = {
  FAST: 'rápido demais', SLOW: 'lento', DIARRHEA: 'solta bombas sem parar', CONSTIPATION: 'não solta bombas',
  LOW_FIRE: 'fogo mínimo', NO_STOP: 'não para de andar', SHORT_FUSE: 'pavio curto', LONG_FUSE: 'pavio longo',
  INVISIBLE: 'invisível', REVERSE: 'controles invertidos', LEAK: 'perde itens', SWAP: 'troca de lugar',
};

const FLAME_INFO: Readonly<Record<HdFlamePart, string>> = {
  center: 'centro da explosão (onde estava a bomba)', h: 'braço horizontal (emenda à esquerda e à direita)',
  v: 'braço vertical (emenda em cima e embaixo)', up: 'ponta de cima', down: 'ponta de baixo', left: 'ponta da esquerda',
  right: 'ponta da direita',
};
export const FLAME_PARTS = Object.keys(FLAME_INFO) as HdFlamePart[];

const TILE_INFO: Readonly<Record<HdTile, string>> = {
  floor: 'piso', floorAlt: 'piso alternado (xadrez com o piso; pode ser igual ao piso)', hard: 'pilar indestrutível do meio do campo',
  wall: 'parede da borda do campo', soft: 'bloco destrutível', burning: 'bloco destrutível queimando (sem loop; depois vira piso)',
  pressure: 'bloco da pressão (Morte Súbita) já pousado',
};
export const HD_TILES = Object.keys(TILE_INFO) as HdTile[];

// ---------------------------------------------------------------------------------------------------------------
// Montagem.

/** Regra do apoio de quem fica de pé no chão (personagens, cavaleiros, trajes, montarias): o apoio é o CENTRO DA
 *  SOMBRA SOB OS PÉS (o ponto em que o desenho toca o chão), não o centro do quadro. O desenho do pacote alinha esse
 *  ponto `FEET_BELOW_CENTER` px do original abaixo do centro da casa. Quadro recomendado 96×128 com apoio (48, 108)
 *  (o mesmo do pacote provisório): 1,5 casa de largura, 2 de altura, 20 px livres sob os pés para a sombra. */
export const FEET_BELOW_CENTER = 9;
const BOX_CHAR = [hd(24), hd(32)] as const;
const ANCHOR_CHAR = [hd(12), hd(27)] as const;
/** Montaria: mais larga (2 casas), mesmo apoio nos pés/base. */
const BOX_MOUNT = [hd(32), hd(32)] as const;
const ANCHOR_MOUNT = [hd(16), hd(27)] as const;
const BOX_CELL = [hd(16), hd(16)] as const;
const ANCHOR_CELL = [hd(8), hd(8)] as const;
const BOX_BIG = [hd(32), hd(32)] as const;
const ANCHOR_BIG_CENTER = [hd(16), hd(16)] as const;
const TOP_LEFT = [0, 0] as const;

function fromPadrao(p: Padrao, fonte: string): HdRitmo {
  return { frames: p.ticks.length, ticks: p.ticks, loop: p.loop, distinct: p.distinct ?? null, fonte };
}

/** Nome da animação na tabela de ritmo da ROM: estável, usado por `scripts/arte-hd/ritmo.ts`. */
export type RitmoName = string;

/** Ritmo: o da ROM (`catalog-ritmo.ts`) se medido, senão o padrão. */
function ritmoDe(name: RitmoName, f: FonteRitmo): HdRitmo {
  const r = RITMO_ROM[name];
  if (!r) return fromPadrao(f.padrao, 'padrão (sem ROM)');
  return { frames: r.ticks.length, ticks: r.ticks, loop: f.loop ?? r.loop, distinct: r.distinct, fonte: `ROM ${r.addr}` };
}

/** Fontes de ritmo na ROM, por nome — lidas pelo gerador com a ROM do usuário. */
export function ritmoFontes(): Map<RitmoName, FonteRitmo> {
  const m = new Map<RitmoName, FonteRitmo>();
  for (const act of PLAYER_ACTS) {
    const info = ACT_INFO[act];
    if (info.dir) for (const d of HD_DIRS) m.set(`char/${act}/${d}`, info.fonte(d));
    else m.set(`char/${act}`, info.fonte('down'));
  }
  for (const t of MOUNT_TYPES) for (const ph of MOUNT_PHASES) for (const d of HD_DIRS) m.set(`mount/${t.toString(16)}/${ph}/${d}`, MOUNT_PHASE_INFO[ph].fonte(t, d));
  for (const d of HD_DIRS) {
    m.set(`rider/${d}`, { rom: { kind: 'seq', addrs: RIDER_ANIMS[0x2][DIR_IDX[d]].walk }, padrao: { ticks: [16, 16, 16, 16], loop: true, distinct: 3 } });
  }
  for (const c of Object.keys(COSTUME_ANIMS).map(Number)) for (const d of HD_DIRS) {
    const a = COSTUME_ANIMS[c][DIR_IDX[d]];
    m.set(`costume/${c}/walk/${d}`, { rom: { kind: 'seq', addrs: a.walk }, padrao: WALK });
    m.set(`costume/${c}/idle/${d}`, { rom: { kind: 'seq', addrs: a.idle }, padrao: STILL });
  }
  m.set('egg/normal', { rom: { kind: 'seq', addrs: EGG_ANIMS }, padrao: { ticks: [10, 10, 10, 10], loop: true } });
  m.set('egg/machine', { rom: { kind: 'seq', addrs: MACHINE_EGG_ANIMS }, padrao: { ticks: [10, 10, 10, 10], loop: true } });
  const bombPadrao: readonly Padrao[] = [   // spec §7.1: normal 20/12/16/16, remota 16×4
    { ticks: [20, 12, 16, 16], loop: true, distinct: 4 }, { ticks: [16, 16, 16, 16], loop: true, distinct: 4 },
    { ticks: [20, 12, 16, 16], loop: true, distinct: 4 },
  ];
  bombPadrao.forEach((p, t) => m.set(`bomb/${t}`, { rom: { kind: 'bomb', type: t }, padrao: p }));
  m.set('fx/egg-burst', { rom: { kind: 'seq', addrs: [REMOUNT_GLOW_ANIMS[2]] }, padrao: { ticks: [10, 10, 10, 10], loop: false }, loop: false });
  m.set('fx/slow-shot', { rom: { kind: 'seq', addrs: [PROJ_ANIMS.e[0]] }, padrao: { ticks: [15, 15, 15, 15], loop: true } });
  m.set('fx/slow-cloud', { rom: { kind: 'seq', addrs: [PROJ_ANIMS.e[1]] }, padrao: { ticks: [10, 10, 10, 10], loop: false }, loop: false });
  m.set('fx/sleep-note', { rom: { kind: 'seq', addrs: PROJ_ANIMS.f }, padrao: { ticks: [2, 2, 2, 2], loop: true } });
  m.set('fx/missile', { rom: { kind: 'seq', addrs: PROJ_ANIMS.d }, padrao: { ticks: [1, 1, 1], loop: true } });
  m.set('stage/3/x/orb', { rom: { kind: 'seq', addrs: [ORB_ANIM] }, padrao: { ticks: [8, 8, 8, 8], loop: true } });
  m.set('stage/8/x/prize', { rom: { kind: 'seq', addrs: [ITEM_FALL_ANIM] }, padrao: { ticks: [5, 5, 5], loop: true } });
  return m;
}
/** Bola da arena 3 (`render/rom/stages/stage3.ts` ORB_ANIM; repetido aqui porque aquele módulo registra camada ao
 *  ser importado) e cápsula de prêmio caindo da arena 8 (`render/rom/stages/stage8.ts` ITEM_FALL_ANIM). */
const ORB_ANIM = 0xd8d57e;
const ITEM_FALL_ANIM = 0xd8d3af;

/** Sequência de fases da chama (`FLAME_PHASE`, A2 B2 C2 … A1) → ticks de cada trecho; 3 desenhos (A, B, C). */
export function flameTicks(): number[] {
  const out: number[] = [];
  for (let i = 0; i < FLAME_PHASE.length; i++) {
    if (i > 0 && FLAME_PHASE[i] === FLAME_PHASE[i - 1]) out[out.length - 1]++;
    else out.push(1);
  }
  return out;
}

/** Itens que aparecem escondidos nos blocos de alguma arena (`STAGE_ITEMS`), sem o ovo. */
const STAGE_ITEM_IDS = new Set(STAGE_ITEMS.flat().map(([, id]) => id).filter(id => id !== ITEM.EGG));
/** Itens que só voltam ao chão quando alguém morre com eles (status inicial / caça-níquel). */
const DROP_IDS = new Set<number>([ITEM.PIERCE, ITEM.REMOTE, ITEM.PASS_SOFT, ITEM.PASS_BOMB, ITEM.STAR]);

/** Códigos de item que podem ficar no chão: `ITEM` (sem ovo), caveiras `DISEASE` e prêmios do caça-níquel. */
export function groundItemCodes(): number[] {
  const ids = new Set<number>();
  for (const [k, v] of Object.entries(ITEM)) if (k !== 'EGG') ids.add(v);
  for (const v of Object.values(DISEASE)) ids.add(v);
  for (const v of [...A8_L149F, ...A8_L14A9]) ids.add(v);
  return [...ids].sort((a, b) => a - b);
}

function itemInfo(id: number): { desc: string; priority: HdPriority } {
  const itemName = (Object.keys(ITEM) as (keyof typeof ITEM)[]).find(k => ITEM[k] === id);
  const disease = (Object.keys(DISEASE) as (keyof typeof DISEASE)[]).find(k => DISEASE[k] === id);
  if (id === ITEM.SKULL) return { desc: 'Caveira no chão (doença sorteada ao pegar)', priority: 'essencial' };
  if (disease) {
    return { desc: `Caveira de doença "${DISEASE_NAME[disease]}" (no original é o mesmo desenho da caveira $21; pode repetir o recorte)`,
      priority: 'raro' };
  }
  if (itemName) {
    const priority: HdPriority = STAGE_ITEM_IDS.has(id) ? 'essencial' : DROP_IDS.has(id) ? 'bom' : 'raro';
    return { desc: ITEM_NAME[itemName], priority };
  }
  return { desc: `Prêmio especial $${id.toString(16).toUpperCase()} do caça-níquel (arena 8), desenho próprio no original`, priority: 'raro' };
}

/** Elementos especiais das arenas (`stage/<n>/x/<nome>`), tirados de `core/stages/**` e das camadas de render. */
interface Especial { stage: number; nome: string; desc: string; size: readonly [number, number]; anchor: readonly [number, number];
  ritmo: HdRitmo; priority: HdPriority }
function especiais(R: (name: RitmoName) => HdRitmo): Especial[] {
  const still = fromPadrao(STILL, 'parado');
  const loopDe = (n: number, t: number, fonte: string): HdRitmo => fromPadrao({ ticks: Array(n).fill(t), loop: true, distinct: n }, fonte);
  const out: Especial[] = [
    { stage: 2, nome: 'clocks', desc: 'relógios translúcidos da camada de cima, que rola na horizontal (peça de 1 casa que se repete; rápido = rola mais rápido)',
      size: BOX_CELL, anchor: ANCHOR_CELL, ritmo: loopDe(8, 22, 'spec §4.1 (8 quadros × 22 ticks)'), priority: 'bom' },
    { stage: 2, nome: 'gears', desc: 'engrenagens animadas do cenário', size: BOX_CELL, anchor: ANCHOR_CELL,
      ritmo: loopDe(4, 22, 'spec §4.1 (4 quadros × 22 ticks)'), priority: 'raro' },
    { stage: 3, nome: 'orb', desc: 'bola que rola quando a chama a atinge e atordoa quem toca (2 por rodada)', size: BOX_CELL,
      anchor: ANCHOR_CELL, ritmo: R('stage/3/x/orb'), priority: 'essencial' },
    { stage: 5, nome: 'fence', desc: 'cerca elétrica em volta do campo (peça de 1 casa que se repete na borda; dá choque)',
      size: BOX_CELL, anchor: ANCHOR_CELL, ritmo: loopDe(4, 9, 'spec §4.4 (pilar: 4 quadros × 9 ticks)'), priority: 'bom' },
    { stage: 6, nome: 'stripes', desc: 'piso repintado de listras: empurra quem entra na direção em que olha', size: BOX_CELL,
      anchor: ANCHOR_CELL, ritmo: still, priority: 'essencial' },
    { stage: 6, nome: 'skull', desc: 'piso repintado de caveira: inverte os controles de quem pisa', size: BOX_CELL,
      anchor: ANCHOR_CELL, ritmo: still, priority: 'essencial' },
    { stage: 6, nome: 'skulls', desc: 'piso repintado de caveirinhas: bomba chutada para antes dele', size: BOX_CELL,
      anchor: ANCHOR_CELL, ritmo: still, priority: 'essencial' },
  ];
  const arrowDirs = [...new Set(A7_ARROWS.map(([, , w]) => faceToHdDir(w - 0x1cc0)))];
  for (const d of HD_DIRS.filter(x => arrowDirs.includes(x))) {
    out.push({ stage: 7, nome: `arrow-${d}`, desc: `seta no chão apontando para ${DIR_PT[d]}: bomba chutada que passa nela vira para lá`,
      size: BOX_CELL, anchor: ANCHOR_CELL, ritmo: still, priority: 'essencial' });
  }
  out.push(
    { stage: 7, nome: 'bush', desc: 'moita alta que fica POR CIMA de jogadores, bombas e chamas (esconde; deixe frestas/transparência)',
      size: BOX_CELL, anchor: ANCHOR_CELL, ritmo: still, priority: 'essencial' },
    { stage: 8, nome: 'pad', desc: 'botão no chão que liga o caça-níquel (desligado)', size: BOX_CELL, anchor: ANCHOR_CELL,
      ritmo: still, priority: 'essencial' },
    { stage: 8, nome: 'pad-lit', desc: 'botão no chão aceso (máquina girando; pisar freia o rolo)', size: BOX_CELL, anchor: ANCHOR_CELL,
      ritmo: still, priority: 'essencial' },
  );
  for (let k = 0; k < REEL_SYMBOLS; k++) {
    out.push({ stage: 8, nome: `reel-${k}`, desc: `símbolo ${k + 1} de ${REEL_SYMBOLS} do rolo do caça-níquel (3 iguais dão prêmio; o jogo rola a fita)`,
      size: BOX_CELL, anchor: ANCHOR_CELL, ritmo: still, priority: 'bom' });
  }
  out.push(
    { stage: 8, nome: 'prize', desc: 'cápsula de prêmio caindo do alto até a casa', size: BOX_CELL, anchor: ANCHOR_CELL,
      ritmo: R('stage/8/x/prize'), priority: 'bom' },
    { stage: 9, nome: 'seesaw-left-up', desc: 'gangorra de 3 casas com a ponta da esquerda levantada', size: [hd(48), hd(16)],
      anchor: [hd(24), hd(8)], ritmo: still, priority: 'essencial' },
    { stage: 9, nome: 'seesaw-right-up', desc: 'gangorra de 3 casas com a ponta da direita levantada', size: [hd(48), hd(16)],
      anchor: [hd(24), hd(8)], ritmo: still, priority: 'essencial' },
    { stage: 9, nome: 'seesaw-turn', desc: 'gangorra virando (transição de 1–2 ticks, quase reta)', size: [hd(48), hd(16)],
      anchor: [hd(24), hd(8)], ritmo: still, priority: 'bom' },
  );
  return out;
}
/** Símbolos do rolo do caça-níquel (`core/stages/stage8.ts` `sym`, 0..3; spec §4.7). */
const REEL_SYMBOLS = 4;
const DIR_PT: Readonly<Record<HdDir, string>> = { up: 'cima', right: 'a direita', down: 'baixo', left: 'a esquerda' };
const DIR_LABEL: Readonly<Record<HdDir, string>> = { up: '↑ cima', right: '→ direita', down: '↓ baixo', left: '← esquerda' };

/** Ritmo do bloco/pilar animado por arena (spec §4.4–§4.6); o resto das peças fixas é parado. */
function tileRitmo(stage: number, tile: HdTile): HdRitmo {
  const loopDe = (n: number, t: number, fonte: string) => fromPadrao({ ticks: Array(n).fill(t), loop: true, distinct: n }, fonte);
  if (tile === 'burning') {
    return fromPadrao({ ticks: Array(6).fill(BURN_TICKS / 6), loop: false, distinct: 6 }, 'render (6 quadros × 4 ticks = BURN_TICKS)');
  }
  if (tile === 'soft' && stage === 6) return loopDe(4, 9, 'spec §4.5 (4 quadros × 9 ticks)');
  if (tile === 'soft' && stage === 7) return loopDe(4, 12, 'spec §4.6 (12 ticks por quadro)');
  if (tile === 'hard' && stage === 5) return loopDe(4, 9, 'spec §4.4 (pilar: 4 quadros × 9 ticks)');
  return fromPadrao(STILL, 'parado');
}

function build(): HdCatalogEntry[] {
  const out: HdCatalogEntry[] = [];
  const fontes = ritmoFontes();
  const R = (name: RitmoName): HdRitmo => ritmoDe(name, fontes.get(name)!);

  // Personagens: 6 personagens originais do Crown Blast × todas as PlayerAct (× 4 direções, menos `dying`/`victory`).
  CHARACTERS.forEach((ch, c) => {
    for (const act of PLAYER_ACTS) {
      const info = ACT_INFO[act];
      const dirs: (HdDir | undefined)[] = info.dir ? [...HD_DIRS] : [undefined];
      for (const d of dirs) {
        out.push({ key: charKey(c, act, d), group: 'personagens',
          desc: `${ch.name} (personagem ${c}) — ${info.desc}${d ? `, olhando para ${DIR_LABEL[d]}` : ''}`,
          size: BOX_CHAR, anchor: ANCHOR_CHAR, ritmo: R(d ? `char/${act}/${d}` : `char/${act}`), priority: info.priority });
      }
    }
  });

  // Cavaleiros: metade de cima de cada personagem sentado na montaria.
  CHARACTERS.forEach((ch, c) => {
    for (const d of HD_DIRS) {
      out.push({ key: `rider/${c}/${d}`, group: 'cavaleiros',
        desc: `${ch.name} montado (só a metade de cima aparece; apoio no chão como o de pé, corpo já na altura do assento, ${hd(16)} px acima), olhando para ${DIR_LABEL[d]}`,
        size: BOX_CHAR, anchor: ANCHOR_CHAR, ritmo: R(`rider/${d}`), priority: 'bom' });
    }
  });

  // Trajes da arena 10 (item Traje): o jogador fica com outra roupa ao andar/parar.
  for (const c of Object.keys(COSTUME_ANIMS).map(Number)) {
    for (const [mode, label] of [['idle', 'parado'], ['walk', 'andando']] as const) {
      for (const d of HD_DIRS) {
        out.push({ key: `costume/${c}/${mode}/${d}`, group: 'trajes',
          desc: `traje ${c + 1} de ${Object.keys(COSTUME_ANIMS).length} (item Traje, arena 10), ${label}, olhando para ${DIR_LABEL[d]}`,
          size: BOX_CHAR, anchor: ANCHOR_CHAR, ritmo: R(`costume/${c}/${mode}/${d}`), priority: 'bom' });
      }
    }
  }

  // Montarias: 13 tipos (7 normais + 6 da senha 0164) × 3 fases × 4 direções.
  for (const t of MOUNT_TYPES) {
    const normal = MOUNT_TYPES_NORMAL.includes(t);
    for (const ph of MOUNT_PHASES) {
      for (const d of HD_DIRS) {
        const priority: HdPriority = !normal || ph === 'dismount' ? 'raro' : 'bom';
        out.push({ key: mountKey(t, ph, d), group: 'montarias',
          desc: `montaria tipo ${t.toString(16).toUpperCase()} (${isMachine(t) ? 'máquina' : 'criatura'}; ${MOUNT_ABILITY[t]}${normal ? '' : '; só com a senha 0164'}) — ${MOUNT_PHASE_INFO[ph].desc}, olhando para ${DIR_LABEL[d]}. Fica ATRÁS do cavaleiro`,
          size: BOX_MOUNT, anchor: ANCHOR_MOUNT, ritmo: R(`mount/${t.toString(16)}/${ph}/${d}`), priority });
      }
    }
  }

  // Ovos: um por tipo de montaria (no chão e seguindo o jogador como reserva).
  for (const t of MOUNT_TYPES) {
    const normal = MOUNT_TYPES_NORMAL.includes(t);
    out.push({ key: `egg/${t.toString(16)}`, group: 'ovos',
      desc: `ovo da montaria tipo ${t.toString(16).toUpperCase()} (${isMachine(t) ? 'ovo de máquina' : 'ovo comum'}; no chão e seguindo o jogador como reserva)${normal ? '' : ' — só com a senha 0164'}`,
      size: BOX_CELL, anchor: ANCHOR_CELL, ritmo: R(isMachine(t) ? 'egg/machine' : 'egg/normal'), priority: normal ? 'essencial' : 'raro' });
  }

  // Bombas (pulsam em loop; a mesma arte vale chutada, voando e na mão).
  const BOMB_DESC = ['bomba normal (pavio aceso, pulsando)', 'bomba remota (explode no detonador; visual de controle remoto)',
    'bomba perfurante (a chama atravessa blocos)'];
  BOMB_DESC.forEach((desc, t) => out.push({ key: `bomb/${t}`, group: 'bombas', desc, size: BOX_CELL, anchor: ANCHOR_CELL,
    ritmo: R(`bomb/${t}`), priority: t === 0 ? 'essencial' : 'bom' }));

  // Chamas: 7 peças, 3 desenhos (A, B, C) na sequência A2 B2 C2 … A1 (sem loop).
  const ft = flameTicks();
  for (const part of FLAME_PARTS) {
    out.push({ key: `flame/${part}`, group: 'chamas', desc: `chama — ${FLAME_INFO[part]}; 3 desenhos (forte, média, fraca) repetidos na sequência`,
      size: BOX_CELL, anchor: ANCHOR_CELL,
      ritmo: { frames: ft.length, ticks: ft, loop: false, distinct: 3, fonte: 'render (FLAME_PHASE, spec §7.1)' }, priority: 'essencial' });
  }

  // Itens no chão (piscam: a cor de destaque alterna a cada 4 ticks).
  for (const id of groundItemCodes()) {
    const { desc, priority } = itemInfo(id);
    out.push({ key: itemKey(id), group: 'itens', desc: `item no chão — ${desc}`, size: BOX_CELL, anchor: ANCHOR_CELL,
      ritmo: fromPadrao({ ticks: [4, 4], loop: true, distinct: 2 }, 'spec §4.10 (itens piscam a cada 4 ticks)'), priority });
  }

  // Arenas: 7 peças fixas em cada uma das 10 + elementos especiais.
  STAGE_NAMES.forEach((name, i) => {
    const n = i + 1;
    for (const tile of HD_TILES) {
      const noBlocks = n === 5 && (tile === 'soft' || tile === 'burning');   // arena 5: sem blocos (spec §4.4)
      const priority: HdPriority = noBlocks ? 'raro' : tile === 'pressure' ? 'bom' : 'essencial';
      out.push({ key: stageKey(n, tile), group: 'arenas', desc: `arena ${n} "${name}" — ${TILE_INFO[tile]}${noBlocks ? ' (esta arena começa sem blocos)' : ''}`,
        size: BOX_CELL, anchor: ANCHOR_CELL, ritmo: tileRitmo(n, tile), priority });
    }
  });
  for (const e of especiais(R)) {
    out.push({ key: `stage/${e.stage}/x/${e.nome}`, group: 'arenas', desc: `arena ${e.stage} "${STAGE_NAMES[e.stage - 1]}" — ${e.desc}`,
      size: e.size, anchor: e.anchor, ritmo: e.ritmo, priority: e.priority });
  }

  // HUD (faixa de cima, 24 px no original): canto de cima à esquerda vai na posição do original.
  const still = fromPadrao(STILL, 'parado');
  const hud = (key: string, desc: string, size: readonly [number, number], priority: HdPriority = 'essencial') =>
    out.push({ key, group: 'hud', desc, size, anchor: TOP_LEFT, ritmo: still, priority });
  hud('hud/bar', 'fundo da faixa do placar (largura da tela toda)', [hd(256), hd(24)]);
  hud('hud/clock', 'ícone do relógio ao lado do tempo', [hd(16), hd(24)]);
  for (let d = 0; d <= 9; d++) hud(`hud/digit/${d}`, `algarismo ${d} do relógio`, [hd(8), hd(24)]);
  hud('hud/colon', 'dois-pontos do relógio', [hd(8), hd(24)]);
  hud('hud/infinity', 'símbolo ∞ (tempo infinito), no lugar dos algarismos', [hd(24), hd(24)], 'bom');
  CHARACTERS.forEach((ch, c) => hud(`hud/head/${c}`, `rosto de ${ch.name} no placar`, [hd(16), hd(24)]));
  for (let n = 0; n <= MAX_CROWNS; n++) hud(`hud/crown/${n}`, `contador de coroas com ${n} vitória(s)`, [hd(8), hd(8)]);

  // Efeitos.
  const fx = (key: string, desc: string, size: readonly [number, number], anchor: readonly [number, number], ritmo: HdRitmo,
    priority: HdPriority) => out.push({ key, group: 'efeitos', desc, size, anchor, ritmo, priority });
  fx('fx/pressure-block', 'bloco da pressão caindo do alto (8 px/tick no original)', BOX_CELL, ANCHOR_CELL, still, 'bom');
  fx('fx/pressure-shadow', 'sombra no chão onde o bloco da pressão vai cair', BOX_CELL, ANCHOR_CELL, still, 'bom');
  fx('fx/item-burn', 'item queimando na chama (sem loop; depois vira piso)', BOX_CELL, ANCHOR_CELL,
    fromPadrao({ ticks: [4, 4, 4, 4, 4], loop: false, distinct: 5 }, 'render (5 quadros × 4 ticks)'), 'bom');
  fx('fx/egg-burst', 'ovo estourando (ovo reserva queimado e fim do remonte)', BOX_BIG, ANCHOR_BIG_CENTER, R('fx/egg-burst'), 'bom');
  fx('fx/egg-glow', 'ovo reserva brilhando e pulando até o jogador no remonte (antes de estourar)', BOX_CELL, ANCHOR_CELL,
    fromPadrao({ ticks: REMOUNT_GLOW_STAGE_TICKS, loop: false, distinct: 2 }, 'ROM medida (REMOUNT_GLOW_STAGE_TICKS)'), 'raro');
  fx('fx/dance-notes', 'notas musicais em volta de quem foi acertado pela montaria F', BOX_CHAR, ANCHOR_CHAR,
    fromPadrao({ ticks: DANCE_NOTE_FRAME_TICKS, loop: false, distinct: 4 }, 'ROM medida (DANCE_NOTE_FRAME_TICKS)'), 'bom');
  for (const d of HD_DIRS) {
    fx(`fx/missile/${d}`, `montaria D lançada como míssil, voando para ${DIR_PT[d]}`, BOX_CELL, ANCHOR_CELL, R('fx/missile'), 'bom');
  }
  fx('fx/slow-shot', 'tiro lento da montaria E, em voo', BOX_CELL, ANCHOR_CELL, R('fx/slow-shot'), 'bom');
  fx('fx/slow-cloud', 'nuvem do tiro lento (deixa lento quem toca)', BOX_BIG, ANCHOR_BIG_CENTER, R('fx/slow-cloud'), 'bom');
  fx('fx/sleep-note', 'nota musical da montaria F, em voo', BOX_CELL, ANCHOR_CELL, R('fx/sleep-note'), 'bom');
  return out;
}
/** Coroas para vencer vão de 1 a 5 (`Rules.matches`): o placar mostra 0..5. */
const MAX_CROWNS = 5;

export const HD_CATALOG: readonly HdCatalogEntry[] = build();
export const HD_CATALOG_BY_KEY: ReadonlyMap<HdKey, HdCatalogEntry> = new Map(HD_CATALOG.map(e => [e.key, e]));

export interface HdGroupCount { group: HdGroup; total: number; essencial: number; bom: number; raro: number }
/** Quantos desenhos por grupo e prioridade. */
export function countByGroup(entries: readonly HdCatalogEntry[] = HD_CATALOG): HdGroupCount[] {
  return HD_GROUPS.map(group => {
    const g = entries.filter(e => e.group === group);
    return { group, total: g.length, essencial: g.filter(e => e.priority === 'essencial').length,
      bom: g.filter(e => e.priority === 'bom').length, raro: g.filter(e => e.priority === 'raro').length };
  });
}

/** Folha (imagem) sugerida para cada desenho no pacote-modelo: uma por personagem, montaria e arena; uma por grupo
 *  no resto. */
export function modelSheet(e: HdCatalogEntry): string {
  const [head, a] = e.key.split('/');
  if (head === 'char') return `personagem-${a}`;
  if (head === 'mount') return `montaria-${a}`;
  if (head === 'stage') return `arena-${a}`;
  return e.group;
}

/** Manifesto-modelo com TODAS as chaves do catálogo: cada desenho numa linha da sua folha, um recorte por quadro
 *  recomendado (lado a lado), com o apoio e os ticks recomendados. `sheets` = tamanho de cada folha. */
export function modelManifest(catalog: readonly HdCatalogEntry[] = HD_CATALOG): { manifest: HdManifest; sheets: Map<string, { w: number; h: number }> } {
  const sheets = new Map<string, { w: number; h: number }>();
  const anims: Record<HdKey, HdAnim> = {};
  for (const e of catalog) {
    const id = modelSheet(e);
    const sh = sheets.get(id) ?? { w: 0, h: 0 };
    const [w, h] = e.size;
    const y = sh.h;
    anims[e.key] = {
      frames: e.ritmo.ticks.map((_, i) => ({ img: id, rect: [i * w, y, w, h] as const, anchor: e.anchor })),
      ticks: e.ritmo.ticks, loop: e.ritmo.loop,
    };
    sheets.set(id, { w: Math.max(sh.w, e.ritmo.ticks.length * w), h: y + h });
  }
  const images = Object.fromEntries([...sheets.keys()].map(id => [id, `${id}.png`]));
  return {
    manifest: { format: 1, name: 'modelo', credits: 'PREENCHA: autor(es) da arte original', license: 'PREENCHA: licença da arte',
      cell: HD_CELL, images, anims },
    sheets,
  };
}
