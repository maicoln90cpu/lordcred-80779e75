import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Send, AlertCircle, CheckCircle2 } from "lucide-react";
import { useV8OperationDraft, type DraftOrigin } from "@/hooks/useV8OperationDraft";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import CreateOperationDocsSection, {
  uploadPendingDocs,
  UploadProgress,
  type PendingDoc,
} from "./CreateOperationDocsSection";

/**
 * V8 — Etapa 5: Diálogo "Criar Proposta" (POST /operation).
 *
 * Estratégia:
 *  - Formulário único com seções Identificação / Endereço (ViaCEP) / Bancário (obrigatórios)
 *  - Accordion "Dados Avançados (opcional)" com PEP, estado civil, nome do pai, ocupação
 *  - Auto-save a cada 1.5s via useV8OperationDraft → tabela v8_operation_drafts
 *  - Ao submeter: chama edge function v8-clt-api action create_operation
 *  - Documentos: opcional (upload existente da Etapa 6 fica para anexar depois)
 *
 * Pré-requisito: a consulta da margem (consult_id) já deve estar autorizada.
 * Sem consult_id válido o botão de submit fica desabilitado com aviso.
 */

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

interface CreateOperationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** ID de consulta autorizada V8 (obrigatório para submeter) */
  consultId?: string | null;
  /** ID da simulação local (v8_simulations.id) — opcional */
  simulationId?: string | null;
  /** Origem: simulation | lead | blank */
  origin: DraftOrigin;
  /** ID da origem (para deduplicar rascunhos) */
  originId?: string | null;
  /** Pré-preenchimento (CPF, nome, telefone vindos da origem) */
  prefill?: {
    cpf?: string;
    name?: string;
    birth_date?: string;
    phone?: string;
    email?: string;
  };
  /** Callback após sucesso */
  onCreated?: (operationId: string | null) => void;
}

function emptyForm(prefill: CreateOperationDialogProps["prefill"] = {}) {
  return {
    borrower: {
      cpf: prefill.cpf || "",
      name: prefill.name || "",
      birth_date: prefill.birth_date || "",
      mother_name: "",
      father_name: "",
      email: prefill.email || "",
      phone: prefill.phone || "",
      marital_status: "",
      pep: false,
      occupation: "",
    },
    address: {
      zip_code: "",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
    },
    bank: {
      transfer_method: "pix",
      pix_key: "",
      pix_key_type: "cpf",
    },
  };
}

