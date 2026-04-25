import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type AllowedTable =
  | 'commission_rates_fgts'
  | 'commission_rates_clt'
  | 'commission_rates_fgts_v2'
  | 'commission_rates_clt_v2';

interface RatesBulkControlsProps {
  banks: string[];
  bankFilter: string;
  onBankFilterChange: (v: string) => void;
  tableName: AllowedTable;
  totalCount: number;
  filteredCount: number;
  onDeleted: () => void;
}

/**
 * Reusable controls placed above the rates tables:
 *  - Bank filter dropdown (`__all__` by default).
 *  - Destructive "Apagar todas as taxas" button protected by typing the word APAGAR.
 *  - When a specific bank is selected, the deletion only targets that bank.
 */
export default function RatesBulkControls({
  banks,
  bankFilter,
  onBankFilterChange,
  tableName,
  totalCount,
  filteredCount,
  onDeleted,
}: RatesBulkControlsProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [confirmWord, setConfirmWord] = useState('');
  const [busy, setBusy] = useState(false);

  const isFiltered = bankFilter !== '__all__' && bankFilter !== '';
  const targetCount = isFiltered ? filteredCount : totalCount;

  const handleDeleteAll = async () => {
    if (confirmWord.trim().toUpperCase() !== 'APAGAR') {
      toast({ title: 'Confirmação inválida', description: 'Digite exatamente APAGAR para confirmar.', variant: 'destructive' });
      return;
    }
    if (targetCount === 0) {
      toast({ title: 'Nada para apagar' });
      setOpen(false);
      return;
    }
    setBusy(true);
    let query = supabase.from(tableName).delete();
    if (isFiltered) {
      query = query.eq('bank', bankFilter);
    } else {
      // delete all rows: filter by impossible-to-be-null id (PK is always set)
      query = query.not('id', 'is', null);
    }
    const { error } = await query;
    setBusy(false);
    if (error) {
      toast({ title: 'Erro ao apagar', description: error.message, variant: 'destructive' });
      return;
    }
    // Audit log (best effort)
    try {
      await supabase.from('audit_logs').insert({
        action: 'bulk_delete_rates',
        target_table: tableName,
        details: { scope: isFiltered ? `bank=${bankFilter}` : 'all', deleted_count: targetCount },
      } as any);
    } catch {
      /* noop */
    }
    toast({ title: `${targetCount} taxa(s) apagada(s)` });
    setOpen(false);
    setConfirmWord('');
    onDeleted();
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Filtrar banco:</Label>
          <Select value={bankFilter || '__all__'} onValueChange={onBankFilterChange}>
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue placeholder="Todos os bancos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os bancos</SelectItem>
              {banks.map(b => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => { setConfirmWord(''); setOpen(true); }}
          disabled={totalCount === 0}
        >
          <Trash2 className="w-4 h-4 mr-1" />
          {isFiltered ? `Apagar todas do banco ${bankFilter}` : 'Apagar todas as taxas'}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Confirmação destrutiva
            </DialogTitle>
            <DialogDescription>
              Você está prestes a apagar <strong>{targetCount}</strong> taxa(s)
              {isFiltered ? <> do banco <strong>{bankFilter}</strong></> : ' (todos os bancos)'}.
              Esta ação <strong>não pode ser desfeita</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Para confirmar, digite <span className="font-mono font-bold text-destructive">APAGAR</span> abaixo:</Label>
            <Input
              value={confirmWord}
              onChange={e => setConfirmWord(e.target.value)}
              placeholder="APAGAR"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAll}
              disabled={busy || confirmWord.trim().toUpperCase() !== 'APAGAR'}
            >
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Apagar definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
