// Jogador montado, montando, desmontando/remontando ou dançando (T14, spec §7.4).
// T14b: notas da dança (mont. F) e "ovo brilhando → explosão → montaria" do remonte — objetos OAM independentes
// (não peças de RIDER_ANIMS/DANCE_ANIMS/REMOUNT_ANIMS; ver facts.ts DANCE_NOTE_ANIMS/REMOUNT_GLOW_ANIMS e o
// relatório da T14b). Ambos são "objetos comuns" (piecePx role 'common', paleta 7), como ovo/reserva/projétil.
import type { Player } from '../../../core/types';
import type { RomAssets } from '../../../rom/types';
import type { AnimFrame, Piece } from '../../../rom/types';
import type { ObjEntry } from '../../ppu/types';
import type { RomPlayerHook } from '../../battle-layers';
import { rider } from '../../../core/mounts/types';
import {
  RIDER_ANIMS, MOUNT_ANIMS, DISMOUNT_ANIMS,
  REMOUNT_ANIMS, REMOUNT_MOUNT_ANIMS, DANCE_ANIMS, DANCE_NOTE_ANIMS, DANCE_NOTE_TICKS,
  DANCE_NOTE_FRAME_TICKS, REMOUNT_GLOW_ANIMS, REMOUNT_GLOW_STAGE_TICKS, MOUNT_GFX,
} from './facts';
import { sampleSeq, piecePx, fallbackMountFrame, playerCellXY, COMMON_BASE_TILE } from './gfx';
import { commonPieces } from './sprites';
import { sampleAnim } from '../../anim/sample';
import { playerAnimRef, resolveAnim } from '../../anim/player-anim';
import { smallFramePx } from '../sprites';

/** Paleta OBJ do slot do jogador (P1..P5), [ANI/spec §7.4]. */
const PLAYER_OBJ_PAL = [0, 1, 4, 5, 6] as const;
/** Paleta OBJ dos objetos comuns (ovo/decoração), igual à de ovo/reserva/projétil [spec §7.2]. */
const COMMON_PAL = 7;

/** Giro do atordoamento montado: troca de direção a cada 2^STUN_SPIN_SHIFT = 4 ticks. */
const STUN_SPIN_SHIFT = 2;

function dirIdxOf(face: number): 0 | 1 | 2 | 3 {
  return (((face >> 1) & 3) as 0 | 1 | 2 | 3);
}

/** `mx`/`my` do quadro somam à posição da peça — deslocamento só visual [spec §7.4]. É o que faz o jogador "pular"
 *  durante `mounting`/`remount` (a montaria fica parada porque seu próprio quadro, congelado, tem `mx=my=0`).
 *  Quem chama passa o quadro de `seqFrame`, com `mx`/`my` já acumulados. */
function pxEntry(px: Uint8Array, X: number, Y: number, pal: number, fr: AnimFrame, piece: Piece): ObjEntry {
  return { x: X + piece.dx + fr.mx, y: Y + piece.dy + fr.my, size: piece.big ? 32 : 16, pal, prio: 2, hflip: piece.hflip, vflip: piece.vflip, src: { px } };
}

/** Todas as peças do quadro (não só a 1ª): `tile >= COMMON_BASE_TILE` é sempre objeto comum (`objCommon`, paleta
 *  OBJ 7 — mesma regra de `sprites.ts` para ovo/reserva/projétil); as demais usam o papel do chamador (personagem
 *  ou montaria) com a paleta do slot/vaga. Fix round 2 (T14): nenhuma tabela medida hoje empacota mais de 1 peça
 *  por quadro (conferido com `ASSETS.anim(addr)` em todas as tabelas de personagem/montaria) — as peças extras da
 *  fixture da T4 (dança, remonte) são objetos OAM separados que a T4 agregou por raio, não peças destes quadros;
 *  ver relatório da T14. Este código já trata corretamente qualquer peça extra que uma tabela venha a empacotar. */
function entriesFor(a: RomAssets, stage: number, X: number, Y: number, fr: AnimFrame, role: 'char' | 'mount', roleId: number, rolePal: number): ObjEntry[] {
  const ctx = role === 'char' ? { role: 'char' as const, char: roleId, stage } : { role: 'mount' as const, type: roleId, stage };
  return fr.pieces.map(piece => {
    const pal = piece.tile >= COMMON_BASE_TILE ? COMMON_PAL : rolePal;   // piecePx() redireciona a peça (tile absoluto) para objCommon
    return pxEntry(piecePx(a, piece, ctx), X, Y, pal, fr, piece);
  });
}