export default function CreateOperationDialog({
  open, onOpenChange, consultId, simulationId, origin, originId, prefill, onCreated,
}: CreateOperationDialogProps) {
  const initial = emptyForm(prefill);
  const { draftId, formData, updateForm, setFormData, isSaving, lastSavedAt, flush } = useV8OperationDraft({
    originType: origin,
    originId,
    initialFormData: initial,
    enabled: open,
  });
  const [submitting, setSubmitting] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([]);
  const [uploadingDocs, setUploadingDocs] = useState(false);

  // Resetar form quando dialog reabrir com origem nova (e nenhum draft carregado)
  useEffect(() => {
    if (open && !draftId) setFormData(emptyForm(prefill));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fd = formData as ReturnType<typeof emptyForm>;
  const setField = (path: string[], value: unknown) => {
    updateForm((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      let ref: any = next;
      for (let i = 0; i < path.length - 1; i++) ref = ref[path[i]];
      ref[path[path.length - 1]] = value;
      return next;
    });
  };

  // ViaCEP — preenche endereço automaticamente
  const handleCepBlur = async () => {
    const cep = String(fd.address?.zip_code || "").replace(/\D/g, "");
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await resp.json();
      if (!data?.erro) {
        updateForm((prev) => {
          const next = JSON.parse(JSON.stringify(prev));
          next.address.street = data.logradouro || next.address.street;
          next.address.neighborhood = data.bairro || next.address.neighborhood;
          next.address.city = data.localidade || next.address.city;
          next.address.state = data.uf || next.address.state;
          return next;
        });
      }
    } catch (e) {
      console.error("ViaCEP failed:", e);
    } finally {
      setCepLoading(false);
    }
  };

  // Etapa 5 — PEP exige ocupação. Bloqueia submit se PEP marcado e sem ocupação preenchida.
  const isPep = !!fd.borrower?.pep;
  const occupationMissing = isPep && !(fd.borrower?.occupation || '').trim();
  const canSubmit = !!consultId && !submitting && !occupationMissing;

  // Etapa 4 — para origin='lead' sem consultId, oferecer atalho "Consultar V8 agora".
  const [consultingForLead, setConsultingForLead] = useState(false);
  async function handleConsultForLead() {
    const cpf = (fd.borrower?.cpf || '').replace(/\D/g, '');
    const birth = fd.borrower?.birth_date || '';
    if (cpf.length !== 11) {
      toast({ title: 'CPF inválido', description: 'Preencha o CPF (11 dígitos) antes de consultar.', variant: 'destructive' });
      return;
    }
    if (!birth) {
      toast({ title: 'Data de nascimento ausente', description: 'A V8 exige data de nascimento para consultar.', variant: 'destructive' });
      return;
    }
    setConsultingForLead(true);
    try {
      const { data, error } = await supabase.functions.invoke('v8-clt-api', {
        body: {
          action: 'simulate_consult_only',
          params: {
            cpf, nome: fd.borrower?.name, data_nascimento: birth,
            telefone: fd.borrower?.phone, triggered_by: 'lead_consult_for_proposal',
          },
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || data?.user_message || 'Falha ao consultar');
      toast({
        title: 'Consulta enviada à V8',
        description: 'Aguarde o webhook (~10–30s). Quando voltar, este lead aparecerá com simulação SUCCESS — então o botão "Enviar proposta" libera.',
      });
    } catch (e: any) {
      toast({ title: 'Falha ao consultar V8', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setConsultingForLead(false);
    }
  }

  /** Atualiza um item de documento individualmente (usado pelo checklist visual). */
  function patchDoc(id: string, patch: Partial<PendingDoc>) {
    setPendingDocs((cur) => cur.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  const handleSubmit = async () => {
    if (!consultId) {
      toast({ title: "Sem consulta autorizada", description: "Faça a consulta de margem antes de criar a proposta.", variant: "destructive" });
      return;
    }
    if (occupationMissing) {
      toast({ title: 'Ocupação obrigatória', description: 'PEP marcado: preencha o campo "Ocupação" em Dados avançados.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    await flush();
    try {
      const { data, error } = await supabase.functions.invoke("v8-clt-api", {
        body: {
          action: "create_operation",
          params: {
            consult_id: consultId,
            simulation_id: simulationId,
            draft_id: draftId,
            payload: fd,
            documents: [],
          },
        },
      });
      if (error) throw error;
      if (!data?.success) {
        toast({
          title: "Falha ao criar proposta",
          description: data?.error || "Erro desconhecido na V8.",
          variant: "destructive",
        });
        return;
      }
      const opId = data?.data?.operation_id ?? null;
      toast({
        title: "Proposta criada",
        description: opId ? `Operação ${opId} criada na V8.` : "Proposta enviada com sucesso.",
      });

      // Upload de documentos pendentes (opcional, pós-criação) — agora com checklist visual
      if (opId && pendingDocs.length > 0) {
        const ready = pendingDocs.filter((d) => d.documentType);
        const skipped = pendingDocs.length - ready.length;
        if (ready.length > 0) {
          setUploadingDocs(true);
          const { ok, fail } = await uploadPendingDocs(opId, ready, supabase.functions.invoke.bind(supabase.functions), patchDoc);
          setUploadingDocs(false);
          if (fail > 0) toast({ title: "Documentos", description: `${ok} enviados, ${fail} falha(s) — veja o checklist.`, variant: "destructive" });
          else toast({ title: "Documentos", description: `${ok} enviado(s) à V8.` });
        }
        if (skipped > 0) {
          toast({ title: "Documentos pulados", description: `${skipped} sem tipo selecionado — anexe depois pela tela de pendência.`, variant: "destructive" });
        }
      }

      onCreated?.(opId);
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro inesperado", description: err?.message || String(err), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            Criar Proposta V8
            {/* Tag de origem — deixa claro de onde o operador veio (simulação V8, lead ou em branco) */}
            {origin === 'simulation' && (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                Origem: Simulação V8
              </Badge>
            )}
            {origin === 'lead' && (
              <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30 text-[10px]">
                Origem: Lead
              </Badge>
            )}
            {origin === 'blank' && (
              <Badge variant="outline" className="text-[10px]">
                Em branco
              </Badge>
            )}
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
            {!isSaving && lastSavedAt && (
              <Badge variant="outline" className="text-[10px]">
                <CheckCircle2 className="w-3 h-3 mr-1 text-green-500" />
                Rascunho salvo
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Preencha os dados do mutuário. O rascunho é salvo automaticamente.
            {!consultId && (
              <span className="block mt-2 text-amber-600 dark:text-amber-400 text-xs flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Necessário ter uma consulta de margem autorizada para enviar.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Identificação */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Identificação</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>CPF *</Label>
              <Input value={fd.borrower?.cpf || ""} onChange={(e) => setField(["borrower","cpf"], e.target.value)} placeholder="000.000.000-00" />
            </div>
            <div>
              <Label>Nome completo *</Label>
              <Input value={fd.borrower?.name || ""} onChange={(e) => setField(["borrower","name"], e.target.value)} />
            </div>
            <div>
              <Label>Data de nascimento *</Label>
              <Input type="date" value={fd.borrower?.birth_date || ""} onChange={(e) => setField(["borrower","birth_date"], e.target.value)} />
            </div>
            <div>
              <Label>Nome da mãe *</Label>
              <Input value={fd.borrower?.mother_name || ""} onChange={(e) => setField(["borrower","mother_name"], e.target.value)} />
            </div>
            <div>
              <Label>E-mail *</Label>
              <Input type="email" value={fd.borrower?.email || ""} onChange={(e) => setField(["borrower","email"], e.target.value)} />
            </div>
            <div>
              <Label>Telefone *</Label>
              <Input value={fd.borrower?.phone || ""} onChange={(e) => setField(["borrower","phone"], e.target.value)} placeholder="+5511999998888" />
            </div>
          </div>
        </section>

        {/* Endereço */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Endereço</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>CEP * {cepLoading && <Loader2 className="inline w-3 h-3 animate-spin ml-1" />}</Label>
              <Input value={fd.address?.zip_code || ""} onChange={(e) => setField(["address","zip_code"], e.target.value)} onBlur={handleCepBlur} placeholder="00000-000" />
            </div>
            <div className="col-span-2">
              <Label>Logradouro *</Label>
              <Input value={fd.address?.street || ""} onChange={(e) => setField(["address","street"], e.target.value)} />
            </div>
            <div>
              <Label>Número *</Label>
              <Input value={fd.address?.number || ""} onChange={(e) => setField(["address","number"], e.target.value)} />
            </div>
            <div>
              <Label>Complemento</Label>
              <Input value={fd.address?.complement || ""} onChange={(e) => setField(["address","complement"], e.target.value)} />
            </div>
            <div>
              <Label>Bairro</Label>
              <Input value={fd.address?.neighborhood || ""} onChange={(e) => setField(["address","neighborhood"], e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Cidade *</Label>
              <Input value={fd.address?.city || ""} onChange={(e) => setField(["address","city"], e.target.value)} />
            </div>
            <div>
              <Label>UF *</Label>
              <Select value={fd.address?.state || ""} onValueChange={(v) => setField(["address","state"], v)}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>
                  {UFS.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Bancário */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dados de pagamento</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Forma *</Label>
              <Select value={fd.bank?.transfer_method || "pix"} onValueChange={(v) => setField(["bank","transfer_method"], v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo da chave *</Label>
              <Select value={fd.bank?.pix_key_type || "cpf"} onValueChange={(v) => setField(["bank","pix_key_type"], v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="phone">Telefone</SelectItem>
                  <SelectItem value="random">Chave aleatória</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Chave PIX *</Label>
              <Input value={fd.bank?.pix_key || ""} onChange={(e) => setField(["bank","pix_key"], e.target.value)} />
            </div>
          </div>
        </section>

        {/* Avançados (colapsável) */}
        <Accordion type="single" collapsible>
          <AccordionItem value="advanced">
            <AccordionTrigger className="text-sm">Dados avançados (opcional)</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <Label>Nome do pai</Label>
                  <Input value={fd.borrower?.father_name || ""} onChange={(e) => setField(["borrower","father_name"], e.target.value)} />
                </div>
                <div>
                  <Label>Estado civil</Label>
                  <Select value={fd.borrower?.marital_status || ""} onValueChange={(v) => setField(["borrower","marital_status"], v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Solteiro(a)</SelectItem>
                      <SelectItem value="married">Casado(a)</SelectItem>
                      <SelectItem value="divorced">Divorciado(a)</SelectItem>
                      <SelectItem value="widowed">Viúvo(a)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Ocupação</Label>
                  <Input value={fd.borrower?.occupation || ""} onChange={(e) => setField(["borrower","occupation"], e.target.value)} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="pep"
                    checked={!!fd.borrower?.pep}
                    onChange={(e) => setField(["borrower","pep"], e.target.checked)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="pep" className="cursor-pointer">Pessoa Politicamente Exposta (PEP)</Label>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Documentos (drag-and-drop) */}
        <CreateOperationDocsSection
          items={pendingDocs}
          onChange={setPendingDocs}
          disabled={submitting || uploadingDocs}
        />

        <DialogFooter className="flex-col sm:flex-row sm:items-center gap-2">
          <UploadProgress busy={uploadingDocs} />
          <div className="flex gap-2 sm:ml-auto">
            <Button variant="outline" onClick={() => { void flush(); onOpenChange(false); }}>
              <Save className="w-4 h-4 mr-1" /> Salvar e fechar
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit || uploadingDocs}>
              {submitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
              Enviar proposta para V8
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
