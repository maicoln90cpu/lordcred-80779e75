import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useHRCandidates } from '@/hooks/useHRCandidates';
import { validateBrazilianPhone } from '@/lib/phoneUtils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CandidateCreateDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const { createCandidate } = useHRCandidates();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<'clt' | 'partner'>('clt');
  const [age, setAge] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setFullName(''); setPhone(''); setType('clt'); setAge('');
  };

  const phoneCheck = validateBrazilianPhone(phone);

  const handleSave = async () => {
    if (fullName.trim().length < 2) {
      toast({ title: 'Nome inválido', description: 'Mínimo 2 caracteres.', variant: 'destructive' });
      return;
    }
    if (!phoneCheck.valid) {
      toast({ title: 'Telefone inválido', description: phoneCheck.reason, variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await createCandidate({
        full_name: fullName.trim().slice(0, 150),
        phone: phoneCheck.normalized,
        type,
        age: age ? Math.max(16, Math.min(99, parseInt(age, 10))) : null,
        kanban_status: 'new_resume',
      });
      reset();
      onOpenChange(false);
    } catch { /* hook handles toast */ }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" /> Novo candidato
          </DialogTitle>
          <DialogDescription>
            Crie o registro inicial. Você poderá completar dados, foto e CV ao abrir o candidato.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Nome completo *</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} maxLength={150} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Telefone *</Label>
              <Input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                maxLength={20}
                className={phone && !phoneCheck.valid ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {phone && !phoneCheck.valid && (
                <p className="text-[11px] text-destructive">{phoneCheck.reason}</p>
              )}
              {phone && phoneCheck.valid && (
                <p className="text-[11px] text-muted-foreground">+{phoneCheck.e164}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Idade</Label>
              <Input type="number" min={16} max={99} value={age} onChange={e => setAge(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as 'clt' | 'partner')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="clt">CLT</SelectItem>
                <SelectItem value="partner">Parceiro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
