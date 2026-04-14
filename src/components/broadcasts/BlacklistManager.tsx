import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Upload, Ban } from 'lucide-react';

interface BlacklistEntry {
  id: string;
  phone: string;
  reason: string | null;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function BlacklistManager({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<BlacklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (open) loadEntries();
  }, [open]);

  const loadEntries = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('broadcast_blacklist')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    setEntries((data as BlacklistEntry[]) || []);
    setLoading(false);
  };

  const addSingle = async () => {
    const cleaned = phone.trim().replace(/\D/g, '');
    if (cleaned.length < 10) {
      toast({ title: 'Telefone inválido', variant: 'destructive' });
      return;
    }
    setAdding(true);
    const { error } = await supabase.from('broadcast_blacklist').insert({
      phone: cleaned,
      reason: reason || null,
      created_by: user?.id,
    } as any);
    if (error) {
      if (error.code === '23505') {
        toast({ title: 'Número já está na blacklist', variant: 'destructive' });
      } else {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      }
    } else {
      toast({ title: 'Número adicionado à blacklist' });
      setPhone('');
      setReason('');
      loadEntries();
    }
    setAdding(false);
  };

  const addBulk = async () => {
    const phones = bulkText
      .split(/[\n,;]+/)
      .map(p => p.trim().replace(/\D/g, ''))
      .filter(p => p.length >= 10);

    if (phones.length === 0) {
      toast({ title: 'Nenhum telefone válido encontrado', variant: 'destructive' });
      return;
    }

    setAdding(true);
    const rows = [...new Set(phones)].map(p => ({
      phone: p,
      reason: reason || 'Importação em lote',
      created_by: user?.id,
    }));

    // Insert in batches, ignoring duplicates
    let added = 0;
    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { data } = await supabase.from('broadcast_blacklist').upsert(batch as any, {
        onConflict: 'phone',
        ignoreDuplicates: true,
      }).select();
      added += data?.length || 0;
    }

    toast({ title: `${added} números adicionados à blacklist` });
    setBulkText('');
    setReason('');
    loadEntries();
    setAdding(false);
  };

  const removeEntry = async (id: string) => {
    await supabase.from('broadcast_blacklist').delete().eq('id', id);
    setEntries(prev => prev.filter(e => e.id !== id));
    toast({ title: 'Número removido da blacklist' });
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="w-5 h-5 text-destructive" /> Blacklist Global
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Toggle bulk */}
          <div className="flex items-center gap-2">
            <Button
              variant={bulkMode ? 'outline' : 'default'}
              size="sm"
              onClick={() => setBulkMode(false)}
            >
              <Plus className="w-3 h-3 mr-1" /> Individual
            </Button>
            <Button
              variant={bulkMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setBulkMode(true)}
            >
              <Upload className="w-3 h-3 mr-1" /> Em Lote
            </Button>
          </div>

          {!bulkMode ? (
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="5511999998888"
                />
              </div>
              <div className="flex-1">
                <Input
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Motivo (opcional)"
                />
              </div>
              <Button onClick={addSingle} disabled={adding} size="icon">
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Textarea
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                placeholder="Cole os números (um por linha, separados por vírgula ou ponto-e-vírgula)"
                rows={4}
              />
              <div className="flex items-center gap-2">
                <Input
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Motivo (opcional)"
                  className="flex-1"
                />
                <Button onClick={addBulk} disabled={adding}>
                  {adding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Adicionar
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs text-muted-foreground">
              {entries.length} números bloqueados
            </Label>
          </div>
          <ScrollArea className="h-[300px] border rounded-md">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Ban className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">Nenhum número na blacklist</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="text-sm font-mono">{e.phone}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.reason || '—'}</TableCell>
                      <TableCell className="text-xs">{formatDate(e.created_at)}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => removeEntry(e.id)}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
