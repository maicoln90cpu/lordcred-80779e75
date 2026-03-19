import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, Clock, CheckCircle, TrendingUp, Loader2, ArrowRightLeft } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface StatusOption {
  value: string;
  label: string;
  color_class: string;
}

interface ProfileOption {
  value: string;
  label: string;
  color_class: string;
}

interface SellerRowState {
  filterProfile: string;
  qty: string;
  targetSeller: string;
}

interface LeadManagementProps {
  statusOptions: StatusOption[];
  profileOptions: ProfileOption[];
}

export default function LeadManagement({ statusOptions, profileOptions }: LeadManagementProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Global filter (only profile, status filter removed)
  const [globalProfile, setGlobalProfile] = useState('all');

  // Per-row state for reassignment
  const [rowStates, setRowStates] = useState<Record<string, SellerRowState>>({});

  // Confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    sellerId: string;
    sellerName: string;
    targetName: string;
    qty: number;
    profile: string;
  } | null>(null);
  const [isReassigning, setIsReassigning] = useState(false);

  // Fetch all leads with relevant fields
  const { data: allLeads = [] } = useQuery({
    queryKey: ['management-leads'],
    queryFn: async () => {
      const allData: any[] = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('client_leads')
          .select('id, status, assigned_to, perfil, contacted_at, updated_at')
          .range(from, from + batchSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length < batchSize) break;
        from += batchSize;
      }
      return allData;
    }
  });

  // Fetch sellers with roles to filter only sellers
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

  const getRowState = (sellerId: string): SellerRowState => {
    return rowStates[sellerId] || { filterProfile: 'all', qty: '', targetSeller: '' };
  };

  const updateRowState = (sellerId: string, partial: Partial<SellerRowState>) => {
    setRowStates(prev => ({
      ...prev,
      [sellerId]: { ...getRowState(sellerId), ...partial }
    }));
  };

  // Apply global profile filter
  const globalFiltered = useMemo(() => {
    let result = [...allLeads];
    if (globalProfile !== 'all') result = result.filter((l: any) => l.perfil === globalProfile);
    return result;
  }, [allLeads, globalProfile]);

  // Global counter metrics
  const globalMetrics = useMemo(() => {
    const total = globalFiltered.length;
    const pendentes = globalFiltered.filter((l: any) => !l.status || l.status === 'pendente').length;
    const contatados = globalFiltered.filter((l: any) => l.status && l.status !== 'pendente').length;
    const aprovados = globalFiltered.filter((l: any) => l.status === 'APROVADO').length;
    const taxaAprovacao = total > 0 ? Math.round((aprovados / total) * 100) : 0;
    return { total, pendentes, contatados, aprovados, taxaAprovacao };
  }, [globalFiltered]);

  // Group leads by seller — compute pendentes from raw allLeads (not filtered)
  const sellerData = useMemo(() => {
    const map = new Map<string, { leads: any[] }>();
    globalFiltered.forEach((l: any) => {
      if (!map.has(l.assigned_to)) map.set(l.assigned_to, { leads: [] });
      map.get(l.assigned_to)!.leads.push(l);
    });

    // Count pendentes from RAW allLeads (unfiltered) per seller
    const pendentesMap = new Map<string, number>();
    allLeads.forEach((l: any) => {
      if (!l.status || l.status === 'pendente') {
        pendentesMap.set(l.assigned_to, (pendentesMap.get(l.assigned_to) || 0) + 1);
      }
    });

    return Array.from(map.entries()).map(([sellerId, { leads }]) => {
      const total = leads.length;
      const contacted = leads.filter((l: any) => l.status && l.status !== 'pendente').length;
      const pctContacted = total > 0 ? Math.round((contacted / total) * 100) : 0;
      const pendentes = pendentesMap.get(sellerId) || 0;
      const lastUpdate = leads.reduce((max: string, l: any) => l.updated_at > max ? l.updated_at : max, '');
      return { sellerId, total, contacted, pctContacted, pendentes, lastUpdate };
    }).sort((a, b) => b.total - a.total);
  }, [globalFiltered, allLeads]);

  // Count leads available for reassignment based on per-row filters (profile only)
  const getAvailableCount = (sellerId: string) => {
    const row = getRowState(sellerId);
    let leads = globalFiltered.filter((l: any) => l.assigned_to === sellerId);
    if (row.filterProfile !== 'all') leads = leads.filter((l: any) => l.perfil === row.filterProfile);
    return leads.length;
  };

  const handleReassignClick = (sellerId: string) => {
    const row = getRowState(sellerId);
    const qty = parseInt(row.qty);
    if (!qty || qty <= 0) {
      toast({ title: 'Informe a quantidade', variant: 'destructive' });
      return;
    }
    if (!row.targetSeller) {
      toast({ title: 'Selecione o vendedor destino', variant: 'destructive' });
      return;
    }
    if (row.targetSeller === sellerId) {
      toast({ title: 'Vendedor destino deve ser diferente', variant: 'destructive' });
      return;
    }
    const available = getAvailableCount(sellerId);
    const finalQty = Math.min(qty, available);
    if (finalQty <= 0) {
      toast({ title: 'Nenhum lead encontrado com os filtros selecionados', variant: 'destructive' });
      return;
    }

    setConfirmDialog({
      sellerId,
      sellerName: getSellerName(sellerId),
      targetName: getSellerName(row.targetSeller),
      qty: finalQty,
      profile: row.filterProfile,
    });
  };

  const executeReassignment = async () => {
    if (!confirmDialog) return;
    setIsReassigning(true);
    try {
      const { sellerId } = confirmDialog;
      const row = getRowState(sellerId);

      // Build query to get lead IDs matching filters
      let query = supabase
        .from('client_leads')
        .select('id')
        .eq('assigned_to', sellerId);

      if (row.filterProfile !== 'all') {
        query = query.eq('perfil', row.filterProfile);
      }

      // Also apply global profile filter
      if (globalProfile !== 'all') {
        query = query.eq('perfil', globalProfile);
      }

      const { data: leads, error: fetchErr } = await query.limit(confirmDialog.qty);
      if (fetchErr) throw fetchErr;
      if (!leads || leads.length === 0) throw new Error('Nenhum lead encontrado');

      const ids = leads.map((l: any) => l.id);

      // Update in batches of 100
      let updated = 0;
      for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100);
        const { error } = await supabase
          .from('client_leads')
          .update({ assigned_to: row.targetSeller, updated_at: new Date().toISOString() } as any)
          .in('id', batch);
        if (error) throw error;
        updated += batch.length;
      }

      toast({
        title: 'Reatribuição concluída',
        description: `${updated} leads movidos de ${confirmDialog.sellerName} para ${confirmDialog.targetName}`,
      });

      queryClient.invalidateQueries({ queryKey: ['management-leads'] });
      queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
      queryClient.invalidateQueries({ queryKey: ['admin-leads-metrics'] });

      // Reset row state
      updateRowState(sellerId, { qty: '', targetSeller: '', filterProfile: 'all' });
      setConfirmDialog(null);
    } catch (e: any) {
      toast({ title: 'Erro na reatribuição', description: e.message, variant: 'destructive' });
    } finally {
      setIsReassigning(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Global Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" />
            Reatribuição de Leads por Vendedor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <span className="text-sm text-muted-foreground">Filtros globais:</span>
            <Select value={globalStatus} onValueChange={setGlobalStatus}>
              <SelectTrigger className="w-44 h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {statusOptions.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={globalProfile} onValueChange={setGlobalProfile}>
              <SelectTrigger className="w-44 h-9">
                <SelectValue placeholder="Perfil" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os perfis</SelectItem>
                {profileOptions.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {sellerData.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum vendedor com leads encontrado.</p>
          ) : (
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-center">Qtd Leads</TableHead>
                    <TableHead className="text-center">% Contatos</TableHead>
                    <TableHead className="text-center">Última Alteração</TableHead>
                    <TableHead>Filtro Status</TableHead>
                    <TableHead>Filtro Perfil</TableHead>
                    <TableHead className="text-center">Qtd Leads</TableHead>
                    <TableHead>Vendedor Destino</TableHead>
                    <TableHead className="text-center">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sellerData.map(({ sellerId, total, pctContacted, lastUpdate }) => {
                    const row = getRowState(sellerId);
                    const available = getAvailableCount(sellerId);

                    return (
                      <TableRow key={sellerId}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {getSellerName(sellerId)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{total}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 justify-center">
                            <Progress value={pctContacted} className="h-2 w-16" />
                            <span className="text-xs text-muted-foreground w-8">{pctContacted}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground whitespace-nowrap">
                          {lastUpdate ? new Date(lastUpdate).toLocaleDateString('pt-BR') : '-'}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={row.filterStatus}
                            onValueChange={(v) => updateRowState(sellerId, { filterStatus: v })}
                          >
                            <SelectTrigger className="w-36 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos</SelectItem>
                              {statusOptions.map(s => (
                                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={row.filterProfile}
                            onValueChange={(v) => updateRowState(sellerId, { filterProfile: v })}
                          >
                            <SelectTrigger className="w-36 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos</SelectItem>
                              {profileOptions.map(p => (
                                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-center gap-1">
                            <Input
                              type="number"
                              min={1}
                              max={available}
                              placeholder="Qtd"
                              value={row.qty}
                              onChange={(e) => updateRowState(sellerId, { qty: e.target.value })}
                              className="w-20 h-8 text-xs text-center"
                            />
                            <span className="text-[10px] text-muted-foreground">
                              Disp: {available}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={row.targetSeller}
                            onValueChange={(v) => updateRowState(sellerId, { targetSeller: v })}
                          >
                            <SelectTrigger className="w-40 h-8 text-xs">
                              <SelectValue placeholder="Destino" />
                            </SelectTrigger>
                            <SelectContent>
                              {sellers
                                .filter((s: any) => s.user_id !== sellerId)
                                .map((s: any) => (
                                  <SelectItem key={s.user_id} value={s.user_id}>
                                    {s.name || s.email}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            onClick={() => handleReassignClick(sellerId)}
                            disabled={!row.qty || !row.targetSeller}
                            className="text-xs"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5 mr-1" />
                            Reatribuir
                          </Button>
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

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmDialog} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Reatribuição</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Mover <strong>{confirmDialog?.qty} leads</strong> de{' '}
                <strong>{confirmDialog?.sellerName}</strong> para{' '}
                <strong>{confirmDialog?.targetName}</strong>.
              </p>
              {confirmDialog?.status !== 'all' && (
                <p className="text-sm">Filtro status: <Badge variant="outline">{confirmDialog?.status}</Badge></p>
              )}
              {confirmDialog?.profile !== 'all' && (
                <p className="text-sm">Filtro perfil: <Badge variant="outline">{confirmDialog?.profile}</Badge></p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isReassigning}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeReassignment} disabled={isReassigning}>
              {isReassigning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-2" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
