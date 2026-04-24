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
    let parts = line.split(/\t|;|,/).map((p) => p.trim()).filter(Boolean);
    if (parts.length === 1) {
      parts = line.split(/\s+/).filter(Boolean);
    }

    // Heurística: se a primeira parte mistura letras E dígitos (ex.: "39364073800MAICON"
    // ou "MARIA1044251247308"), trata-se de formato concatenado — tenta esse path antes.
    const firstPart = parts[0] || '';
    const hasLettersAndDigits = /[A-Za-zÀ-ÿ]/.test(firstPart) && /\d/.test(firstPart);
    if (hasLettersAndDigits) {
      const concat = parseConcatenated(line);
      if (concat) {
        rows.push(concat);
        continue;
      }
    }

    const cpfRaw = (parts[0] || '').replace(/\D/g, '');

    // Caso 1: formato com separadores e CPF na primeira posição.
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

      rows.push(row);
      continue;
    }

    // Caso 2: linha concatenada (NOME+CPF+DATA sem separadores).
    const concat = parseConcatenated(line);
    if (concat) {
      rows.push(concat);
      continue;
    }
    // Senão, descarta a linha (CPF inválido).
  }
  return rows;
}
