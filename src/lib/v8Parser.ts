/**
 * Parser para colagem de CPFs no Simulador V8 CLT.
 * Aceita TSV/CSV/linhas com espaços. Tokens reconhecidos automaticamente
 * em qualquer ordem após o CPF:
 *   - DATA: dd/mm/aaaa ou yyyy-mm-dd
 *   - GÊNERO: M, F, masculino, feminino, male, female
 *   - TELEFONE: bloco com 10 ou 11 dígitos (com ou sem máscara)
 *   - NOME: tudo que sobrar (juntado com espaços)
 *
 * Exemplos válidos:
 *   39364073800 Maicon Douglas 06/08/1990 M 11999998888
 *   39364073800;Maria Silva;15/03/1985;F;(11) 98888-7777
 *   39364073800
 */
export interface V8ParsedRow {
  cpf: string;
  nome?: string;
  data_nascimento?: string;
  genero?: 'M' | 'F';
  telefone?: string;
}

const DATE_BR = /^(\d{2}\/\d{2}\/\d{4})$/;
const DATE_ISO = /^(\d{4}-\d{2}-\d{2})$/;
const GENDER_TOKENS = new Set([
  'm',
  'f',
  'masc',
  'fem',
  'masculino',
  'feminino',
  'male',
  'female',
  'h',
]);

function isDateToken(t: string): string | null {
  const br = t.match(DATE_BR);
  if (br) return br[1];
  const iso = t.match(DATE_ISO);
  if (iso) {
    const [y, m, d] = iso[1].split('-');
    return `${d}/${m}/${y}`;
  }
  return null;
}

function isGenderToken(t: string): 'M' | 'F' | null {
  const norm = t.toLowerCase();
  if (!GENDER_TOKENS.has(norm)) return null;
  if (norm.startsWith('f')) return 'F';
  return 'M';
}

function isPhoneToken(t: string): string | null {
  const digits = t.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) return digits;
  return null;
}

export function parseV8Paste(input: string): V8ParsedRow[] {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const rows: V8ParsedRow[] = [];
  for (const line of lines) {
    let parts = line.split(/\t|;|,/).map((p) => p.trim()).filter(Boolean);
    if (parts.length === 1) {
      parts = line.split(/\s+/).filter(Boolean);
    }

    const cpfRaw = (parts[0] || '').replace(/\D/g, '');
    if (cpfRaw.length !== 11) continue;

    const row: V8ParsedRow = { cpf: cpfRaw };
    const nameTokens: string[] = [];

    for (let i = 1; i < parts.length; i++) {
      const tok = parts[i];
      const date = isDateToken(tok);
      if (date && !row.data_nascimento) {
        row.data_nascimento = date;
        continue;
      }
      const gen = isGenderToken(tok);
      if (gen && !row.genero) {
        row.genero = gen;
        continue;
      }
      const phone = isPhoneToken(tok);
      if (phone && !row.telefone) {
        row.telefone = phone;
        continue;
      }
      nameTokens.push(tok);
    }

    const nome = nameTokens.join(' ').trim();
    if (nome) row.nome = nome;

    rows.push(row);
  }
  return rows;
}
