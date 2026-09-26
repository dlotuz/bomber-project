import { registerFallbackLayer } from '../../battle-layers';
registerFallbackLayer({ id: 'stage7', draw(s) { if (s.stage !== 7) return; } });
