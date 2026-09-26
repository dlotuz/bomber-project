import { registerFallbackLayer } from '../../battle-layers';
registerFallbackLayer({ id: 'stage3', draw(s) { if (s.stage !== 3) return; } });
