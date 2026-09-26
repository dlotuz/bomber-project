import { registerFallbackLayer } from '../../battle-layers';
registerFallbackLayer({ id: 'stage8', draw(s) { if (s.stage !== 8) return; } });
