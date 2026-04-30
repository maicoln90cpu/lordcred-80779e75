import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, Users, RefreshCw, Trash2, Search, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import V8ContactPoolImportDialog from './V8ContactPoolImportDialog';

interface PoolContact {
  id: string;
  cpf: string;
  full_name: string | null;
  phone: string | null;
  birth_date: string | null;
  last_simulated_at: string | null;
  last_simulation_status: string | null;
  last_available_margin: number | null;
  simulation_count: number;
  is_blocked: boolean;
  imported_at: string;
}

const PAGE_SIZE = 50;

export default function V8ContactPoolTab() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PoolContact[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [stats, setStats] = useState({ total: 0, simulated: 0, pending: 0, blocked: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('v8_contact_pool')
        .select('id, cpf, full_name, phone, birth_date, last_simulated_at, last_simulation_status, last_available_margin, simulation_count, is_blocked, imported_at', { count: 'exact' })
        .order('imported_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (search.trim()) {
        const cleanCpf = search.replace(/\D/g, '');
        if (cleanCpf.length >= 3) {
          q = q.ilike('cpf', `%${cleanCpf}%`);
        } else {
          q = q.ilike('full_name', `%${search.trim()}%`);
        }
      }

      const { data, error, count } = await q;
      if (error) throw error;
      setRows((data as PoolContact[]) || []);
      setTotal(count || 0);
    } catch (e: any) {
      toast.error('Erro ao carregar pool: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  const loadStats = useCallback(async () => {
    try {
      const [totalR, simR, blockedR] = await Promise.all([
        supabase.from('v8_contact_pool').select('*', { count: 'exact', head: true }),
        supabase.from('v8_contact_pool').select('*', { count: 'exact', head: true }).not('last_simulated_at', 'is', null),
        supabase.from('v8_contact_pool').select('*', { count: 'exact', head: true }).eq('is_blocked', true),
      ]);
      const t = totalR.count || 0;
      const s = simR.count || 0;
      setStats({ total: t, simulated: s, pending: t - s, blocked: blockedR.count || 0 });
    } catch {
      // silent
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadStats(); }, [loadStats]);

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este contato do pool? Não afeta simulações já feitas.')) return;
    const { error } = await supabase.from('v8_contact_pool').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Contato removido');
    load(); loadStats();
  };

  const formatCpf = (cpf: string) => {
    const c = cpf.replace(/\D/g, '');
    if (c.length !== 11) return cpf;
    return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total no pool</div>
          <div className="text-2xl font-bold flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> {stats.total.toLocaleString('pt-BR')}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Já simulados</div>
          <div className="text-2xl font-bold text-green-600">{stats.simulated.toLocaleString('pt-BR')}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Aguardando simulação</div>
          <div className="text-2xl font-bold text-amber-600">{stats.pending.toLocaleString('pt-BR')}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Bloqueados</div>
          <div className="text-2xl font-bold text-destructive">{stats.blocked.toLocaleString('pt-BR')}</div>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setImportOpen(true)} className="gap-2">
          <Upload className="w-4 h-4" /> Importar XLSX/XLSM/CSV
        </Button>
        <Button variant="outline" onClick={() => { load(); loadStats(); }} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="CPF ou nome..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-64"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhum contato no pool ainda.</p>
            <p className="text-xs">Clique em "Importar XLSX/CSV" para começar.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="text-left p-2">CPF</th>
                  <th className="text-left p-2">Nome</th>
                  <th className="text-left p-2">Telefone</th>
                  <th className="text-center p-2">Última simulação</th>
                  <th className="text-center p-2">Status</th>
                  <th className="text-right p-2">Margem</th>
                  <th className="text-center p-2">Tentativas</th>
                  <th className="text-center p-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="p-2 font-mono text-xs">{formatCpf(r.cpf)}</td>
                    <td className="p-2">{r.full_name || '—'}</td>
                    <td className="p-2 font-mono text-xs">{r.phone || '—'}</td>
                    <td className="p-2 text-center text-xs">
                      {r.last_simulated_at ? new Date(r.last_simulated_at).toLocaleDateString('pt-BR') : <span className="text-muted-foreground">nunca</span>}
                    </td>
                    <td className="p-2 text-center">
                      {r.last_simulation_status ? (
                        <Badge variant={r.last_simulation_status === 'success' ? 'default' : 'secondary'} className="text-[10px]">
                          {r.last_simulation_status}
                        </Badge>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="p-2 text-right text-xs">
                      {r.last_available_margin ? `R$ ${Number(r.last_available_margin).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="p-2 text-center text-xs">{r.simulation_count}</td>
                    <td className="p-2 text-center">
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(r.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between p-3 border-t text-sm">
            <span className="text-muted-foreground">
              Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total.toLocaleString('pt-BR')}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <Button size="sm" variant="outline" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}>Próximo</Button>
            </div>
          </div>
        )}
      </Card>

      <V8ContactPoolImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => { load(); loadStats(); }}
      />
    </div>
  );
}
