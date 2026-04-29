import { describe, it, expect } from 'vitest';

/**
 * Espelha a função parseImportData de RatesCLTTab.tsx.
 * Mantém aqui para teste isolado (a original é privada do componente).
 * Se mudar a lógica original, atualize aqui também.
 */
function parseImportData(rows: Record<string, string>[]) {
  const today = new Date().toISOString().slice(0, 10);
  return rows.map(r => {
    const bank = (r['Banco'] || r['banco'] || r['bank'] || '').toString().trim().toUpperCase();
    const tableKey = (r['Tabela'] || r['tabela'] || r['table_key'] || '').toString().trim().toUpperCase();
    const termMin = parseInt((r['Prazo Min'] || r['prazo_min'] || r['term_min'] || '0').toString()) || 0;
    const termMax = parseInt((r['Prazo Max'] || r['prazo_max'] || r['term_max'] || '999').toString()) || 999;
    const minValue = parseFloat((r['Valor Min'] || r['valor_min'] || r['min_value'] || '0').toString().replace(',', '.')) || 0;
    const maxValueRaw = (r['Valor Max'] || r['valor_max'] || r['max_value'] || '999999999').toString().replace(',', '.');
    const maxValue = parseFloat(maxValueRaw) || 999999999;
    const seguroRaw = (r['Seguro (Sim/Não)'] || r['Seguro'] || r['seguro'] || r['has_insurance'] || 'Não').toString().toLowerCase();
    const hasInsurance = seguroRaw === 'sim' || seguroRaw === 'true' || seguroRaw === '1';
    const rate = parseFloat((r['Taxa (%)'] || r['taxa'] || r['rate'] || '0').toString().replace(',', '.')) || 0;
    const obs = (r['Obs'] || r['obs'] || '').toString();
    const dataVigRaw = (r['Data Vigência (AAAA-MM-DD, opcional)'] || r['Data Vigência'] || r['data_vigencia'] || r['effective_date'] || '').toString().trim();
    const effectiveDate = /^\d{4}-\d{2}-\d{2}$/.test(dataVigRaw) ? dataVigRaw : today;
    return { effective_date: effectiveDate, bank, table_key: tableKey || null, term_min: termMin, term_max: termMax, min_value: minValue, max_value: maxValue, has_insurance: hasInsurance, rate, obs: obs || null };
  }).filter(r => r.bank);
}

const today = new Date().toISOString().slice(0, 10);

describe('RatesCLTTab.parseImportData', () => {
  it('linha completa do modelo do sistema (FACTA GOLD 24-24 Sim 1.8%)', () => {
    const out = parseImportData([{
      'Banco': 'FACTA',
      'Tabela': 'GOLD',
      'Prazo Min': '24',
      'Prazo Max': '24',
      'Valor Min': '0',
      'Valor Max': '999999999',
      'Seguro (Sim/Não)': 'Sim',
      'Taxa (%)': '1.8',
      'Obs': '',
    }]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      bank: 'FACTA', table_key: 'GOLD', term_min: 24, term_max: 24,
      min_value: 0, max_value: 999999999, has_insurance: true, rate: 1.8,
      effective_date: today, obs: null,
    });
  });

  it('Data Vigência preenchida sobrescreve hoje', () => {
    const out = parseImportData([{
      'Banco': 'BANCO C6', 'Taxa (%)': '5.5',
      'Data Vigência (AAAA-MM-DD, opcional)': '2026-01-15',
    }]);
    expect(out[0].effective_date).toBe('2026-01-15');
  });

  it('Data Vigência inválida cai em hoje', () => {
    const out = parseImportData([{
      'Banco': 'BANCO C6', 'Taxa (%)': '5.5',
      'Data Vigência': '15/01/2026',
    }]);
    expect(out[0].effective_date).toBe(today);
  });

  it('vírgula como decimal em taxa e valores', () => {
    const out = parseImportData([{
      'Banco': 'HAPPY', 'Valor Min': '1300,01', 'Valor Max': '1600',
      'Seguro': 'Não', 'Taxa (%)': '0,25',
    }]);
    expect(out[0].rate).toBe(0.25);
    expect(out[0].min_value).toBeCloseTo(1300.01);
  });

  it('sem table_key vira null (não string vazia)', () => {
    const out = parseImportData([{
      'Banco': 'PRESENÇA', 'Tabela': '', 'Prazo Min': '6', 'Prazo Max': '6', 'Taxa (%)': '0',
    }]);
    expect(out[0].table_key).toBeNull();
  });

  it('linha sem banco é descartada', () => {
    const out = parseImportData([
      { 'Banco': '', 'Taxa (%)': '5' },
      { 'Banco': 'FACTA', 'Taxa (%)': '5' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].bank).toBe('FACTA');
  });

  it('aceita "SIM" maiúsculo e "true"', () => {
    expect(parseImportData([{ 'Banco': 'X', 'Seguro (Sim/Não)': 'SIM', 'Taxa (%)': '1' }])[0].has_insurance).toBe(true);
    expect(parseImportData([{ 'Banco': 'X', 'Seguro': 'true', 'Taxa (%)': '1' }])[0].has_insurance).toBe(true);
    expect(parseImportData([{ 'Banco': 'X', 'Seguro': 'Não', 'Taxa (%)': '1' }])[0].has_insurance).toBe(false);
  });
});
