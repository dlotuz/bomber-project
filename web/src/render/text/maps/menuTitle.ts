import type { StyleRomDef } from '../types';
/** Título dos menus (cena `vsmode`, BG1, "Select a VS mode!" — cursivo azul): fonte em bloco 16×16 com traço
 * contínuo, sem coluna em branco separando letras vizinhas (nem sementes + máscara isolam bem cada letra nesse
 * desenho pequeno — o preenchimento de cada letra é fino e majoritariamente feito do próprio contorno
 * compartilhado com a vizinha; ver task-16-report.md). Por isso este estilo usa só glifos próprios (EXTRA),
 * desenhados no mesmo bloco geométrico simples dos outros dois estilos do grupo, com os índices de cor
 * observados nesta cena (10–15 = degradê azul, 1–2 = contorno). Paleta: linha 0 da cena `vsmode` (o mesmo azul
 * visto em VS/FFA/jogadores/regras/personagem, lido de verdade da ROM — só a FORMA das letras é própria). */
export const DEF: StyleRomDef = {
  strips: {},
  cuts: [],
  height: 16, spacing: 0, spaceWidth: 6,
  palette: { kind: 'scene', scene: 'vsmode', row: 0, size: 16 },
};
