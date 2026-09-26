import type { StyleRomDef } from '../types';
/** Itens dos menus (cena `vsmode`, BG1, "Battle Royale"/"Championship"/"Bombermania" — cursivo vermelho/
 * laranja): fonte em bloco 16×16 com traço contínuo, sem coluna em branco separando letras vizinhas (nem
 * sementes + máscara isolam bem cada letra nesse desenho pequeno — o preenchimento de cada letra é fino e
 * majoritariamente feito do próprio contorno compartilhado com a vizinha; ver task-16-report.md). Por isso este
 * estilo usa só glifos próprios (EXTRA), desenhados no mesmo bloco geométrico simples dos outros dois estilos do
 * grupo, com os índices de cor observados nesta cena (10–15 = degradê, 1–2 = contorno). Tons: linhas da CGRAM da
 * própria cena `vsmode` (0 = azul do título, 3 = verde, 7 = vermelho/padrão, 9 = cinza) — lidas de verdade da
 * ROM, só a FORMA das letras é própria. */
export const DEF: StyleRomDef = {
  strips: {},
  cuts: [],
  height: 16, spacing: 0, spaceWidth: 6,
  palette: { kind: 'scene', scene: 'vsmode', row: 7, size: 16 },
  tones: { gray: 9, green: 3, red: 7, blue: 0 },
};
