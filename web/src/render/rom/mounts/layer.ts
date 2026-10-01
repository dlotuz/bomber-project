// Camada ROM das montarias: paletas das vagas (pal. 2/3) + sprites de ovo/reserva/projétil (T14).
import type { RomBattleLayer } from '../../battle-layers';
import type { RomAssets } from '../../../rom/types';
import { readBgr555 } from '../../../rom/decode/palette';
import { rider } from '../../../core/mounts/types';
import { MOUNT_GFX } from './facts';
import { fallbackMountFrame } from './gfx';
import { mountRomSprites } from './sprites';

/** Endereço das 16 cores da paleta OBJ 2 (vaga 1) por tipo — `fx.palettes[].objPal===2` da T4 (medido; T4 não
 *  exportou esta tabela em `facts.ts`, então guardamos aqui os 7 endereços validados no fixture da T4). A vaga 2
 *  (2º jogador montado) reaproveitaria a paleta OBJ 3, que não foi medida com uma montaria ativa (ver relatório). */
const MOUNT_PAL_ADDR: Record<number, number> = {
  0x2: 0xd7ec5c, 0x3: 0xd7ebfc, 0xa: 0xd7ec9c, 0xc: 0xd7ee7c, 0xd: 0xd7efdc, 0xe: 0xd7f89c, 0xf: 0xd7f69c,
  // tipos da senha 0164 (montarias-extras/facts_extra.py: as 16 cores da OBJ 2 achadas uma única vez na ROM)
  0x1: 0xd7f67c, 0x4: 0xd7eebc, 0x5: 0xd7ef7c, 0x6: 0xd7f21c, 0x9: 0xd7edbc, 0xb: 0xd7ee1c,
};

export const romMountLayer: RomBattleLayer = {
  id: 'mounts',
  draw(s, b, aObj, hostFrame, frame = hostFrame) {   // `frame` = visualTick (base de `t0`/`born`/`phaseT0`, congela no TIME UP; T16)
    const a = aObj as RomAssets;
    for (const p of s.players) {
      const r = rider(p);
      if (!r || !r.slot) continue;
      const pal = 1 + r.slot;
      if (MOUNT_GFX[r.type]?.format === 'unknown') {
        // Plano B: sem tiles medidos, a paleta também sai da arte por código do fallback (rider.ts espelha a
        // mesma face/passo ao montar a peça).
        const face = (p.face & 6) as 0 | 2 | 4 | 6;
        const step: 0 | 1 = p.moveDir !== 8 ? ((frame >> 3) & 1) as 0 | 1 : 0;
        const { colors } = fallbackMountFrame(r.type, face, step);
        for (let i = 0; i < 16; i++) b.cgram(128 + 16 * pal + i, colors[i]);
        continue;
      }
      const addr = MOUNT_PAL_ADDR[r.type];
      if (addr === undefined) continue;
      const colors = readBgr555(a.rom.bytes(addr, 32), 0, 16);
      for (let i = 0; i < 16; i++) b.cgram(128 + 16 * pal + i, colors[i]);
    }
    let order = 0;
    for (const { e, sortY } of mountRomSprites(s, a, frame)) b.sprite(e, sortY, order++);
  },
};
