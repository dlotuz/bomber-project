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
  RIDER_ANIMS, MOUNT_ANIMS, MOUNTING_ANIMS, MOUNTING_MOUNT_ANIMS, DISMOUNT_ANIMS,
  REMOUNT_ANIMS, REMOUNT_MOUNT_ANIMS, DANCE_ANIMS, DANCE_NOTE_ANIMS, DANCE_NOTE_TICKS,
  DANCE_NOTE_FRAME_TICKS, REMOUNT_GLOW_ANIMS, REMOUNT_GLOW_STAGE_TICKS, MOUNT_GFX,
} from './facts';
import { sampleSeq, piecePx, fallbackMountFrame, playerCellXY, COMMON_BASE_TILE } from './gfx';
import { commonPieces } from './sprites';

/** Paleta OBJ do slot do jogador (P1..P5), [ANI/spec §7.4]. */
const PLAYER_OBJ_PAL = [0, 1, 4, 5, 6] as const;
/** Paleta OBJ dos objetos comuns (ovo/decoração), igual à de ovo/reserva/projétil [spec §7.2]. */
const COMMON_PAL = 7;

function dirIdxOf(face: number): 0 | 1 | 2 | 3 {
  return (((face >> 1) & 3) as 0 | 1 | 2 | 3);
}

/** `mx`/`my` do quadro somam à posição da peça — deslocamento só visual [spec §7.4]. É o que faz o jogador "pular"
 *  durante `mounting`/`remount` (a montaria fica parada porque seu próprio quadro, congelado, tem `mx=my=0`). */
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

/** T14b: as 3 fases do "ovo brilhando" do remonte, ancoradas só em estado do core (`r.trail`, posição atual do
 *  jogador) — sem estado novo. Fases (medidas): brilha parado na casa de origem (`r.trail[1]`, 1 casa atrás —
 *  mesma referência da reserva em `sprites.ts`) por `REMOUNT_GLOW_STAGE_TICKS[0]` ticks (o gráfico) enquanto
 *  "pula" 1 px/tick até a posição do jogador (o movimento, medido à parte — continua no início da explosão até
 *  chegar) → estoura na posição do jogador (mesma tabela usada pelas notas da dança). REMOUNT_TICKS do core (45)
 *  já corta a fase antes do fim medido da explosão sozinho (~71 ticks na ROM) — ver relatório da T14b. */
function remountGlowPieces(a: RomAssets, stage: number, trail: number[], t: number, X: number, Y: number): ObjEntry[] {
  const origin = trail[1] ?? trail[0];
  const { X: oX, Y: oY } = origin === undefined ? { X, Y } : playerCellXY(origin);
  const [aTicks, bTicks] = REMOUNT_GLOW_STAGE_TICKS;
  const gx = step1px(oX, X, t - aTicks + 1), gy = step1px(oY, Y, t - aTicks + 1);
  const addr = t < aTicks ? REMOUNT_GLOW_ANIMS[0] : t < aTicks + bTicks ? REMOUNT_GLOW_ANIMS[1] : REMOUNT_GLOW_ANIMS[2];
  const lt = t < aTicks ? t : t < aTicks + bTicks ? t - aTicks : t - aTicks - bTicks;
  const { frame: fr } = sampleSeq(a, [addr], lt);
  return commonPieces(a, stage, gx, gy, fr).map(m => m.e);
}

export const riderHook: RomPlayerHook = (s, p, a, frame) => {
  const r = rider(p);
  const X = Math.floor(p.x / 256), Y = Math.floor(p.y / 256);
  const pal = PLAYER_OBJ_PAL[p.slot] ?? 0;

  if (!r) {
    if (p.act !== 'dance') return null;
    const t = frame - p.actT0;
    const { frame: fr } = sampleSeq(a, DANCE_ANIMS, t);
    const out = charPieces(a, s.stage, p, X, Y, pal, fr);
    // T14b: notas do acerto (mont. F) — objeto próprio que nasce no tick do acerto e dura só os ticks medidos
    // (facts.ts DANCE_NOTE_TICKS), ancorado na posição do próprio jogador dançando.
    if (t >= 0 && t < DANCE_NOTE_TICKS) {
      const nfr = (a.anim(DANCE_NOTE_ANIMS[0]) as AnimFrame[])[frameAtTicks(DANCE_NOTE_FRAME_TICKS, t)];
      out.push(...commonPieces(a, s.stage, X, Y, nfr).map(m => m.e));
    }
    return out;
  }

  const mountPal = 1 + (r.slot || 1);
  const face = (p.face & 6) as 0 | 2 | 4 | 6;
  const step: 0 | 1 = p.moveDir !== 8 ? ((frame >> 3) & 1) as 0 | 1 : 0;

  if (r.phase === 'riding') {
    const dirIdx = dirIdxOf(p.face);
    const walking = p.moveDir !== 8;
    const riderList = walking ? RIDER_ANIMS[r.type][dirIdx].walk : RIDER_ANIMS[r.type][dirIdx].idle;
    const mountList = walking ? MOUNT_ANIMS[r.type][dirIdx].walk : MOUNT_ANIMS[r.type][dirIdx].idle;
    const t = frame - p.actT0;
    const rf = sampleSeq(a, riderList, t).frame, mf = sampleSeq(a, mountList, t).frame;
    return [...charPieces(a, s.stage, p, X, Y, pal, rf), ...mountPieces(a, s.stage, r.type, face, step, X, Y, mountPal, mf)];
  }

  const t = frame - r.t0;
  if (r.phase === 'mounting') {
    const rf = sampleSeq(a, MOUNTING_ANIMS[r.type], t).frame;
    const mf = sampleSeq(a, MOUNTING_MOUNT_ANIMS[r.type], t).frame;
    return [...charPieces(a, s.stage, p, X, Y, pal, rf), ...mountPieces(a, s.stage, r.type, face, step, X, Y, mountPal, mf)];
  }

  // dismount
  if (r.remount) {
    const rf = sampleSeq(a, REMOUNT_ANIMS, t).frame;
    const mf = sampleSeq(a, REMOUNT_MOUNT_ANIMS, t).frame;
    const out = [...charPieces(a, s.stage, p, X, Y, pal, rf), ...mountPieces(a, s.stage, r.type, face, step, X, Y, mountPal, mf)];
    // T14b: o próprio ovo reserva "brilha" na casa de origem, "pula" até o jogador e estoura, revelando a
    // montaria — não nasce outro objeto (facts.ts REMOUNT_GLOW_ANIMS/REMOUNT_GLOW_STAGE_TICKS). O core não guarda
    // a posição da origem além de `r.trail` (§7.2, mesma referência usada para os reservas em sprites.ts).
    if (t >= 0) out.push(...remountGlowPieces(a, s.stage, r.trail, t, X, Y));
    return out;
  }
  const rf = sampleSeq(a, DISMOUNT_ANIMS, t).frame;
  return charPieces(a, s.stage, p, X, Y, pal, rf);
};