function charPieces(a: RomAssets, stage: number, p: Player, X: number, Y: number, pal: number, fr: AnimFrame): ObjEntry[] {
  return entriesFor(a, stage, X, Y, fr, 'char', p.char, pal);
}

/** Plano B: `MOUNT_GFX[type].format === 'unknown'` — varrer a ROM pelos `pxSha1` medidos não é permitido em tempo
 *  de execução (spec §"Plano B" da T14). A montaria sai da arte por código do fallback (`fallbackMountFrame`), com
 *  a posição/tamanho do próprio fallback (ignora `fr`: não há quadro de ROM confiável para essa montaria). */
function mountPieces(a: RomAssets, stage: number, type: number, face: 0 | 2 | 4 | 6, step: 0 | 1, X: number, Y: number, pal: number, fr: AnimFrame): ObjEntry[] {
  if (MOUNT_GFX[type].format === 'unknown') {
    const { px } = fallbackMountFrame(type, face, step);
    return [{ x: X - 16, y: Y - 18, size: 32, pal, prio: 2, hflip: false, vflip: false, src: { px } }];
  }
  return entriesFor(a, stage, X, Y, fr, 'mount', type, pal);
}

/** Pulo para a montaria (fase `mounting`, 43 ticks no core): espera, arco e o resto já sentado. */
const JUMP_WAIT = 6;
const JUMP_TICKS = 30;
const JUMP_PEAK = 14;    // px acima da reta entre o chão e o assento
const SEAT_RISE = 16;    // px: o personagem montado fica 16 px acima do de pé (dy −40 × −24 na OAM medida)
const MOUNT_FADE = 16;   // ticks da montaria surgindo embaixo (piscando e subindo)
const MOUNT_RISE = 6;    // px que ela sobe enquanto surge

/** Personagem na pose parada olhando para `p.face` (mesmo desenho do jogador a pé, `drawFrame` de ../sprites). */
function standPieces(a: RomAssets, p: Player, X: number, Y: number, pal: number): ObjEntry[] {
  const { ref } = playerAnimRef({ act: 'idle', face: p.face, char: p.char, moving: false }, 0);
  const { frame, ox, oy } = sampleAnim(resolveAnim(a, ref, p.char), 0);
  const ch = a.character(p.char);
  return frame.pieces.map(pc => {
    const full = ch.frame(pc.tile);
    return { x: X + pc.dx + ox, y: Y + pc.dy + oy, size: pc.big ? 32 : 16, pal: (pal + pc.palAdd) & 7, prio: 2,
      hflip: pc.hflip, vflip: pc.vflip, src: { px: pc.big ? full : smallFramePx(full) } };
  });
}

/** Quadro de `sampleSeq` com `mx`/`my` trocados pelo acumulado (`ox`/`oy`), para o arco do pulo sair contínuo. */
function seqFrame(a: RomAssets, addrs: readonly number[], t: number): AnimFrame {
  const { frame, ox, oy } = sampleSeq(a, addrs, t);
  return { ...frame, mx: ox, my: oy };
}

/** Índice do quadro em `ticks` (duração medida de cada quadro, não a `dur` da própria tabela) para um `t` dado —
 *  T14b: a captura das notas da dança começa no tick em que o jogador entra na rotina de dança, que já é alguns
 *  ticks depois do objeto da nota ter entrado no quadro 0 da explosão (`DANCE_NOTE_FRAME_TICKS[0]` mais curto que
 *  os outros, medido); por isso não dá para usar `sampleSeq` (que assume um `t` alinhado ao início da tabela). */
function frameAtTicks(ticks: readonly number[], t: number): number {
  let acc = 0;
  for (let i = 0; i < ticks.length; i++) { acc += ticks[i]; if (t < acc) return i; }
  return ticks.length - 1;
}

/** Anda 1 px/tick de `from` até `to` (por eixo), parando exatamente no alvo — medido no remonte (T14b): o "ovo
 *  brilhando" fecha os 16 px de 1 casa em 16 ticks a 1 px/tick, não numa interpolação proporcional à duração do
 *  quadro. `ticks` já deve ser 0 antes do 1º tick de movimento (então o 1º passo dá `from + 1`, como medido). */
function step1px(from: number, to: number, ticks: number): number {
  if (ticks <= 0 || from === to) return from;
  const d = to - from;
  const dist = Math.min(Math.abs(d), ticks);
  return from + Math.sign(d) * dist;
}

