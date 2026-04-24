import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Copy, Link2, Trash2, Plus, MessageCircle, ExternalLink, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interviewId: string | undefined;
  candidateId: string;
  candidateName: string;
  candidatePhone?: string | null;
  stage: 1 | 2;
}

interface TokenRow {
  id: string;
  token: string;
  created_at: string;
  expires_at: string | null;
  used_at: string | null;
  is_active: boolean;
}

function generateToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

export function PublicInterviewLinkDialog({
  open, onOpenChange, interviewId, candidateId, candidateName, candidatePhone, stage,
}: Props) {
  const { toast } = useToast();
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<string>('7');

  const fetchTokens = async () => {
    if (!interviewId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('hr_interview_tokens')
      .select('id, token, created_at, expires_at, used_at, is_active')
      .eq('interview_id', interviewId)
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Erro ao carregar links', description: error.message, variant: 'destructive' });
    } else {
      setTokens(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open && interviewId) fetchTokens();
  }, [open, interviewId]);

  const handleCreate = async () => {
    if (!interviewId) {
      toast({ title: 'Salve a entrevista primeiro', description: 'É preciso ter um registro de E' + stage + ' antes de gerar o link.', variant: 'destructive' });
      return;
    }
    setCreating(true);
    const days = parseInt(expiresInDays, 10);
    const expires_at = days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString() : null;
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('hr_interview_tokens').insert({
      token: generateToken(),
      interview_id: interviewId,
      candidate_id: candidateId,
      stage,
      expires_at,
      created_by: userData.user?.id ?? null,
    });
    setCreating(false);
    if (error) {
      toast({ title: 'Erro ao gerar link', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Link gerado com sucesso' });
      fetchTokens();
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revogar este link? O candidato não poderá mais acessar.')) return;
    const { error } = await supabase
      .from('hr_interview_tokens')
      .update({ is_active: false })
      .eq('id', id);
    if (error) {
      toast({ title: 'Erro ao revogar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Link revogado' });
      fetchTokens();
    }
  };

  const buildUrl = (token: string) => `${window.location.origin}/entrevista/${token}`;

  const copyLink = (token: string) => {
    const url = buildUrl(token);
    navigator.clipboard.writeText(url);
    toast({ title: 'Link copiado', description: url });
  };

  const sendWhatsApp = (token: string) => {
    const url = buildUrl(token);
    const phone = (candidatePhone || '').replace(/\D/g, '');
    const msg = encodeURIComponent(
      `Olá ${candidateName}! Segue o link para responder à Entrevista ${stage}: ${url}`,
    );
    const wa = phone
      ? `https://wa.me/${phone.startsWith('55') ? phone : '55' + phone}?text=${msg}`
      : `https://wa.me/?text=${msg}`;
    window.open(wa, '_blank');
  };

  const renderStatus = (t: TokenRow) => {
    if (!t.is_active) return <Badge variant="outline" className="text-destructive border-destructive/50">Revogado</Badge>;
    if (t.expires_at && new Date(t.expires_at) < new Date()) return <Badge variant="outline" className="text-warning border-warning/50">Expirado</Badge>;
    if (t.used_at) return <Badge variant="outline" className="text-success border-success/50">Respondido</Badge>;
    return <Badge variant="outline" className="text-primary border-primary/50">Ativo</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" /> Links públicos — Entrevista {stage}
          </DialogTitle>
          <DialogDescription>
            Gere um link único para que <span className="font-semibold text-foreground">{candidateName}</span> responda às perguntas da E{stage}. As respostas chegam aqui automaticamente.
          </DialogDescription>
        </DialogHeader>

        {!interviewId ? (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            Salve a Entrevista {stage} antes de gerar o link público.
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="grid grid-cols-[1fr,auto] gap-3 items-end">
                <div className="space-y-1.5">
                  <Label className="text-xs">Validade (dias)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={90}
                    value={expiresInDays}
                    onChange={e => setExpiresInDays(e.target.value)}
                    placeholder="7"
                  />
                  <p className="text-[10px] text-muted-foreground">0 = sem expiração</p>
                </div>
                <Button onClick={handleCreate} disabled={creating} className="gap-2">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Gerar novo link
                </Button>
              </div>
            </div>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Carregando...
                </div>
              ) : tokens.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum link gerado ainda.</p>
              ) : (
                tokens.map(t => (
                  <div key={t.id} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {renderStatus(t)}
                        <span className="text-[11px] text-muted-foreground truncate">
                          Criado em {format(new Date(t.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                          {t.expires_at ? ` · expira ${format(new Date(t.expires_at), 'dd/MM/yy', { locale: ptBR })}` : ''}
                          {t.used_at ? ` · respondido ${format(new Date(t.used_at), 'dd/MM HH:mm', { locale: ptBR })}` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/40 rounded px-2 py-1 truncate">
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">{buildUrl(t.token)}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => copyLink(t.token)} disabled={!t.is_active}>
                        <Copy className="w-3.5 h-3.5" /> Copiar
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => sendWhatsApp(t.token)} disabled={!t.is_active}>
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => window.open(buildUrl(t.token), '_blank')} disabled={!t.is_active}>
                        <ExternalLink className="w-3.5 h-3.5" /> Abrir
                      </Button>
                      {t.is_active && (
                        <Button size="sm" variant="ghost" className="gap-1.5 h-8 text-destructive hover:text-destructive ml-auto" onClick={() => handleRevoke(t.id)}>
                          <Trash2 className="w-3.5 h-3.5" /> Revogar
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
