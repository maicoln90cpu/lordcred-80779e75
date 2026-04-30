import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Download, Upload, Loader2 } from 'lucide-react';
import { TSHead, useSortState, applySortToData } from '@/components/commission-reports/CRSortUtils';
import { parseClipboardText } from '@/lib/clipboardParser';
import { loadXLSX } from '@/lib/xlsx-lazy';
import type { RateFGTS } from './commissionUtils';
import RatesBulkControls from '@/components/commissions/RatesBulkControls';
import SmartPasteRatesButton from '@/components/commissions/SmartPasteRatesButton';
import { previewRateUpsert, upsertRates } from './rateUpsert';

export default function RatesFGTSTab() {
  const { toast } = useToast();
  const [rates, setRates] = useState<RateFGTS[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RateFGTS | null>(null);
  const [form, setForm] = useState({ effective_date: '', bank: '', table_key: '', term_min: '0', term_max: '999', min_value: '0', max_value: '999999999', has_insurance: false, rate: '', obs: '' });
  const { sort, toggle } = useSortState();
  const [bankFilter, setBankFilter] = useState<string>('__all__');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importStats, setImportStats] = useState<{ newCount: number; replaceCount: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadRates(); }, []);

  const loadRates = async () => {
    setLoading(true);
    const { data } = await supabase.from('commission_rates_fgts_v2').select('*').order('effective_date', { ascending: false });
    if (data) setRates(data as unknown as RateFGTS[]);
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ effective_date: new Date().toISOString().slice(0, 10), bank: '', table_key: '', term_min: '0', term_max: '999', min_value: '0', max_value: '999999999', has_insurance: false, rate: '', obs: '' });
    setDialogOpen(true);
  };

  const openEdit = (r: RateFGTS) => {
    setEditing(r);
    setForm({
      effective_date: r.effective_date, bank: r.bank, table_key: r.table_key || '',
      term_min: r.term_min.toString(), term_max: r.term_max.toString(),
      min_value: r.min_value.toString(), max_value: r.max_value.toString(),
      has_insurance: r.has_insurance, rate: r.rate.toString(), obs: r.obs || ''
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.bank || !form.effective_date || !form.rate) { toast({ title: 'Preencha campos obrigatórios', variant: 'destructive' }); return; }
    const payload = {
      effective_date: form.effective_date, bank: form.bank, table_key: form.table_key || null,
      term_min: parseInt(form.term_min) || 0, term_max: parseInt(form.term_max) || 999,
      min_value: parseFloat(form.min_value) || 0, max_value: parseFloat(form.max_value) || 999999999,
      has_insurance: form.has_insurance, rate: parseFloat(form.rate) || 0, obs: form.obs || null,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from('commission_rates_fgts_v2').update(payload as any).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('commission_rates_fgts_v2').insert(payload as any));
    }
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Taxa salva' }); setDialogOpen(false); loadRates(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta taxa?')) return;
    await supabase.from('commission_rates_fgts_v2').delete().eq('id', id);
    toast({ title: 'Taxa excluída' }); loadRates();
  };

  const downloadTemplate = async () => {
    const XLSX = await loadXLSX();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Banco', 'Tabela', 'Prazo Min', 'Prazo Max', 'Valor Min', 'Valor Max', 'Seguro (Sim/Não)', 'Taxa (%)', 'Obs', 'Data Vigência (AAAA-MM-DD, opcional)'],
      ['LOTUS', 'LOTUS 1+', '1', '1', '0', '999999999', 'Não', '16', 'Prazo 1 ano', ''],
    ]);
    ws['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 25 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo FGTS V2');
    XLSX.writeFile(wb, 'modelo_taxas_fgts_v2.xlsx');
  };

  const parseImportData = (rows: Record<string, string>[]) => {
    const today = new Date().toISOString().slice(0, 10);
    return rows.map(r => {
      // UPPERCASE em bank/table_key — alinha com índice case-sensitive e função UPPER().
      const bank = (r['Banco'] || r['banco'] || '').toString().trim().toUpperCase();
      const tableKey = (r['Tabela'] || r['tabela'] || '').toString().trim().toUpperCase();
      const termMin = parseInt((r['Prazo Min'] || r['prazo_min'] || '0').toString()) || 0;
      const termMax = parseInt((r['Prazo Max'] || r['prazo_max'] || '999').toString()) || 999;
      const minValue = parseFloat((r['Valor Min'] || r['valor_min'] || '0').toString().replace(',', '.')) || 0;
      const maxValue = parseFloat((r['Valor Max'] || r['valor_max'] || '999999999').toString().replace(',', '.')) || 999999999;
      const seguroRaw = (r['Seguro (Sim/Não)'] || r['Seguro'] || r['seguro'] || 'Não').toString().toLowerCase();
      const hasInsurance = seguroRaw === 'sim' || seguroRaw === 'true' || seguroRaw === '1';
      const rate = parseFloat((r['Taxa (%)'] || r['Taxa'] || r['taxa'] || '0').toString().replace(',', '.')) || 0;
      const obs = (r['Obs'] || r['obs'] || '').toString();
      const dataVigRaw = (r['Data Vigência (AAAA-MM-DD, opcional)'] || r['Data Vigência'] || r['data_vigencia'] || r['effective_date'] || '').toString().trim();
      const effectiveDate = /^\d{4}-\d{2}-\d{2}$/.test(dataVigRaw) ? dataVigRaw : today;
      return { effective_date: effectiveDate, bank, table_key: tableKey || null, term_min: termMin, term_max: termMax, min_value: minValue, max_value: maxValue, has_insurance: hasInsurance, rate, obs: obs || null };
    }).filter(r => r.bank);
  };

  // Calcula contadores novas/substituídas sempre que o preview mudar
  useEffect(() => {
    if (importPreview.length === 0) { setImportStats(null); return; }
    let cancelled = false;
    previewRateUpsert('commission_rates_fgts_v2', importPreview as any)
      .then(stats => { if (!cancelled) setImportStats(stats); })
      .catch(() => { if (!cancelled) setImportStats(null); });
    return () => { cancelled = true; };
  }, [importPreview]);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const XLSX = await loadXLSX();
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { raw: false });
    setImportPreview(parseImportData(rows));
    setImportDialogOpen(true);
    if (importFileRef.current) importFileRef.current.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    const parsed = parseClipboardText(text, ['Banco', 'Tabela', 'Prazo Min', 'Prazo Max', 'Valor Min', 'Valor Max', 'Seguro (Sim/Não)', 'Taxa (%)', 'Obs', 'Data Vigência (AAAA-MM-DD, opcional)']);
    setImportPreview(parseImportData(parsed.rows));
  };

  const confirmImport = async () => {
    if (importPreview.length === 0) return;
    setImporting(true);
    try {
      const res = await upsertRates('commission_rates_fgts_v2', importPreview as any);
      if (res.errors.length > 0) {
        toast({
          title: 'Importação concluída com erros',
          description: `${res.inserted} novas, ${res.updated} substituídas. ${res.errors.length} falha(s): ${res.errors[0]}`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Importação concluída',
          description: `${res.inserted} nova(s) inserida(s) · ${res.updated} substituída(s).`,
        });
      }
      setImportDialogOpen(false);
      setImportPreview([]);
      setImportStats(null);
      loadRates();
    } catch (err: any) {
      toast({ title: 'Erro ao importar', description: err.message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle>Taxas Comissão FGTS <span className="ml-2 text-xs font-normal text-muted-foreground">(V2 — multi-variável)</span></CardTitle>
          <div className="flex gap-2 flex-wrap">
            
            <Button variant="outline" size="sm" onClick={downloadTemplate}><Download className="w-4 h-4 mr-1" /> Baixar Modelo</Button>
            <Button variant="outline" size="sm" onClick={() => {
              const XLSX = await loadXLSX();
              if (rates.length === 0) { toast({ title: 'Nenhuma taxa para exportar' }); return; }
              const data = rates.map(r => ({ 'Banco': r.bank, 'Tabela': r.table_key || '-', 'Prazo Min': r.term_min, 'Prazo Max': r.term_max, 'Valor Min': r.min_value, 'Valor Max': r.max_value, 'Seguro': r.has_insurance ? 'Sim' : 'Não', 'Taxa (%)': r.rate, 'Obs': r.obs || '', 'Data Vigência': r.effective_date }));
              const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Taxas FGTS V2'); XLSX.writeFile(wb, 'taxas_fgts_v2.xlsx');
              toast({ title: `${rates.length} taxas exportadas` });
            }}><Download className="w-4 h-4 mr-1" /> Exportar Taxas</Button>
            <SmartPasteRatesButton tableName="commission_rates_fgts_v2" onInserted={loadRates} />
            <Button variant="outline" size="sm" onClick={() => { setImportPreview([]); setImportDialogOpen(true); }}><Upload className="w-4 h-4 mr-1" /> Importar</Button>
            <Button onClick={openCreate} size="sm"><Plus className="w-4 h-4 mr-1" /> Nova Taxa</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <RatesBulkControls
          banks={Array.from(new Set(rates.map(r => r.bank))).sort()}
          bankFilter={bankFilter}
          onBankFilterChange={setBankFilter}
          tableName="commission_rates_fgts_v2"
          totalCount={rates.length}
          filteredCount={rates.filter(r => r.bank === bankFilter).length}
          onDeleted={loadRates}
        />
        {loading ? <p className="text-center text-muted-foreground py-8">Carregando...</p> : rates.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma taxa cadastrada — use "Importar" ou "Colar Inteligente" para subir as taxas oficiais.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TSHead label="Vigência" sortKey="effective_date" sort={sort} toggle={toggle} />
                <TSHead label="Banco" sortKey="bank" sort={sort} toggle={toggle} />
                <TSHead label="Tabela" sortKey="table_key" sort={sort} toggle={toggle} />
                <TSHead label="Prazo" sortKey="term_min" sort={sort} toggle={toggle} />
                <TSHead label="Faixa Valor" sortKey="min_value" sort={sort} toggle={toggle} />
                <TSHead label="Seguro" sortKey="has_insurance" sort={sort} toggle={toggle} />
                <TSHead label="Taxa" sortKey="rate" sort={sort} toggle={toggle} className="text-right" />
                <TSHead label="Obs" sortKey="obs" sort={sort} toggle={toggle} />
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applySortToData(rates.filter(r => bankFilter === '__all__' || r.bank === bankFilter), sort, (r, k) => {
                if (k === 'has_insurance') return r.has_insurance ? 'Sim' : 'Não';
                return (r as any)[k];
              }).map(r => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.effective_date + 'T12:00:00').toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell className="font-medium">{r.bank}</TableCell>
                  <TableCell className="text-xs">{r.table_key || '-'}</TableCell>
                  <TableCell className="text-xs">{r.term_min === r.term_max ? `${r.term_min}` : `${r.term_min}-${r.term_max}`}</TableCell>
                  <TableCell className="text-xs">{r.max_value >= 999999999 ? (r.min_value > 0 ? `>${r.min_value}` : '-') : `${r.min_value}-${r.max_value}`}</TableCell>
                  <TableCell>{r.has_insurance ? 'Sim' : 'Não'}</TableCell>
                  <TableCell className="text-right font-medium">{r.rate}%</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.obs || '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editing ? 'Editar Taxa FGTS V2' : 'Nova Taxa FGTS V2'}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Vigência *</Label><Input type="date" value={form.effective_date} onChange={e => setForm({ ...form, effective_date: e.target.value })} /></div>
              <div><Label>Banco *</Label><Input value={form.bank} onChange={e => setForm({ ...form, bank: e.target.value })} placeholder="LOTUS" /></div>
              <div className="col-span-2"><Label>Chave Tabela</Label><Input value={form.table_key} onChange={e => setForm({ ...form, table_key: e.target.value })} placeholder="LOTUS 1+, SONHO, GOLD PLUS, CARTA NA MANGA" /></div>
              <div><Label>Prazo Min (anos)</Label><Input type="number" value={form.term_min} onChange={e => setForm({ ...form, term_min: e.target.value })} /></div>
              <div><Label>Prazo Max (anos)</Label><Input type="number" value={form.term_max} onChange={e => setForm({ ...form, term_max: e.target.value })} /></div>
              <div><Label>Valor Min (R$)</Label><Input type="number" step="0.01" value={form.min_value} onChange={e => setForm({ ...form, min_value: e.target.value })} /></div>
              <div><Label>Valor Max (R$)</Label><Input type="number" step="0.01" value={form.max_value} onChange={e => setForm({ ...form, max_value: e.target.value })} /></div>
              <div className="flex items-end gap-2 pb-1"><Switch checked={form.has_insurance} onCheckedChange={v => setForm({ ...form, has_insurance: v })} /><Label>Com Seguro</Label></div>
              <div><Label>Taxa (%) *</Label><Input type="number" step="0.01" value={form.rate} onChange={e => setForm({ ...form, rate: e.target.value })} /></div>
              <div className="col-span-2"><Label>Observação</Label><Input value={form.obs} onChange={e => setForm({ ...form, obs: e.target.value })} placeholder="Ex: Faixa até R$ 500" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Importar Taxas FGTS V2</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Upload Excel (.xlsx)</Label>
                <input ref={importFileRef} type="file" accept=".xlsx,.xls" onChange={handleImportFile} className="block w-full text-sm mt-1 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground" />
              </div>
              <div className="relative">
                <Label>Ou cole os dados (Ctrl+V)</Label>
                <textarea onPaste={handlePaste} placeholder="Cole aqui os dados copiados da planilha..." className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] mt-1 placeholder:text-muted-foreground" />
              </div>
              {importPreview.length > 0 && (
                <div className="border rounded-md p-3 bg-muted/30 space-y-1">
                  <p className="text-sm font-medium">Preview: {importPreview.length} taxa(s)</p>
                  {importStats ? (
                    <p className="text-xs text-muted-foreground">
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">{importStats.newCount} nova(s)</span>
                      {' · '}
                      <span className="text-amber-600 dark:text-amber-400 font-medium">{importStats.replaceCount} substituída(s)</span>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Calculando novas vs substituídas…</p>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancelar</Button>
              <Button onClick={confirmImport} disabled={importPreview.length === 0 || importing}>
                {importing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                Importar {importPreview.length} taxas
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
