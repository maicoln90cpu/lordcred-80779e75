import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Plus, Pencil, Trash2, Settings, AlertTriangle, Search, Download, Upload } from 'lucide-react';
import { TSHead, useSortState, applySortToData, TOOLTIPS_RULES_CLT } from './CRSortUtils';
import { parseClipboardText } from '@/lib/clipboardParser';
import { loadXLSX } from '@/lib/xlsx-lazy';

interface RuleCLT {
  id: string; data_vigencia: string; banco: string; tabela_chave: string;
  seguro: string; prazo_min: number; prazo_max: number; valor_min: number; valor_max: number; taxa: number; created_at: string;
}

const EMPTY: Omit<RuleCLT, 'id' | 'created_at'> = {
  data_vigencia: new Date().toISOString().slice(0, 10), banco: '', tabela_chave: '*',
  seguro: 'Ambos', prazo_min: 0, prazo_max: 999, valor_min: 0, valor_max: 999999999, taxa: 0,
};

export default function CRRulesCLT() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<RuleCLT> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RuleCLT | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const { sort, toggle } = useSortState();
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['cr-rules-clt'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cr_rules_clt').select('*').order('banco').order('data_vigencia', { ascending: false });
      if (error) throw error;
      return data as RuleCLT[];
    },
  });

  const filtered = rules.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.banco.toLowerCase().includes(q) || r.tabela_chave.toLowerCase().includes(q) || r.seguro.toLowerCase().includes(q);
  });

  const sorted = applySortToData(filtered, sort);

  const handleSave = async () => {
    if (!editing || !editing.banco) { toast({ title: 'Banco é obrigatório', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const payload = { data_vigencia: editing.data_vigencia!, banco: editing.banco!, tabela_chave: editing.tabela_chave || '*', seguro: editing.seguro || 'Ambos', prazo_min: editing.prazo_min ?? 0, prazo_max: editing.prazo_max ?? 999, valor_min: editing.valor_min ?? 0, valor_max: editing.valor_max ?? 999999999, taxa: editing.taxa ?? 0 };
      if (editing.id) {
        const { error } = await supabase.from('cr_rules_clt').update(payload).eq('id', editing.id);
        if (error) throw error; toast({ title: 'Regra atualizada' });
      } else {
        const { error } = await supabase.from('cr_rules_clt').insert(payload);
        if (error) throw error; toast({ title: 'Regra criada' });
      }
      setEditing(null); qc.invalidateQueries({ queryKey: ['cr-rules-clt'] });
    } catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('cr_rules_clt').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast({ title: 'Regra excluída' }); setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ['cr-rules-clt'] });
    } catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); }
    finally { setDeleting(false); }
  };

  // ===== IMPORT / EXPORT =====
  const downloadTemplate = async () => {
    const XLSX = await loadXLSX();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Banco', 'Tabela Chave', 'Seguro (Sim/Não/Ambos)', 'Prazo Mín', 'Prazo Máx', 'Valor Mín', 'Valor Máx', 'Taxa (%)'],
      ['BANCO C6', '*', 'Ambos', '0', '999', '0', '999999999', '2.5'],
      ['REP CLT', '*', 'Ambos', '6', '36', '1000', '5000', '3.0'],
      ['REP CLT', '*', 'Ambos', '6', '36', '5000', '10000', '5.0'],
    ]);
    ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo CLT');
    XLSX.writeFile(wb, 'modelo_regras_clt.xlsx');
  };

  const exportRules = async () => {
    const XLSX = await loadXLSX();
    if (rules.length === 0) { toast({ title: 'Nenhuma regra para exportar' }); return; }
    const data = rules.map(r => ({
      'Banco': r.banco,
      'Tabela Chave': r.tabela_chave,
      'Seguro': r.seguro,
      'Prazo Mín': r.prazo_min,
      'Prazo Máx': r.prazo_max,
      'Valor Mín': r.valor_min ?? 0,
      'Valor Máx': r.valor_max ?? 999999999,
      'Taxa (%)': r.taxa,
      'Data Vigência': r.data_vigencia,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Regras CLT');
    XLSX.writeFile(wb, 'regras_clt_exportadas.xlsx');
    toast({ title: `${rules.length} regras exportadas` });
  };

  const parseImportData = (rows: Record<string, string>[]) => {
    const today = new Date().toISOString().slice(0, 10);
    return rows.map(r => {
      const banco = r['Banco'] || r['banco'] || '';
      const tabela_chave = r['Tabela Chave'] || r['tabela_chave'] || r['Tabela'] || '*';
      const seguroRaw = (r['Seguro (Sim/Não/Ambos)'] || r['Seguro'] || r['seguro'] || 'Ambos').trim();
      const seguro = ['Sim', 'Não', 'Ambos'].includes(seguroRaw) ? seguroRaw : 'Ambos';
      const prazo_min = parseInt((r['Prazo Mín'] || r['prazo_min'] || r['Prazo Min'] || '0').replace(',', '.')) || 0;
      const prazo_max = parseInt((r['Prazo Máx'] || r['prazo_max'] || r['Prazo Max'] || '999').replace(',', '.')) || 999;
      const valor_min = parseFloat((r['Valor Mín'] || r['valor_min'] || r['Valor Min'] || '0').toString().replace(',', '.')) || 0;
      const valor_max = parseFloat((r['Valor Máx'] || r['valor_max'] || r['Valor Max'] || '999999999').toString().replace(',', '.')) || 999999999;
      const taxa = parseFloat((r['Taxa (%)'] || r['taxa'] || r['Taxa'] || '0').replace(',', '.')) || 0;
      return { data_vigencia: today, banco, tabela_chave, seguro, prazo_min, prazo_max, valor_min, valor_max, taxa };
    }).filter(r => r.banco);
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
    const parsed = parseClipboardText(text, ['Banco', 'Tabela Chave', 'Seguro (Sim/Não/Ambos)', 'Prazo Mín', 'Prazo Máx', 'Valor Mín', 'Valor Máx', 'Taxa (%)']);
    setImportPreview(parseImportData(parsed.rows));
  };

  const confirmImport = async () => {
    if (importPreview.length === 0) return;
    setImporting(true);
    const { error } = await supabase.from('cr_rules_clt').insert(importPreview);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: `${importPreview.length} regras importadas` }); setImportDialogOpen(false); setImportPreview([]); qc.invalidateQueries({ queryKey: ['cr-rules-clt'] }); }
    setImporting(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg"><Settings className="w-5 h-5" /> Regras CLT</CardTitle>
            <CardDescription>Taxas de comissão esperada por banco, tabela, seguro e faixa de prazo.</CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative"><Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 w-40 h-9" /></div>
            <Button variant="outline" size="sm" onClick={downloadTemplate}><Download className="w-4 h-4 mr-1" /> Baixar Modelo</Button>
            <Button variant="outline" size="sm" onClick={exportRules}><Download className="w-4 h-4 mr-1" /> Exportar Taxas</Button>
            <Button variant="outline" size="sm" onClick={() => { setImportPreview([]); setImportDialogOpen(true); }}><Upload className="w-4 h-4 mr-1" /> Importar</Button>
            <Button size="sm" onClick={() => setEditing({ ...EMPTY })}><Plus className="w-4 h-4 mr-1" /> Nova Regra</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : sorted.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma regra CLT cadastrada.</p>
        ) : (
          <div className="border rounded-lg overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <tr>
                  <TSHead label="Vigência" sortKey="data_vigencia" sort={sort} toggle={toggle} tooltip={TOOLTIPS_RULES_CLT.data_vigencia} className="text-xs" />
                  <TSHead label="Banco" sortKey="banco" sort={sort} toggle={toggle} tooltip={TOOLTIPS_RULES_CLT.banco} className="text-xs" />
                  <TSHead label="Tabela" sortKey="tabela_chave" sort={sort} toggle={toggle} tooltip={TOOLTIPS_RULES_CLT.tabela_chave} className="text-xs" />
                  <TSHead label="Seguro" sortKey="seguro" sort={sort} toggle={toggle} tooltip={TOOLTIPS_RULES_CLT.seguro} className="text-xs" />
                  <TSHead label="Prazo Mín" sortKey="prazo_min" sort={sort} toggle={toggle} tooltip={TOOLTIPS_RULES_CLT.prazo_min} className="text-xs text-right" />
                  <TSHead label="Prazo Máx" sortKey="prazo_max" sort={sort} toggle={toggle} tooltip={TOOLTIPS_RULES_CLT.prazo_max} className="text-xs text-right" />
                  <TSHead label="Valor Mín" sortKey="valor_min" sort={sort} toggle={toggle} className="text-xs text-right" />
                  <TSHead label="Valor Máx" sortKey="valor_max" sort={sort} toggle={toggle} className="text-xs text-right" />
                  <TSHead label="Taxa %" sortKey="taxa" sort={sort} toggle={toggle} tooltip={TOOLTIPS_RULES_CLT.taxa} className="text-xs text-right" />
                  <th className="w-20"></th>
                </tr>
              </TableHeader>
              <TableBody>
                {sorted.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{new Date(r.data_vigencia + 'T00:00:00').toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell className="text-xs font-medium">{r.banco}</TableCell>
                    <TableCell className="text-xs">{r.tabela_chave === '*' ? <Badge variant="secondary" className="text-[10px]">Todas</Badge> : r.tabela_chave}</TableCell>
                    <TableCell className="text-xs"><Badge variant={r.seguro === 'Sim' ? 'default' : r.seguro === 'Não' ? 'outline' : 'secondary'} className="text-[10px]">{r.seguro}</Badge></TableCell>
                    <TableCell className="text-xs text-right">{r.prazo_min}</TableCell>
                    <TableCell className="text-xs text-right">{r.prazo_max >= 999 ? '∞' : r.prazo_max}</TableCell>
                    <TableCell className="text-xs text-right">{(r.valor_min ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                    <TableCell className="text-xs text-right">{(r.valor_max ?? 999999999) >= 999999999 ? '∞' : (r.valor_max ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{r.taxa.toFixed(2)}%</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing({ ...r })}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(r)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Edit/Create Dialog */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing?.id ? 'Editar' : 'Nova'} Regra CLT</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-muted-foreground">Vigência</label><Input type="date" value={editing.data_vigencia || ''} onChange={e => setEditing(p => ({ ...p!, data_vigencia: e.target.value }))} /></div>
                <div><label className="text-xs font-medium text-muted-foreground">Banco</label><Input value={editing.banco || ''} onChange={e => setEditing(p => ({ ...p!, banco: e.target.value.toUpperCase() }))} placeholder="Ex: HUB CREDITO" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-muted-foreground">Tabela/Chave</label><Input value={editing.tabela_chave || '*'} onChange={e => setEditing(p => ({ ...p!, tabela_chave: e.target.value }))} placeholder="* = todas" /></div>
                <div><label className="text-xs font-medium text-muted-foreground">Seguro</label>
                  <Select value={editing.seguro || 'Ambos'} onValueChange={v => setEditing(p => ({ ...p!, seguro: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Sim">Sim</SelectItem><SelectItem value="Não">Não</SelectItem><SelectItem value="Ambos">Ambos</SelectItem></SelectContent></Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs font-medium text-muted-foreground">Prazo Mín</label><Input type="number" value={editing.prazo_min ?? 0} onChange={e => setEditing(p => ({ ...p!, prazo_min: parseInt(e.target.value) || 0 }))} /></div>
                <div><label className="text-xs font-medium text-muted-foreground">Prazo Máx</label><Input type="number" value={editing.prazo_max ?? 999} onChange={e => setEditing(p => ({ ...p!, prazo_max: parseInt(e.target.value) || 999 }))} /></div>
                <div><label className="text-xs font-medium text-muted-foreground">Taxa %</label><Input type="number" step="0.01" value={editing.taxa ?? 0} onChange={e => setEditing(p => ({ ...p!, taxa: parseFloat(e.target.value) || 0 }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-muted-foreground">Valor Mín. (R$)</label><Input type="number" step="0.01" value={editing.valor_min ?? 0} onChange={e => setEditing(p => ({ ...p!, valor_min: parseFloat(e.target.value) || 0 }))} placeholder="0" /></div>
                <div><label className="text-xs font-medium text-muted-foreground">Valor Máx. (R$)</label><Input type="number" step="0.01" value={editing.valor_max ?? 999999999} onChange={e => setEditing(p => ({ ...p!, valor_max: parseFloat(e.target.value) || 999999999 }))} placeholder="999999999 = sem limite" /></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-destructive" /> Excluir Regra</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Excluir regra do banco <strong>{deleteTarget?.banco}</strong> com taxa <strong>{deleteTarget?.taxa}%</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Excluir'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Importar Regras CLT</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Upload Excel (.xlsx)</Label>
              <input ref={importFileRef} type="file" accept=".xlsx,.xls" onChange={handleImportFile} className="block w-full text-sm mt-1 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground" />
            </div>
            <div>
              <Label>Ou cole os dados (Ctrl+V)</Label>
              <textarea onPaste={handlePaste} placeholder="Cole aqui os dados copiados da planilha..." className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] mt-1 placeholder:text-muted-foreground" />
            </div>
            {importPreview.length > 0 && (
              <div className="border rounded-md p-3 bg-muted/30">
                <p className="text-sm font-medium mb-2">Preview: {importPreview.length} regras (vigência: hoje)</p>
                <div className="max-h-40 overflow-auto text-xs">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="text-xs p-1">Banco</TableHead>
                      <TableHead className="text-xs p-1">Tabela</TableHead>
                      <TableHead className="text-xs p-1">Seguro</TableHead>
                      <TableHead className="text-xs p-1 text-right">Prazo</TableHead>
                      <TableHead className="text-xs p-1 text-right">Taxa</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {importPreview.slice(0, 10).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="p-1">{r.banco}</TableCell>
                          <TableCell className="p-1">{r.tabela_chave}</TableCell>
                          <TableCell className="p-1">{r.seguro}</TableCell>
                          <TableCell className="p-1 text-right">{r.prazo_min}-{r.prazo_max}</TableCell>
                          <TableCell className="p-1 text-right">{r.taxa}%</TableCell>
                        </TableRow>
                      ))}
                      {importPreview.length > 10 && <TableRow><TableCell colSpan={5} className="p-1 text-center text-muted-foreground">...e mais {importPreview.length - 10}</TableCell></TableRow>}
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
              Importar {importPreview.length} regras
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <input ref={importFileRef} type="file" accept=".xlsx,.xls" onChange={handleImportFile} className="hidden" />
    </Card>
  );
}
