import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Clock, User, Building2, FileText, History, Loader2, Send, Eye, AlertTriangle, ScrollText } from 'lucide-react';
import { format } from 'date-fns';
import { PartnerField, PartnerSelectField } from '@/components/partners/PartnerFormFields';
import { ContractPreviewDialog } from '@/components/partners/ContractPreviewDialog';
import { ContractTemplateEditor } from '@/components/partners/ContractTemplateEditor';

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

function isValidCpf(value: string): boolean {
  const raw = value.replace(/\D/g, '');
  if (raw.length !== 11 || /^(\d)\1{10}$/.test(raw)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(raw[i]) * (10 - i);
  if (((sum * 10) % 11) % 10 !== Number(raw[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(raw[i]) * (11 - i);
  return ((sum * 10) % 11) % 10 === Number(raw[10]);
}

function validateForContract(form: Record<string, any>): Record<string, string> {
  const errors: Record<string, string> = {};
  const nome = (form.nome || '').trim();
  const parts = nome.split(' ').filter(Boolean);
  if (!nome) errors.nome = 'Nome é obrigatório';
  else if (parts.length < 2) errors.nome = 'Informe nome e sobrenome';
  else if (/\d/.test(nome)) errors.nome = 'Nome não pode conter números';

  const cpf = (form.cpf || '').replace(/\D/g, '');
  if (!cpf) errors.cpf = 'CPF é obrigatório';
  else if (!isValidCpf(cpf)) errors.cpf = 'CPF inválido';

  if (!form.email || !form.email.includes('@')) errors.email = 'Email válido é obrigatório';
  if (!form.telefone) errors.telefone = 'Telefone é obrigatório';

  return errors;
}

export default function PartnerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, any>>({});
  const [dirty, setDirty] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [contractPreviewText, setContractPreviewText] = useState('');

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

  const contractErrors = useMemo(() => validateForContract(form), [form]);
  const canGenerateContract = Object.keys(contractErrors).length === 0;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { id: _id, created_at, updated_at, ...updates } = form;
      const { error } = await supabase.from('partners').update(updates).eq('id', id!);
      if (error) throw error;
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

  const previewMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('clicksign-api', {
        body: { action: 'preview', partner_id: id },
      });
      if (error) throw new Error(error.message || 'Erro ao gerar prévia');
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setContractPreviewText(data.contract_text);
      setPreviewOpen(true);
    },
    onError: (e: any) => toast({ title: 'Erro ao gerar prévia', description: e.message, variant: 'destructive' }),
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
      setPreviewOpen(false);
      queryClient.invalidateQueries({ queryKey: ['partner', id] });
      queryClient.invalidateQueries({ queryKey: ['partner-history', id] });
      toast({ title: 'Contrato gerado e enviado!', description: 'O parceiro receberá um email com o link para assinatura.' });
    },
    onError: (e: any) => toast({ title: 'Erro ao gerar contrato', description: e.message, variant: 'destructive' }),
  });

  if (isLoading) {
    return (
      <DashboardLayout>
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
              <PartnerSelectField label="Status Pipeline" field="pipeline_status" value={form.pipeline_status} onChange={updateField} options={PIPELINE_STATUSES} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <PartnerSelectField label="Status Contrato" field="contrato_status" value={form.contrato_status} onChange={updateField} options={CONTRATO_STATUSES} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <PartnerSelectField label="Status Treinamento" field="treinamento_status" value={form.treinamento_status} onChange={updateField} options={TREINAMENTO_STATUSES} />
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pessoal" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pessoal"><User className="w-4 h-4 mr-1" /> Dados Pessoais</TabsTrigger>
            <TabsTrigger value="pj"><Building2 className="w-4 h-4 mr-1" /> Dados PJ</TabsTrigger>
            <TabsTrigger value="contrato"><FileText className="w-4 h-4 mr-1" /> Contrato</TabsTrigger>
            <TabsTrigger value="template"><ScrollText className="w-4 h-4 mr-1" /> Template</TabsTrigger>
            <TabsTrigger value="historico"><History className="w-4 h-4 mr-1" /> Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="pessoal">
            <Card>
              <CardHeader><CardTitle className="text-lg">Dados Pessoais</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <PartnerField label="Nome Completo" field="nome" value={form.nome} onChange={updateField} placeholder="Nome completo" required error={contractErrors.nome} />
                  <PartnerField label="CPF" field="cpf" value={form.cpf} onChange={updateField} placeholder="000.000.000-00" required error={contractErrors.cpf} />
                  <PartnerField label="Telefone" field="telefone" value={form.telefone} onChange={updateField} placeholder="(00) 00000-0000" required error={contractErrors.telefone} />
                  <PartnerField label="Email" field="email" value={form.email} onChange={updateField} placeholder="email@exemplo.com" type="email" required error={contractErrors.email} />
                  <PartnerField label="Nacionalidade" field="nacionalidade" value={form.nacionalidade} onChange={updateField} placeholder="Brasileira" />
                  <PartnerField label="Estado Civil" field="estado_civil" value={form.estado_civil} onChange={updateField} placeholder="Solteiro(a)" />
                  <PartnerField label="Idade" field="idade" value={form.idade} onChange={updateField} placeholder="30" type="number" />
                  <PartnerField label="Endereço" field="endereco" value={form.endereco} onChange={updateField} placeholder="Rua, nº, bairro, cidade - UF" colSpan />
                  <div className="col-span-2 grid grid-cols-2 gap-4">
                    <PartnerSelectField
                      label="Tipo de Captação"
                      field="captacao_tipo"
                      value={form.captacao_tipo}
                      onChange={updateField}
                      options={[
                        { value: 'indicacao', label: 'Indicação' },
                        { value: 'redes_sociais', label: 'Redes Sociais' },
                        { value: 'anuncio', label: 'Anúncio' },
                        { value: 'organico', label: 'Orgânico' },
                        { value: 'evento', label: 'Evento' },
                        { value: 'outro', label: 'Outro' },
                      ]}
                    />
                    <PartnerField label="Indicado por" field="indicado_por" value={form.indicado_por} onChange={updateField} placeholder="Quem indicou" />
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
                  <PartnerField label="CNPJ" field="cnpj" value={form.cnpj} onChange={updateField} placeholder="00.000.000/0000-00" />
                  <PartnerField label="Razão Social" field="razao_social" value={form.razao_social} onChange={updateField} placeholder="Razão Social Ltda" />
                  <PartnerField label="Endereço PJ" field="endereco_pj" value={form.endereco_pj} onChange={updateField} placeholder="Rua, nº, bairro, cidade - UF, CEP" colSpan />
                  <PartnerField label="Chave PIX PJ" field="pix_pj" value={form.pix_pj} onChange={updateField} placeholder="Chave PIX da empresa" colSpan />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contrato">
            <Card>
              <CardHeader><CardTitle className="text-lg">Contrato</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <PartnerField label="Dia de Pagamento" field="dia_pagamento" value={form.dia_pagamento ?? 7} onChange={(f, v) => updateField(f, parseInt(v) || 7)} type="number" />
                  <PartnerField label="Vigência (meses)" field="vigencia_meses" value={form.vigencia_meses ?? 12} onChange={(f, v) => updateField(f, parseInt(v) || 12)} type="number" />
                  <PartnerField label="Aviso Prévio (dias)" field="aviso_previo_dias" value={form.aviso_previo_dias ?? 7} onChange={(f, v) => updateField(f, parseInt(v) || 7)} type="number" />
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
                    {!canGenerateContract && (
                      <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                        <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium text-destructive mb-1">Preencha os campos obrigatórios antes de gerar o contrato:</p>
                          <ul className="list-disc list-inside text-destructive/80 text-xs space-y-0.5">
                            {Object.values(contractErrors).map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Clique abaixo para gerar a prévia do contrato. Após revisá-lo, você poderá confirmar o envio para assinatura digital via ClickSign.
                    </p>
                    <Button
                      onClick={() => previewMutation.mutate()}
                      disabled={!canGenerateContract || previewMutation.isPending}
                    >
                      {previewMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando prévia...</>
                      ) : (
                        <><Eye className="w-4 h-4 mr-2" /> Gerar Prévia do Contrato</>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="template">
            <ContractTemplateEditor />
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

      <ContractPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        contractText={contractPreviewText}
        onConfirmSend={() => generateContractMutation.mutate()}
        isSending={generateContractMutation.isPending}
      />
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
