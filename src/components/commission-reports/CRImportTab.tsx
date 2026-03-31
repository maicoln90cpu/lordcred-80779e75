import { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, Loader2, FileSpreadsheet, Search, Download } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import CRPasteImportButton from './CRPasteImportButton';
import { TSHead, THead, useSortState, applySortToData, TOOLTIPS_GERAL, TOOLTIPS_REPASSE, TOOLTIPS_SEGUROS } from './CRSortUtils';
import type { SortConfig } from './CRSortUtils';

// ==================== HELPERS ====================
function cleanCurrency(v: any): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  const s = String(v).trim();
  if (s.includes(',')) {
    const c = s.replace(/[R$\s.]/g, '').replace(',', '.');
    const n = parseFloat(c);
    return isNaN(n) ? null : n;
  }
  const c = s.replace(/[R$\s]/g, '');
  const n = parseFloat(c);
  return isNaN(n) ? null : n;
}

function cleanPercent(v: any): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace('%', '').replace(',', '.').trim();
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

const normalize = (s: string) => s?.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() || '';

function findCol(row: Record<string, any>, aliases: string[]): any {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const found = keys.find(k => normalize(k) === normalize(alias));
    if (found !== undefined) return row[found];
  }
  return undefined;
}

const fmtBRL = (v: number | null) => v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-';
const fmtPct = (v: number | null) => v != null ? `${v.toFixed(2)}%` : '-';

// ==================== COLUMN DEFINITIONS ====================
export interface ColumnDef {
  key: string;
  label: string;
  aliases: string[];
  type: 'text' | 'currency' | 'percent' | 'integer' | 'date';
  width?: string;
}

function cleanDate(v: any): string | null {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
  // DD/MM/YYYY or MM/DD/YYYY with optional time
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(.*)$/);
  if (m) {
    let [, a, b, y, rest] = m;
    let year = y.length === 2 ? '20' + y : y;
    // If a > 12, it must be DD/MM/YYYY
    let day: string, month: string;
    if (parseInt(a) > 12) { day = a.padStart(2, '0'); month = b.padStart(2, '0'); }
    // If b > 12, it must be MM/DD/YYYY
    else if (parseInt(b) > 12) { month = a.padStart(2, '0'); day = b.padStart(2, '0'); }
    // Ambiguous — assume DD/MM (Brazilian default)
    else { day = a.padStart(2, '0'); month = b.padStart(2, '0'); }
    const time = rest?.trim() || '';
    if (time) {
      const tm = time.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if (tm) return `${year}-${month}-${day}T${tm[1].padStart(2,'0')}:${tm[2]}:${tm[3]||'00'}`;
    }
    return `${year}-${month}-${day}`;
  }
  return null;
}

export const GERAL_COLUMNS: ColumnDef[] = [
  { key: 'data_pgt_cliente', label: 'Data Pgt', aliases: ['data pgt cliente', 'data_pgt_cliente', 'data pago', 'data pgt'], type: 'date' },
  { key: 'data_digitacao', label: 'Data Digitação', aliases: ['data digitacao', 'data_digitacao', 'data digitação'], type: 'date' },
  { key: 'ade', label: 'ADE', aliases: ['ade'], type: 'text' },
  { key: 'cod_contrato', label: 'Cód Contrato', aliases: ['cod contrato', 'cod_contrato', 'código contrato'], type: 'text' },
  { key: 'cpf', label: 'CPF', aliases: ['cpf'], type: 'text' },
  { key: 'idade', label: 'Idade', aliases: ['idade'], type: 'text' },
  { key: 'nome_cliente', label: 'Nome', aliases: ['nome cliente', 'nome_cliente', 'nome'], type: 'text' },
  { key: 'convenio', label: 'Convênio', aliases: ['convenio', 'convênio'], type: 'text' },
  { key: 'pmts', label: 'PMTS', aliases: ['pmts'], type: 'text' },
  { key: 'prazo', label: 'Prazo', aliases: ['prazo'], type: 'integer' },
  { key: 'prod_liq', label: 'Prod Líq', aliases: ['prod liq', 'prod_liq', 'prod líq', 'produção liquida'], type: 'currency' },
  { key: 'pct_cms', label: '% CMS', aliases: ['% cms', 'pct_cms', 'pct cms'], type: 'percent' },
  { key: 'prod_bruta', label: 'Prod Bruta', aliases: ['prod bruta', 'prod_bruta', 'produção bruta'], type: 'currency' },
  { key: 'pct_cms_bruta', label: '% CMS Bruta', aliases: ['% cms bruta', 'pct_cms_bruta', 'pct cms bruta'], type: 'percent' },
  { key: 'tipo_operacao', label: 'Tipo Op.', aliases: ['tipo operação', 'tipo operacao', 'tipo_operacao', 'tipo op'], type: 'text' },
  { key: 'banco', label: 'Banco', aliases: ['banco'], type: 'text' },
  { key: 'cms_rep', label: 'CMS REP', aliases: ['cms rep', 'cms_rep', 'comissão rep'], type: 'currency' },
];

