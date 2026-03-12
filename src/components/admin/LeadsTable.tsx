import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Search, Users, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function LeadsTable() {
  const [filterSeller, setFilterSeller] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sellers = [] } = useQuery({
    queryKey: ['sellers-list'],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, email');
      return profiles || [];
    }
  });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['admin-leads', filterSeller, filterStatus, searchTerm],
    queryFn: async () => {
      let query = supabase.from('client_leads' as any).select('*').order('created_at', { ascending: false });

      if (filterSeller !== 'all') {
        query = query.eq('assigned_to', filterSeller);
      }
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }
      if (searchTerm) {
        query = query.or(`nome.ilike.%${searchTerm}%,telefone.ilike.%${searchTerm}%,cpf.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query.limit(200);
      if (error) throw error;
      return data as any[];
    }
  });

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('client_leads' as any).delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
      toast({ title: 'Lead excluído' });
    }
  };

  const getSellerName = (userId: string) => {
    const seller = sellers.find((s: any) => s.user_id === userId);
    return seller?.name || seller?.email || 'N/A';
  };

  const statusColors: Record<string, string> = {
    'CHAMEI': 'bg-blue-500/20 text-blue-400',
    'NÃO EXISTE': 'bg-red-500/20 text-red-400',
    'APROVADO': 'bg-green-500/20 text-green-400',
    'NÃO ATENDEU': 'bg-yellow-500/20 text-yellow-400',
    'pendente': 'bg-muted text-muted-foreground',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Todos os Leads
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou CPF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterSeller} onValueChange={setFilterSeller}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os vendedores</SelectItem>
              {sellers.map((s: any) => (
                <SelectItem key={s.user_id} value={s.user_id}>{s.name || s.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="CHAMEI">Chamei</SelectItem>
              <SelectItem value="NÃO ATENDEU">Não Atendeu</SelectItem>
              <SelectItem value="NÃO EXISTE">Não Existe</SelectItem>
              <SelectItem value="APROVADO">Aprovado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum lead encontrado. Importe uma planilha para começar.
          </div>
        ) : (
          <div className="border rounded-lg overflow-auto max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Valor Lib.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead: any) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.nome}</TableCell>
                    <TableCell>{lead.telefone}</TableCell>
                    <TableCell>
                      {lead.valor_lib
                        ? Number(lead.valor_lib).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[lead.status] || 'bg-muted text-muted-foreground'}>
                        {lead.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{getSellerName(lead.assigned_to)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{lead.batch_name}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(lead.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          Mostrando {leads.length} leads
        </p>
      </CardContent>
    </Card>
  );
}
