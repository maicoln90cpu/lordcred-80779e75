// ==================== SHARED CLIPBOARD PARSER ====================

export function looksLikeDateValue(val: string): boolean {
  return /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(val.trim());
}

export interface ClipboardParseResult {
  headers: string[];
  rows: Record<string, string>[];
  format: string;
  rawLineCount: number;
  emptyLines: number;
}

/**
 * Robust clipboard parser supporting TSV (Excel/Sheets), CSV (semicolon/comma).
 * Handles quoted fields with embedded newlines.
 * Auto-detects presence of headers by checking if the first cell looks like a date.
 * When no headers are detected, uses positionalHeaders for mapping.
 */
export function parseClipboardText(
  raw: string,
  positionalHeaders?: string[]
): ClipboardParseResult {
  let normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const firstLine = normalized.split('\n')[0] || '';
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  let sep = '\t';
  let format = 'TSV (Excel/Google Sheets)';
  if (tabCount === 0 && semiCount > 0) { sep = ';'; format = 'CSV (LibreOffice/semicolon)'; }
  else if (tabCount === 0 && semiCount === 0 && commaCount > 0) { sep = ','; format = 'CSV (comma)'; }

  const rows: string[][] = [];
  let current: string[] = [];
  let inQuote = false;
  let field = '';
  const chars = normalized + '\n';

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (inQuote) {
      if (ch === '"' && chars[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuote = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuote = true; }
      else if (ch === sep) { current.push(field.trim()); field = ''; }
      else if (ch === '\n') {
        current.push(field.trim());
        field = '';
        if (current.some(c => c !== '')) rows.push(current);
        current = [];
      } else { field += ch; }
    }
  }

  if (rows.length === 0) return { headers: [], rows: [], format, rawLineCount: 0, emptyLines: 0 };

  const firstCell = rows[0][0] || '';
  const hasHeaders = !looksLikeDateValue(firstCell);

  let headers: string[];
  let startRow: number;

  if (hasHeaders) {
    if (rows.length < 2) return { headers: [], rows: [], format, rawLineCount: rows.length, emptyLines: 0 };
    headers = rows[0];
    startRow = 1;
  } else {
    const colCount = rows[0].length;
    if (positionalHeaders && positionalHeaders.length >= colCount) {
      headers = positionalHeaders.slice(0, colCount);
    } else if (positionalHeaders) {
      headers = [...positionalHeaders, ...rows[0].slice(positionalHeaders.length).map((_, i) => `Col${positionalHeaders!.length + i + 1}`)];
    } else {
      headers = rows[0].map((_, i) => `Col${i + 1}`);
    }
    startRow = 0;
    format += ' (sem cabeçalho)';
  }

  const dataRows: Record<string, string>[] = [];
  let emptyLines = 0;

  for (let r = startRow; r < rows.length; r++) {
    const line = rows[r];
    if (line.every(c => c === '')) { emptyLines++; continue; }
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = line[i] || ''; });
    dataRows.push(obj);
  }

  return { headers, rows: dataRows, format, rawLineCount: rows.length - (hasHeaders ? 1 : 0), emptyLines };
}
