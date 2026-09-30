// gerado por analise/investigacao/montarias-e-telas/mount_render_facts.py — não editar
// ROM SHA-1 38f4394986bd39fcbe32a722a3fe103ee6177d9b
export interface DirAnims { walk: number[]; idle: number[] }   // ↑ → ↓ ← (índices 0..3)
export const RIDER_ANIMS: Record<number, DirAnims[]> = {
  0x2: [{ walk: [0xd8172c], idle: [0xd816da] }, { walk: [0xd81713], idle: [0xd816d3] }, { walk: [0xd816e1], idle: [0xd816c5] }, { walk: [0xd816fa], idle: [0xd816cc] }],
  0x3: [{ walk: [0xd8172c], idle: [0xd816da] }, { walk: [0xd81713], idle: [0xd816d3] }, { walk: [0xd816e1], idle: [0xd816c5] }, { walk: [0xd816fa], idle: [0xd816cc] }],
  0xa: [{ walk: [0xd8172c], idle: [0xd816da] }, { walk: [0xd81713], idle: [0xd816d3] }, { walk: [0xd816e1], idle: [0xd816c5] }, { walk: [0xd816fa], idle: [0xd816cc] }],
  0xc: [{ walk: [0xd8172c], idle: [0xd816da] }, { walk: [0xd81713], idle: [0xd816d3] }, { walk: [0xd816e1], idle: [0xd816c5] }, { walk: [0xd816fa], idle: [0xd816cc] }],
  0xd: [{ walk: [0xd8172c], idle: [0xd816da] }, { walk: [0xd81713], idle: [0xd816d3] }, { walk: [0xd816e1], idle: [0xd816c5] }, { walk: [0xd816fa], idle: [0xd816cc] }],
  0xe: [{ walk: [0xd8172c], idle: [0xd816da] }, { walk: [0xd81713], idle: [0xd816d3] }, { walk: [0xd816e1], idle: [0xd816c5] }, { walk: [0xd816fa], idle: [0xd816cc] }],
  0xf: [{ walk: [0xd8172c], idle: [0xd816da] }, { walk: [0xd81713], idle: [0xd816d3] }, { walk: [0xd816e1], idle: [0xd816c5] }, { walk: [0xd816fa], idle: [0xd816cc] }],
};
// 2ª animação do objeto do jogador (+$38, guarda endereço + 1 como +$08): desenha a montaria (tile $008 do P1, folha MOUNT_GFX[tipo]).
export const MOUNT_ANIMS: Record<number, DirAnims[]> = {
  0x2: [{ walk: [0xd835fa], idle: [0xd835de] }, { walk: [0xd83613], idle: [0xd835e5] }, { walk: [0xd8362c], idle: [0xd835ec] }, { walk: [0xd83645], idle: [0xd835f3] }],
  0x3: [{ walk: [0xd82e42], idle: [0xd82e26] }, { walk: [0xd82e5b], idle: [0xd82e2d] }, { walk: [0xd82e74], idle: [0xd82e34] }, { walk: [0xd82e8d], idle: [0xd82e3b] }],
  0xa: [{ walk: [0xd83848], idle: [0xd83848] }, { walk: [0xd83848], idle: [0xd83848] }, { walk: [0xd83848], idle: [0xd83848] }, { walk: [0xd83848], idle: [0xd83848] }],
  0xc: [{ walk: [0xd85d9d], idle: [0xd85d81] }, { walk: [0xd85db6], idle: [0xd85d88] }, { walk: [0xd85dcf], idle: [0xd85d8f] }, { walk: [0xd85de8], idle: [0xd85d96] }],
  0xd: [{ walk: [0xd87978], idle: [0xd8795c] }, { walk: [0xd87991], idle: [0xd87963] }, { walk: [0xd879aa], idle: [0xd8796a] }, { walk: [0xd879c3], idle: [0xd87971] }],
  0xe: [{ walk: [0xd897b2], idle: [0xd89796] }, { walk: [0xd897cb], idle: [0xd8979d] }, { walk: [0xd897e4], idle: [0xd897a4] }, { walk: [0xd897fd], idle: [0xd897ab] }],
  0xf: [{ walk: [0xd893f5], idle: [0xd893d9] }, { walk: [0xd8940e], idle: [0xd893e0] }, { walk: [0xd89427], idle: [0xd893e7] }, { walk: [0xd89440], idle: [0xd893ee] }],
};
export const MOUNTING_MOUNT_ANIMS: Record<number, number[]> = {0x2: [0xd835ec], 0x3: [0xd82e34], 0xa: [0xd83848], 0xc: [0xd85d8f], 0xd: [0xd8796a], 0xe: [0xd897a4], 0xf: [0xd893e7]};
export const MOUNTING_ANIMS: Record<number, number[]> = {0x2: [0xd81745, 0xd816c5], 0x3: [0xd81745, 0xd816c5], 0xa: [0xd81745, 0xd816c5], 0xc: [0xd81745, 0xd816c5], 0xd: [0xd81745, 0xd816c5], 0xe: [0xd81745, 0xd816c5], 0xf: [0xd81745, 0xd816c5]};
export const DISMOUNT_ANIMS: number[] = [0xd816c5, 0xd81851, 0xd81645];
export const REMOUNT_ANIMS: number[] = [0xd818ef, 0xd816d3];
export const REMOUNT_MOUNT_ANIMS: number[] = [0xd835e5];   // +$38 durante o remonte
export const RESERVE_EGG_ANIMS: number[] = [0xd8d1f1, 0xd8d258, 0xd8d206];
export const EGG_ANIMS: number[] = [0xd8d271];
// Ovo de máquina (metálico): a ROM usa $D8:D2CC para os ids ≥ $38 (relatório montarias-e-telas §A.3). Aqui vale para
// as montarias de máquina do Crown Blast (A, D, F — `isMachine`), no chão e seguindo o jogador.
export const MACHINE_EGG_ANIMS: number[] = [0xd8d2cc];
export const PROJ_ANIMS: Record<'d' | 'e' | 'f', number[]> = {d: [0xd80edb], e: [0xd80f93, 0xd8d327], f: [0xd80f14]};
export const DANCE_ANIMS: number[] = [0xd81653, 0xd82a0d];
// Notas da dança (T14b): objeto OAM independente da nota que acerta (tipo F, Y), não o jogador dançando.
// Nasce no tick do acerto e usa esta única animação, medida com 4 quadros de 10 ticks (40 no total); depois some.
export const DANCE_NOTE_ANIMS: number[] = [0xd8d327];
// Ticks medidos em que o objeto da nota tem peça visível perto do jogador (0 = no próprio tick do acerto).
export const DANCE_NOTE_TICKS: number = 39;
// Ticks medidos de cada quadro de DANCE_NOTE_ANIMS[0] (não a duração da tabela: o quadro 0 já nasce
// parcial, porque a captura começa no tick em que o jogador entra na rotina de dança, alguns ticks
// depois do próprio objeto da nota já ter entrado no quadro 0 da explosão).
export const DANCE_NOTE_FRAME_TICKS: number[] = [8, 10, 10, 10];
// Ovo reserva "brilhando" → explosão de brilho → revelação da montaria, no remonte (T14b). É o próprio objeto
// do ovo reserva (não nasce outro): brilha parado na casa de origem, "pula" até o jogador e estoura.
export const REMOUNT_GLOW_ANIMS: number[] = [0xd8d23f, 0xd8d226, 0xd8d327];
// Ticks medidos de cada um dos 2 primeiros endereços de REMOUNT_GLOW_ANIMS antes de trocar (o 3º, a explosão,
// não tem limite próprio medido aqui — REMOUNT_TICKS do core já corta a fase antes dele se esgotar sozinho).
export const REMOUNT_GLOW_STAGE_TICKS: number[] = [16, 15];
export const COSTUME_ANIMS: Record<number, DirAnims[]> = {
  0: [{ walk: [0xd81513, 0xd8157a], idle: [0xd81528] }, { walk: [0xd81561], idle: [0xd81521] }, { walk: [0xd81513, 0xd8152f], idle: [0xd81513] }, { walk: [0xd81548], idle: [0xd8151a] }],
  1: [{ walk: [0xd815ac, 0xd81613], idle: [0xd815c1] }, { walk: [0xd815fa], idle: [0xd815ba] }, { walk: [0xd815ac, 0xd815c8], idle: [0xd815ac] }, { walk: [0xd815e1], idle: [0xd815b3] }],
  2: [{ walk: [0xd81513, 0xd8157a], idle: [0xd81528] }, { walk: [0xd81561], idle: [0xd81521] }, { walk: [0xd81513, 0xd8152f], idle: [0xd81513] }, { walk: [0xd81548], idle: [0xd8151a] }],
  3: [{ walk: [0xd815ac, 0xd81613], idle: [0xd815c1] }, { walk: [0xd815fa], idle: [0xd815ba] }, { walk: [0xd815ac, 0xd815c8], idle: [0xd815ac] }, { walk: [0xd815e1], idle: [0xd815b3] }],
  4: [{ walk: [0xd81513, 0xd8157a], idle: [0xd81528] }, { walk: [0xd81561], idle: [0xd81521] }, { walk: [0xd81513, 0xd8152f], idle: [0xd81513] }, { walk: [0xd81548], idle: [0xd8151a] }],
  5: [{ walk: [0xd815ac, 0xd81613], idle: [0xd815c1] }, { walk: [0xd815fa], idle: [0xd815ba] }, { walk: [0xd815ac, 0xd815c8], idle: [0xd815ac] }, { walk: [0xd815e1], idle: [0xd815b3] }],
  6: [{ walk: [0xd81513, 0xd8157a], idle: [0xd81528] }, { walk: [0xd81561], idle: [0xd81521] }, { walk: [0xd81513, 0xd8152f], idle: [0xd81513] }, { walk: [0xd81548], idle: [0xd8151a] }],
  7: [{ walk: [0xd815ac, 0xd81613], idle: [0xd815c1] }, { walk: [0xd815fa], idle: [0xd815ba] }, { walk: [0xd815ac, 0xd815c8], idle: [0xd815ac] }, { walk: [0xd815e1], idle: [0xd815b3] }],
};
// folha do jogador com traje (+$A0 medido), = p24(COSTUME_SHEET_TABLE + 3·traje); mesma fórmula de quadro das folhas de personagem
export const COSTUME_SHEET_TABLE = 0xc20718;
export const COSTUME_SHEETS: Record<number, number> = {0: 0xca2852, 1: 0xca4852, 2: 0xca2852, 3: 0xca4852, 4: 0xca2852, 5: 0xca4852, 6: 0xca2852, 7: 0xca4852};
export const MOUNT_GFX: Record<number, { src: number; format: 'zte' | 'raw' | 'unknown' }> = {0x2: { src: 0xd40000, format: 'raw' }, 0x3: { src: 0xd3d02b, format: 'raw' }, 0xa: { src: 0xd3e82b, format: 'raw' }, 0xc: { src: 0xd44800, format: 'raw' }, 0xd: { src: 0xd49000, format: 'raw' }, 0xe: { src: 0xd52000, format: 'raw' }, 0xf: { src: 0xd50000, format: 'raw' }};
export const MOUNT_SHEET_TABLE = 0xc470dc;   // MOUNT_GFX[t].src = p24(MOUNT_SHEET_TABLE + 3·t) = +$A4 do jogador montado
export const SHEET2 = 0xd40000;   // +$A4 medido montado no tipo 2 (esperado $D4:0000; nos outros tipos +$A4 = MOUNT_GFX[t].src)
