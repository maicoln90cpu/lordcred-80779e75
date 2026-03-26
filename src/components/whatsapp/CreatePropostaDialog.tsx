import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { invokeCorban } from '@/lib/invokeCorban';
import { Loader2, FileText, User, MapPin, CreditCard, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CreatePropostaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: any;
  onSuccess?: (propostaId: string) => void;
}

/** Split phone into DDD + number */
function splitPhone(telefone: string | null): { ddd: string; numero: string } {
  if (!telefone) return { ddd: '', numero: '' };
  const digits = telefone.replace(/\D/g, '');
  // Remove country code 55 if present
  const local = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
  if (local.length >= 10) {
    return { ddd: local.slice(0, 2), numero: local.slice(2) };
  }
  return { ddd: '', numero: local };
}

/** Convert DD/MM/YYYY or other formats to YYYY-MM-DD */
function toISODate(value: string | null): string {
  if (!value) return '';
  const s = value.trim();
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.split('T')[0];
  // DD/MM/YYYY
  const ddmm = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmm) return `${ddmm[3]}-${ddmm[2]}-${ddmm[1]}`;
  // Excel serial
  if (/^\d+$/.test(s)) {
    const serial = parseInt(s, 10);
    const epoch = new Date(1900, 0, 1);
    const date = new Date(epoch.getTime() + (serial - 2) * 86400000);
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return '';
}

