import { registerFallbackLayer } from '../../battle-layers';
registerFallbackLayer({ id: 'stage9', draw(s) { if (s.stage !== 9) return; } });
