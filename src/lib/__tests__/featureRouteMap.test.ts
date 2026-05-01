import { describe, expect, it } from 'vitest';
import { FEATURE_ROUTE_MAP, MASTER_FEATURE_TOGGLE_KEYS, ROUTE_FEATURE_MAP } from '../featureRouteMap';

describe('FEATURE_ROUTE_MAP x master_feature_toggles', () => {
  it('todo módulo do painel Master tem rota mapeada', () => {
    const missing = MASTER_FEATURE_TOGGLE_KEYS.filter((key) => !FEATURE_ROUTE_MAP[key]?.length);
    expect(missing).toEqual([]);
  });

  it('não deixa rota mapeada para feature inexistente no painel Master, exceto rotas internas', () => {
    const allowedInternalOnly = new Set(['master_admin']);
    const extra = Object.keys(FEATURE_ROUTE_MAP).filter(
      (key) => !MASTER_FEATURE_TOGGLE_KEYS.includes(key as any) && !allowedInternalOnly.has(key),
    );
    expect(extra).toEqual([]);
  });

  it('toda rota reversa aponta para uma feature válida', () => {
    Object.entries(ROUTE_FEATURE_MAP).forEach(([route, featureKey]) => {
      expect(route).toMatch(/^\//);
      expect(FEATURE_ROUTE_MAP[featureKey]).toContain(route);
    });
  });
});