/** Duração da explosão do ovo reserva: `$D8:D327` tem 4 quadros × 10 ticks (decodificado na ROM, revisão final I2). */
export const REMOUNT_BURST_TICKS = 40;
/** Fim do objeto do ovo reserva no remonte: brilha + anda (REMOUNT_GLOW_STAGE_TICKS = 16 + 15) + explosão (40) = 71. */
export const REMOUNT_FX_END = REMOUNT_GLOW_STAGE_TICKS[0] + REMOUNT_GLOW_STAGE_TICKS[1] + REMOUNT_BURST_TICKS;

/** T14b: as 3 fases do "ovo brilhando" do remonte. Fases (medidas): brilha parado na casa de origem (`origin`,
 *  1 casa atrás — mesma referência da reserva em `sprites.ts`) por `REMOUNT_GLOW_STAGE_TICKS[0]` ticks (o gráfico)
 *  enquanto "pula" 1 px/tick até (X, Y) (o movimento, medido à parte — continua no início da explosão até chegar) →
 *  estoura em (X, Y) (mesma tabela usada pelas notas da dança). Revisão final I2: a ancoragem vem do marcador
 *  `r.remountFx` do core (t0, origem, posição no acerto), então a explosão continua depois que o core volta a
 *  `riding` (t = 52) e fica no lugar onde estourou mesmo que o jogador ande; some em t = REMOUNT_FX_END (71). */
function remountGlowPieces(a: RomAssets, stage: number, origin: number | undefined, t: number, X: number, Y: number): ObjEntry[] {
  if (t < 0 || t >= REMOUNT_FX_END) return [];
  const { X: oX, Y: oY } = origin === undefined ? { X, Y } : playerCellXY(origin);
  const [aTicks, bTicks] = REMOUNT_GLOW_STAGE_TICKS;
  const gx = step1px(oX, X, t - aTicks + 1), gy = step1px(oY, Y, t - aTicks + 1);
  const addr = t < aTicks ? REMOUNT_GLOW_ANIMS[0] : t < aTicks + bTicks ? REMOUNT_GLOW_ANIMS[1] : REMOUNT_GLOW_ANIMS[2];
  const lt = t < aTicks ? t : t < aTicks + bTicks ? t - aTicks : t - aTicks - bTicks;
  const { frame: fr } = sampleSeq(a, [addr], lt);
  return commonPieces(a, stage, gx, gy, fr).map(m => m.e);
}

/** Brilho/explosão do remonte a partir do marcador do core; sem marcador (estado montado à mão), cai no t0 da fase e
 *  na trilha atual, como na T14b. */
function remountFxPieces(a: RomAssets, stage: number, r: NonNullable<ReturnType<typeof rider>>, frame: number, X: number, Y: number): ObjEntry[] {
  const f = r.remountFx;
  if (f) return remountGlowPieces(a, stage, f.origin, frame - f.t0, Math.floor(f.x / 256), Math.floor(f.y / 256));
  if (r.phase !== 'dismount' || !r.remount) return [];
  return remountGlowPieces(a, stage, r.trail[1] ?? r.trail[0], frame - r.t0, X, Y);
}

