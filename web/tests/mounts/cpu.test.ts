import { cpuRound } from './sim';

describe('CPU e montarias', () => {
  it('CPUs pegam ovos e usam o Y das montarias ativas em algum momento (40 rodadas)', () => {
    let starts = 0, abilities = 0;
    for (const stage of [1, 2, 3, 6, 7]) for (let seed = 1; seed <= 8; seed++) {
      const r = cpuRound(stage, seed);
      starts += r.events.filter(e => (e.type === 'mount' && e.id === 'mount_start')).length;
      abilities += r.events.filter(e => (e.type === 'mount' && e.id === 'mount_ability')).length;
    }
    expect(starts).toBeGreaterThan(0);
    expect(abilities).toBeGreaterThan(0);
   }, 120_000);
  it('nenhuma rodada trava: todas chegam a over', () => {
    for (const stage of [1, 2, 3, 6, 7]) for (const seed of [11, 12]) expect(cpuRound(stage, seed).s.phase).toBe('over');
   }, 120_000);
});
