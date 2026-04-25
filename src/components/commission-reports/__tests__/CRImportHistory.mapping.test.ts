import { describe, it, expect } from 'vitest';
import { mapSheetToTable } from '../CRImportHistory';

describe('mapSheetToTable — isolamento V1 vs V2', () => {
  it('parceiros_v2 + base → commission_sales_v2 (NUNCA commission_sales)', () => {
    expect(mapSheetToTable('parceiros_v2', 'base')).toBe('commission_sales_v2');
  });

  it('parceiros + base → commission_sales (NUNCA commission_sales_v2)', () => {
    expect(mapSheetToTable('parceiros', 'base')).toBe('commission_sales');
  });

  it('relatorios + geral → cr_geral', () => {
    expect(mapSheetToTable('relatorios', 'geral')).toBe('cr_geral');
  });

  it('relatorios + repasse → cr_repasse', () => {
    expect(mapSheetToTable('relatorios', 'repasse')).toBe('cr_repasse');
  });

  it('relatorios + seguros → cr_seguros', () => {
    expect(mapSheetToTable('relatorios', 'seguros')).toBe('cr_seguros');
  });

  it('relatorios + relatorio → cr_relatorio', () => {
    expect(mapSheetToTable('relatorios', 'relatorio')).toBe('cr_relatorio');
  });

  it('aba desconhecida → null', () => {
    expect(mapSheetToTable('parceiros', 'inexistente')).toBeNull();
  });
});
