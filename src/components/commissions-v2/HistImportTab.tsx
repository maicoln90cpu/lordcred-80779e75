import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Upload, Loader2 } from 'lucide-react';
import { loadXLSX } from '@/lib/xlsx-lazy';
import CRImportHistory from '@/components/commission-reports/CRImportHistory';
import { parseExcelDate, cleanCurrency } from './commissionUtils';
import type { Profile } from './commissionUtils';
import { resolveSellerByName } from '@/lib/sellerNameMatch';

interface HistImportTabProps {
  userId: string;
  profiles: Profile[];
  getSellerName: (id: string) => string;
}

export default function HistImportTab({ userId, profiles, getSellerName }: HistImportTabProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const findSellerByName = async (name: string): Promise<string | null> => {
    const r = await resolveSellerByName(name, profiles);
    if (!r.userId) return null;
    if (r.ambiguous) {
      console.warn('[commissions import V2] match ambíguo descartado para', name, r);
      return null;
    }
    return r.userId;
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const XLSX = await loadXLSX();
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const XLSX = await loadXLSX();
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array', cellDates: true });
      const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('base')) || wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (rows.length === 0) { toast({ title: 'Planilha vazia', variant: 'destructive' }); return; }

      const normalize = (s: string) => s?.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() || '';
      const findCol = (row: any, aliases: string[]) => { const keys = Object.keys(row); for (const alias of aliases) { const found = keys.find(k => normalize(k) === normalize(alias)); if (found) return row[found]; } return undefined; };

      let skipped = 0;
      const payloads: any[] = [];
      for (const row of rows) {
        const rawDate = findCol(row, ['Data Pago', 'data_pago', 'Data', 'data pago']);
        const saleDate = parseExcelDate(rawDate);
        if (!saleDate) { skipped++; continue; }
        const bank = findCol(row, ['Banco', 'banco']) || '';
        const releasedValue = cleanCurrency(findCol(row, ['Valor Liberado', 'valor_liberado', 'Valor', 'valor liberado']));
        if (!bank || releasedValue <= 0) { skipped++; continue; }
        const sellerName = findCol(row, ['Vendedor', 'vendedor'])?.toString() || '';
        payloads.push({
          sale_date: saleDate, product: findCol(row, ['Produto', 'produto']) || 'FGTS', bank,
          term: parseInt(findCol(row, ['Prazo', 'prazo'])) || null, released_value: releasedValue,
          has_insurance: findCol(row, ['Seguro', 'seguro'])?.toString().toLowerCase().trim() === 'sim',
          client_cpf: findCol(row, ['CPF', 'cpf'])?.toString() || null,
          client_name: findCol(row, ['Nome', 'nome', 'Cliente'])?.toString() || null,
          client_phone: findCol(row, ['Telefone', 'telefone', 'Fone'])?.toString() || null,
          seller_id: (await findSellerByName(sellerName)) || userId,
          external_proposal_id: findCol(row, ['id', 'ID', 'Id Proposta', 'external_proposal_id'])?.toString() || null,
          table_name: findCol(row, ['Tabela', 'tabela', 'Table'])?.toString() || null,
          client_birth_date: findCol(row, ['Data Nascimento', 'data_nascimento', 'Nascimento'])?.toString() || null,
          created_by: userId,
        });
      }
      if (payloads.length === 0) { toast({ title: 'Nenhum registro válido encontrado', variant: 'destructive' }); return; }

      const { data: batchRecord, error: batchErr } = await supabase.from('import_batches' as any).insert({
        file_name: file.name, module: 'parceiros_v2', sheet_name: 'base', row_count: payloads.length, imported_by: userId, status: 'active',
      } as any).select('id').single();
      const batchId = batchErr ? null : (batchRecord as any)?.id;
      if (batchId) payloads.forEach(p => { p.batch_id = batchId; });

      let errors = 0;
      for (let i = 0; i < payloads.length; i += 50) {
        const batch = payloads.slice(i, i + 50);
        const { error } = await supabase.from('commission_sales_v2').insert(batch as any);
        if (error) { console.error('Batch error:', error); errors += batch.length; }
      }
      if (batchId && errors > 0) await supabase.from('import_batches' as any).update({ row_count: payloads.length - errors } as any).eq('id', batchId);

      toast({ title: 'Importação concluída', description: `${payloads.length - errors} registros importados${skipped > 0 ? `, ${skipped} ignorados` : ''}${errors > 0 ? `, ${errors} com erro` : ''}` });
      setRefreshKey(k => k + 1);
    } catch (err: any) {
      toast({ title: 'Erro na importação', description: err.message, variant: 'destructive' });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <input type="file" ref={fileInputRef} accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
              {importing ? 'Importando...' : 'Importar Excel'}
            </Button>
            <span className="text-xs text-muted-foreground">Importe um arquivo Excel para criar um novo lote na Base</span>
          </div>
        </CardContent>
      </Card>
      <CRImportHistory key={refreshKey} moduleFilter="parceiros_v2" />
    </div>
  );
}
