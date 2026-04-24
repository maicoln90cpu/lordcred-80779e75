/**
 * Parser para colagem de CPFs no Simulador V8 CLT.
 *
 * Suporta múltiplos formatos por linha:
 *   1) Tokens separados por TAB / `;` / `,` / espaço — em qualquer ordem após o CPF:
 *        39364073800 Maicon Douglas 06/08/1990 M 11999998888
 *        39364073800;Maria Silva;15/03/1985;F;(11) 98888-7777
 *
 *   2) CPF puro:
 *        39364073800
 *
 *   3) **Formato concatenado** (sem separadores), como exportado por alguns ERPs:
 *        DANIEL ALYSSON BARBOSA DA SILVA1044251247308/05/1992
 *      Reconhece: NOME (letras+espaços) + CPF (11 dígitos) + DATA (dd/mm/aaaa
 *      ou yyyy-mm-dd) — em qualquer ordem entre si.
 *
 * Tokens reconhecidos automaticamente:
 *   - DATA: dd/mm/aaaa ou yyyy-mm-dd
 *   - GÊNERO: M, F, masculino, feminino, male, female
 *   - TELEFONE: bloco com 10 ou 11 dígitos
 *   - NOME: tudo que sobrar (juntado com espaços)
 */
export interface V8ParsedRow {
  cpf: string;
  nome?: string;
  data_nascimento?: string;
  genero?: 'M' | 'F';
  telefone?: string;
}

export type V8PasteIssueCode = 'invalid_format' | 'invalid_date' | 'missing_birth_date';

export interface V8PasteIssue {
  lineNumber: number;
  raw: string;
  code: V8PasteIssueCode;
  message: string;
}

export interface V8PasteAnalysis {
  rows: V8ParsedRow[];
  issues: V8PasteIssue[];
  totalLines: number;
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

function isRealDate(day: number, month: number, year: number): boolean {
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function hasInvalidDateLikeToken(line: string): boolean {
  const matches = line.match(/\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2}/g) ?? [];

  return matches.some((token) => {
    if (DATE_BR.test(token)) {
      const [day, month, year] = token.split('/').map(Number);
      return !isRealDate(day, month, year);
    }

    if (DATE_ISO.test(token)) {
      const [year, month, day] = token.split('-').map(Number);
      return !isRealDate(day, month, year);
    }

    return false;
  });
}

function parseV8Line(line: string): V8ParsedRow | null {
  let parts = line.split(/\t|;|,/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 1) {
    parts = line.split(/\s+/).filter(Boolean);
  }

  const firstPart = parts[0] || '';
  const hasLettersAndDigits = /[A-Za-zÀ-ÿ]/.test(firstPart) && /\d/.test(firstPart);
  if (hasLettersAndDigits) {
    const concat = parseConcatenated(line);
    if (concat) return concat;
  }

  const cpfRaw = (parts[0] || '').replace(/\D/g, '');
  if (cpfRaw.length === 11) {
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
    return row;
  }

  return parseConcatenated(line);
}

export function analyzeV8Paste(input: string): V8PasteAnalysis {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const rows: V8ParsedRow[] = [];
  const issues: V8PasteIssue[] = [];

  lines.forEach((line, index) => {
    if (hasInvalidDateLikeToken(line)) {
      issues.push({
        lineNumber: index + 1,
        raw: line,
        code: 'invalid_date',
        message: 'Data inválida. Use uma data real em dd/mm/aaaa ou yyyy-mm-dd.',
      });
      return;
    }

    const parsed = parseV8Line(line);
    if (!parsed) {
      issues.push({
        lineNumber: index + 1,
        raw: line,
        code: 'invalid_format',
        message: 'Formato não reconhecido. Inclua pelo menos CPF e data de nascimento.',
      });
      return;
    }

    if (!parsed.data_nascimento) {
      issues.push({
        lineNumber: index + 1,
        raw: line,
        code: 'missing_birth_date',
        message: 'Linha sem data de nascimento. A V8 exige este campo.',
      });
      return;
    }

    rows.push(parsed);
  });

  return { rows, issues, totalLines: lines.length };
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

/**
 * Tenta extrair { cpf, nome?, data_nascimento? } de uma linha sem separadores
 * onde os campos vêm "colados".
 *
 * Estratégia: procura uma data (dd/mm/aaaa ou yyyy-mm-dd) e uma sequência de
 * exatamente 11 dígitos contíguos no mesmo bloco. O que sobra é o nome
 * (sequência de letras + espaços + acentos).
 *
 * Retorna `null` se não for possível identificar CPF.
 */
export function parseConcatenated(line: string): V8ParsedRow | null {
  // Detecta data primeiro (BR ou ISO) em qualquer posição.
  const dateBrMatch = line.match(/(\d{2}\/\d{2}\/\d{4})/);
  const dateIsoMatch = line.match(/(\d{4}-\d{2}-\d{2})/);
  let data_nascimento: string | undefined;
  let lineNoDate = line;
  if (dateBrMatch) {
    data_nascimento = dateBrMatch[1];
    lineNoDate = line.replace(dateBrMatch[0], ' ');
  } else if (dateIsoMatch) {
    const [y, m, d] = dateIsoMatch[1].split('-');
    data_nascimento = `${d}/${m}/${y}`;
    lineNoDate = line.replace(dateIsoMatch[0], ' ');
  }

  // Procura sequência de 11 dígitos contíguos (CPF cru, sem máscara).
  const cpfMatch = lineNoDate.match(/(\d{11})/);
  if (!cpfMatch) return null;
  const cpf = cpfMatch[1];

  // O que sobra (sem CPF e sem data) é o nome.
  const nome = lineNoDate
    .replace(cpfMatch[0], ' ')
    .replace(/[^A-Za-zÀ-ÿ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const row: V8ParsedRow = { cpf };
  if (nome) row.nome = nome;
  if (data_nascimento) row.data_nascimento = data_nascimento;
  return row;
}

export function parseV8Paste(input: string): V8ParsedRow[] {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const rows: V8ParsedRow[] = [];
  for (const line of lines) {
    const parsed = parseV8Line(line);
    if (parsed) {
      rows.push(parsed);
      continue;
    }
    // Senão, descarta a linha (CPF inválido).
  }
  return rows;
}