export const REPASSE_COLUMNS: ColumnDef[] = [
  { key: 'data_pgt_cliente', label: 'Data Pgt', aliases: ['data pgt cliente', 'data_pgt_cliente', 'data pago'], type: 'date' },
  { key: 'data_digitacao', label: 'Data Digitação', aliases: ['data digitacao', 'data_digitacao', 'data digitação'], type: 'date' },
  { key: 'ade', label: 'ADE', aliases: ['ade'], type: 'text' },
  { key: 'cod_contrato', label: 'Cód Contrato', aliases: ['cod contrato', 'cod_contrato'], type: 'text' },
  { key: 'cpf', label: 'CPF', aliases: ['cpf'], type: 'text' },
  { key: 'idade', label: 'Idade', aliases: ['idade'], type: 'text' },
  { key: 'nome_cliente', label: 'Nome', aliases: ['nome cliente', 'nome_cliente', 'nome'], type: 'text' },
  { key: 'convenio', label: 'Convênio', aliases: ['convenio', 'convênio'], type: 'text' },
  { key: 'pmts', label: 'PMTS', aliases: ['pmts'], type: 'text' },
  { key: 'prazo', label: 'Prazo', aliases: ['prazo'], type: 'integer' },
  { key: 'prod_liq', label: 'Prod Líq', aliases: ['prod liq', 'prod_liq'], type: 'currency' },
  { key: 'pct_cms', label: '% CMS', aliases: ['% cms', 'pct_cms'], type: 'percent' },
  { key: 'prod_bruta', label: 'Prod Bruta', aliases: ['prod bruta', 'prod_bruta'], type: 'currency' },
  { key: 'pct_cms_bruta', label: '% CMS Bruta', aliases: ['% cms bruta', 'pct_cms_bruta'], type: 'percent' },
  { key: 'tipo_operacao', label: 'Tipo Op.', aliases: ['tipo operação', 'tipo operacao', 'tipo_operacao'], type: 'text' },
  { key: 'banco', label: 'Banco', aliases: ['banco'], type: 'text' },
  { key: 'cms_rep', label: 'CMS REP', aliases: ['cms rep', 'cms_rep'], type: 'currency' },
  { key: 'pct_rateio', label: '% Rateio', aliases: ['% rateio', 'pct_rateio', 'pct rateio'], type: 'percent' },
  { key: 'pct_rateio_fixo', label: '% Rateio Fixo', aliases: ['% rateio fixo', 'pct_rateio_fixo', 'pct rateio fixo'], type: 'percent' },
  { key: 'cms_rep_favorecido', label: 'CMS REP Fav.', aliases: ['cms rep favorecido', 'cms_rep_favorecido', 'cms rep fav'], type: 'currency' },
  { key: 'favorecido', label: 'Favorecido', aliases: ['favorecido'], type: 'text' },
];

