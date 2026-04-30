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
import { TSHead, useSortState, applySortToData, TOOLTIPS_RULES_FGTS } from './CRSortUtils';
import { parseClipboardText } from '@/lib/clipboardParser';
import { loadXLSX } from '@/lib/xlsx-lazy';

interface RuleFGTS {
  id: string; data_vigencia: string; banco: string; tabela_chave: string;
  seguro: string; min_valor: number; max_valor: number; taxa: number; created_at: string;
}

const EMPTY: Omit<RuleFGTS, 'id' | 'created_at'> = {
  data_vigencia: new Date().toISOString().slice(0, 10), banco: '', tabela_chave: '*',
  seguro: 'Ambos', min_valor: 0, max_valor: 999999999, taxa: 0,
};

export default function CRRulesFGTS() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<RuleFGTS> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RuleFGTS | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const { sort, toggle } = useSortState();
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['cr-rules-fgts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cr_rules_fgts').select('*').order('banco').order('data_vigencia', { ascending: false });
      if (error) throw error;
      return data as RuleFGTS[];
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
      const payload = { data_vigencia: editing.data_vigencia!, banco: editing.banco!, tabela_chave: editing.tabela_chave || '*', seguro: editing.seguro || 'Ambos', min_valor: editing.min_valor ?? 0, max_valor: editing.max_valor ?? 999999999, taxa: editing.taxa ?? 0 };
      if (editing.id) {
        const { error } = await supabase.from('cr_rules_fgts').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast({ title: 'Regra atualizada' });
      } else {
        const { error } = await supabase.from('cr_rules_fgts').insert(payload);
        if (error) throw error;
        toast({ title: 'Regra criada' });
      }
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['cr-rules-fgts'] });
    } catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('cr_rules_fgts').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast({ title: 'Regra excluída' });
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ['cr-rules-fgts'] });
    } catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); }
    finally { setDeleting(false); }
  };

  // ===== IMPORT / EXPORT =====
  const downloadTemplate = async () => {
    const XLSX = await loadXLSX();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Banco', 'Tabela Chave', 'Seguro (Sim/Não/Ambos)', 'Valor Mín', 'Valor Máx', 'Taxa (%)'],
      ['MERCANTIL', '*', 'Ambos', '0', '999999999', '3.5'],
    ]);
    ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 22 }, { wch: 12 }, { wch: 15 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo FGTS');
    XLSX.writeFile(wb, 'modelo_regras_fgts.xlsx');
  };

  const exportRules = async () => {
    const XLSX = await loadXLSX();
    if (rules.length === 0) { toast({ title: 'Nenhuma regra para exportar' }); return; }
    const data = rules.map(r => ({
      'Banco': r.banco,
      'Tabela Chave': r.tabela_chave,
      'Seguro': r.seguro,
      'Valor Mín': r.min_valor,
      'Valor Máx': r.max_valor,
      'Taxa (%)': r.taxa,
      'Data Vigência': r.data_vigencia,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Regras FGTS');
    XLSX.writeFile(wb, 'regras_fgts_exportadas.xlsx');
    toast({ title: `${rules.length} regras exportadas` });
  };

  const parseImportData = (rows: Record<string, string>[]) => {
    const today = new Date().toISOString().slice(0, 10);
    return rows.map(r => {
      const banco = r['Banco'] || r['banco'] || '';
      const tabela_chave = r['Tabela Chave'] || r['tabela_chave'] || r['Tabela'] || '*';
      const seguroRaw = (r['Seguro (Sim/Não/Ambos)'] || r['Seguro'] || r['seguro'] || 'Ambos').trim();
      const seguro = ['Sim', 'Não', 'Ambos'].includes(seguroRaw) ? seguroRaw : 'Ambos';
      const min_valor = parseFloat((r['Valor Mín'] || r['min_valor'] || r['Valor Min'] || '0').replace(',', '.')) || 0;
      const max_valor = parseFloat((r['Valor Máx'] || r['max_valor'] || r['Valor Max'] || '999999999').replace(',', '.')) || 999999999;
      const taxa = parseFloat((r['Taxa (%)'] || r['taxa'] || r['Taxa'] || '0').replace(',', '.')) || 0;
      return { data_vigencia: today, banco, tabela_chave, seguro, min_valor, max_valor, taxa };
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
    const parsed = parseClipboardText(text, ['Banco', 'Tabela Chave', 'Seguro (Sim/Não/Ambos)', 'Valor Mín', 'Valor Máx', 'Taxa (%)']);
    setImportPreview(parseImportData(parsed.rows));
  };

  const confirmImport = async () => {
    if (importPreview.length === 0) return;
    setImporting(true);
    const { error } = await supabase.from('cr_rules_fgts').insert(importPreview);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: `${importPreview.length} regras importadas` }); setImportDialogOpen(false); setImportPreview([]); qc.invalidateQueries({ queryKey: ['cr-rules-fgts'] }); }
    setImporting(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg"><Settings className="w-5 h-5" /> Regras FGTS</CardTitle>
            <CardDescription>Taxas de comissão esperada por banco, tabela, seguro e faixa de valor liberado.</CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 w-40 h-9" />
            </div>
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
          <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma regra FGTS cadastrada.</p>
        ) : (
          <div className="border rounded-lg overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <tr>
                  <TSHead label="Vigência" sortKey="data_vigencia" sort={sort} toggle={toggle} tooltip={TOOLTIPS_RULES_FGTS.data_vigencia} className="text-xs" />
                  <TSHead label="Banco" sortKey="banco" sort={sort} toggle={toggle} tooltip={TOOLTIPS_RULES_FGTS.banco} className="text-xs" />
                  <TSHead label="Tabela" sortKey="tabela_chave" sort={sort} toggle={toggle} tooltip={TOOLTIPS_RULES_FGTS.tabela_chave} className="text-xs" />
                  <TSHead label="Seguro" sortKey="seguro" sort={sort} toggle={toggle} tooltip={TOOLTIPS_RULES_FGTS.seguro} className="text-xs" />
                  <TSHead label="Valor Mín" sortKey="min_valor" sort={sort} toggle={toggle} tooltip={TOOLTIPS_RULES_FGTS.min_valor} className="text-xs text-right" />
                  <TSHead label="Valor Máx" sortKey="max_valor" sort={sort} toggle={toggle} tooltip={TOOLTIPS_RULES_FGTS.max_valor} className="text-xs text-right" />
                  <TSHead label="Taxa %" sortKey="taxa" sort={sort} toggle={toggle} tooltip={TOOLTIPS_RULES_FGTS.taxa} className="text-xs text-right" />
                  <th className="w-20"></th>
                </tr>
              </TableHeader>
              <TableBody>
                {sorted.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{new Date(r.data_vigencia + 'T00:00:00').toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell className="text-xs font-medium">{r.banco}</TableCell>
                    <TableCell className="text-xs">{r.tabela_chave === '*' ? <Badge variant="secondary" className="text-[10px]">Todas</Badge> : r.tabela_chave}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant={r.seguro === 'Sim' ? 'default' : r.seguro === 'Não' ? 'outline' : 'secondary'} className="text-[10px]">{r.seguro}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-right">{r.min_valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                    <TableCell className="text-xs text-right">{r.max_valor >= 999999000 ? '∞' : r.max_valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
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
          <DialogHeader><DialogTitle>{editing?.id ? 'Editar' : 'Nova'} Regra FGTS</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-muted-foreground">Vigência</label><Input type="date" value={editing.data_vigencia || ''} onChange={e => setEditing(p => ({ ...p!, data_vigencia: e.target.value }))} /></div>
                <div><label className="text-xs font-medium text-muted-foreground">Banco</label><Input value={editing.banco || ''} onChange={e => setEditing(p => ({ ...p!, banco: e.target.value.toUpperCase() }))} placeholder="Ex: MERCANTIL" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-muted-foreground">Tabela/Chave</label><Input value={editing.tabela_chave || '*'} onChange={e => setEditing(p => ({ ...p!, tabela_chave: e.target.value }))} placeholder="* = todas" /></div>
                <div><label className="text-xs font-medium text-muted-foreground">Seguro</label>
                  <Select value={editing.seguro || 'Ambos'} onValueChange={v => setEditing(p => ({ ...p!, seguro: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Sim">Sim</SelectItem><SelectItem value="Não">Não</SelectItem><SelectItem value="Ambos">Ambos</SelectItem></SelectContent></Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs font-medium text-muted-foreground">Valor Mín</label><Input type="number" value={editing.min_valor ?? 0} onChange={e => setEditing(p => ({ ...p!, min_valor: parseFloat(e.target.value) || 0 }))} /></div>
                <div><label className="text-xs font-medium text-muted-foreground">Valor Máx</label><Input type="number" value={editing.max_valor ?? 999999999} onChange={e => setEditing(p => ({ ...p!, max_valor: parseFloat(e.target.value) || 999999999 }))} /></div>
                <div><label className="text-xs font-medium text-muted-foreground">Taxa %</label><Input type="number" step="0.01" value={editing.taxa ?? 0} onChange={e => setEditing(p => ({ ...p!, taxa: parseFloat(e.target.value) || 0 }))} /></div>
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
          <DialogHeader><DialogTitle>Importar Regras FGTS</DialogTitle></DialogHeader>
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
                      <TableHead className="text-xs p-1 text-right">Val.Mín</TableHead>
                      <TableHead className="text-xs p-1 text-right">Val.Máx</TableHead>
                      <TableHead className="text-xs p-1 text-right">Taxa</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {importPreview.slice(0, 10).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="p-1">{r.banco}</TableCell>
                          <TableCell className="p-1">{r.tabela_chave}</TableCell>
                          <TableCell className="p-1">{r.seguro}</TableCell>
                          <TableCell className="p-1 text-right">{r.min_valor}</TableCell>
                          <TableCell className="p-1 text-right">{r.max_valor >= 999999000 ? '∞' : r.max_valor}</TableCell>
                          <TableCell className="p-1 text-right">{r.taxa}%</TableCell>
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
              Importar {importPreview.length} regras
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <input ref={importFileRef} type="file" accept=".xlsx,.xls" onChange={handleImportFile} className="hidden" />
    </Card>
  );
}
