import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Smartphone, Wifi, WifiOff, Shield, User } from 'lucide-react';

interface MetaChip {
  id: string;
  instance_name: string;
  nickname: string | null;
  phone_number: string | null;
  meta_phone_number_id: string | null;
  meta_waba_id: string | null;
  status: string;
  user_id: string;
  created_at: string;
}

interface Profile {
  user_id: string;
  email: string;
  name: string | null;
}

export default function MetaChipsManager() {
  const { toast } = useToast();
  const [chips, setChips] = useState<MetaChip[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteChip, setDeleteChip] = useState<MetaChip | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Add form
  const [phoneId, setPhoneId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [chipsRes, profilesRes] = await Promise.all([
      supabase.from('chips').select('id, instance_name, nickname, phone_number, meta_phone_number_id, meta_waba_id, status, user_id, created_at')
        .eq('provider', 'meta').order('created_at', { ascending: false }),
      supabase.rpc('get_visible_profiles'),
    ]);

    setChips((chipsRes.data || []) as unknown as MetaChip[]);
    const pMap: Record<string, Profile> = {};
    (profilesRes.data || []).forEach(p => { pMap[p.user_id] = p; });
    setProfiles(pMap);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!phoneId.trim()) {
      toast({ title: 'Preencha o Phone Number ID', variant: 'destructive' });
      return;
    }
    setIsAdding(true);
    try {
      const { data: settings } = await supabase.from('system_settings')
        .select('meta_access_token').limit(1).maybeSingle();
      const token = (settings as any)?.meta_access_token;
      if (!token) throw new Error('Token Meta não configurado');

      // Validate with Meta — pedimos explicitamente status, code_verification_status e quality_rating
      const resp = await fetch(
        `https://graph.facebook.com/v21.0/${phoneId.trim()}?fields=display_phone_number,verified_name,status,code_verification_status,quality_rating,name_status`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await resp.json();
      if (data.error) throw new Error(data.error.message || 'Phone Number ID inválido');

      // Bloqueio: o número precisa estar CONNECTED na Cloud API
      // status pode vir como "CONNECTED", "PENDING", "FLAGGED", "RESTRICTED" ou ausente (não registrado)
      const phoneStatus = String(data.status || '').toUpperCase();
      const codeStatus = String(data.code_verification_status || '').toUpperCase();
      if (phoneStatus !== 'CONNECTED') {
        const friendly = !phoneStatus
          ? 'Este número ainda NÃO foi registrado na WhatsApp Cloud API. Vá em Meta Business Manager → WhatsApp → API Setup → Phone Numbers, clique no número, escolha "Register" e defina um PIN de 6 dígitos. Só depois cadastre aqui.'
          : `Número está com status "${phoneStatus}" na Meta (esperado: CONNECTED). Verificação do código: ${codeStatus || 'desconhecida'}. Conclua o registro/verificação no Meta Business Manager antes de cadastrar.`;
        throw new Error(friendly);
      }

      const displayPhone = data.display_phone_number || phoneId;
      const verifiedName = data.verified_name || `meta_${displayPhone.replace(/\D/g, '')}`;

      // Get current user
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) throw new Error('Sessão expirada');

      const { error } = await supabase.from('chips').insert({
        user_id: userId,
        slot_number: 100 + Math.floor(Math.random() * 900),
        instance_name: verifiedName,
        nickname: verifiedName,
        status: 'connected',
        activated_at: new Date().toISOString(),
        last_connection_attempt: new Date().toISOString(),
        chip_type: 'whatsapp',
        provider: 'meta',
        meta_phone_number_id: phoneId.trim(),
        meta_waba_id: wabaId.trim() || null,
        phone_number: displayPhone.replace(/\D/g, ''),
      } as any);

      if (error) throw error;

      toast({ title: 'Chip Meta conectado!', description: `Número ${displayPhone}` });
      setPhoneId('');
      setWabaId('');
      setShowAdd(false);
      loadData();
    } catch (err: any) {
      toast({ title: 'Não foi possível conectar', description: err.message, variant: 'destructive', duration: 12000 });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteChip) return;
    setIsDeleting(true);
    try {
      await supabase.from('chips').delete().eq('id', deleteChip.id);
      toast({ title: 'Chip removido' });
      setDeleteChip(null);
      loadData();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5" />
                Chips Meta Conectados
              </CardTitle>
              <CardDescription>
                Números conectados via Meta WhatsApp Cloud API ({chips.length} chip{chips.length !== 1 ? 's' : ''})
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowAdd(!showAdd)} variant={showAdd ? 'secondary' : 'default'}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add form */}
          {showAdd && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Phone Number ID *</Label>
                  <Input placeholder="123456789012345" value={phoneId} onChange={e => setPhoneId(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">WABA ID (opcional)</Label>
                  <Input placeholder="987654321098765" value={wabaId} onChange={e => setWabaId(e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Encontre esses IDs em Meta Business Manager → WhatsApp → API Setup</p>
              <Button size="sm" onClick={handleAdd} disabled={isAdding}>
                {isAdding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
                Validar e Conectar
              </Button>
            </div>
          )}

          {/* Table */}
          {chips.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Shield className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>Nenhum chip Meta conectado</p>
              <p className="text-xs mt-1">Clique em "Adicionar" para conectar um número oficial</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Nome / Número</TableHead>
                  <TableHead>Phone Number ID</TableHead>
                  <TableHead>Proprietário</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chips.map(chip => {
                  const owner = profiles[chip.user_id];
                  return (
                    <TableRow key={chip.id}>
                      <TableCell>
                        <Badge variant={chip.status === 'connected' ? 'default' : 'destructive'} className="text-xs gap-1">
                          {chip.status === 'connected' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                          {chip.status === 'connected' ? 'Online' : 'Offline'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{chip.nickname || chip.instance_name}</p>
                          <p className="text-xs text-muted-foreground">{chip.phone_number || '—'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{chip.meta_phone_number_id || '—'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs">
                          <User className="w-3 h-3 text-muted-foreground" />
                          {owner?.name || owner?.email || chip.user_id.slice(0, 8)}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(chip.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => setDeleteChip(chip)} className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Confirm delete */}
      <AlertDialog open={!!deleteChip} onOpenChange={() => setDeleteChip(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Chip Meta</AlertDialogTitle>
            <AlertDialogDescription>
              Remover "{deleteChip?.nickname || deleteChip?.phone_number}"? As conversas associadas não serão excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground">
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
