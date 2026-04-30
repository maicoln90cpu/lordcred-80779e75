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
import type { RateCLT } from './commissionUtils';
import RatesBulkControls from './RatesBulkControls';
import SmartPasteRatesButton from './SmartPasteRatesButton';

export default function RatesCLTTab() {
  const { toast } = useToast();
  const [rates, setRates] = useState<RateCLT[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RateCLT | null>(null);
  const [form, setForm] = useState({ effective_date: '', bank: '', term_min: '0', term_max: '999', min_value: '0', max_value: '999999999', has_insurance: false, rate: '', obs: '', table_key: '' });
  const { sort, toggle } = useSortState();
  const [bankFilter, setBankFilter] = useState<string>('__all__');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadRates(); }, []);

  const loadRates = async () => {
    setLoading(true);
    const { data } = await supabase.from('commission_rates_clt').select('*').order('effective_date', { ascending: false });
    if (data) setRates(data as unknown as RateCLT[]);
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ effective_date: new Date().toISOString().slice(0, 10), bank: '', term_min: '0', term_max: '999', min_value: '0', max_value: '999999999', has_insurance: false, rate: '', obs: '', table_key: '' });
    setDialogOpen(true);
  };

  const openEdit = (r: RateCLT) => {
    setEditing(r);
    setForm({
      effective_date: r.effective_date, bank: r.bank,
      term_min: r.term_min.toString(), term_max: r.term_max.toString(),
      min_value: (r.min_value ?? 0).toString(), max_value: (r.max_value ?? 999999999).toString(),
      has_insurance: r.has_insurance, rate: r.rate.toString(), obs: r.obs || '',
      table_key: r.table_key || ''
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.bank || !form.effective_date || !form.rate) { toast({ title: 'Preencha campos obrigatórios', variant: 'destructive' }); return; }
    const payload = {
      effective_date: form.effective_date, bank: form.bank,
      term_min: parseInt(form.term_min) || 0, term_max: parseInt(form.term_max) || 999,
      min_value: parseFloat(form.min_value) || 0, max_value: parseFloat(form.max_value) || 999999999,
      has_insurance: form.has_insurance, rate: parseFloat(form.rate) || 0, obs: form.obs || null,
      table_key: form.table_key || null,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from('commission_rates_clt').update(payload as any).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('commission_rates_clt').insert(payload as any));
    }
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Taxa salva' }); setDialogOpen(false); loadRates(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir?')) return;
    await supabase.from('commission_rates_clt').delete().eq('id', id);
    toast({ title: 'Excluída' }); loadRates();
  };

  const downloadTemplate = async () => {
    const XLSX = await loadXLSX();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Banco', 'Tabela', 'Prazo Min', 'Prazo Max', 'Valor Min', 'Valor Max', 'Seguro (Sim/Não)', 'Taxa (%)', 'Obs'],
      ['BANCO C6', 'SONHO', '0', '999', '0', '999999999', 'Não', '5.5', 'CLT padrão'],
      ['REP CLT', '', '6', '36', '1000', '5000', 'Não', '3.0', 'REP faixa 1k-5k'],
      ['REP CLT', '', '6', '36', '5000', '10000', 'Não', '5.0', 'REP faixa 5k-10k'],
    ]);
    ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 15 }, { wch: 10 }, { wch: 25 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo CLT');
    XLSX.writeFile(wb, 'modelo_taxas_clt.xlsx');
  };

  const parseImportData = (rows: Record<string, string>[]) => {
    const today = new Date().toISOString().slice(0, 10);
    return rows.map(r => {
      const bank = r['Banco'] || r['banco'] || r['bank'] || '';
      const tableKey = r['Tabela'] || r['tabela'] || r['table_key'] || '';
      const termMin = parseInt(r['Prazo Min'] || r['prazo_min'] || r['term_min'] || '0') || 0;
      const termMax = parseInt(r['Prazo Max'] || r['prazo_max'] || r['term_max'] || '999') || 999;
      const minValue = parseFloat((r['Valor Min'] || r['valor_min'] || r['min_value'] || '0').toString().replace(',', '.')) || 0;
      const maxValueRaw = (r['Valor Max'] || r['valor_max'] || r['max_value'] || '999999999').toString().replace(',', '.');
      const maxValue = parseFloat(maxValueRaw) || 999999999;
      const seguroRaw = (r['Seguro (Sim/Não)'] || r['seguro'] || r['has_insurance'] || 'Não').toLowerCase();
      const hasInsurance = seguroRaw === 'sim' || seguroRaw === 'true' || seguroRaw === '1';
      const rate = parseFloat((r['Taxa (%)'] || r['taxa'] || r['rate'] || '0').replace(',', '.')) || 0;
      const obs = r['Obs'] || r['obs'] || '';
      return { effective_date: today, bank, table_key: tableKey || null, term_min: termMin, term_max: termMax, min_value: minValue, max_value: maxValue, has_insurance: hasInsurance, rate, obs: obs || null };
    }).filter(r => r.bank);
  };

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
    const parsed = parseClipboardText(text, ['Banco', 'Tabela', 'Prazo Min', 'Prazo Max', 'Valor Min', 'Valor Max', 'Seguro (Sim/Não)', 'Taxa (%)', 'Obs']);
    setImportPreview(parseImportData(parsed.rows));
  };

  const confirmImport = async () => {
    if (importPreview.length === 0) return;
    setImporting(true);
    const { error } = await supabase.from('commission_rates_clt').insert(importPreview as any);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: `${importPreview.length} taxas importadas` }); setImportDialogOpen(false); setImportPreview([]); loadRates(); }
    setImporting(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle>Taxas Comissão CLT</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate}><Download className="w-4 h-4 mr-1" /> Baixar Modelo</Button>
            <Button variant="outline" size="sm" onClick={async () => {
              const XLSX = await loadXLSX();
              if (rates.length === 0) { toast({ title: 'Nenhuma taxa para exportar' }); return; }
              const data = rates.map(r => ({ 'Banco': r.bank, 'Tabela': r.table_key || '-', 'Prazo Min': r.term_min, 'Prazo Max': r.term_max, 'Valor Min': r.min_value ?? 0, 'Valor Max': r.max_value ?? 999999999, 'Seguro': r.has_insurance ? 'Sim' : 'Não', 'Taxa (%)': r.rate, 'Obs': r.obs || '', 'Data Vigência': r.effective_date }));
              const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Taxas CLT'); XLSX.writeFile(wb, 'taxas_clt_parceiros.xlsx');
              toast({ title: `${rates.length} taxas exportadas` });
            }}><Download className="w-4 h-4 mr-1" /> Exportar Taxas</Button>
            <SmartPasteRatesButton tableName="commission_rates_clt" onInserted={loadRates} />
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
          tableName="commission_rates_clt"
          totalCount={rates.length}
          filteredCount={rates.filter(r => r.bank === bankFilter).length}
          onDeleted={loadRates}
        />
        {loading ? <p className="text-center text-muted-foreground py-8">Carregando...</p> : rates.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma taxa cadastrada</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TSHead label="Vigência" sortKey="effective_date" sort={sort} toggle={toggle} />
                <TSHead label="Banco" sortKey="bank" sort={sort} toggle={toggle} />
                <TSHead label="Tabela" sortKey="table_key" sort={sort} toggle={toggle} />
                <TSHead label="Prazo Min" sortKey="term_min" sort={sort} toggle={toggle} />
                <TSHead label="Prazo Max" sortKey="term_max" sort={sort} toggle={toggle} />
                <TSHead label="Valor Min" sortKey="min_value" sort={sort} toggle={toggle} className="text-right" />
                <TSHead label="Valor Max" sortKey="max_value" sort={sort} toggle={toggle} className="text-right" />
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
                  <TableCell>{r.term_min}</TableCell>
                  <TableCell>{r.term_max}</TableCell>
                  <TableCell className="text-right text-xs">{(r.min_value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                  <TableCell className="text-right text-xs">{(r.max_value ?? 999999999) >= 999999999 ? '∞' : (r.max_value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                  <TableCell>{r.has_insurance ? 'Sim' : 'Não'}</TableCell>
                  <TableCell className="text-right">{r.rate}%</TableCell>
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
            <DialogHeader><DialogTitle>{editing ? 'Editar Taxa CLT' : 'Nova Taxa CLT'}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Vigência *</Label><Input type="date" value={form.effective_date} onChange={e => setForm({ ...form, effective_date: e.target.value })} /></div>
              <div><Label>Banco *</Label><Input value={form.bank} onChange={e => setForm({ ...form, bank: e.target.value })} /></div>
              <div><Label>Prazo Min</Label><Input type="number" value={form.term_min} onChange={e => setForm({ ...form, term_min: e.target.value })} /></div>
              <div><Label>Prazo Max</Label><Input type="number" value={form.term_max} onChange={e => setForm({ ...form, term_max: e.target.value })} /></div>
              <div><Label>Valor Mín. (R$)</Label><Input type="number" step="0.01" value={form.min_value} onChange={e => setForm({ ...form, min_value: e.target.value })} placeholder="0" /></div>
              <div><Label>Valor Máx. (R$)</Label><Input type="number" step="0.01" value={form.max_value} onChange={e => setForm({ ...form, max_value: e.target.value })} placeholder="999999999 = sem limite" /></div>
              <div className="flex items-end gap-2 pb-1"><Switch checked={form.has_insurance} onCheckedChange={v => setForm({ ...form, has_insurance: v })} /><Label>Seguro</Label></div>
              <div><Label>Taxa (%) *</Label><Input type="number" step="0.01" value={form.rate} onChange={e => setForm({ ...form, rate: e.target.value })} /></div>
              <div><Label>Chave Tabela</Label><Input value={form.table_key} onChange={e => setForm({ ...form, table_key: e.target.value })} placeholder="Ex: SONHO, FOCO, 2 Parcela" /></div>
              <div><Label>Observação</Label><Input value={form.obs} onChange={e => setForm({ ...form, obs: e.target.value })} placeholder="Ex: REP CLT faixa 1k-5k" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Importar Taxas CLT</DialogTitle></DialogHeader>
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
                <div className="border rounded-md p-3 bg-muted/30">
                  <p className="text-sm font-medium mb-2">Preview: {importPreview.length} taxas (vigência: hoje)</p>
                  <div className="max-h-40 overflow-auto text-xs">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead className="text-xs p-1">Banco</TableHead>
                        <TableHead className="text-xs p-1">Tabela</TableHead>
                        <TableHead className="text-xs p-1">Prazo</TableHead>
                        <TableHead className="text-xs p-1">Valor</TableHead>
                        <TableHead className="text-xs p-1">Seguro</TableHead>
                        <TableHead className="text-xs p-1 text-right">Taxa</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {importPreview.slice(0, 10).map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="p-1">{r.bank}</TableCell>
                            <TableCell className="p-1">{r.table_key || '-'}</TableCell>
                            <TableCell className="p-1">{r.term_min}-{r.term_max}</TableCell>
                            <TableCell className="p-1 text-xs">
                              {(r.min_value ?? 0).toLocaleString('pt-BR')}–{(r.max_value ?? 0) >= 999999999 ? '∞' : (r.max_value ?? 0).toLocaleString('pt-BR')}
                            </TableCell>
                            <TableCell className="p-1">{r.has_insurance ? 'Sim' : 'Não'}</TableCell>
                            <TableCell className="p-1 text-right">{r.rate}%</TableCell>
                          </TableRow>
                        ))}
                        {importPreview.length > 10 && <TableRow><TableCell colSpan={6} className="p-1 text-center text-muted-foreground">...e mais {importPreview.length - 10}</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </div>
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
