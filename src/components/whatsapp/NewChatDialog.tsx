import { useState } from 'react';
import { Phone, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import type { ChatContact } from '@/pages/WhatsApp';

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartChat: (phoneNumber: string) => void;
}

export default function NewChatDialog({ open, onOpenChange, onStartChat }: NewChatDialogProps) {
  const [number, setNumber] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [contactResults, setContactResults] = useState<{ id: string; name: string; phone: string; cpf?: string }[]>([]);

  const handleSearchLeads = async (q: string) => {
    setContactSearch(q);
    if (q.length < 3) { setContactResults([]); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: leads } = await supabase
      .from('client_leads')
      .select('id, nome, telefone, cpf')
      .eq('assigned_to', user.id)
      .ilike('telefone', `%${q}%`)
      .limit(20);
    if (leads) {
      setContactResults(leads.map((l: any) => ({
        id: l.id, name: l.nome || 'Sem nome', phone: l.telefone || '', cpf: l.cpf,
      })));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setNumber(''); setContactSearch(''); setContactResults([]); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Nova Conversa</DialogTitle></DialogHeader>
        <Tabs defaultValue="number" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="number"><Phone className="w-3.5 h-3.5 mr-1.5" />Digitar número</TabsTrigger>
            <TabsTrigger value="contacts"><Users className="w-3.5 h-3.5 mr-1.5" />Buscar lead</TabsTrigger>
          </TabsList>
          <TabsContent value="number" className="space-y-3 mt-3">
            <Input
              placeholder="Ex: (11) 99999-9999"
              value={number}
              onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter' && number.length >= 10) onStartChat(number); }}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">Digite com DDD (ex: 11999999999). O código do país (55) é adicionado automaticamente.</p>
            <DialogFooter>
              <Button disabled={number.length < 10} onClick={() => onStartChat(number)}>Iniciar conversa</Button>
            </DialogFooter>
          </TabsContent>
          <TabsContent value="contacts" className="space-y-3 mt-3">
            <Input placeholder="Buscar lead por telefone..." value={contactSearch} onChange={(e) => handleSearchLeads(e.target.value)} autoFocus />
            <ScrollArea className="max-h-60">
              {contactResults.length > 0 ? (
                <div className="space-y-1">
                  {contactResults.map(c => (
                    <button
                      key={c.id}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-secondary/50 text-left transition-colors"
                      onClick={() => { const digits = c.phone.replace(/\D/g, ''); if (digits.length >= 10) onStartChat(digits); }}
                    >
                      <Avatar className="w-8 h-8 shrink-0">
                        <AvatarFallback className="bg-primary/20 text-primary text-xs font-medium">{c.name.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.phone}{c.cpf ? ` · CPF: ${c.cpf}` : ''}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : contactSearch.length >= 3 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum lead encontrado</p>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Digite pelo menos 3 caracteres do telefone</p>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
