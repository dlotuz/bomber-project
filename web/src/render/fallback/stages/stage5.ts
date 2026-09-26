import { registerFallbackLayer } from '../../battle-layers';
registerFallbackLayer({ id: 'stage5', draw(s) { if (s.stage !== 5) return; } });
