import { registerFallbackLayer } from '../../battle-layers';
registerFallbackLayer({ id: 'stage2', draw(s) { if (s.stage !== 2) return; } });
