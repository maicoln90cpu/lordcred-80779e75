import { describe, it, expect, vi } from 'vitest';
import V8NovaSimulacaoTab from '../V8NovaSimulacaoTab';
import BatchCreatePanel from '../nova-simulacao/BatchCreatePanel';
import BatchActionsBar from '../nova-simulacao/BatchActionsBar';
import BatchProgressTable from '../nova-simulacao/BatchProgressTable';

// Mocks defensivos para garantir que o módulo carrega sem rede.
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

describe('V8 Nova Simulação — modularização', () => {
  it('orquestrador exporta um componente function default', () => {
    expect(typeof V8NovaSimulacaoTab).toBe('function');
  });
  it('expõe sub-componentes BatchCreatePanel/ActionsBar/ProgressTable', () => {
    expect(typeof BatchCreatePanel).toBe('function');
    expect(typeof BatchActionsBar).toBe('function');
    expect(typeof BatchProgressTable).toBe('function');
  });
});