export default function CreatePropostaDialog({ open, onOpenChange, lead, onSuccess }: CreatePropostaDialogProps) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<any>(null);

  // ---- Dados Pessoais (auto-mapped from lead) ----
  const [cpf, setCpf] = useState('');
  const [nome, setNome] = useState('');
  const [nascimento, setNascimento] = useState('');
  const [nomeMae, setNomeMae] = useState('');
  const [sexo, setSexo] = useState('MASCULINO');
  const [estadoCivil, setEstadoCivil] = useState('SOLTEIRO');
  const [nacionalidade, setNacionalidade] = useState('BRASILEIRO');
  const [nomePai, setNomePai] = useState('');
  const [renda, setRenda] = useState('');
  const [email, setEmail] = useState('');

  // ---- Telefone (auto-mapped) ----
  const [ddd, setDdd] = useState('');
  const [telefoneNum, setTelefoneNum] = useState('');

  // ---- Documento ----
  const [docNumero, setDocNumero] = useState('');
  const [docTipo, setDocTipo] = useState('RG');
  const [docEmissao, setDocEmissao] = useState('');
  const [docUf, setDocUf] = useState('SP');

  // ---- Endereço ----
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [endNumero, setEndNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [uf, setUf] = useState('SP');
  const [complemento, setComplemento] = useState('');

  // ---- Proposta (auto-mapped) ----
  const [bancoId, setBancoId] = useState('');
  const [convenioId, setConvenioId] = useState('');
  const [produtoId, setProdutoId] = useState('');
  const [valorLiberado, setValorLiberado] = useState('');
  const [valorParcela, setValorParcela] = useState('');
  const [prazo, setPrazo] = useState('');
  const [taxa, setTaxa] = useState('');
  const [tipoLiberacao, setTipoLiberacao] = useState('CONTA_CORRENTE');
  const [bancoAverbacao, setBancoAverbacao] = useState('');
  const [agencia, setAgencia] = useState('');
  const [conta, setConta] = useState('');
  const [contaDigito, setContaDigito] = useState('');

  // Fetch cached assets for selects
  const { data: bancosAssets = [] } = useQuery({
    queryKey: ['corban-assets-bancos'],
    queryFn: async () => {
      const { data } = await supabase.from('corban_assets_cache').select('asset_id, asset_label').eq('asset_type', 'bancos');
      return data || [];
    },
  });

  const { data: conveniosAssets = [] } = useQuery({
    queryKey: ['corban-assets-convenios'],
    queryFn: async () => {
      const { data } = await supabase.from('corban_assets_cache').select('asset_id, asset_label').eq('asset_type', 'convenios');
      return data || [];
    },
  });

  const { data: produtosAssets = [] } = useQuery({
    queryKey: ['corban-assets-produtos'],
    queryFn: async () => {
      const { data } = await supabase.from('corban_assets_cache').select('asset_id, asset_label').eq('asset_type', 'produtos');
      return data || [];
    },
  });

  // Auto-fill from lead when dialog opens
  useEffect(() => {
    if (!lead || !open) return;
    setCpf(lead.cpf || '');
    setNome(lead.nome || '');
    setNascimento(toISODate(lead.data_nasc));
    setNomeMae(lead.nome_mae || '');
    const phone = splitPhone(lead.telefone);
    setDdd(phone.ddd);
    setTelefoneNum(phone.numero);
    setValorLiberado(lead.valor_lib ? String(lead.valor_lib) : '');
    setValorParcela(lead.vlr_parcela ? String(lead.vlr_parcela) : '');
    setPrazo(lead.prazo ? String(lead.prazo) : '');
    setBancoId(lead.banco_codigo || '');
    setAgencia(lead.agencia || '');
    setConta(lead.conta || '');
    setResponse(null);
  }, [lead, open]);

  const autoMappedFields = useMemo(() => {
    if (!lead) return [];
    const fields: string[] = [];
    if (lead.cpf) fields.push('CPF');
    if (lead.nome) fields.push('Nome');
    if (lead.data_nasc) fields.push('Data Nasc.');
    if (lead.nome_mae) fields.push('Nome Mãe');
    if (lead.telefone) fields.push('Telefone');
    if (lead.valor_lib) fields.push('Valor Lib.');
    if (lead.vlr_parcela) fields.push('Parcela');
    if (lead.prazo) fields.push('Prazo');
    if (lead.banco_codigo) fields.push('Banco');
    if (lead.agencia) fields.push('Agência');
    if (lead.conta) fields.push('Conta');
    return fields;
  }, [lead]);

  const handleSubmit = async () => {
    if (!cpf || !nome) {
      toast({ title: 'CPF e Nome são obrigatórios', variant: 'destructive' });
      return;
    }

    setSending(true);
    setResponse(null);

    const content = {
      cliente: {
        pessoais: {
          cpf: cpf.replace(/\D/g, ''),
          nome,
          nascimento: nascimento || undefined,
          sexo,
          estado_civil: estadoCivil,
          nacionalidade,
          mae: nomeMae || undefined,
          pai: nomePai || undefined,
          renda: renda ? parseFloat(renda) : undefined,
          email: email || undefined,
          falecido: false,
          nao_perturbe: false,
          analfabeto: false,
        },
        documentos: docNumero ? [{
          numero: docNumero,
          tipo: docTipo,
          data_emissao: docEmissao || undefined,
          uf: docUf,
        }] : [],
        enderecos: cep ? [{
          cep: cep.replace(/\D/g, ''),
          logradouro,
          numero: endNumero,
          bairro,
          cidade,
          estado,
          uf,
          complemento,
        }] : [],
        telefones: ddd && telefoneNum ? [{ ddd, numero: telefoneNum }] : [],
      },
      proposta: {
        documento_id: docNumero || undefined,
        endereco_id: cep?.replace(/\D/g, '') || undefined,
        telefone_id: telefoneNum || undefined,
        banco_id: bancoId || undefined,
        convenio_id: convenioId || undefined,
        produto_id: produtoId || undefined,
        status: '0',
        tipo_cadastro: 'API',
        tipo_liberacao: tipoLiberacao,
        banco_averbacao: bancoAverbacao || undefined,
        conta: conta || undefined,
        conta_digito: contaDigito || undefined,
        agencia: agencia || undefined,
        valor_parcela: valorParcela ? parseFloat(valorParcela) : 0,
        valor_financiado: valorLiberado ? parseFloat(valorLiberado) : 0,
        valor_liberado: valorLiberado ? parseFloat(valorLiberado) : 0,
        prazos: prazo ? parseInt(prazo) : undefined,
        taxa: taxa ? parseFloat(taxa) : undefined,
      },
    };

    try {
      const result = await invokeCorban('createProposta', { content });

      if (result.error) {
        setResponse({ success: false, error: result.error });
        toast({ title: 'Erro ao criar proposta', description: result.error, variant: 'destructive' });
      } else {
        setResponse({ success: true, data: result.data });
        toast({ title: 'Proposta criada com sucesso!' });

        // Save corban_proposta_id to the lead for status tracking
        const propostaId = result.data?.id || result.data?.proposta_id;
        if (lead?.id) {
          const updateData: any = { corban_proposta_id: propostaId ? String(propostaId) : null, updated_at: new Date().toISOString() };
          await supabase.from('client_leads' as any).update(updateData).eq('id', lead.id);
          if (propostaId) onSuccess?.(String(propostaId));
        }
      }
    } catch (err: any) {
      setResponse({ success: false, error: err.message });
      toast({ title: 'Erro inesperado', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const UF_OPTIONS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Criar Proposta — NewCorban
          </DialogTitle>
          {autoMappedFields.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              <span className="text-xs text-muted-foreground">Auto-preenchido:</span>
              {autoMappedFields.map(f => (
                <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>
              ))}
            </div>
          )}
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 pr-4">
          <div className="space-y-6 pb-4">
            {/* === DADOS PESSOAIS === */}
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <User className="w-4 h-4" /> Dados Pessoais
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">CPF *</Label>
                  <Input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="12345678900" />
                </div>
                <div>
                  <Label className="text-xs">Nome *</Label>
                  <Input value={nome} onChange={e => setNome(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Data Nascimento</Label>
                  <Input type="date" value={nascimento} onChange={e => setNascimento(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Sexo</Label>
                  <Select value={sexo} onValueChange={setSexo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MASCULINO">Masculino</SelectItem>
                      <SelectItem value="FEMININO">Feminino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Estado Civil</Label>
                  <Select value={estadoCivil} onValueChange={setEstadoCivil}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SOLTEIRO">Solteiro</SelectItem>
                      <SelectItem value="CASADO">Casado</SelectItem>
                      <SelectItem value="DIVORCIADO">Divorciado</SelectItem>
                      <SelectItem value="VIUVO">Viúvo</SelectItem>
                      <SelectItem value="UNIAO_ESTAVEL">União Estável</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Nacionalidade</Label>
                  <Input value={nacionalidade} onChange={e => setNacionalidade(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Nome da Mãe</Label>
                  <Input value={nomeMae} onChange={e => setNomeMae(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Nome do Pai</Label>
                  <Input value={nomePai} onChange={e => setNomePai(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Renda (R$)</Label>
                  <Input type="number" value={renda} onChange={e => setRenda(e.target.value)} placeholder="1412" />
                </div>
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">DDD</Label>
                  <Input value={ddd} onChange={e => setDdd(e.target.value)} placeholder="11" maxLength={2} />
                </div>
                <div>
                  <Label className="text-xs">Telefone</Label>
                  <Input value={telefoneNum} onChange={e => setTelefoneNum(e.target.value)} placeholder="940034771" />
                </div>
              </div>
            </div>

            <Separator />

            {/* === DOCUMENTO === */}
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4" /> Documento
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Número</Label>
                  <Input value={docNumero} onChange={e => setDocNumero(e.target.value)} placeholder="12345678" />
                </div>
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={docTipo} onValueChange={setDocTipo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RG">RG</SelectItem>
                      <SelectItem value="CNH">CNH</SelectItem>
                      <SelectItem value="CTPS">CTPS</SelectItem>
                      <SelectItem value="PASSAPORTE">Passaporte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Data de Emissão</Label>
                  <Input type="date" value={docEmissao} onChange={e => setDocEmissao(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">UF</Label>
                  <Select value={docUf} onValueChange={setDocUf}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UF_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* === ENDEREÇO === */}
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4" /> Endereço
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">CEP</Label>
                  <Input value={cep} onChange={e => setCep(e.target.value)} placeholder="03545000" />
                </div>
                <div>
                  <Label className="text-xs">Logradouro</Label>
                  <Input value={logradouro} onChange={e => setLogradouro(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Número</Label>
                  <Input value={endNumero} onChange={e => setEndNumero(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Complemento</Label>
                  <Input value={complemento} onChange={e => setComplemento(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Bairro</Label>
                  <Input value={bairro} onChange={e => setBairro(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Cidade</Label>
                  <Input value={cidade} onChange={e => setCidade(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Estado</Label>
                  <Input value={estado} onChange={e => setEstado(e.target.value)} placeholder="São Paulo" />
                </div>
                <div>
                  <Label className="text-xs">UF</Label>
                  <Select value={uf} onValueChange={setUf}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UF_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* === PROPOSTA === */}
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <CreditCard className="w-4 h-4" /> Dados da Proposta
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Banco</Label>
                  {bancosAssets.length > 0 ? (
                    <Select value={bancoId} onValueChange={setBancoId}>
                      <SelectTrigger><SelectValue placeholder="Selecionar banco" /></SelectTrigger>
                      <SelectContent>
                        {bancosAssets.map((b: any) => (
                          <SelectItem key={b.asset_id} value={b.asset_id}>{b.asset_label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={bancoId} onChange={e => setBancoId(e.target.value)} placeholder="Código do banco" />
                  )}
                </div>
                <div>
                  <Label className="text-xs">Convênio</Label>
                  {conveniosAssets.length > 0 ? (
                    <Select value={convenioId} onValueChange={setConvenioId}>
                      <SelectTrigger><SelectValue placeholder="Selecionar convênio" /></SelectTrigger>
                      <SelectContent>
                        {conveniosAssets.map((c: any) => (
                          <SelectItem key={c.asset_id} value={c.asset_id}>{c.asset_label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={convenioId} onChange={e => setConvenioId(e.target.value)} placeholder="ID do convênio" />
                  )}
                </div>
                <div>
                  <Label className="text-xs">Produto</Label>
                  {produtosAssets.length > 0 ? (
                    <Select value={produtoId} onValueChange={setProdutoId}>
                      <SelectTrigger><SelectValue placeholder="Selecionar produto" /></SelectTrigger>
                      <SelectContent>
                        {produtosAssets.map((p: any) => (
                          <SelectItem key={p.asset_id} value={p.asset_id}>{p.asset_label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={produtoId} onChange={e => setProdutoId(e.target.value)} placeholder="ID do produto" />
                  )}
                </div>
                <div>
                  <Label className="text-xs">Tipo de Liberação</Label>
                  <Select value={tipoLiberacao} onValueChange={setTipoLiberacao}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CONTA_CORRENTE">Conta Corrente</SelectItem>
                      <SelectItem value="CONTA_POUPANCA">Conta Poupança</SelectItem>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="ORDEM_PAGAMENTO">Ordem de Pagamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Valor Liberado (R$)</Label>
                  <Input type="number" step="0.01" value={valorLiberado} onChange={e => setValorLiberado(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Valor Parcela (R$)</Label>
                  <Input type="number" step="0.01" value={valorParcela} onChange={e => setValorParcela(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Prazo (meses)</Label>
                  <Input type="number" value={prazo} onChange={e => setPrazo(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Taxa (%)</Label>
                  <Input type="number" step="0.01" value={taxa} onChange={e => setTaxa(e.target.value)} placeholder="1.80" />
                </div>
                <div>
                  <Label className="text-xs">Banco Averbação</Label>
                  <Input value={bancoAverbacao} onChange={e => setBancoAverbacao(e.target.value)} placeholder="237" />
                </div>
                <div>
                  <Label className="text-xs">Agência</Label>
                  <Input value={agencia} onChange={e => setAgencia(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Conta</Label>
                  <Input value={conta} onChange={e => setConta(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Dígito da Conta</Label>
                  <Input value={contaDigito} onChange={e => setContaDigito(e.target.value)} maxLength={1} />
                </div>
              </div>
            </div>

            {/* === RESPOSTA === */}
            {response && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4" /> Resposta da API
                  </h3>
                  <div className={`rounded-md p-3 text-xs font-mono whitespace-pre-wrap ${
                    response.success ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-destructive/10 text-destructive border border-destructive/20'
                  }`}>
                    {JSON.stringify(response.success ? response.data : response.error, null, 2)}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={sending || !cpf || !nome}>
            {sending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Enviar para NewCorban
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
