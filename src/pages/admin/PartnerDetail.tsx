import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Clock, User, Building2, FileText, GraduationCap, History, Loader2, Send } from 'lucide-react';
import { format } from 'date-fns';

const PIPELINE_STATUSES = [
  { value: 'contato_inicial', label: 'Contato Inicial' },
  { value: 'reuniao_marcada', label: 'Reunião Marcada' },
  { value: 'link_enviado', label: 'Link Enviado' },
  { value: 'confirmou', label: 'Confirmou' },
  { value: 'mei_pendente', label: 'MEI Pendente' },
  { value: 'mei_criado', label: 'MEI Criado' },
  { value: 'contrato_pendente', label: 'Contrato Pendente' },
  { value: 'contrato_assinado', label: 'Contrato Assinado' },
  { value: 'em_treinamento', label: 'Em Treinamento' },
  { value: 'ativo', label: 'Ativo' },
  { value: 'desistencia', label: 'Desistência' },
];

const CONTRATO_STATUSES = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'gerado', label: 'Gerado' },
  { value: 'pendente_parceiro', label: 'Aguardando Assinatura' },
  { value: 'assinado', label: 'Assinado' },
];

const TREINAMENTO_STATUSES = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'concluido', label: 'Concluído' },
];

export default function PartnerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, any>>({});
  const [dirty, setDirty] = useState(false);

  const { data: partner, isLoading } = useQuery({
    queryKey: ['partner', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('partners').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['partner-history', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partner_history')
        .select('*')
        .eq('partner_id', id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (partner) {
      setForm({ ...partner });
      setDirty(false);
    }
  }, [partner]);

  const updateField = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { id: _id, created_at, updated_at, ...updates } = form;
      const { error } = await supabase.from('partners').update(updates).eq('id', id!);
      if (error) throw error;

      // Log change in history
      await supabase.from('partner_history').insert({
        partner_id: id!,
        action: 'dados_atualizados',
        details: { fields_changed: Object.keys(updates) },
        created_by: user!.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner', id] });
      queryClient.invalidateQueries({ queryKey: ['partner-history', id] });
      setDirty(false);
      toast({ title: 'Parceiro atualizado com sucesso' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const generateContractMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('clicksign-api', {
        body: { action: 'generate_and_send', partner_id: id },
      });
      if (error) throw new Error(error.message || 'Erro ao gerar contrato');
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner', id] });
      queryClient.invalidateQueries({ queryKey: ['partner-history', id] });
      toast({ title: 'Contrato gerado e enviado!', description: 'O parceiro receberá um email com o link para assinatura.' });
    },
    onError: (e: any) => toast({ title: 'Erro ao gerar contrato', description: e.message, variant: 'destructive' }),
  });


  if (isLoading) {
    return (
        <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>
      </DashboardLayout>
    );
  }

  if (!partner) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Parceiro não encontrado.</p>
          <Button variant="outline" onClick={() => navigate('/admin/parceiros')}>Voltar</Button>
        </div>
      </DashboardLayout>
    );
  }

  const Field = ({ label, field, placeholder, type = 'text', colSpan = false }: { label: string; field: string; placeholder?: string; type?: string; colSpan?: boolean }) => (
    <div className={colSpan ? 'col-span-2' : ''}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type={type} value={form[field] ?? ''} onChange={e => updateField(field, e.target.value || null)} placeholder={placeholder} className="mt-1" />
    </div>
  );

  const SelectField = ({ label, field, options }: { label: string; field: string; options: { value: string; label: string }[] }) => (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={form[field] ?? ''} onValueChange={v => updateField(field, v)}>
        <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/parceiros')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{form.nome || 'Parceiro'}</h1>
              <p className="text-sm text-muted-foreground">
                Cadastrado em {format(new Date(partner.created_at), 'dd/MM/yyyy')}
              </p>
            </div>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={!dirty || saveMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>

        {/* Status Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <SelectField label="Status Pipeline" field="pipeline_status" options={PIPELINE_STATUSES} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <SelectField label="Status Contrato" field="contrato_status" options={CONTRATO_STATUSES} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <SelectField label="Status Treinamento" field="treinamento_status" options={TREINAMENTO_STATUSES} />
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pessoal" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pessoal"><User className="w-4 h-4 mr-1" /> Dados Pessoais</TabsTrigger>
            <TabsTrigger value="pj"><Building2 className="w-4 h-4 mr-1" /> Dados PJ</TabsTrigger>
            <TabsTrigger value="contrato"><FileText className="w-4 h-4 mr-1" /> Contrato</TabsTrigger>
            <TabsTrigger value="historico"><History className="w-4 h-4 mr-1" /> Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="pessoal">
            <Card>
              <CardHeader><CardTitle className="text-lg">Dados Pessoais</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Nome Completo" field="nome" placeholder="Nome completo" />
                  <Field label="CPF" field="cpf" placeholder="000.000.000-00" />
                  <Field label="Telefone" field="telefone" placeholder="(00) 00000-0000" />
                  <Field label="Email" field="email" placeholder="email@exemplo.com" type="email" />
                  <Field label="Nacionalidade" field="nacionalidade" placeholder="Brasileira" />
                  <Field label="Estado Civil" field="estado_civil" placeholder="Solteiro(a)" />
                  <Field label="Idade" field="idade" placeholder="30" type="number" />
                  <Field label="Endereço" field="endereco" placeholder="Rua, nº, bairro, cidade - UF" colSpan />
                  <div className="col-span-2 grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Tipo de Captação</Label>
                      <Select value={form.captacao_tipo ?? ''} onValueChange={v => updateField('captacao_tipo', v)}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="indicacao">Indicação</SelectItem>
                          <SelectItem value="redes_sociais">Redes Sociais</SelectItem>
                          <SelectItem value="anuncio">Anúncio</SelectItem>
                          <SelectItem value="organico">Orgânico</SelectItem>
                          <SelectItem value="evento">Evento</SelectItem>
                          <SelectItem value="outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Field label="Indicado por" field="indicado_por" placeholder="Quem indicou" />
                  </div>
                </div>
                <div className="mt-4">
                  <Label className="text-xs text-muted-foreground">Observações</Label>
                  <Textarea value={form.obs ?? ''} onChange={e => updateField('obs', e.target.value || null)} placeholder="Notas internas..." rows={3} className="mt-1" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pj">
            <Card>
              <CardHeader><CardTitle className="text-lg">Dados da Pessoa Jurídica</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="CNPJ" field="cnpj" placeholder="00.000.000/0000-00" />
                  <Field label="Razão Social" field="razao_social" placeholder="Razão Social Ltda" />
                  <Field label="Endereço PJ" field="endereco_pj" placeholder="Rua, nº, bairro, cidade - UF, CEP" colSpan />
                  <Field label="Chave PIX PJ" field="pix_pj" placeholder="Chave PIX da empresa" colSpan />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contrato">
            <Card>
              <CardHeader><CardTitle className="text-lg">Contrato</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Dia de Pagamento</Label>
                    <Input type="number" value={form.dia_pagamento ?? 7} onChange={e => updateField('dia_pagamento', parseInt(e.target.value) || 7)} className="mt-1" min={1} max={31} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Vigência (meses)</Label>
                    <Input type="number" value={form.vigencia_meses ?? 12} onChange={e => updateField('vigencia_meses', parseInt(e.target.value) || 12)} className="mt-1" min={1} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Aviso Prévio (dias)</Label>
                    <Input type="number" value={form.aviso_previo_dias ?? 7} onChange={e => updateField('aviso_previo_dias', parseInt(e.target.value) || 7)} className="mt-1" min={1} />
                  </div>
                </div>

                {form.contrato_status === 'assinado' && form.contrato_signed_url && (
                  <div className="mt-6 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                    <p className="text-sm font-medium text-green-400 mb-2">✅ Contrato Assinado</p>
                    {form.contrato_assinado_em && (
                      <p className="text-xs text-muted-foreground mb-2">
                        Assinado em {format(new Date(form.contrato_assinado_em), 'dd/MM/yyyy HH:mm')}
                      </p>
                    )}
                    <a href={form.contrato_signed_url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
                      Abrir documento assinado
                    </a>
                  </div>
                )}

                {form.contrato_status === 'pendente_parceiro' && (
                  <div className="mt-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-sm font-medium text-amber-400 mb-2">⏳ Aguardando Assinatura do Parceiro</p>
                    <p className="text-xs text-muted-foreground mb-2">O contrato foi enviado para o email do parceiro via ClickSign.</p>
                    {form.contrato_url && (
                      <a href={form.contrato_url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
                        Ver envelope na ClickSign
                      </a>
                    )}
                  </div>
                )}

                {(form.contrato_status === 'pendente' || form.contrato_status === 'gerado') && (
                  <div className="mt-6 p-4 rounded-lg bg-muted border space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Clique abaixo para gerar o contrato automaticamente e enviar para assinatura digital via ClickSign.
                    </p>
                    {!form.email && (
                      <p className="text-sm text-destructive">⚠️ O parceiro precisa ter um email cadastrado para receber o contrato.</p>
                    )}
                    <Button
                      onClick={() => generateContractMutation.mutate()}
                      disabled={!form.email || !form.nome || generateContractMutation.isPending}
                    >
                      {generateContractMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando contrato...</>
                      ) : (
                        <><Send className="w-4 h-4 mr-2" /> Gerar Contrato e Enviar para Assinatura</>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historico">
            <Card>
              <CardHeader><CardTitle className="text-lg">Histórico de Ações</CardTitle></CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma ação registrada ainda.</p>
                ) : (
                  <div className="space-y-3">
                    {history.map(h => (
                      <div key={h.id} className="flex gap-3 items-start border-l-2 border-primary/30 pl-4 py-2">
                        <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{formatAction(h.action)}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(h.created_at), 'dd/MM/yyyy HH:mm')}
                          </p>
                          {h.details && typeof h.details === 'object' && (
                            <pre className="text-xs text-muted-foreground mt-1 bg-muted rounded p-2 overflow-x-auto max-w-full">
                              {JSON.stringify(h.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function formatAction(action: string): string {
  const map: Record<string, string> = {
    'criado': 'Parceiro criado',
    'dados_atualizados': 'Dados atualizados',
    'status_alterado': 'Status alterado',
    'contrato_gerado': 'Contrato gerado',
    'contrato_assinado': 'Contrato assinado',
    'contrato_enviado': 'Contrato enviado para assinatura',
  };
  return map[action] || action;
}
