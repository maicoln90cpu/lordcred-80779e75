import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { ArrowLeft, Save, Building2, FileText, History, Loader2, Send, Eye, AlertTriangle, Download, MessageSquare, RefreshCw, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { PartnerField, PartnerSelectField } from '@/components/partners/PartnerFormFields';
import { ContractPreviewDialog } from '@/components/partners/ContractPreviewDialog';
import { ContractViewerDialog } from '@/components/partners/ContractViewerDialog';
import {
  formatCnpj, formatCpf, formatPhone, formatCep, validateForContract,
  PIPELINE_STATUSES, CONTRATO_STATUSES, TREINAMENTO_STATUSES, ACTION_LABELS, ACTION_ICONS,
} from '@/lib/partnerUtils';

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
  const [cepLoading, setCepLoading] = useState(false);
  const [cepRepLoading, setCepRepLoading] = useState(false);

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
      const { data, error } = await supabase.from('partner_history').select('*').eq('partner_id', id!).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  useEffect(() => { if (partner) { setForm({ ...partner }); setDirty(false); } }, [partner]);

  const updateField = useCallback((field: string, value: any) => {
    if (field === 'cnpj') value = formatCnpj(value || '');
    else if (field === 'cpf') value = formatCpf(value || '');
    else if (field === 'telefone') value = formatPhone(value || '');
    else if (field === 'endereco_pj_cep') value = formatCep(value || '');
    else if (field === 'endereco_rep_cep') value = formatCep(value || '');
    setForm(prev => ({ ...prev, [field]: value }));
    setDirty(true);
  }, []);

  // CEP auto-fill PJ
  useEffect(() => {
    const cepRaw = (form.endereco_pj_cep || '').replace(/\D/g, '');
    if (cepRaw.length !== 8) return;
    let cancelled = false;
    setCepLoading(true);
    fetch(`https://viacep.com.br/ws/${cepRaw}/json/`).then(r => r.json()).then(data => {
      if (cancelled || data.erro) return;
      setForm(prev => ({ ...prev, endereco_pj_rua: data.logradouro || prev.endereco_pj_rua, endereco_pj_bairro: data.bairro || prev.endereco_pj_bairro, endereco_pj_municipio: data.localidade || prev.endereco_pj_municipio, endereco_pj_uf: data.uf || prev.endereco_pj_uf }));
      setDirty(true);
    }).catch(() => {}).finally(() => { if (!cancelled) setCepLoading(false); });
    return () => { cancelled = true; };
  }, [form.endereco_pj_cep]);

  // CEP auto-fill Rep
  useEffect(() => {
    const cepRaw = (form.endereco_rep_cep || '').replace(/\D/g, '');
    if (cepRaw.length !== 8) return;
    let cancelled = false;
    setCepRepLoading(true);
    fetch(`https://viacep.com.br/ws/${cepRaw}/json/`).then(r => r.json()).then(data => {
      if (cancelled || data.erro) return;
      setForm(prev => ({ ...prev, endereco_rep_rua: data.logradouro || prev.endereco_rep_rua, endereco_rep_bairro: data.bairro || prev.endereco_rep_bairro, endereco_rep_municipio: data.localidade || prev.endereco_rep_municipio, endereco_rep_uf: data.uf || prev.endereco_rep_uf }));
      setDirty(true);
    }).catch(() => {}).finally(() => { if (!cancelled) setCepRepLoading(false); });
    return () => { cancelled = true; };
  }, [form.endereco_rep_cep]);

  const contractErrors = useMemo(() => validateForContract(form), [form]);
  const canGenerateContract = Object.keys(contractErrors).length === 0;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { id: _id, created_at, updated_at, ...updates } = form;
      const rua = (updates.endereco_pj_rua || '').trim();
      const num = (updates.endereco_pj_numero || '').trim();
      const bairro = (updates.endereco_pj_bairro || '').trim();
      const mun = (updates.endereco_pj_municipio || '').trim();
      const uf = (updates.endereco_pj_uf || '').trim();
      const cep = (updates.endereco_pj_cep || '').trim();
      if (rua && mun) {
        updates.endereco_pj = [rua, num ? `n. ${num}` : '', bairro ? `bairro ${bairro}` : '', `${mun}${uf ? ' ' + uf : ''}`, cep ? `CEP ${cep}` : ''].filter(Boolean).join(', ');
      }
      const repRua = (updates.endereco_rep_rua || '').trim();
      const repNum = (updates.endereco_rep_numero || '').trim();
      const repBairro = (updates.endereco_rep_bairro || '').trim();
      const repMun = (updates.endereco_rep_municipio || '').trim();
      const repUf = (updates.endereco_rep_uf || '').trim();
      const repCep = (updates.endereco_rep_cep || '').trim();
      if (repRua && repMun) {
        updates.endereco = [repRua, repNum ? `n. ${repNum}` : '', repBairro ? `bairro ${repBairro}` : '', `${repMun}${repUf ? ' ' + repUf : ''}`, repCep ? `CEP ${repCep}` : ''].filter(Boolean).join(', ');
      }
      const { error } = await supabase.from('partners').update(updates).eq('id', id!);
      if (error) throw error;
      await supabase.from('partner_history').insert({ partner_id: id!, action: 'dados_atualizados', details: { fields_changed: Object.keys(updates) }, created_by: user!.id });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['partner', id] }); queryClient.invalidateQueries({ queryKey: ['partner-history', id] }); setDirty(false); toast({ title: 'Parceiro atualizado com sucesso' }); },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => { const { error } = await supabase.from('partner_history').insert({ partner_id: id!, action: 'nota_adicionada', details: { nota: newNote }, created_by: user!.id }); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['partner-history', id] }); setNewNote(''); toast({ title: 'Nota adicionada' }); },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const previewMutation = useMutation({
    mutationFn: async () => { const { data, error } = await supabase.functions.invoke('clicksign-api', { body: { action: 'preview', partner_id: id } }); if (error) throw new Error(error.message); if (data?.error) throw new Error(data.error); return data; },
    onSuccess: (data) => { setContractPreviewText(data.contract_text); setContractPdfBase64(data.pdf_base64 || ''); setPreviewOpen(true); },
    onError: (e: any) => toast({ title: 'Erro ao gerar prévia', description: e.message, variant: 'destructive' }),
  });

  const generateContractMutation = useMutation({
    mutationFn: async () => { const { data, error } = await supabase.functions.invoke('clicksign-api', { body: { action: 'generate_and_send', partner_id: id } }); if (error) throw new Error(error.message); if (data?.error) throw new Error(data.error); return data; },
    onSuccess: () => { setPreviewOpen(false); queryClient.invalidateQueries({ queryKey: ['partner', id] }); queryClient.invalidateQueries({ queryKey: ['partner-history', id] }); toast({ title: 'Contrato gerado e enviado!' }); },
    onError: (e: any) => toast({ title: 'Erro ao gerar contrato', description: e.message, variant: 'destructive' }),
  });

  const handleDownloadOrView = async (mode: 'view' | 'download') => {
    setDownloadingPdf(true);
    try {
      const { data, error } = await supabase.functions.invoke('clicksign-api', { body: { action: 'download_pdf', partner_id: id } });
      if (error || data?.error) throw new Error(data?.error || error?.message || 'Erro');
      if (data?.pdf_base64) {
        if (mode === 'view') { setViewerPdfBase64(data.pdf_base64); setViewerFilename(data.filename || 'contrato.pdf'); setViewerOpen(true); }
        else {
          const byteChars = atob(data.pdf_base64);
          const byteArray = new Uint8Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = data.filename || 'contrato.pdf'; a.click();
          URL.revokeObjectURL(url);
        }
      }
    } catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); }
    finally { setDownloadingPdf(false); }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const { data, error } = await supabase.functions.invoke('clicksign-api', { body: { action: 'resend_notification', partner_id: id } });
      if (error || data?.error) throw new Error(data?.error || error?.message || 'Erro');
      toast({ title: '✅ Contrato reenviado!', description: `${data.notified} signatário(s) notificado(s)` });
      queryClient.invalidateQueries({ queryKey: ['partner-history', id] });
    } catch (e: any) { toast({ title: 'Erro ao reenviar', description: e.message, variant: 'destructive' }); }
    finally { setResending(false); }
  };

  if (isLoading) return <DashboardLayout><div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div></DashboardLayout>;
  if (!partner) return <DashboardLayout><div className="text-center py-12"><p className="text-muted-foreground mb-4">Parceiro não encontrado.</p><Button variant="outline" onClick={() => navigate('/admin/parceiros')}>Voltar</Button></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/parceiros')}><ArrowLeft className="w-5 h-5" /></Button>
            <div>
              <h1 className="text-2xl font-bold">{form.nome || 'Parceiro'}</h1>
              <p className="text-sm text-muted-foreground">Cadastrado em {format(new Date(partner.created_at), 'dd/MM/yyyy')}</p>
            </div>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={!dirty || saveMutation.isPending}><Save className="w-4 h-4 mr-2" />{saveMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}</Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardContent className="p-4"><PartnerSelectField label="Status Pipeline" field="pipeline_status" value={form.pipeline_status} onChange={updateField} options={PIPELINE_STATUSES} /></CardContent></Card>
          <Card><CardContent className="p-4"><PartnerSelectField label="Status Contrato" field="contrato_status" value={form.contrato_status} onChange={updateField} options={CONTRATO_STATUSES} /></CardContent></Card>
          <Card><CardContent className="p-4"><PartnerSelectField label="Status Treinamento" field="treinamento_status" value={form.treinamento_status} onChange={updateField} options={TREINAMENTO_STATUSES} /></CardContent></Card>
        </div>

        <Tabs defaultValue="empresa" className="space-y-4">
          <TabsList>
            <TabsTrigger value="empresa"><Building2 className="w-4 h-4 mr-1" /> Dados da Empresa</TabsTrigger>
            <TabsTrigger value="contrato"><FileText className="w-4 h-4 mr-1" /> Contrato</TabsTrigger>
            <TabsTrigger value="notas"><MessageSquare className="w-4 h-4 mr-1" /> Notas</TabsTrigger>
            <TabsTrigger value="historico"><History className="w-4 h-4 mr-1" /> Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="empresa">
            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle className="text-lg">🏢 Empresa</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <PartnerField label="Razão Social" field="razao_social" value={form.razao_social} onChange={updateField} placeholder="Razão Social Ltda" required error={contractErrors.razao_social} />
                    <PartnerField label="CNPJ" field="cnpj" value={form.cnpj} onChange={updateField} placeholder="00.000.000/0000-00" required error={contractErrors.cnpj} />
                    <PartnerField label="Rua / Logradouro" field="endereco_pj_rua" value={form.endereco_pj_rua} onChange={updateField} placeholder="Rua..." required error={contractErrors.endereco_pj_rua} />
                    <PartnerField label="Número" field="endereco_pj_numero" value={form.endereco_pj_numero} onChange={updateField} placeholder="4619" required error={contractErrors.endereco_pj_numero} />
                    <PartnerField label="Bairro" field="endereco_pj_bairro" value={form.endereco_pj_bairro} onChange={updateField} placeholder="Centro" required error={contractErrors.endereco_pj_bairro} />
                    <PartnerField label="Município" field="endereco_pj_municipio" value={form.endereco_pj_municipio} onChange={updateField} placeholder="Palhoça" required error={contractErrors.endereco_pj_municipio} />
                    <PartnerField label="UF" field="endereco_pj_uf" value={form.endereco_pj_uf} onChange={updateField} placeholder="SC" required error={contractErrors.endereco_pj_uf} />
                    <div className="relative">
                      <PartnerField label="CEP" field="endereco_pj_cep" value={form.endereco_pj_cep} onChange={updateField} placeholder="00000-000" required error={contractErrors.endereco_pj_cep} />
                      {cepLoading && <div className="absolute right-2 top-7 flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Buscando...</div>}
                    </div>
                    <PartnerField label="Chave PIX PJ" field="pix_pj" value={form.pix_pj} onChange={updateField} placeholder="Chave PIX da empresa" colSpan />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg">👤 Representante Legal</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <PartnerField label="Nome Completo" field="nome" value={form.nome} onChange={updateField} placeholder="Nome completo" required error={contractErrors.nome} />
                    <PartnerField label="CPF" field="cpf" value={form.cpf} onChange={updateField} placeholder="000.000.000-00" required error={contractErrors.cpf} />
                    <PartnerField label="Telefone" field="telefone" value={form.telefone} onChange={updateField} placeholder="(00) 00000-0000" required error={contractErrors.telefone} />
                    <PartnerField label="Email" field="email" value={form.email} onChange={updateField} placeholder="email@exemplo.com" type="email" required error={contractErrors.email} />
                    <PartnerField label="Nacionalidade" field="nacionalidade" value={form.nacionalidade} onChange={updateField} placeholder="Brasileira" required error={contractErrors.nacionalidade} />
                    <PartnerField label="Estado Civil" field="estado_civil" value={form.estado_civil} onChange={updateField} placeholder="Solteiro(a)" required error={contractErrors.estado_civil} />
                    <div className="col-span-1 sm:col-span-2"><h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1 mb-3 mt-2"><MapPin className="w-3.5 h-3.5" /> Endereço Pessoal</h3></div>
                    <div className="relative">
                      <PartnerField label="CEP" field="endereco_rep_cep" value={form.endereco_rep_cep} onChange={updateField} placeholder="00000-000" required error={contractErrors.endereco_rep_cep} />
                      {cepRepLoading && <div className="absolute right-2 top-7 flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Buscando...</div>}
                    </div>
                    <PartnerField label="Rua" field="endereco_rep_rua" value={form.endereco_rep_rua} onChange={updateField} placeholder="Rua..." required error={contractErrors.endereco_rep_rua} />
                    <PartnerField label="Número" field="endereco_rep_numero" value={form.endereco_rep_numero} onChange={updateField} placeholder="123" required error={contractErrors.endereco_rep_numero} />
                    <PartnerField label="Complemento" field="endereco_rep_complemento" value={form.endereco_rep_complemento} onChange={updateField} placeholder="Apto, Sala..." />
                    <PartnerField label="Bairro" field="endereco_rep_bairro" value={form.endereco_rep_bairro} onChange={updateField} placeholder="Centro" required error={contractErrors.endereco_rep_bairro} />
                    <PartnerField label="Município" field="endereco_rep_municipio" value={form.endereco_rep_municipio} onChange={updateField} placeholder="Palhoça" required error={contractErrors.endereco_rep_municipio} />
                    <PartnerField label="UF" field="endereco_rep_uf" value={form.endereco_rep_uf} onChange={updateField} placeholder="SC" required error={contractErrors.endereco_rep_uf} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg">📋 Captação</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <PartnerSelectField label="Tipo de Captação" field="captacao_tipo" value={form.captacao_tipo} onChange={updateField} options={[{ value: 'indicacao', label: 'Indicação' }, { value: 'redes_sociais', label: 'Redes Sociais' }, { value: 'anuncio', label: 'Anúncio' }, { value: 'organico', label: 'Orgânico' }, { value: 'evento', label: 'Evento' }, { value: 'outro', label: 'Outro' }]} />
                    <PartnerField label="Indicado por" field="indicado_por" value={form.indicado_por} onChange={updateField} placeholder="Quem indicou" />
                    <PartnerField label="Idade" field="idade" value={form.idade} onChange={updateField} placeholder="30" type="number" />
                  </div>
                  <div className="mt-4">
                    <Label className="text-xs text-muted-foreground">Observações</Label>
                    <Textarea value={form.obs ?? ''} onChange={e => updateField('obs', e.target.value || null)} placeholder="Notas internas..." rows={3} className="mt-1" />
                  </div>
                </CardContent>
              </Card>
            </div>
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
                  <div className="mt-6 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                    <p className="text-sm font-medium text-green-400 mb-2">✅ Contrato Assinado</p>
                    {form.contrato_assinado_em && <p className="text-xs text-muted-foreground mb-2">Assinado em {format(new Date(form.contrato_assinado_em), 'dd/MM/yyyy HH:mm')}</p>}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={downloadingPdf} onClick={() => handleDownloadOrView('view')}>{downloadingPdf ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Eye className="w-3.5 h-3.5 mr-1" />}Visualizar</Button>
                      <Button variant="outline" size="sm" disabled={downloadingPdf} onClick={() => handleDownloadOrView('download')}>{downloadingPdf ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1" />}Baixar PDF</Button>
                    </div>
                  </div>
                )}

                {form.contrato_status === 'pendente_parceiro' && (
                  <div className="mt-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-sm font-medium text-amber-400 mb-2">⏳ Aguardando Assinatura do Parceiro</p>
                    <p className="text-xs text-muted-foreground mb-2">O contrato foi enviado para o email do parceiro via ClickSign.</p>
                    <div className="flex gap-2 mt-2">
                      <Button variant="outline" size="sm" disabled={downloadingPdf} onClick={() => handleDownloadOrView('view')}>{downloadingPdf ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Eye className="w-3.5 h-3.5 mr-1" />}Visualizar</Button>
                      <Button variant="outline" size="sm" disabled={resending} onClick={handleResend}>{resending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}Reenviar</Button>
                    </div>
                  </div>
                )}

                {(form.contrato_status === 'pendente' || form.contrato_status === 'gerado') && (
                  <div className="mt-6 space-y-4">
                    {!canGenerateContract && (
                      <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                        <p className="text-sm font-medium text-destructive flex items-center gap-1"><AlertTriangle className="w-4 h-4" />Campos obrigatórios faltando:</p>
                        <ul className="mt-1 text-xs text-muted-foreground list-disc list-inside">{Object.values(contractErrors).map((e, i) => <li key={i}>{e}</li>)}</ul>
                      </div>
                    )}
                    <Button onClick={() => previewMutation.mutate()} disabled={!canGenerateContract || previewMutation.isPending}>
                      {previewMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}Gerar Prévia do Contrato
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notas">
            <Card>
              <CardHeader><CardTitle className="text-lg">Notas</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Adicionar uma nota..." className="flex-1" rows={2} />
                  <Button onClick={() => addNoteMutation.mutate()} disabled={!newNote.trim() || addNoteMutation.isPending} className="shrink-0">
                    {addNoteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
                <div className="space-y-3">
                  {history.filter((h: any) => h.action === 'nota_adicionada').map((h: any) => (
                    <div key={h.id} className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                      <p className="text-sm">{h.details?.nota}</p>
                      <p className="text-xs text-muted-foreground mt-1">{format(new Date(h.created_at), 'dd/MM/yyyy HH:mm')}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historico">
            <Card>
              <CardHeader><CardTitle className="text-lg">Histórico</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {history.map((h: any) => (
                    <div key={h.id} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50">
                      <span className="text-xl">{ACTION_ICONS[h.action] || '📋'}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{ACTION_LABELS[h.action] || h.action}</p>
                        {h.details && <p className="text-xs text-muted-foreground mt-0.5">{h.action === 'nota_adicionada' ? h.details.nota : JSON.stringify(h.details)}</p>}
                        <p className="text-xs text-muted-foreground mt-1">{format(new Date(h.created_at), 'dd/MM/yyyy HH:mm')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <ContractPreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} contractText={contractPreviewText} pdfBase64={contractPdfBase64} onConfirm={() => generateContractMutation.mutate()} isGenerating={generateContractMutation.isPending} />
        <ContractViewerDialog open={viewerOpen} onOpenChange={setViewerOpen} pdfBase64={viewerPdfBase64} filename={viewerFilename} />
      </div>
    </DashboardLayout>
  );
}
