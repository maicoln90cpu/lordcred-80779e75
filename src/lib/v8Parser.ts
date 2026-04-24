/**
 * Parser para colagem de CPFs no Simulador V8 CLT.
 * Aceita TSV/CSV/linhas com espaços nos formatos:
 *   CPF
 *   CPF Nome
 *   CPF Nome dd/mm/aaaa
 *   CPF;Nome;dd/mm/aaaa
 *   CPF,Nome,dd/mm/aaaa
 *   CPF\tNome\tdd/mm/aaaa
 *
 * Estratégia: extrai CPF (11 dígitos) sempre da primeira posição da linha,
 * detecta data (dd/mm/aaaa ou yyyy-mm-dd) em qualquer posição posterior,
 * e o que sobrar entre eles vira o nome.
 */
export interface V8ParsedRow {
  cpf: string;
  nome?: string;
  data_nascimento?: string;
}

const DATE_BR = /\b(\d{2}\/\d{2}\/\d{4})\b/;
const DATE_ISO = /\b(\d{4}-\d{2}-\d{2})\b/;

export function parseV8Paste(input: string): V8ParsedRow[] {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const rows: V8ParsedRow[] = [];
  for (const line of lines) {
    // Tenta primeiro separadores estruturados (tab, ;, ,)
    let parts = line.split(/\t|;|,/).map((p) => p.trim()).filter(Boolean);

    // Se não houve separadores, divide por espaços (formato "CPF NOME SOBRENOME DATA")
    if (parts.length === 1) {
      parts = line.split(/\s+/).filter(Boolean);
    }

    // CPF sempre é o primeiro token (apenas dígitos, 11 chars)
    const cpfRaw = (parts[0] || '').replace(/\D/g, '');
    if (cpfRaw.length !== 11) continue;

    const row: V8ParsedRow = { cpf: cpfRaw };

    // Procura data em qualquer parte (dd/mm/aaaa ou yyyy-mm-dd)
    let dateStr: string | undefined;
    let dateIdx = -1;
    for (let i = 1; i < parts.length; i++) {
      const brM = parts[i].match(DATE_BR);
      const isoM = parts[i].match(DATE_ISO);
      if (brM) {
        dateStr = brM[1];
        dateIdx = i;
        break;
      }
      if (isoM) {
        const [y, m, d] = isoM[1].split('-');
        dateStr = `${d}/${m}/${y}`;
        dateIdx = i;
        break;
      }
    }
    if (dateStr) row.data_nascimento = dateStr;

    // Nome: tudo entre CPF e data (ou tudo após CPF se sem data)
    const nameTokens =
      dateIdx > 0 ? parts.slice(1, dateIdx) : parts.slice(1);
    const nome = nameTokens.join(' ').trim();
    if (nome) row.nome = nome;

    rows.push(row);
  }
  return rows;
}
