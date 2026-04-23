/**
 * Parser para colagem de CPFs no Simulador V8 CLT.
 * Aceita TSV/CSV/linhas simples nos formatos:
 *   CPF
 *   CPF\tNome
 *   CPF\tNome\tdd/mm/aaaa
 *   CPF;Nome;dd/mm/aaaa
 *   CPF,Nome,dd/mm/aaaa
 */
export interface V8ParsedRow {
  cpf: string;
  nome?: string;
  data_nascimento?: string;
}

export function parseV8Paste(input: string): V8ParsedRow[] {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const rows: V8ParsedRow[] = [];
  for (const line of lines) {
    const parts = line.split(/\t|;|,/).map((p) => p.trim());
    const cpfRaw = (parts[0] || '').replace(/\D/g, '');
    if (cpfRaw.length !== 11) continue;
    const row: V8ParsedRow = { cpf: cpfRaw };
    if (parts[1]) row.nome = parts[1];
    if (parts[2]) {
      // Aceita dd/mm/yyyy ou yyyy-mm-dd
      const d = parts[2];
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) row.data_nascimento = d;
      else if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        const [y, m, day] = d.split('-');
        row.data_nascimento = `${day}/${m}/${y}`;
      }
    }
    rows.push(row);
  }
  return rows;
}