export const SEGUROS_COLUMNS: ColumnDef[] = [
  { key: 'id_seguro', label: 'ID Seguro', aliases: ['id seguro', 'id_seguro', 'id'], type: 'text' },
  { key: 'data_registro', label: 'Data Registro', aliases: ['data registro', 'data_registro', 'data'], type: 'date' },
  { key: 'descricao', label: 'Descrição', aliases: ['descrição', 'descricao', 'desc'], type: 'text' },
  { key: 'tipo_comissao', label: 'Tipo Comissão', aliases: ['tipo comissão', 'tipo comissao', 'tipo_comissao', 'tipo'], type: 'text' },
  { key: 'valor_comissao', label: 'Valor Comissão', aliases: ['valor comissão', 'valor comissao', 'valor_comissao', 'valor'], type: 'currency' },
];

function getTooltipMap(module: string): Record<string, string> {
  if (module === 'geral') return TOOLTIPS_GERAL;
  if (module === 'repasse') return TOOLTIPS_REPASSE;
  if (module === 'seguros') return TOOLTIPS_SEGUROS;
  return {};
}

// ==================== GENERIC IMPORT TAB ====================
interface CRImportTabProps {
  module: 'geral' | 'repasse' | 'seguros';
  tableName: string;
  columns: ColumnDef[];
  title: string;
  description: string;
  noHeader?: boolean;
}

