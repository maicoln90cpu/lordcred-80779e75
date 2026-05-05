// Parser tolerante de data de vigência para imports XLSX/colagem.
// Aceita: ISO "AAAA-MM-DD", BR "dd/mm/aaaa", "dd-mm-aaaa", Date nativo do Excel
// (serial number ex: 45123) e objetos Date. Retorna ISO ou null se inválido.
export function parseEffectiveDate(raw: any): string | null {
  if (raw === null || raw === undefined || raw === '') return null;

  // Date nativo (vem quando XLSX é lido com cellDates:true)
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }

  // Número (serial date Excel — base 1899-12-30)
  if (typeof raw === 'number' && isFinite(raw) && raw > 59) {
    const ms = (raw - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  const s = String(raw).trim();
  if (!s) return null;

  // ISO AAAA-MM-DD (com ou sem hora)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // BR dd/mm/aaaa ou dd-mm-aaaa (aceita ano com 2 dígitos → 20YY)
  const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (br) {
    const dd = br[1].padStart(2, '0');
    const mm = br[2].padStart(2, '0');
    let yyyy = br[3];
    if (yyyy.length === 2) yyyy = '20' + yyyy;
    return `${yyyy}-${mm}-${dd}`;
  }

  // Fallback: Date.parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

// Helper de preview: conta quantas linhas vieram com vigência da planilha vs default
export function countDateSources<T extends { _vigencia_origem?: 'sheet' | 'default' }>(rows: T[]) {
  let fromSheet = 0;
  let fromDefault = 0;
  for (const r of rows) {
    if (r._vigencia_origem === 'sheet') fromSheet++;
    else fromDefault++;
  }
  return { fromSheet, fromDefault };
}
