import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Key } from 'lucide-react';
import { TSHead, useSortState, applySortToData } from '@/components/commission-reports/CRSortUtils';
import type { SellerPix, Profile } from './commissionUtils';

interface PixTabProps {
  profiles: Profile[];
  getSellerName: (id: string) => string;
  isAdmin: boolean;
  userId: string;
}

export default function PixTab({ profiles, getSellerName, isAdmin, userId }: PixTabProps) {
  const { toast } = useToast();
  const [pixList, setPixList] = useState<SellerPix[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SellerPix | null>(null);
  const [form, setForm] = useState({ seller_id: userId, pix_key: '', pix_type: 'cpf' });
  const { sort, toggle } = useSortState();

  useEffect(() => { loadPix(); }, []);

  const loadPix = async () => {
    setLoading(true);
    const { data } = await supabase.from('seller_pix_v2').select('*').order('created_at');
    if (data) setPixList(data as unknown as SellerPix[]);
    setLoading(false);
  };

  const openCreate = () => { setEditing(null); setForm({ seller_id: userId, pix_key: '', pix_type: 'cpf' }); setDialogOpen(true); };
  const openEdit = (p: SellerPix) => { setEditing(p); setForm({ seller_id: p.seller_id, pix_key: p.pix_key, pix_type: p.pix_type }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.pix_key) { toast({ title: 'Informe a chave PIX', variant: 'destructive' }); return; }
    const payload = { seller_id: form.seller_id, pix_key: form.pix_key, pix_type: form.pix_type };
    let error;
    if (editing) { ({ error } = await supabase.from('seller_pix_v2').update(payload as any).eq('id', editing.id)); }
    else { ({ error } = await supabase.from('seller_pix_v2').insert(payload as any)); }
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'PIX salvo' }); setDialogOpen(false); loadPix(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta chave PIX?')) return;
    await supabase.from('seller_pix_v2').delete().eq('id', id);
    toast({ title: 'PIX excluído' }); loadPix();
  };

  const visiblePix = isAdmin ? pixList : pixList.filter(p => p.seller_id === userId);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Key className="w-5 h-5" /> Chaves PIX</CardTitle>
          <Button onClick={openCreate} size="sm"><Plus className="w-4 h-4 mr-1" /> Adicionar</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-center text-muted-foreground py-8">Carregando...</p> : visiblePix.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma chave PIX cadastrada</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TSHead label="Vendedor" sortKey="seller_id" sort={sort} toggle={toggle} />
                <TSHead label="Tipo" sortKey="pix_type" sort={sort} toggle={toggle} />
                <TSHead label="Chave PIX" sortKey="pix_key" sort={sort} toggle={toggle} />
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applySortToData(visiblePix, sort, (p, k) => {
                if (k === 'seller_id') return getSellerName(p.seller_id);
                return (p as any)[k];
              }).map(p => (
                <TableRow key={p.id}>
                  <TableCell>{getSellerName(p.seller_id)}</TableCell>
                  <TableCell><Badge variant="outline">{p.pix_type.toUpperCase()}</Badge></TableCell>
                  <TableCell className="font-mono text-sm">{p.pix_key}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{editing ? 'Editar PIX' : 'Nova Chave PIX'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {isAdmin && (
                <div><Label>Vendedor</Label>
                  <Select value={form.seller_id} onValueChange={v => setForm({ ...form, seller_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{[...profiles].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, 'pt-BR')).map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.name || p.email}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div><Label>Tipo</Label>
                <Select value={form.pix_type} onValueChange={v => setForm({ ...form, pix_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF</SelectItem><SelectItem value="cnpj">CNPJ</SelectItem>
                    <SelectItem value="celular">Celular</SelectItem><SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="aleatoria">Aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Chave PIX</Label><Input value={form.pix_key} onChange={e => setForm({ ...form, pix_key: e.target.value })} placeholder="Ex: 123.456.789-00" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
