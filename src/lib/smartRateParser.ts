// ==================== SMART RATE PARSER ====================
// Converts free-form text like:
//   LOTUS 1+
//   16,00%
//   HUB Sonho
//   9,5%
//   FACTA FGTS GOLD PLUS 2 anos
//   6,35%
// into structured rate records (FGTS or CLT).
//
// Heuristics
//   • Two-line block: label line + percent line.
//   • Bank is the first known token (LOTUS, HUB, FACTA, PARANA, C6, ITAU, ...).
//     If unknown, the first uppercase word is used.
//   • Term (years) detected via "N anos?" / "N+" / "Nano" tokens.
//   • Value range detected via "até R$X", "de R$X", "acima de R$X",
//     "entre R$X e R$Y", or pure number tokens after "R$".
//   • Insurance flag detected via the words "com seguro" / "sem seguro".
//   • Table/key is the leftover text after stripping bank/term/value/insurance.
//
// The parser is intentionally permissive: anything it cannot map cleanly is
// surfaced in `warnings` so the UI can still preview before insert.

export interface ParsedRate {
  bank: string;
  table_key: string | null;
  term_min: number;
  term_max: number;
  min_value: number;
  max_value: number;
  has_insurance: boolean;
  rate: number;
  obs: string | null;
  /** Original label so the operator can see what was parsed. */
  source: string;
}

export interface SmartParseResult {
  rates: ParsedRate[];
  warnings: string[];
  /** Raw label/percent pairs the parser identified. Useful for debugging. */
  pairs: Array<{ label: string; percent: string }>;
}

const KNOWN_BANKS = [
  'LOTUS', 'HUB', 'FACTA', 'PARANA', 'PARANÁ', 'PARANA BANCO',
  'C6', 'BANCO C6', 'ITAU', 'ITAÚ', 'BMG', 'PAN', 'BANCO PAN',
  'DAYCOVAL', 'SAFRA', 'BRADESCO', 'SANTANDER', 'INTER', 'MERCANTIL',
  'CREFISA', 'OLE', 'OLÉ', 'BANRISUL', 'CETELEM', 'AGIBANK',
];

const PERCENT_RE = /^\s*[+-]?\d{1,3}(?:[.,]\d+)?\s*%\s*$/;

export function looksLikePercent(line: string): boolean {
  return PERCENT_RE.test(line);
}

export function parsePercent(line: string): number {
  const cleaned = line.replace('%', '').replace(',', '.').trim();
  return parseFloat(cleaned) || 0;
}

/**
 * Find the bank inside a label. Returns { bank, rest } where `rest` is the
 * label minus the bank prefix (so it can be further parsed for table/term).
 */
export function extractBank(label: string): { bank: string; rest: string } {
  const upper = label.toUpperCase();
  // Try multi-word matches first (e.g. "PARANA BANCO" before "PARANA")
  const sorted = [...KNOWN_BANKS].sort((a, b) => b.length - a.length);
  for (const bank of sorted) {
    if (upper.startsWith(bank + ' ') || upper === bank) {
      return { bank, rest: label.slice(bank.length).trim() };
    }
  }
  // Fallback: first whitespace-delimited token uppercased.
  const firstToken = label.split(/\s+/)[0] || '';
  return { bank: firstToken.toUpperCase(), rest: label.slice(firstToken.length).trim() };
}

/**
 * Detect a term range from free text. Returns null if nothing recognizable.
 */
export function extractTerm(text: string): { min: number; max: number; matched: string } | null {
  // "2 anos", "5 anos", "1 ano"
  const anos = text.match(/(\d{1,2})\s*anos?\b/i);
  if (anos) {
    const n = parseInt(anos[1]);
    return { min: n, max: n, matched: anos[0] };
  }
  // "1+" / "2+" / "3+" — open-ended
  const plus = text.match(/\b(\d{1,2})\+/);
  if (plus) {
    const n = parseInt(plus[1]);
    return { min: n, max: n, matched: plus[0] };
  }
  return null;
}