export default function CRImportTab({ module, tableName, columns, title, description, noHeader }: CRImportTabProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [parsedData, setParsedData] = useState<Record<string, any>[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState('');
  const { sort, toggle: toggleSort } = useSortState();
  const { sort: previewSort, toggle: togglePreviewSort } = useSortState();

  const tooltipMap = getTooltipMap(module);

  const { data: existingData = [], isLoading, refetch } = useQuery({
    queryKey: [`cr-${module}`],
    queryFn: async () => {
      const { data, error } = await supabase.from(tableName as any).select('*').order('created_at', { ascending: false }).limit(1000);
      if (error) throw error;
      return (data || []) as Record<string, any>[];
    }
  });

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];

      let rows: Record<string, any>[];
      if (noHeader) {
        rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[];
        rows = (rows as any[][]).filter(r => r.some(c => c !== '')).map(r => {
          const obj: Record<string, any> = {};
          columns.forEach((col, i) => { obj[col.key] = r[i] ?? ''; });
          return obj;
        });
      } else {
        const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
        rows = rawRows.map(row => {
          const norm: Record<string, any> = {};
          for (const key of Object.keys(row)) { norm[key.toLowerCase().trim()] = row[key]; }
          const mapped: Record<string, any> = {};
          for (const col of columns) {
            const raw = findCol(norm, col.aliases.map(a => normalize(a)));
            mapped[col.key] = raw === undefined ? (findCol(norm, [col.key]) ?? '') : raw;
          }
          return mapped;
        });
      }

      const cleaned = rows.map(row => {
        const r: Record<string, any> = {};
        for (const col of columns) {
          const raw = row[col.key];
          switch (col.type) {
            case 'currency': r[col.key] = cleanCurrency(raw); break;
            case 'percent': r[col.key] = cleanPercent(raw); break;
            case 'integer': r[col.key] = raw ? parseInt(String(raw)) || null : null; break;
            case 'date': r[col.key] = cleanDate(raw); break;
            default: r[col.key] = raw != null ? String(raw) : '';
          }
        }
        return r;
      });

      setParsedData(cleaned.filter(r => columns.some(c => {
        const v = r[c.key];
        return v != null && v !== '' && v !== 0;
      })));
    };
    reader.readAsArrayBuffer(file);
  }, [columns, noHeader]);

  const handleImport = async () => {
    if (parsedData.length === 0) return;
    setImporting(true);
    try {
      const { data: batch, error: batchErr } = await supabase.from('import_batches' as any).insert({
        module: 'relatorios', sheet_name: module, file_name: fileName,
        row_count: parsedData.length, imported_by: user!.id,
      } as any).select().single();
      if (batchErr) throw batchErr;
      const batchId = (batch as any).id;

      for (let i = 0; i < parsedData.length; i += 100) {
        const chunk = parsedData.slice(i, i + 100).map(row => ({ ...row, batch_id: batchId }));
        const { error } = await supabase.from(tableName as any).insert(chunk as any);
        if (error) throw error;
      }

      toast({ title: `${parsedData.length} registros importados com sucesso!` });
      setParsedData([]); setFileName('');
      if (fileRef.current) fileRef.current.value = '';
      refetch();
      queryClient.invalidateQueries({ queryKey: ['cr-import-batches'] });
    } catch (error: any) {
      toast({ title: 'Erro ao importar', description: error.message, variant: 'destructive' });
    } finally { setImporting(false); }
  };

  const filterFn = (row: Record<string, any>) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return columns.some(c => String(row[c.key] ?? '').toLowerCase().includes(q));
  };

  const filteredExisting = existingData.filter(filterFn);
  const sortedExisting = applySortToData(filteredExisting, sort);
  const sortedPreview = applySortToData(parsedData, previewSort);

  const handleExport = () => {
    if (filteredExisting.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(filteredExisting.map(row => {
      const r: Record<string, any> = {};
      for (const col of columns) { r[col.label] = row[col.key] ?? ''; }
      return r;
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title);
    XLSX.writeFile(wb, `cr_${module}.xlsx`);
    toast({ title: 'Exportado com sucesso' });
  };

  const renderCell = (val: any, col: ColumnDef) => {
    if (val == null || val === '') return '-';
    switch (col.type) {
      case 'currency': return fmtBRL(val);
      case 'percent': return fmtPct(val);
      default: return String(val);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileSpreadsheet className="w-5 h-5" />
            Importar {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="max-w-sm cursor-pointer" />
            <CRPasteImportButton module={module} tableName={tableName} columns={columns} noHeader={noHeader} onImported={() => { refetch(); queryClient.invalidateQueries({ queryKey: ['cr-import-batches'] }); }} />
            {fileName && <span className="text-sm text-muted-foreground">📄 {fileName}</span>}
          </div>

          {parsedData.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">{parsedData.length} registros encontrados</Badge>
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importando...</> : <><Upload className="w-4 h-4 mr-2" /> Importar</>}
                </Button>
              </div>
              <div className="border rounded-lg max-h-72 overflow-auto">
                <Table>
                  <TableHeader>
                    <tr>
                      {columns.map(col => (
                        <TSHead key={col.key} label={col.label} sortKey={col.key} sort={previewSort} toggle={togglePreviewSort}
                          tooltip={tooltipMap[col.key]} className="text-xs whitespace-nowrap" />
                      ))}
                    </tr>
                  </TableHeader>
                  <TableBody>
                    {sortedPreview.slice(0, 30).map((row, i) => (
                      <tr key={i}>
                        {columns.map(col => (
                          <TableCell key={col.key} className="text-xs py-1.5 whitespace-nowrap">{renderCell(row[col.key], col)}</TableCell>
                        ))}
                      </tr>
                    ))}
                  </TableBody>
                </Table>
                {parsedData.length > 30 && (
                  <p className="text-center text-xs text-muted-foreground py-2">Mostrando 30 de {parsedData.length}...</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Dados Importados — {title}</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 w-48 h-9" />
              </div>
              <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredExisting.length === 0}>
                <Download className="w-4 h-4 mr-1" /> Exportar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : sortedExisting.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">Nenhum dado importado ainda.</p>
          ) : (
            <div className="border rounded-lg max-h-[500px] overflow-auto">
              <Table>
                <TableHeader>
                  <tr>
                    {columns.map(col => (
                      <TSHead key={col.key} label={col.label} sortKey={col.key} sort={sort} toggle={toggleSort}
                        tooltip={tooltipMap[col.key]} className="text-xs whitespace-nowrap" />
                    ))}
                  </tr>
                </TableHeader>
                <TableBody>
                  {sortedExisting.slice(0, 200).map((row, i) => (
                    <tr key={row.id || i}>
                      {columns.map(col => (
                        <TableCell key={col.key} className="text-xs py-1.5 whitespace-nowrap">{renderCell(row[col.key], col)}</TableCell>
                      ))}
                    </tr>
                  ))}
                </TableBody>
              </Table>
              {sortedExisting.length > 200 && (
                <p className="text-center text-xs text-muted-foreground py-2">Mostrando 200 de {sortedExisting.length}...</p>
              )}
            </div>
          )}
          <div className="flex justify-end mt-2">
            <Badge variant="outline" className="text-xs">{filteredExisting.length} registros</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
