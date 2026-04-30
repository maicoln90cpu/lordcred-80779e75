import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Download, Upload, Loader2 } from 'lucide-react';
import { TSHead, useSortState, applySortToData } from '@/components/commission-reports/CRSortUtils';
import { parseClipboardText } from '@/lib/clipboardParser';
import { loadXLSX } from '@/lib/xlsx-lazy';
import type { RateFGTS } from './commissionUtils';
import RatesBulkControls from './RatesBulkControls';
import SmartPasteRatesButton from './SmartPasteRatesButton';

export default function RatesFGTSTab() {
  const { toast } = useToast();
  const [rates, setRates] = useState<RateFGTS[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RateFGTS | null>(null);
  const [form, setForm] = useState({ effective_date: '', bank: '', rate_no_insurance: '', rate_with_insurance: '' });
  const { sort, toggle } = useSortState();
  const [bankFilter, setBankFilter] = useState<string>('__all__');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadRates(); }, []);

  const loadRates = async () => {
    setLoading(true);
    const { data } = await supabase.from('commission_rates_fgts').select('*').order('effective_date', { ascending: false });
    if (data) setRates(data as unknown as RateFGTS[]);
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ effective_date: new Date().toISOString().slice(0, 10), bank: '', rate_no_insurance: '', rate_with_insurance: '' });
    setDialogOpen(true);
  };

  const openEdit = (r: RateFGTS) => {
    setEditing(r);
    setForm({ effective_date: r.effective_date, bank: r.bank, rate_no_insurance: r.rate_no_insurance.toString(), rate_with_insurance: r.rate_with_insurance.toString() });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.bank || !form.effective_date) { toast({ title: 'Preencha campos obrigatórios', variant: 'destructive' }); return; }
    const payload = {
      effective_date: form.effective_date, bank: form.bank,
      rate_no_insurance: parseFloat(form.rate_no_insurance) || 0,
      rate_with_insurance: parseFloat(form.rate_with_insurance) || 0,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from('commission_rates_fgts').update(payload as any).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('commission_rates_fgts').insert(payload as any));
    }
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Taxa salva' }); setDialogOpen(false); loadRates(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta taxa?')) return;
    await supabase.from('commission_rates_fgts').delete().eq('id', id);
    toast({ title: 'Taxa excluída' }); loadRates();
  };

  const downloadTemplate = async () => {
    const XLSX = await loadXLSX();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Banco', 'Taxa Sem Seguro (%)', 'Taxa Com Seguro (%)'],
      ['PARANA BANCO', '3.5', '4.0'],
    ]);
    ws['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo FGTS');
    XLSX.writeFile(wb, 'modelo_taxas_fgts.xlsx');
  };

  const parseImportData = (rows: Record<string, string>[]) => {
    const today = new Date().toISOString().slice(0, 10);
    return rows.map(r => {
      const bank = r['Banco'] || r['banco'] || '';
      const rateNo = parseFloat((r['Taxa Sem Seguro (%)'] || r['taxa_sem_seguro'] || r['rate_no_insurance'] || '0').replace(',', '.')) || 0;
      const rateWith = parseFloat((r['Taxa Com Seguro (%)'] || r['taxa_com_seguro'] || r['rate_with_insurance'] || '0').replace(',', '.')) || 0;
      return { effective_date: today, bank, rate_no_insurance: rateNo, rate_with_insurance: rateWith };
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
    const parsed = parseClipboardText(text, ['Banco', 'Taxa Sem Seguro (%)', 'Taxa Com Seguro (%)']);
    setImportPreview(parseImportData(parsed.rows));
  };

  const confirmImport = async () => {
    if (importPreview.length === 0) return;
    setImporting(true);
    const { error } = await supabase.from('commission_rates_fgts').insert(importPreview as any);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: `${importPreview.length} taxas importadas` }); setImportDialogOpen(false); setImportPreview([]); loadRates(); }
    setImporting(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle>Taxas Comissão FGTS</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate}><Download className="w-4 h-4 mr-1" /> Baixar Modelo</Button>
            <Button variant="outline" size="sm" onClick={async () => {
              const XLSX = await loadXLSX();
              if (rates.length === 0) { toast({ title: 'Nenhuma taxa para exportar' }); return; }
              const data = rates.map(r => ({ 'Banco': r.bank, 'Data Vigência': r.effective_date, 'Taxa Sem Seguro (%)': r.rate_no_insurance, 'Taxa Com Seguro (%)': r.rate_with_insurance }));
              const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Taxas FGTS'); XLSX.writeFile(wb, 'taxas_fgts_parceiros.xlsx');
              toast({ title: `${rates.length} taxas exportadas` });
            }}><Download className="w-4 h-4 mr-1" /> Exportar Taxas</Button>
            <SmartPasteRatesButton tableName="commission_rates_fgts" onInserted={loadRates} />
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
          tableName="commission_rates_fgts"
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
                <TSHead label="Sem Seguro" sortKey="rate_no_insurance" sort={sort} toggle={toggle} className="text-right" />
                <TSHead label="Com Seguro" sortKey="rate_with_insurance" sort={sort} toggle={toggle} className="text-right" />
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applySortToData(rates.filter(r => bankFilter === '__all__' || r.bank === bankFilter), sort, (r, k) => (r as any)[k]).map(r => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.effective_date + 'T12:00:00').toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell className="font-medium">{r.bank}</TableCell>
                  <TableCell className="text-right">{r.rate_no_insurance}%</TableCell>
                  <TableCell className="text-right">{r.rate_with_insurance}%</TableCell>
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
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{editing ? 'Editar Taxa FGTS' : 'Nova Taxa FGTS'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Início Vigência *</Label><Input type="date" value={form.effective_date} onChange={e => setForm({ ...form, effective_date: e.target.value })} /></div>
              <div><Label>Banco *</Label><Input value={form.bank} onChange={e => setForm({ ...form, bank: e.target.value })} placeholder="Ex: PARANA BANCO" /></div>
              <div><Label>Taxa Sem Seguro (%)</Label><Input type="number" step="0.01" value={form.rate_no_insurance} onChange={e => setForm({ ...form, rate_no_insurance: e.target.value })} /></div>
              <div><Label>Taxa Com Seguro (%)</Label><Input type="number" step="0.01" value={form.rate_with_insurance} onChange={e => setForm({ ...form, rate_with_insurance: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Importar Taxas FGTS</DialogTitle></DialogHeader>
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
                        <TableHead className="text-xs p-1 text-right">Sem Seguro</TableHead>
                        <TableHead className="text-xs p-1 text-right">Com Seguro</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {importPreview.slice(0, 10).map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="p-1">{r.bank}</TableCell>
                            <TableCell className="p-1 text-right">{r.rate_no_insurance}%</TableCell>
                            <TableCell className="p-1 text-right">{r.rate_with_insurance}%</TableCell>
                          </TableRow>
                        ))}
                        {importPreview.length > 10 && <TableRow><TableCell colSpan={3} className="p-1 text-center text-muted-foreground">...e mais {importPreview.length - 10}</TableCell></TableRow>}
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
