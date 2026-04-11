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
import { ArrowLeft, Save, Clock, User, Building2, FileText, History, Loader2, Send, Eye, AlertTriangle, Download, MessageSquare, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { PartnerField, PartnerSelectField } from '@/components/partners/PartnerFormFields';
import { ContractPreviewDialog } from '@/components/partners/ContractPreviewDialog';
import { ContractViewerDialog } from '@/components/partners/ContractViewerDialog';

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

  // PJ fields required for contract
  if (!form.cnpj || (form.cnpj || '').replace(/\D/g, '').length < 14) errors.cnpj = 'CNPJ válido é obrigatório';
  if (!form.razao_social || (form.razao_social || '').trim().length < 3) errors.razao_social = 'Razão Social é obrigatória';
  if (!form.endereco_pj_rua || (form.endereco_pj_rua || '').trim().length < 3) errors.endereco_pj_rua = 'Rua PJ é obrigatória';
  if (!form.endereco_pj_municipio || (form.endereco_pj_municipio || '').trim().length < 2) errors.endereco_pj_municipio = 'Município PJ é obrigatório';

  return errors;
}

const ACTION_LABELS: Record<string, string> = {
  'criado': 'Parceiro criado',
  'dados_atualizados': 'Dados atualizados',
  'status_alterado': 'Status alterado',
  'contrato_gerado': 'Contrato gerado',
  'contrato_assinado': 'Contrato assinado',
  'contrato_enviado': 'Contrato enviado para assinatura',
  'nota_adicionada': 'Nota adicionada',
};

const ACTION_ICONS: Record<string, string> = {
  'criado': '🆕',
  'dados_atualizados': '✏️',
  'status_alterado': '🔄',
  'contrato_gerado': '📄',
  'contrato_assinado': '✅',
  'contrato_enviado': '📧',
  'nota_adicionada': '💬',
};

