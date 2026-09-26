import { DPAD, SUBPOS, PAR, TBL, A20, DIAM, KICK_MASK, KICK_DIRBIT, speedVec, SPEED_BY_LEVEL } from '../../src/core/tables/movement';
import { STAGE_FACTS } from '../../src/core/tables/stages';
import { STAGE_ITEMS } from '../../src/core/tables/items';
import { FREE_CELLS } from '../../src/core/tables/cells';
import { PUNCH, BOUNCE, KICK_STEP, THROW, ITEM_FLIGHT } from '../../src/core/tables/flights';
import { CAPSULE_TYPES, FUSE_TABLE, MAX_CAPS, INVISIBLE_PATTERN, RACER_HANDLERS, STUN_LOSS_HANDLERS } from '../../src/core/tables/misc';

const cell = (col: number, lin: number) => lin * 17 + col;
const count = (list: readonly (readonly [number, number])[], item: number) => list.filter(([, i]) => i === item).length;
const sum = (s: readonly (readonly [number, number])[], k: 0 | 1) => s.reduce((a, v) => a + v[k], 0);

describe('tabelas de movimento', () => {
  it('DPAD, PAR e subposição do centro', () => {
    expect(DPAD).toEqual([8, 2, 6, 8, 4, 3, 5, 8, 0, 1, 7, 8, 8, 8, 8, 8]);
    expect(PAR).toEqual([1, 3, 0, 2]);
    expect(SUBPOS.length).toBe(256);
    expect(SUBPOS[7 * 16 + 7]).toBe(12);
    expect(SUBPOS.slice(0, 16)).toEqual([7, 7, 7, 7, 7, 7, 7, 8, 0, 0, 0, 0, 0, 0, 0, 1]);
  });
  it('velocidade por nível (1/256 px/tick), diagonais sem normalizar', () => {
    expect(SPEED_BY_LEVEL).toEqual([224, 256, 288, 320, 352, 384, 512, 128]);
    expect(speedVec(1, 2)).toEqual([256, 0]);
    expect(speedVec(1, 3)).toEqual([256, 256]);
    expect(speedVec(6, 4)).toEqual([0, 512]);
    expect(speedVec(7, 6)).toEqual([-128, 0]);
    expect(speedVec(5, 8)).toEqual([0, 0]);
  });
  it('empurrão contra parede $C3:2A20', () => {
    expect(A20).toEqual([7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, -2, -3, -4, -5, -6, -7, -8]);
  });
  it('tabelas de direção e diamante', () => {
    expect(TBL.length).toBe(4);
    for (const t of TBL) expect(t.length).toBe(0x70);
    expect(TBL[0].slice(0, 8)).toEqual([0, 0, 3, 3, 4, 5, 5, 0]);
    expect(TBL[1].slice(0, 8)).toEqual([0, 16, 16, 4, 4, 4, 112, 0]);
    expect(TBL[2].slice(0, 8)).toEqual([18, 2, 2, 2, 50, 6, 6, 6]);
    expect(TBL[3]).toEqual(TBL[0]);
    expect(DIAM.length).toBe(256);
    expect(DIAM[0]).toEqual([7, 0]);
    expect(DIAM[16]).toEqual([0, 6]);
  });
  it('máscara do chute: centro dispara para as 4 faces; 2 px antes não dispara para a direita', () => {
    expect(KICK_DIRBIT).toEqual([0x01, 0x04, 0x10, 0x40]);
    expect(KICK_MASK.slice(7 * 16, 7 * 16 + 16)).toEqual([0x40, 0x51, 0x51, 0x51, 0x51, 0x51, 0x55, 0x55, 0x55, 0x55, 0x15, 0x15, 0x15, 0x15, 0x15, 0x04]);
    expect(KICK_MASK[7 * 16 + 7] & 0x55).toBe(0x55);
    expect(KICK_MASK[7 * 16 + 5] & KICK_DIRBIT[1]).toBe(0);
  });
});

describe('fases', () => {
  it('N removidos por fase', () => {
    expect(STAGE_FACTS.map(f => f.remove)).toEqual([14, 14, 12, 4, 8, 14, 4, 0, 4, 14]);
  });
  it('fase 1: toda casa sem pilar é soft; paredes nas bordas', () => {
    const b = STAGE_FACTS[0].base;
    expect(b.length).toBe(221);
    expect(b.filter(v => v === 0xcc80).length).toBe(113);
    expect(b[cell(1, 5)]).toBe(0xec40);
    expect(b[cell(15, 5)]).toBe(0xec40);
    expect(b[cell(8, 0)]).toBe(0xec40);
    expect(b[cell(8, 12)]).toBe(0xec40);
    expect(b[cell(3, 2)]).toBe(0xec40);
    expect(STAGE_FACTS[0].floorLogic[cell(2, 1)]).toBe(0x0000);
  });
  it('fases 5 e 8 sem blocos; casas das bolas (3), setas (7) e pads (8) livres na base (os objetos vêm do init da arena)', () => {
    expect(STAGE_FACTS[4].base.filter(v => v === 0xcc80).length).toBe(0);
    expect(STAGE_FACTS[7].base.filter(v => v === 0xcc80).length).toBe(0);
    expect(STAGE_FACTS.map(f => f.base.filter(v => v === 0xcc80).length)).toEqual([113, 113, 111, 93, 0, 113, 85, 0, 101, 113]);
    expect([cell(6, 5), cell(10, 7)].map(c => STAGE_FACTS[2].base[c])).toEqual([0, 0]);
    expect([cell(4, 3), cell(12, 3), cell(12, 9), cell(4, 9)].map(c => STAGE_FACTS[6].base[c])).toEqual([0, 0, 0, 0]);
    expect([cell(4, 7), cell(8, 7), cell(12, 7)].map(c => STAGE_FACTS[7].base[c])).toEqual([0, 0, 0]);
  });
});

