import { STAGES } from '../../src/core/stages';
import { MOUNTS, NO_MOUNT } from '../../src/core/mounts';
import { romLayers, fallbackLayers, fallbackOverLayers, registerRomLayer, registerFallbackLayer } from '../../src/render/battle-layers';
import { emptyRound } from '../../src/core/state';
import { defaultRules } from '../../src/core/types';

describe('pontos de extensão (§2.5)', () => {
  it('STAGES tem 11 entradas (índice = fase)', () => {
    expect(STAGES.length).toBe(11);
    for (let n = 1; n <= 10; n++) expect(STAGES[n]).toBeDefined();   // o plano 8 preenche 2..10 (acordo do plano 8)
  });
  it('montaria padrão é no-op', () => {
    const s = emptyRound(1, defaultRules());
    const p = s.players[0];
    expect(MOUNTS.current).toBe(NO_MOUNT);
    expect(NO_MOUNT.onHit(s, p, [])).toBe(false);
    expect(NO_MOUNT.onY(s, p, [])).toBe(false);
    NO_MOUNT.tick(s, []);
    NO_MOUNT.revealEgg(s, 20, []);
    NO_MOUNT.stepOnEgg(s, p, 20, []);
  });
  it('registros de camadas começam vazios e aceitam registro', () => {
    expect(romLayers.length).toBe(0);
    expect(fallbackLayers.length).toBe(0);
    expect(fallbackOverLayers.length).toBe(0);
    registerRomLayer({ id: 't', draw() {} });
    registerFallbackLayer({ id: 't', draw() {} });
    expect(romLayers.map(l => l.id)).toEqual(['t']);
    expect(fallbackLayers.map(l => l.id)).toEqual(['t']);
    romLayers.length = 0; fallbackLayers.length = 0;
  });
  it('registro de fallback com over: true vai para fallbackOverLayers, não fallbackLayers (M4)', () => {
    registerFallbackLayer({ id: 'o', over: true, draw() {} });
    expect(fallbackLayers.map(l => l.id)).toEqual([]);
    expect(fallbackOverLayers.map(l => l.id)).toEqual(['o']);
    fallbackOverLayers.length = 0;
  });
});