export default function PartnerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, any>>({});
  const [dirty, setDirty] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [contractPreviewText, setContractPreviewText] = useState('');
  const [contractPdfBase64, setContractPdfBase64] = useState('');
  const [newNote, setNewNote] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [resending, setResending] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerPdfBase64, setViewerPdfBase64] = useState('');
  const [viewerFilename, setViewerFilename] = useState('');

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
      // Auto-fill endereco_pj from structured fields
      const rua = (updates.endereco_pj_rua || '').trim();
      const num = (updates.endereco_pj_numero || '').trim();
      const bairro = (updates.endereco_pj_bairro || '').trim();
      const mun = (updates.endereco_pj_municipio || '').trim();
      const uf = (updates.endereco_pj_uf || '').trim();
      const cep = (updates.endereco_pj_cep || '').trim();
      if (rua && mun) {
        const parts = [rua, num ? `n. ${num}` : '', bairro ? `bairro ${bairro}` : '', `${mun}${uf ? ' ' + uf : ''}`, cep ? `CEP ${cep}` : ''].filter(Boolean);
        updates.endereco_pj = parts.join(', ');
      }
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

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('partner_history').insert({
        partner_id: id!,
        action: 'nota_adicionada',
        details: { nota: newNote },
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-history', id] });
      setNewNote('');
      toast({ title: 'Nota adicionada' });
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
      setContractPdfBase64(data.pdf_base64 || '');
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
            <TabsTrigger value="notas"><MessageSquare className="w-4 h-4 mr-1" /> Notas</TabsTrigger>
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
                  <PartnerField label="CNPJ" field="cnpj" value={form.cnpj} onChange={updateField} placeholder="00.000.000/0000-00" required error={contractErrors.cnpj} />
                  <PartnerField label="Razão Social" field="razao_social" value={form.razao_social} onChange={updateField} placeholder="Razão Social Ltda" required error={contractErrors.razao_social} />
                  <PartnerField label="Rua / Logradouro" field="endereco_pj_rua" value={form.endereco_pj_rua} onChange={updateField} placeholder="Rua Jacob Weingartner" required error={contractErrors.endereco_pj_rua} />
                  <PartnerField label="Número" field="endereco_pj_numero" value={form.endereco_pj_numero} onChange={updateField} placeholder="4619" />
                  <PartnerField label="Bairro" field="endereco_pj_bairro" value={form.endereco_pj_bairro} onChange={updateField} placeholder="Centro" />
                  <PartnerField label="Município" field="endereco_pj_municipio" value={form.endereco_pj_municipio} onChange={updateField} placeholder="Palhoça" required error={contractErrors.endereco_pj_municipio} />
                  <PartnerField label="UF" field="endereco_pj_uf" value={form.endereco_pj_uf} onChange={updateField} placeholder="SC" />
                  <PartnerField label="CEP" field="endereco_pj_cep" value={form.endereco_pj_cep} onChange={updateField} placeholder="88131400" />
                  <PartnerField label="Endereço PJ (texto livre)" field="endereco_pj" value={form.endereco_pj} onChange={updateField} placeholder="Preenchido automaticamente ao salvar" colSpan />
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

                {form.contrato_status === 'assinado' && (
                  <div className="mt-6 space-y-4">
                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                      <p className="text-sm font-medium text-green-400 mb-2">✅ Contrato Assinado</p>
                      {form.contrato_assinado_em && (
                        <p className="text-xs text-muted-foreground mb-2">
                          Assinado em {format(new Date(form.contrato_assinado_em), 'dd/MM/yyyy HH:mm')}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={downloadingPdf}
                          onClick={async () => {
                            setDownloadingPdf(true);
                            try {
                              const { data, error } = await supabase.functions.invoke('clicksign-api', {
                                body: { action: 'download_pdf', partner_id: id },
                              });
                              if (error || data?.error) throw new Error(data?.error || error?.message || 'Erro');
                              if (data?.pdf_base64) {
                                setViewerPdfBase64(data.pdf_base64);
                                setViewerFilename(data.filename || 'contrato.pdf');
                                setViewerOpen(true);
                              }
                            } catch (e: any) {
                              toast({ title: 'Erro', description: e.message, variant: 'destructive' });
                            } finally {
                              setDownloadingPdf(false);
                            }
                          }}
                        >
                          {downloadingPdf ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                          Visualizar Contrato
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={downloadingPdf}
                          onClick={async () => {
                            setDownloadingPdf(true);
                            try {
                              const { data, error } = await supabase.functions.invoke('clicksign-api', {
                                body: { action: 'download_pdf', partner_id: id },
                              });
                              if (error || data?.error) throw new Error(data?.error || error?.message || 'Erro');
                              if (data?.pdf_base64) {
                                const byteChars = atob(data.pdf_base64);
                                const byteArray = new Uint8Array(byteChars.length);
                                for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
                                const blob = new Blob([byteArray], { type: 'application/pdf' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = data.filename || 'contrato.pdf';
                                a.click();
                                URL.revokeObjectURL(url);
                              }
                            } catch (e: any) {
                              toast({ title: 'Erro ao buscar PDF', description: e.message, variant: 'destructive' });
                            } finally {
                              setDownloadingPdf(false);
                            }
                          }}
                        >
                          {downloadingPdf ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1" />}
                          Baixar PDF Assinado
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {form.contrato_status === 'pendente_parceiro' && (
                  <div className="mt-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-sm font-medium text-amber-400 mb-2">⏳ Aguardando Assinatura do Parceiro</p>
                    <p className="text-xs text-muted-foreground mb-2">O contrato foi enviado para o email do parceiro via ClickSign.</p>
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={downloadingPdf}
                        onClick={async () => {
                          setDownloadingPdf(true);
                          try {
                            const { data, error } = await supabase.functions.invoke('clicksign-api', {
                              body: { action: 'download_pdf', partner_id: id },
                            });
                            if (error || data?.error) throw new Error(data?.error || error?.message || 'Erro');
                            if (data?.pdf_base64) {
                              setViewerPdfBase64(data.pdf_base64);
                              setViewerFilename(data.filename || 'contrato.pdf');
                              setViewerOpen(true);
                            }
                          } catch (e: any) {
                            toast({ title: 'Erro', description: e.message, variant: 'destructive' });
                          } finally {
                            setDownloadingPdf(false);
                          }
                        }}
                      >
                        {downloadingPdf ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                        Visualizar Contrato
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={resending}
                        onClick={async () => {
                          setResending(true);
                          try {
                            const { data, error } = await supabase.functions.invoke('clicksign-api', {
                              body: { action: 'resend_notification', partner_id: id },
                            });
                            if (error || data?.error) throw new Error(data?.error || error?.message || 'Erro');
                            toast({ title: '✅ Contrato reenviado!', description: `${data.notified} signatário(s) notificado(s) por email.` });
                            queryClient.invalidateQueries({ queryKey: ['partner-history', id] });
                          } catch (e: any) {
                            toast({ title: 'Erro ao reenviar', description: e.message, variant: 'destructive' });
                          } finally {
                            setResending(false);
                          }
                        }}
                      >
                        {resending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
                        Reenviar Contrato
                      </Button>
                    </div>
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

          {/* New Notes Tab */}
          <TabsContent value="notas">
            <Card>
              <CardHeader><CardTitle className="text-lg">Notas e Comentários</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Textarea
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    placeholder="Adicionar uma nota sobre este parceiro..."
                    rows={2}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => addNoteMutation.mutate()}
                    disabled={!newNote.trim() || addNoteMutation.isPending}
                    className="self-end"
                  >
                    {addNoteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>

                <div className="space-y-3">
                  {history.filter(h => h.action === 'nota_adicionada').length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma nota registrada ainda.</p>
                  ) : (
                    history.filter(h => h.action === 'nota_adicionada').map(h => (
                      <div key={h.id} className="p-3 rounded-lg bg-muted/50 border">
                        <p className="text-sm">{(h.details as any)?.nota || ''}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(h.created_at), 'dd/MM/yyyy HH:mm')}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historico">
            <Card>
              <CardHeader><CardTitle className="text-lg">Timeline de Ações</CardTitle></CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma ação registrada ainda.</p>
                ) : (
                  <div className="space-y-1">
                    {history.map((h, i) => (
                      <div key={h.id} className="flex gap-3 items-start relative">
                        {/* Timeline line */}
                        {i < history.length - 1 && (
                          <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />
                        )}
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm shrink-0 z-10">
                          {ACTION_ICONS[h.action] || '📋'}
                        </div>
                        <div className="flex-1 pb-4">
                          <p className="text-sm font-medium">{ACTION_LABELS[h.action] || h.action}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(h.created_at), 'dd/MM/yyyy HH:mm')}
                          </p>
                          {h.action === 'nota_adicionada' && (h.details as any)?.nota && (
                            <p className="text-sm mt-1 p-2 rounded bg-muted/50 border">{(h.details as any).nota}</p>
                          )}
                          {h.action !== 'nota_adicionada' && h.details && typeof h.details === 'object' && (
                            <details className="mt-1">
                              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Ver detalhes</summary>
                              <pre className="text-xs text-muted-foreground mt-1 bg-muted rounded p-2 overflow-x-auto max-w-full">
                                {JSON.stringify(h.details, null, 2)}
                              </pre>
                            </details>
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
        pdfBase64={contractPdfBase64}
        partnerName={form.nome}
        onConfirmSend={() => generateContractMutation.mutate()}
        isSending={generateContractMutation.isPending}
      />

      <ContractViewerDialog
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        pdfBase64={viewerPdfBase64}
        partnerName={form.nome}
        filename={viewerFilename}
      />
    </DashboardLayout>
  );
}