// `frame` = visualTick (5º argumento, tick do core congelado no TIME UP; sem ele, o quadro do host) — base de `actT0`/`t0` (T16).
// T14b: notas/brilho também usam esse `frame` (visualTick), não `hostFrame` — congelam junto com o resto no TIME UP.
export const riderHook: RomPlayerHook = (s, p, a, hostFrame, frame = hostFrame) => {
  const r = rider(p);
  const X = Math.floor(p.x / 256), Y = Math.floor(p.y / 256);
  const pal = PLAYER_OBJ_PAL[p.slot] ?? 0;

  /** T14b: notas do acerto (mont. F) — objeto próprio que nasce no tick do acerto e dura só os ticks medidos
   *  (facts.ts DANCE_NOTE_TICKS), ancorado na posição do próprio jogador. */
  const notes = (): ObjEntry[] => {
    const t = frame - p.actT0;
    if (t < 0 || t >= DANCE_NOTE_TICKS) return [];
    const nfr = (a.anim(DANCE_NOTE_ANIMS[0]) as AnimFrame[])[frameAtTicks(DANCE_NOTE_FRAME_TICKS, t)];
    return commonPieces(a, s.stage, X, Y, nfr).map(m => m.e);
  };

  // Na mão da luva de outro (ou arremessado): sentado, com a pose de montado da ROM (já SEAT_RISE px mais alta que a
  // de pé, por isso desce SEAT_RISE para ficar na altura z de quem está na mão).
  // Largado da luva: o mesmo pulo de quem perde a montaria ($C2:10D5), a partir da cabeça de quem segurava
  if (!r && p.act === 'dropped') return charPieces(a, s.stage, p, X, Y, pal, seqFrame(a, DISMOUNT_ANIMS, frame - p.actT0));
  if (!r && p.act === 'held') {
    return charPieces(a, s.stage, p, X, Y - p.z + SEAT_RISE, pal, seqFrame(a, RIDER_ANIMS[0x2][dirIdxOf(p.face)].idle, 0));
  }
  if (!r) return p.act === 'dance' ? [...charPieces(a, s.stage, p, X, Y, pal, seqFrame(a, DANCE_ANIMS, frame - p.actT0)), ...notes()] : null;

  const mountPal = 1 + (r.slot || 1);
  const face = (p.face & 6) as 0 | 2 | 4 | 6;
  const step: 0 | 1 = p.moveDir !== 8 ? ((frame >> 3) & 1) as 0 | 1 : 0;

  if (r.phase === 'riding') {
    // Atordoado ou no soneca (mont. F) montado: jogador e montaria giram juntos (sentido horário, 1 direção a cada
    // 4 ticks); no soneca, as notas do acerto ficam embaixo, no jogador.
    const spinning = p.act === 'stunned' || p.act === 'dance';
    const dirIdx = spinning ? ((dirIdxOf(p.face) + ((frame - p.actT0) >> STUN_SPIN_SHIFT)) & 3) as 0 | 1 | 2 | 3 : dirIdxOf(p.face);
    const face = (dirIdx << 1) as 0 | 2 | 4 | 6;
    const walking = !spinning && p.moveDir !== 8;
    const riderList = walking ? RIDER_ANIMS[r.type][dirIdx].walk : RIDER_ANIMS[r.type][dirIdx].idle;
    const mountList = walking ? MOUNT_ANIMS[r.type][dirIdx].walk : MOUNT_ANIMS[r.type][dirIdx].idle;
    const t = frame - p.actT0;
    const rf = seqFrame(a, riderList, t), mf = seqFrame(a, mountList, t);
    return [...charPieces(a, s.stage, p, X, Y, pal, rf), ...mountPieces(a, s.stage, r.type, face, step, X, Y, mountPal, mf),
      ...(p.act === 'dance' ? notes() : []),
      ...remountFxPieces(a, s.stage, r, frame, X, Y)];   // I2: explosão do remonte ainda no ar (t < 71)
  }

  const t = frame - r.t0;
  if (r.phase === 'mounting') {
    // A montaria aparece embaixo desde o 1º tick, virada para o lado em que o ovo foi pego; o personagem, olhando
    // para o mesmo lado, espera JUMP_WAIT, pula em arco por JUMP_TICKS e cai sentado (pose montada da ROM).
    const dirIdx = dirIdxOf(p.face);
    // Surge piscando (1 em 4 quadros, depois 1 em 2, depois fixa) e subindo MOUNT_RISE px até o lugar.
    const shown = t >= MOUNT_FADE || (t < MOUNT_FADE / 2 ? (t & 3) === 0 : (t & 1) === 0);
    const rise = Math.round(MOUNT_RISE * Math.max(0, 1 - t / MOUNT_FADE));
    const mount = shown
      ? mountPieces(a, s.stage, r.type, face, 0, X, Y + rise, mountPal, seqFrame(a, MOUNT_ANIMS[r.type][dirIdx].idle, t)) : [];
    const u = (t - JUMP_WAIT) / JUMP_TICKS;
    if (u < 1) {
      const k = Math.max(0, u);
      const dy = Math.round(-SEAT_RISE * k - JUMP_PEAK * 4 * k * (1 - k));
      return [...standPieces(a, p, X, Y + dy, pal), ...mount];
    }
    const rf = seqFrame(a, RIDER_ANIMS[r.type][dirIdx].idle, t - JUMP_WAIT - JUMP_TICKS);
    return [...charPieces(a, s.stage, p, X, Y, pal, rf), ...mount];
  }

  // dismount
  if (r.remount) {
    const rf = seqFrame(a, REMOUNT_ANIMS, t);
    const mf = seqFrame(a, REMOUNT_MOUNT_ANIMS, t);
    const out = [...charPieces(a, s.stage, p, X, Y, pal, rf), ...mountPieces(a, s.stage, r.type, face, step, X, Y, mountPal, mf)];
    // T14b: o próprio ovo reserva "brilha" na casa de origem, "pula" até o jogador e estoura, revelando a
    // montaria — não nasce outro objeto (facts.ts REMOUNT_GLOW_ANIMS/REMOUNT_GLOW_STAGE_TICKS).
    out.push(...remountFxPieces(a, s.stage, r, frame, X, Y));
    return out;
  }
  const rf = seqFrame(a, DISMOUNT_ANIMS, t);
  return charPieces(a, s.stage, p, X, Y, pal, rf);
};
