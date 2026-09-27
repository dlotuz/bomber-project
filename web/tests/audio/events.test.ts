import { BattleAudio, HIT_SFX_DELAY, HIT_VOICE_DELAY } from '../../src/audio/events';
import type { AudioSink } from '../../src/audio/sink';
import type { GameEvent } from '../../src/core/types';

function recorder() {
  const log: string[] = [];
  const h = (n: number) => n.toString(16).padStart(2, '0');
  const s: AudioSink = {
    bank: id => { log.push(`bank ${h(id)}`); }, music: id => { log.push(`music ${h(id)}`); }, sfx: id => { log.push(`sfx ${h(id)}`); },
    voice: id => { log.push(`voice ${h(id)}`); }, stop: () => { log.push('stop'); }, fade: () => { log.push('fade'); }, tick: () => { log.push('tick'); },
  };
  return { log, s };
}
const ev = (...e: object[]) => e as unknown as GameEvent[];
const TABLES = {
  stage: { a2_warn: 0x26, a5_shock: 0x18, a6_reverse: 0x0a, a8_click: 0x01, a8_brake: 0x27, a8_prize: 0x17, a8_drop: 0x12 },
  mount: { egg_revealed: null, mount_start: null, mount_ability: 0x0c },
};

describe('BattleAudio: tabela da §3.15', () => {
  const table: [object, string[]][] = [
    [{ type: 'bomb_placed', slot: 0, cell: 40 }, ['sfx 0c']],
    [{ type: 'explosion', cell: 40, owner: 0 }, ['sfx 07']],
    [{ type: 'item_picked', slot: 0, item: 0x01 }, ['sfx 08']],
    [{ type: 'item_picked', slot: 0, item: 0x21 }, ['sfx 0a']],
    [{ type: 'item_picked', slot: 0, item: 0x2b }, ['sfx 0a']],
    [{ type: 'item_picked', slot: 0, item: 0x30 }, ['sfx 08']],
    [{ type: 'disease_passed', from: 0, to: 1 }, ['sfx 0a', 'voice 04']],
    [{ type: 'footstep', slot: 2 }, ['sfx 0b']],
    [{ type: 'bomb_kicked', slot: 0 }, ['sfx 0d']],
    [{ type: 'punch', slot: 0 }, ['sfx 0d', 'voice 03']],
    [{ type: 'p_punch', slot: 0 }, ['sfx 0d', 'voice 03']],
    [{ type: 'throw', slot: 0 }, ['sfx 0e', 'voice 03']],
    [{ type: 'bomb_bounce' }, ['sfx 0e']],
    [{ type: 'bomb_landed' }, ['sfx 0f']],
    [{ type: 'stunned', slot: 1 }, ['sfx 12', 'voice 02']],
    [{ type: 'hurry' }, ['sfx 15', 'voice 10']],
    [{ type: 'pressure_step', cell: 18 }, ['sfx 27']],
    [{ type: 'victory_sfx', slot: 3 }, ['sfx 17']],
    [{ type: 'time_up' }, ['stop']],
    [{ type: 'round_over', result: 'draw' }, []],
    [{ type: 'stage', id: 'a2_warn' }, ['sfx 26']],
    [{ type: 'stage', id: 'a8_brake', slot: 0 }, ['sfx 27']],
    [{ type: 'stage', id: 'a6_reverse', slot: 1, cell: 40 }, ['sfx 0a']],
    [{ type: 'stage', id: 'sem_som' }, []],
    [{ type: 'mount', id: 'mount_start', slot: 0 }, []],
    [{ type: 'mount', id: 'mount_ability', slot: 0 }, ['sfx 0c']],
    [{ type: 'stage', id: 'qualquer', sfx: 0x1c, voice: 0x03 }, ['sfx 1c', 'voice 03']],
  ];
  for (const [e, want] of table) {
    it((e as { type: string }).type + ' ' + JSON.stringify(e), () => {
      const { log, s } = recorder();
      new BattleAudio(TABLES).handle(s, ev(e));
      expect(log).toEqual(want);
    });
  }
  it('vários eventos no mesmo tick saem na ordem dos eventos (a fila de 1/tick é do sink)', () => {
    const { log, s } = recorder();
    new BattleAudio().handle(s, ev({ type: 'explosion' }, { type: 'explosion' }, { type: 'bomb_placed' }));
    expect(log).toEqual(['sfx 07', 'sfx 07', 'sfx 0c']);
  });
});

describe('BattleAudio: acerto com atraso', () => {
  it('voz $06 em +2 ticks e SFX $10 em +13 ticks, no sink que recebeu o evento', () => {
    const { log, s } = recorder();
    const b = new BattleAudio();
    b.handle(s, ev({ type: 'player_hit', slot: 1 }));
    const when: Record<string, number> = {};
    for (let t = 1; t <= 20; t++) {
      const n = log.length;
      b.tick();
      for (const l of log.slice(n)) when[l] = t;
    }
    expect(when).toEqual({ 'voice 06': HIT_VOICE_DELAY, 'sfx 10': HIT_SFX_DELAY });
    expect([HIT_VOICE_DELAY, HIT_SFX_DELAY]).toEqual([2, 13]);
  });
  it('reset descarta os pendentes; o limite é de 64 pendentes', () => {
    const { log, s } = recorder();
    const b = new BattleAudio();
    b.handle(s, ev({ type: 'player_hit', slot: 0 }));
    b.reset();
    for (let t = 0; t < 20; t++) b.tick();
    expect(log).toEqual([]);
    for (let i = 0; i < 40; i++) b.handle(s, ev({ type: 'player_hit', slot: 0 }));
    for (let t = 0; t < 20; t++) b.tick();
    expect(log).toHaveLength(64);
  });
});
