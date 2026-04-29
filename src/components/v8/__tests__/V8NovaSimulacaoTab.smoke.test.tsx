import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import V8NovaSimulacaoTab from '../V8NovaSimulacaoTab';

// Mocks de hooks/serviços que tocariam rede/realtime/Supabase em runtime.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [] }), maybeSingle: () => Promise.resolve({ data: null }) }) }) }),
    functions: { invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }) },
    channel: () => ({ on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }), subscribe: () => ({ unsubscribe: () => {} }) }),
    removeChannel: () => {},
  },
}));

vi.mock('@/hooks/useV8Configs', () => ({
  useV8Configs: () => ({ configs: [], refreshing: false, refreshFromV8: () => {} }),
}));
vi.mock('@/hooks/useV8Settings', () => ({
  useV8Settings: () => ({ settings: null, save: () => {} }),
}));
vi.mock('@/hooks/useV8Batches', () => ({
  useV8BatchSimulations: () => ({ simulations: [], lastUpdateAt: null }),
}));

describe('V8NovaSimulacaoTab (smoke)', () => {
  it('renderiza sem props e sem crashar', () => {
    const qc = new QueryClient();
    const { container } = render(
      <QueryClientProvider client={qc}>
        <V8NovaSimulacaoTab />
      </QueryClientProvider>,
    );
    // Painel de criação sempre presente
    expect(container.textContent).toContain('Configurar Simulação');
    expect(container.textContent).toContain('Iniciar Simulação');
  });
});
