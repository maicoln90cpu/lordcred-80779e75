import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Loader2, FileText, CheckCircle, XCircle, Clock, Search, Eye } from 'lucide-react';
import MetaTemplateCreateDialog from './MetaTemplateCreateDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MetaTemplate {
  id: string;
  waba_id: string;
  template_name: string;
  language: string;
  category: string;
  status: string;
  components: any;
  synced_at: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle }> = {
  APPROVED: { label: 'Aprovado', variant: 'default', icon: CheckCircle },
  PENDING: { label: 'Pendente', variant: 'secondary', icon: Clock },
  REJECTED: { label: 'Rejeitado', variant: 'destructive', icon: XCircle },
};

const categoryLabels: Record<string, string> = {
  MARKETING: 'Marketing',
  UTILITY: 'Utilidade',
  AUTHENTICATION: 'Autenticação',
};

export default function MetaTemplatesManager() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [metaChips, setMetaChips] = useState<any[]>([]);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('meta_message_templates')
      .select('*')
      .order('template_name');
    setTemplates((data as MetaTemplate[]) || []);
    setLoading(false);
  }, []);

  const fetchMetaChips = useCallback(async () => {
    const { data } = await supabase
      .from('chips')
      .select('id, instance_name, phone_number, meta_phone_number_id, meta_waba_id')
      .eq('provider', 'meta');
    setMetaChips(data || []);
  }, []);

  useEffect(() => {
    fetchTemplates();
    fetchMetaChips();
  }, [fetchTemplates, fetchMetaChips]);

  const handleSync = async () => {
    if (metaChips.length === 0) {
      toast({ title: 'Nenhum chip Meta com WABA ID configurado', variant: 'destructive' });
      return;
    }

    setSyncing(true);
    let totalSynced = 0;
    let errors: string[] = [];

    for (const chip of metaChips) {
      try {
        const { data, error } = await supabase.functions.invoke('whatsapp-gateway', {
          body: { action: 'sync-templates', chipId: chip.id },
        });
        if (error) throw new Error(error.message);
        if (data?.success) {
          totalSynced += data.synced || 0;
        } else {
          errors.push(data?.error || `Falha no chip ${chip.phone_number || chip.id}`);
        }
      } catch (err: any) {
        errors.push(err.message);
      }
    }

    if (errors.length > 0) {
      toast({
        title: `Sincronização parcial: ${totalSynced} templates`,
        description: errors.join('; '),
        variant: 'destructive',
      });
    } else {
      toast({ title: `${totalSynced} templates sincronizados com sucesso` });
    }

    await fetchTemplates();
    setSyncing(false);
  };

  const filtered = templates.filter(t =>
    t.template_name.toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const cfg = statusConfig[status] || { label: status, variant: 'outline' as const, icon: Clock };
    const Icon = cfg.icon;
    return (
      <Badge variant={cfg.variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {cfg.label}
      </Badge>
    );
  };

  const getPreviewText = (components: any) => {
    if (!Array.isArray(components)) return '—';
    const body = components.find((c: any) => c.type === 'BODY');
    if (!body?.text) return '—';
    return body.text.length > 80 ? body.text.slice(0, 80) + '…' : body.text;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Templates Meta
            </CardTitle>
            <CardDescription>
              Templates de mensagem aprovados no WhatsApp Business Manager
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <MetaTemplateCreateDialog metaChips={metaChips} onCreated={fetchTemplates} />
            <Button onClick={handleSync} disabled={syncing}>
              {syncing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Importar Templates
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou categoria..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {templates.length === 0
              ? 'Nenhum template sincronizado. Clique em "Importar Templates" para buscar da Meta.'
              : 'Nenhum template encontrado para a busca.'}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Idioma</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Preview</TableHead>
                  <TableHead>Sincronizado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.template_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{t.language}</Badge>
                    </TableCell>
                    <TableCell>{categoryLabels[t.category] || t.category}</TableCell>
                    <TableCell>{getStatusBadge(t.status)}</TableCell>
                    <TableCell className="max-w-[250px] truncate text-xs text-muted-foreground">
                      {getPreviewText(t.components)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t.synced_at
                        ? new Date(t.synced_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Total: {filtered.length} template{filtered.length !== 1 ? 's' : ''}
          {search && ` (de ${templates.length})`}
        </p>
      </CardContent>
    </Card>
  );
}
