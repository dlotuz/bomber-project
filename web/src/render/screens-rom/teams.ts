// Geometria da cena "charsel" reaproveitada pela tela de equipes (Escolha as equipes!), spec §6.6/R14, brief T10:
// retratos na coluna esquerda, marcador do lado em x = 64 (equipe 0) ou 176 (equipe 1), "VS" centrado em (128, 96).
// Mesma ressalva de `charsel.ts`: sem captura para conferir tile a tile, só a disposição em pixels usada pelo
// desenho de `screens/teams.ts` (ROM e fallback).

/** Coluna de retratos à esquerda: um por jogador ativo, de cima a baixo. */
export const TEAMSEL_PORTRAIT = { x: 16, w: 32, y0: 32, dy: 32 };

/** Marcador do lado: x por equipe (0 = esquerda/vermelha, 1 = direita/branca). */
export const TEAMSEL_MARKER_X: readonly [number, number] = [64, 176];

/** "VS" (estilo `menuItem`) centrado na tela. */
export const TEAMSEL_VS = { x: 128, y: 96 };