describe('itens e casas', () => {
  it('totais por fase', () => {
    expect(STAGE_ITEMS.map(l => l.length)).toEqual([30, 31, 35, 26, 0, 34, 35, 0, 32, 33]);
  });
  it('fase 1 = 8 bombas, 5 fogo, 3 patins, 3 chute, 2 soco, 2 luva, 2 P, 1 caveira $21, 4 ovos; todas sorteadas', () => {
    const l = STAGE_ITEMS[0];
    expect([0x01, 0x03, 0x05, 0x0e, 0x0d, 0x07, 0x12, 0x21, 0x30].map(i => count(l, i))).toEqual([8, 5, 3, 3, 2, 2, 2, 1, 4]);
    expect(l.every(([off]) => off === 0x44)).toBe(true);
  });
  it('fase 10 tem 8 trajes; fases 3, 6 e 7 têm 1 fogo total', () => {
    expect(count(STAGE_ITEMS[9], 0x0f)).toBe(8);
    expect([2, 5, 6].map(k => count(STAGE_ITEMS[k], 0x04))).toEqual([1, 1, 1]);
  });
  it('lista $C4:1327: 113 casas distintas do campo, sem pilar, na ordem da ROM', () => {
    expect(FREE_CELLS.length).toBe(113);
    expect(new Set(FREE_CELLS).size).toBe(113);
    expect(FREE_CELLS.slice(0, 3)).toEqual([cell(10, 3), cell(11, 11), cell(12, 1)]);
    for (const c of FREE_CELLS) {
      const col = c % 17, lin = Math.floor(c / 17);
      expect(col >= 2 && col <= 14 && lin >= 1 && lin <= 11).toBe(true);
      expect(col % 2 === 1 && lin % 2 === 0).toBe(false);
    }
  });
});

describe('scripts de voo', () => {
  it('soco: 17 passos; horizontal 48 px com pico 10; vertical para cima −48', () => {
    expect(PUNCH[1].map(v => v[0])).toEqual([3, 3, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 2, 0, 0]);
    expect(sum(PUNCH[1], 1)).toBe(0);
    expect(PUNCH[0].map(v => v[1])).toEqual([-4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -3, -3, -3, 0, 1, 0, 0]);
    expect(sum(PUNCH[2], 1)).toBe(48);
    expect(sum(PUNCH[3], 0)).toBe(-48);
  });
  it('quique: 8 passos, 1 casa', () => {
    expect(BOUNCE[1]).toEqual([[3, -4], [3, -2], [3, 0], [3, 0], [2, 2], [2, 4], [0, 0], [0, 0]]);
    expect(sum(BOUNCE[0], 1)).toBe(-16);
    for (const s of BOUNCE) expect(s.length).toBe(8);
  });
  it('luva: 2..5 casas a partir da mão (Y−16)', () => {
    for (const n of [2, 3, 4, 5] as const) {
      expect(sum(THROW[n][1], 0)).toBe(16 * n);
      expect(sum(THROW[n][1], 1)).toBe(16);        // desce da mão ao chão
      expect(sum(THROW[n][0], 1)).toBe(-16 * n + 16);
      expect(sum(THROW[n][2], 1)).toBe(16 * n + 16);
      expect(THROW[n][0].length).toBe(11);
    }
  });
  it('chute: 8 × 2 px', () => {
    expect(KICK_STEP[1]).toEqual(new Array(8).fill([2, 0]));
    expect(KICK_STEP[0]).toEqual(new Array(8).fill([0, -2]));
  });
  it('itens voando ($C1:6715): 12 = 4 direções × 5/4/3 casas, mesmos scripts da luva', () => {
    expect(ITEM_FLIGHT.map(f => f.dir)).toEqual([0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3]);
    expect(ITEM_FLIGHT.map(f => f.cells)).toEqual([5, 5, 5, 5, 4, 4, 4, 4, 3, 3, 3, 3]);
    expect(ITEM_FLIGHT[1].script).toEqual(THROW[5][1]);
  });
});

describe('outros fatos', () => {
  it('valores', () => {
    expect(CAPSULE_TYPES).toEqual([0x32, 0x33, 0x3a, 0x3c, 0x3d, 0x3e, 0x3f, 0x32, 0x33, 0x3a, 0x3c, 0x3d, 0x3e, 0x3f]);
    expect(FUSE_TABLE).toEqual([62, 253, 126]);
    expect(MAX_CAPS).toEqual({ bombs: 9, fire: 8, speed: 6 });
    expect(INVISIBLE_PATTERN.length).toBe(64);
    expect(INVISIBLE_PATTERN.slice(0, 16)).toEqual([0x55, 0x55, 0x55, 0x33, 0x33, 0x33, 7, 7, 7, 0x0f, 0x0f, 0x0f, 0, 0x0f, 0, 0x0f]);
    expect(INVISIBLE_PATTERN.slice(16).every(v => v === 0)).toBe(true);
    expect(RACER_HANDLERS).toEqual([0x0954, 0x0965, 0x096c, 0x097b, 0x0982, 0x0991, 0x0997, 0x0997, 0x099e, 0x09a9, 0x09a9, 0x09aa, 0x09b5, 0x09bc, 0x09dd, 0x09e4, 0x09eb]);
    expect(STUN_LOSS_HANDLERS).toEqual([0x545a, 0x556c, 0x52d4, 0x5318, 0x534c, 0x5378, 0x53d6, 0x5402, 0x54db, 0x5507, 0x5540, 0x54af, 0x542e]);
  });
});
