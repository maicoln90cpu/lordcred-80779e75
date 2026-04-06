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
import { Loader2, ArrowRightLeft, Check } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';

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

  const [globalProfiles, setGlobalProfiles] = useState<string[]>([]);
  const [globalStatuses, setGlobalStatuses] = useState<string[]>([]);
  const [globalBancos, setGlobalBancos] = useState<string[]>([]);
  const [globalBatches, setGlobalBatches] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [rowStates, setRowStates] = useState<Record<string, SellerRowState>>({});
  const [confirmDialog, setConfirmDialog] = useState<{
    sellerId: string;
    sellerName: string;
    targetName: string;
    qty: number;
    profile: string;
  } | null>(null);
  const [isReassigning, setIsReassigning] = useState(false);

  const { data: allLeads = [] } = useQuery({
    queryKey: ['management-leads'],
    queryFn: async () => {
      const allData: any[] = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('client_leads')
          .select('id, status, assigned_to, perfil, contacted_at, updated_at, banco_simulado, batch_name')
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

  // Extract unique banks and batches
  const uniqueBancos = useMemo(() => {
    const set = new Set<string>();
    allLeads.forEach((l: any) => { if (l.banco_simulado) set.add(l.banco_simulado); });
    return Array.from(set).sort();
  }, [allLeads]);

  const uniqueBatches = useMemo(() => {
    const set = new Set<string>();
    allLeads.forEach((l: any) => { if (l.batch_name) set.add(l.batch_name); });
    return Array.from(set).sort();
  }, [allLeads]);

  // Apply global filters
  const globalFiltered = useMemo(() => {
    let result = [...allLeads];
    if (globalProfiles.length > 0) result = result.filter((l: any) => globalProfiles.includes(l.perfil));
    if (globalStatuses.length > 0) result = result.filter((l: any) => globalStatuses.includes(l.status || 'pendente'));
    if (globalBancos.length > 0) result = result.filter((l: any) => globalBancos.includes(l.banco_simulado));
    if (globalBatches.length > 0) result = result.filter((l: any) => globalBatches.includes(l.batch_name));
    if (dateFrom) result = result.filter((l: any) => l.updated_at >= dateFrom);
    if (dateTo) result = result.filter((l: any) => l.updated_at <= dateTo + 'T23:59:59');
    return result;
  }, [allLeads, globalProfiles, globalStatuses, globalBancos, globalBatches, dateFrom, dateTo]);

  // Group leads by seller
  const sellerData = useMemo(() => {
    // Total absoluto (sem filtros)
    const totalMap = new Map<string, number>();
    allLeads.forEach((l: any) => {
      totalMap.set(l.assigned_to, (totalMap.get(l.assigned_to) || 0) + 1);
    });

    // Leads filtrados agrupados por seller
    const filteredMap = new Map<string, any[]>();
    globalFiltered.forEach((l: any) => {
      if (!filteredMap.has(l.assigned_to)) filteredMap.set(l.assigned_to, []);
      filteredMap.get(l.assigned_to)!.push(l);
    });

    // Unir todos os sellers que existem em qualquer dos dois maps
    const allSellerIds = new Set([...totalMap.keys(), ...filteredMap.keys()]);

    return Array.from(allSellerIds).map((sellerId) => {
      const total = totalMap.get(sellerId) || 0;
      const leads = filteredMap.get(sellerId) || [];
      const totalFiltrado = leads.length;
      const contacted = leads.filter((l: any) => l.status && l.status !== 'pendente').length;
      const pctContacted = totalFiltrado > 0 ? Math.round((contacted / totalFiltrado) * 100) : 0;
      const lastUpdate = leads.reduce((max: string, l: any) => l.updated_at > max ? l.updated_at : max, '');
      return { sellerId, total, contacted, pctContacted, totalFiltrado, lastUpdate };
    }).sort((a, b) => b.total - a.total);
  }, [allLeads, globalFiltered]);

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

      let query = supabase
        .from('client_leads')
        .select('id')
        .eq('assigned_to', sellerId);

      if (row.filterProfile !== 'all') query = query.eq('perfil', row.filterProfile);
      if (globalProfiles.length > 0) query = query.in('perfil', globalProfiles);
      if (globalStatuses.length > 0) query = query.in('status', globalStatuses);

      const { data: leads, error: fetchErr } = await query.limit(confirmDialog.qty);
      if (fetchErr) throw fetchErr;
      if (!leads || leads.length === 0) throw new Error('Nenhum lead encontrado');

      const ids = leads.map((l: any) => l.id);
      let updated = 0;
      for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100);
        const { error } = await supabase
          .from('client_leads')
          .update({ assigned_to: row.targetSeller, assigned_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any)
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
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" />
            Reatribuição de Leads por Vendedor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <span className="text-sm text-muted-foreground">Filtro global:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-48 h-9 justify-between text-sm">
                  {globalProfiles.length === 0 ? 'Todos os perfis' : `Perfis (${globalProfiles.length})`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="start">
                <div className="space-y-1">
                  {profileOptions.map(p => (
                    <label key={p.value} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm">
                      <Checkbox
                        checked={globalProfiles.includes(p.value)}
                        onCheckedChange={(checked) => {
                          setGlobalProfiles(prev =>
                            checked ? [...prev, p.value] : prev.filter(v => v !== p.value)
                          );
                        }}
                      />
                      {p.label}
                    </label>
                  ))}
                  {globalProfiles.length > 0 && (
                    <Button variant="ghost" size="sm" className="w-full text-xs mt-1" onClick={() => setGlobalProfiles([])}>
                      Limpar filtros
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-48 h-9 justify-between text-sm">
                  {globalStatuses.length === 0 ? 'Todos os status' : `Status (${globalStatuses.length})`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="start">
                <div className="space-y-1">
                  {statusOptions.map(s => (
                    <label key={s.value} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm">
                      <Checkbox
                        checked={globalStatuses.includes(s.value)}
                        onCheckedChange={(checked) => {
                          setGlobalStatuses(prev =>
                            checked ? [...prev, s.value] : prev.filter(v => v !== s.value)
                          );
                        }}
                      />
                      {s.label}
                    </label>
                  ))}
                  {globalStatuses.length > 0 && (
                    <Button variant="ghost" size="sm" className="w-full text-xs mt-1" onClick={() => setGlobalStatuses([])}>
                      Limpar filtros
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-48 h-9 justify-between text-sm">
                  {globalBancos.length === 0 ? 'Todos os bancos' : `Bancos (${globalBancos.length})`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2 max-h-60 overflow-y-auto" align="start">
                <div className="space-y-1">
                  {uniqueBancos.map(b => (
                    <label key={b} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm">
                      <Checkbox
                        checked={globalBancos.includes(b)}
                        onCheckedChange={(checked) => {
                          setGlobalBancos(prev =>
                            checked ? [...prev, b] : prev.filter(v => v !== b)
                          );
                        }}
                      />
                      {b}
                    </label>
                  ))}
                  {globalBancos.length > 0 && (
                    <Button variant="ghost" size="sm" className="w-full text-xs mt-1" onClick={() => setGlobalBancos([])}>
                      Limpar filtros
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-48 h-9 justify-between text-sm">
                  {globalBatches.length === 0 ? 'Todos os lotes' : `Lotes (${globalBatches.length})`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2 max-h-60 overflow-y-auto" align="start">
                <div className="space-y-1">
                  {uniqueBatches.map(b => (
                    <label key={b} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm">
                      <Checkbox
                        checked={globalBatches.includes(b)}
                        onCheckedChange={(checked) => {
                          setGlobalBatches(prev =>
                            checked ? [...prev, b] : prev.filter(v => v !== b)
                          );
                        }}
                      />
                      {b}
                    </label>
                  ))}
                  {globalBatches.length > 0 && (
                    <Button variant="ghost" size="sm" className="w-full text-xs mt-1" onClick={() => setGlobalBatches([])}>
                      Limpar filtros
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">De:</span>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40 h-9 text-sm"
              />
              <span className="text-sm text-muted-foreground">Até:</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40 h-9 text-sm"
              />
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setDateFrom(''); setDateTo(''); }}>
                  Limpar datas
                </Button>
              )}
            </div>
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
                    <TableHead className="text-center">Total Filtrado</TableHead>
                    <TableHead className="text-center">% Contatos</TableHead>
                    <TableHead className="text-center">Última Alteração</TableHead>
                    <TableHead>Filtro Perfil</TableHead>
                    <TableHead className="text-center">Qtd Leads</TableHead>
                    <TableHead>Vendedor Destino</TableHead>
                    <TableHead className="text-center">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sellerData.map(({ sellerId, total, pctContacted, totalFiltrado, lastUpdate }) => {
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
                        <TableCell className="text-center">
                          <Badge variant="outline">{totalFiltrado}</Badge>
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
