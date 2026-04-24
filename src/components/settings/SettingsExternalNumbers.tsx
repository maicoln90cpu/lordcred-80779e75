import { Phone, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import type { ExternalNumber } from '@/hooks/useSettingsData';

interface Props {
  externalNumbers: ExternalNumber[];
  newPhone: string;
  setNewPhone: (v: string) => void;
  newName: string;
  setNewName: (v: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, isActive: boolean) => void;
}

export default function SettingsExternalNumbers({ externalNumbers, newPhone, setNewPhone, newName, setNewName, onAdd, onDelete, onToggle }: Props) {
  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="w-5 h-5 text-primary" />
          Números Externos
        </CardTitle>
        <CardDescription>
          Números de terceiros que receberão mensagens de aquecimento ({externalNumbers.filter(n => n.is_active).length} ativos)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="Ex: (11) 99999-9999" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className="flex-1" />
          <Input placeholder="Nome/Descrição (opcional)" value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1" />
          <Button onClick={onAdd} className="shrink-0"><Plus className="w-4 h-4 mr-2" />Adicionar</Button>
        </div>
        <Separator />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto">
          {externalNumbers.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 col-span-full">Nenhum número externo cadastrado</p>
          ) : (
            externalNumbers.map((num) => (
              <div key={num.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50">
                <Switch checked={num.is_active} onCheckedChange={() => onToggle(num.id, num.is_active)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{num.phone_number}</p>
                  {num.name && <p className="text-xs text-muted-foreground truncate">{num.name}</p>}
                </div>
                <Button variant="ghost" size="icon" className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onDelete(num.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
