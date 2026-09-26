import { registerRomLayer } from '../../battle-layers';
import { CODE } from '../../../core/types';
import { colOf, linOf } from '../../../core/units';
import { ARROWS } from '../../../core/stages/stage7';

// As setas não estão no mapa de piso: a ROM as repõe por gancho ($C1:534F). Sob chama/bomba, o plano 7 desenha o resto.
// Moitas (M4 da revisão final do plano 8): a ROM as desenha em BG1 com prioridade 1 (acima de OBJ, §4.6), não por um
// gancho desta camada — são parte fixa do mapa de fundo da arena 7, carregado à parte (plano 7). `RomBattleBuilder`
// já reserva `setBg1` para isso; falta o compositor real BG1-prioridade-1-sobre-OBJ, que é do plano 7 (M8: o modo
// ROM ainda não está ligado à tela de batalha). Nada a fazer aqui: o mecanismo (prioridade de BG) já é o certo.
registerRomLayer({
  id: 'stage7',
  draw(s, b) {
    if (s.stage !== 7) return;
    for (const a of ARROWS) if (s.grid[a.cell] === CODE.ARROW) b.setBg2(colOf(a.cell), linOf(a.cell), a.word);
  },
});
