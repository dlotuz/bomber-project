import { registerFallbackLayer } from '../../battle-layers';
registerFallbackLayer({ id: 'stage6', draw(s) { if (s.stage !== 6) return; } });
