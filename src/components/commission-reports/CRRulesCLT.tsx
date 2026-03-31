import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Plus, Pencil, Trash2, Settings, AlertTriangle, Search } from 'lucide-react';
import { TSHead, useSortState, applySortToData, TOOLTIPS_RULES_CLT } from './CRSortUtils';

interface RuleCLT {
  id: string; data_vigencia: string; banco: string; tabela_chave: string;
  seguro: string; prazo_min: number; prazo_max: number; taxa: number; created_at: string;
}

const EMPTY: Omit<RuleCLT, 'id' | 'created_at'> = {
  data_vigencia: new Date().toISOString().slice(0, 10), banco: '', tabela_chave: '*',
  seguro: 'Ambos', prazo_min: 0, prazo_max: 999, taxa: 0,
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
      const payload = { data_vigencia: editing.data_vigencia!, banco: editing.banco!, tabela_chave: editing.tabela_chave || '*', seguro: editing.seguro || 'Ambos', prazo_min: editing.prazo_min ?? 0, prazo_max: editing.prazo_max ?? 999, taxa: editing.taxa ?? 0 };
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg"><Settings className="w-5 h-5" /> Regras CLT</CardTitle>
            <CardDescription>Taxas de comissão esperada por banco, tabela, seguro e faixa de prazo.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative"><Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 w-40 h-9" /></div>
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
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </Card>
  );
}
