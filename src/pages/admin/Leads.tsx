import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Users, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import LeadImporter from '@/components/admin/LeadImporter';
import LeadsTable from '@/components/admin/LeadsTable';

export default function Leads() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reassignBatch, setReassignBatch] = useState<string | null>(null);
  const [reassignSeller, setReassignSeller] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);

  const { data: allLeads = [] } = useQuery({
    queryKey: ['admin-leads-metrics'],
    queryFn: async () => {
      const { data } = await supabase.from('client_leads' as any).select('status, batch_name, assigned_to, created_at, contacted_at').limit(5000);
      return (data || []) as any[];
    }
  });

  const { data: sellers = [] } = useQuery({
    queryKey: ['sellers-list'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, name, email');
      return data || [];
    }
  });

  const getSellerName = (userId: string) => {
    const s = sellers.find((s: any) => s.user_id === userId);
    return s?.name || s?.email || 'N/A';
  };

  const metrics = useMemo(() => {
    const total = allLeads.length;
    const pendentes = allLeads.filter((l: any) => l.status === 'pendente').length;
    const contatados = allLeads.filter((l: any) => l.status !== 'pendente').length;
    const aprovados = allLeads.filter((l: any) => l.status === 'APROVADO').length;
    const taxaAprovacao = total > 0 ? Math.round((aprovados / total) * 100) : 0;
    return { total, pendentes, contatados, aprovados, taxaAprovacao };
  }, [allLeads]);

  const batchHistory = useMemo(() => {
    const map = new Map<string, { batch: string; seller: string; total: number; contacted: number; created: string }>();
    allLeads.forEach((l: any) => {
      const key = l.batch_name || 'Sem lote';
      if (!map.has(key)) {
        map.set(key, { batch: key, seller: l.assigned_to, total: 0, contacted: 0, created: l.created_at });
      }
      const entry = map.get(key)!;
      entry.total++;
      if (l.status !== 'pendente') entry.contacted++;
      if (l.created_at < entry.created) entry.created = l.created_at;
    });
    return Array.from(map.values()).sort((a, b) => b.created.localeCompare(a.created));
  }, [allLeads]);

  const handleReassignBatch = async () => {
    if (!reassignBatch || !reassignSeller) return;
    setIsReassigning(true);
    try {
      const { error } = await supabase.from('client_leads' as any)
        .update({ assigned_to: reassignSeller, updated_at: new Date().toISOString() })
        .eq('batch_name', reassignBatch);
      if (error) throw error;
      toast({ title: 'Lote reatribuído com sucesso' });
      queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
      queryClient.invalidateQueries({ queryKey: ['admin-leads-metrics'] });
      setReassignBatch(null);
      setReassignSeller('');
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setIsReassigning(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Leads</h1>
          <p className="text-muted-foreground">Importe planilhas e atribua leads aos vendedores</p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-muted-foreground text-sm"><Users className="w-4 h-4" /> Total</div>
              <p className="text-2xl font-bold mt-1">{metrics.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-muted-foreground text-sm"><Clock className="w-4 h-4" /> Pendentes</div>
              <p className="text-2xl font-bold mt-1">{metrics.pendentes}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-muted-foreground text-sm"><CheckCircle className="w-4 h-4" /> Contatados</div>
              <p className="text-2xl font-bold mt-1">{metrics.contatados}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-muted-foreground text-sm"><XCircle className="w-4 h-4" /> Aprovados</div>
              <p className="text-2xl font-bold mt-1">{metrics.aprovados} <span className="text-sm text-muted-foreground font-normal">({metrics.taxaAprovacao}%)</span></p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="leads" className="space-y-4">
          <TabsList>
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="import">Importar Planilha</TabsTrigger>
            <TabsTrigger value="batches">Histórico de Lotes</TabsTrigger>
          </TabsList>

          <TabsContent value="leads">
            <LeadsTable />
          </TabsContent>

          <TabsContent value="import">
            <LeadImporter />
          </TabsContent>

          <TabsContent value="batches">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Importações</CardTitle>
              </CardHeader>
              <CardContent>
                {batchHistory.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Nenhum lote importado.</p>
                ) : (
                  <div className="border rounded-lg overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lote</TableHead>
                          <TableHead>Vendedor</TableHead>
                          <TableHead>Qtd Leads</TableHead>
                          <TableHead>% Contatados</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Reatribuir</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {batchHistory.map((b) => {
                          const pct = b.total > 0 ? Math.round((b.contacted / b.total) * 100) : 0;
                          return (
                            <TableRow key={b.batch}>
                              <TableCell className="font-medium">{b.batch}</TableCell>
                              <TableCell>{getSellerName(b.seller)}</TableCell>
                              <TableCell>{b.total}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Progress value={pct} className="h-2 w-20" />
                                  <span className="text-xs text-muted-foreground">{pct}%</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {new Date(b.created).toLocaleDateString('pt-BR')}
                              </TableCell>
                              <TableCell>
                                {reassignBatch === b.batch ? (
                                  <div className="flex gap-2 items-center">
                                    <Select value={reassignSeller} onValueChange={setReassignSeller}>
                                      <SelectTrigger className="w-40 h-8">
                                        <SelectValue placeholder="Vendedor" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {sellers.map((s: any) => (
                                          <SelectItem key={s.user_id} value={s.user_id}>{s.name || s.email}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Button size="sm" onClick={handleReassignBatch} disabled={isReassigning || !reassignSeller}>
                                      {isReassigning ? <Loader2 className="w-3 h-3 animate-spin" /> : 'OK'}
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setReassignBatch(null)}>✕</Button>
                                  </div>
                                ) : (
                                  <Button size="sm" variant="outline" onClick={() => { setReassignBatch(b.batch); setReassignSeller(''); }}>
                                    Reatribuir
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