/**
 * Detect a value range from free text. Returns null if nothing recognizable.
 */
export function extractValueRange(text: string): { min: number; max: number; matched: string } | null {
  const norm = text.replace(/\s+/g, ' ');
  // "entre R$X e R$Y" or "de X a Y"
  const entre = norm.match(/(?:entre|de)\s*R?\$?\s*([\d.,]+)\s*(?:a|e|até)\s*R?\$?\s*([\d.,]+)/i);
  if (entre) {
    return {
      min: parseMoney(entre[1]),
      max: parseMoney(entre[2]),
      matched: entre[0],
    };
  }
  // "até R$X" / "até X"
  const ate = norm.match(/at[ée]\s*R?\$?\s*([\d.,]+)/i);
  if (ate) {
    return { min: 0, max: parseMoney(ate[1]), matched: ate[0] };
  }
  // "acima de X" / "a partir de X" / "de X" (open upper bound, R$ optional)
  const acima = norm.match(/(?:acima\s+de|a\s+partir\s+de|de)\s*R?\$?\s*([\d.,]+)/i);
  if (acima) {
    return { min: parseMoney(acima[1]), max: 999999999, matched: acima[0] };
  }
  return null;
}

function parseMoney(raw: string): number {
  // Brazilian: "1.234,56" -> 1234.56 ; "250,00" -> 250
  const cleaned = raw.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

export function extractInsurance(text: string): { has: boolean | null; matched: string } {
  if (/sem\s+seguro/i.test(text)) return { has: false, matched: 'sem seguro' };
  if (/com\s+seguro/i.test(text)) return { has: true, matched: 'com seguro' };
  return { has: null, matched: '' };
}

/**
 * Pair lines into label+percent blocks. Tolerates blank lines and stray
 * percent-only lines (those become orphans surfaced as warnings).
 */
export function pairLabelsAndPercents(text: string): {
  pairs: Array<{ label: string; percent: string }>;
  orphans: string[];
} {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const pairs: Array<{ label: string; percent: string }> = [];
  const orphans: string[] = [];
  let pendingLabel: string | null = null;

  for (const line of lines) {
    if (looksLikePercent(line)) {
      if (pendingLabel) {
        pairs.push({ label: pendingLabel, percent: line });
        pendingLabel = null;
      } else {
        orphans.push(line);
      }
    } else {
      // If we already had a pending label, the previous one was an orphan.
      if (pendingLabel) orphans.push(pendingLabel);
      pendingLabel = line;
    }
  }
  if (pendingLabel) orphans.push(pendingLabel);
  return { pairs, orphans };
}

/**
 * Main entry. Pass kind='fgts' to get min_value/max_value, kind='clt' to omit
 * them in the consumer (parser still fills defaults).
 */
export function parseSmartRates(text: string): SmartParseResult {
  const { pairs, orphans } = pairLabelsAndPercents(text);
  const warnings: string[] = [];
  if (orphans.length > 0) {
    warnings.push(`${orphans.length} linha(s) ignorada(s) sem par válido: ${orphans.slice(0, 3).join(' | ')}${orphans.length > 3 ? '…' : ''}`);
  }

  const rates: ParsedRate[] = pairs.map(({ label, percent }) => {
    const { bank, rest } = extractBank(label);
    let working = rest;

    const term = extractTerm(working);
    if (term) working = working.replace(term.matched, ' ');

    const range = extractValueRange(working);
    if (range) working = working.replace(range.matched, ' ');

    const insurance = extractInsurance(working);
    if (insurance.matched) working = working.replace(new RegExp(insurance.matched, 'i'), ' ');

    const tableKey = working.replace(/\s+/g, ' ').trim() || null;

    return {
      bank,
      table_key: tableKey,
      term_min: term?.min ?? 0,
      term_max: term?.max ?? 999,
      min_value: range?.min ?? 0,
      max_value: range?.max ?? 999999999,
      has_insurance: insurance.has ?? false,
      rate: parsePercent(percent),
      obs: label,
      source: label,
    };
  });

  return { rates, warnings, pairs };
}
