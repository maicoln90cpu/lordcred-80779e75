import { useEffect, useMemo, useRef, useState } from 'react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, FileSearch, Loader2, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { useV8Operations } from '@/hooks/useV8Operations';
import { supabase } from '@/integrations/supabase/client';

function formatCpf(value?: string | null) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length !== 11) return value || '—';
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatCurrency(value?: string | number | null) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('pt-BR');
}

function toRangeBoundary(date: Date, boundary: 'start' | 'end') {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const time = boundary === 'start' ? '00:00:00.000' : '23:59:59.999';
  return `${year}-${month}-${day}T${time}Z`;
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date;
  onChange: (date: Date | undefined) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn('w-full justify-start text-left font-normal', !value && 'text-muted-foreground')}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, 'dd/MM/yyyy') : <span>Selecione</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onChange}
            initialFocus
            locale={ptBR}
            className={cn('p-3 pointer-events-auto')}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function V8ConsultasTab() {
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [rtPulse, setRtPulse] = useState(false);
  const lastSearchRef = useRef<{ start: Date; end: Date; term: string } | null>(null);

  const {
    operations,
    consults,
    loading,
    detailLoading,
    selectedOperation,
    setSelectedOperation,
    loadOperations,
    loadConsults,
    loadOperationDetail,
  } = useV8Operations();

  // Não auto-fetch — requisição manual evita custo desnecessário com a V8

  const filteredOperations = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    if (!search) return operations;

    const digits = search.replace(/\D/g, '');
    return operations.filter((operation) => {
      const name = String(operation.name || '').toLowerCase();
      const cpf = String(operation.documentNumber || '').replace(/\D/g, '');
      const contract = String(operation.contractNumber || '').toLowerCase();

      return (
        name.includes(search) ||
        contract.includes(search) ||
        (digits.length > 0 && cpf.includes(digits))
      );
    });
  }, [operations, searchTerm]);

  const filteredConsults = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    if (!search) return consults;

    const digits = search.replace(/\D/g, '');
    return consults.filter((consult) => {
      const name = String(consult.name || '').toLowerCase();
      const cpf = String(consult.documentNumber || '').replace(/\D/g, '');
      const title = String(consult.title || '').toLowerCase();
      const detail = String(consult.detail || '').toLowerCase();

      return name.includes(search) || title.includes(search) || detail.includes(search) || (digits.length > 0 && cpf.includes(digits));
    });
  }, [consults, searchTerm]);

  async function handleSearch() {
    if (startDate > endDate) {
      toast.error('A data inicial não pode ser maior que a data final');
      return;
    }

    setHasSearched(true);

    const result = await loadOperations({
      startDate: toRangeBoundary(startDate, 'start'),
      endDate: toRangeBoundary(endDate, 'end'),
      limit: 200,
      page: 1,
    });

    const consultResult = await loadConsults({
      startDate: toRangeBoundary(startDate, 'start'),
      endDate: toRangeBoundary(endDate, 'end'),
      limit: 200,
      page: 1,
      search: searchTerm,
    });

    if (!result.success) {
      toast.error(result.error || 'Não foi possível consultar as propostas');
      return;
    }

    if (!consultResult.success) {
      toast.error(consultResult.error || 'Não foi possível consultar consultas ativas');
      return;
    }

    toast.success(`${result.total} proposta(s) e ${consultResult.total} consulta(s) carregada(s)`);
  }

  async function handleOpenDetails(operationId: string) {
    const result = await loadOperationDetail(operationId);
    if (!result.success) {
      toast.error(result.error || 'Não foi possível abrir os detalhes');
      return;
    }
    setDetailsOpen(true);
  }

  async function handleReplayPending() {
    setReplaying(true);
    try {
      // Limite 200 por clique para caber dentro do timeout de 150s da edge function.
      // O usuário pode clicar várias vezes até zerar a fila.
      const { data, error } = await supabase.functions.invoke('v8-webhook', {
        body: { action: 'replay_pending', limit: 200 },
      });
      if (error) throw error;
      if (data?.ok) {
        toast.success(
          `Reprocessados: ${data.success} sucesso, ${data.failed} sem ação. Total lido: ${data.total}. Clique de novo se ainda houver pendentes.`,
        );
      } else {
        toast.error(data?.error || 'Não foi possível reprocessar os webhooks pendentes.');
      }
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || err}`);
    } finally {
      setReplaying(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Consultas já existentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <DateField label="Período inicial" value={startDate} onChange={(date) => date && setStartDate(date)} />
            <DateField label="Período final" value={endDate} onChange={(date) => date && setEndDate(date)} />
            <div className="space-y-2 md:col-span-2">
              <Label>Buscar por CPF, nome ou contrato</Label>
              <Input
                placeholder="Ex.: 12345678901 ou Maria"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                O período é aplicado no backend. CPF/nome/contrato refinam a lista carregada aqui na tela.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="outline"
              onClick={handleReplayPending}
              disabled={replaying}
              title="Reprocessa webhooks da V8 que ficaram pendentes nos últimos 7 dias"
            >
              {replaying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Reprocessar webhooks pendentes (7 dias)
            </Button>
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSearch className="mr-2 h-4 w-4" />}
              Buscar propostas
            </Button>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Nome</th>
                  <th className="px-3 py-2 text-left">CPF</th>
                  <th className="px-3 py-2 text-right">Valor bruto</th>
                  <th className="px-3 py-2 text-right">Valor líquido liberado</th>
                  <th className="px-3 py-2 text-left">Nº contrato</th>
                  <th className="px-3 py-2 text-left">Data de criação</th>
                  <th className="px-3 py-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {!loading && !hasSearched && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                      Defina o período e clique em <strong>Buscar propostas</strong> para carregar os dados da V8.
                    </td>
                  </tr>
                )}

                {!loading && hasSearched && filteredOperations.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                      Nenhuma proposta encontrada para o período informado.
                    </td>
                  </tr>
                )}

                {filteredOperations.map((operation) => (
                  <tr key={operation.operationId} className="border-t">
                    <td className="px-3 py-2">
                      <Badge variant="outline">{operation.status || '—'}</Badge>
                    </td>
                    <td className="px-3 py-2">{operation.name || '—'}</td>
                    <td className="px-3 py-2 font-mono">{formatCpf(operation.documentNumber)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(operation.issueAmount)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(operation.disbursedIssueAmount)}</td>
                    <td className="px-3 py-2">{operation.contractNumber || '—'}</td>
                    <td className="px-3 py-2">{formatDateTime(operation.createdAt)}</td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="outline" size="sm" onClick={() => handleOpenDetails(operation.operationId)}>
                        Ver detalhes
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Consultas ativas / já existentes fora das operações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Nome</th>
                  <th className="px-3 py-2 text-left">CPF</th>
                  <th className="px-3 py-2 text-left">Título</th>
                  <th className="px-3 py-2 text-left">Detalhe</th>
                  <th className="px-3 py-2 text-left">Data</th>
                </tr>
              </thead>
              <tbody>
                {!loading && !hasSearched && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      Defina o período e clique em <strong>Buscar propostas</strong> para carregar consultas ativas.
                    </td>
                  </tr>
                )}

                {!loading && hasSearched && filteredConsults.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      Nenhuma consulta ativa ou já existente encontrada para o período informado.
                    </td>
                  </tr>
                )}
                {filteredConsults.map((consult) => (
                  <tr key={consult.consultId || `${consult.documentNumber}-${consult.createdAt}`} className="border-t align-top">
                    <td className="px-3 py-2">
                      <Badge variant="outline">{consult.status || '—'}</Badge>
                    </td>
                    <td className="px-3 py-2">{consult.name || '—'}</td>
                    <td className="px-3 py-2 font-mono">{formatCpf(consult.documentNumber)}</td>
                    <td className="px-3 py-2">{consult.title || '—'}</td>
                    <td className="px-3 py-2 whitespace-pre-line">{consult.detail || '—'}</td>
                    <td className="px-3 py-2">{formatDateTime(consult.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) setSelectedOperation(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da operação</DialogTitle>
            <DialogDescription>
              Visualização simples da proposta retornada pela V8.
            </DialogDescription>
          </DialogHeader>

          {detailLoading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando detalhes...
            </div>
          )}

          {!detailLoading && selectedOperation && (
            <div className="space-y-6 text-sm">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-medium">{selectedOperation.status || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Contrato</p>
                  <p className="font-medium">{selectedOperation.contract_number || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Nome</p>
                  <p className="font-medium">{selectedOperation.borrower?.name || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">CPF</p>
                  <p className="font-medium font-mono">{formatCpf(selectedOperation.document_number)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Valor bruto</p>
                  <p className="font-medium">{formatCurrency(selectedOperation.operation_data?.issue_amount)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Valor líquido</p>
                  <p className="font-medium">{formatCurrency(selectedOperation.operation_data?.disbursed_issue_amount)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Parcela</p>
                  <p className="font-medium">{formatCurrency(selectedOperation.operation_data?.installment_face_value)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Parcelas</p>
                  <p className="font-medium">{selectedOperation.operation_data?.number_of_installments ?? '—'}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-medium">Histórico da operação</p>
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left">Ação</th>
                        <th className="px-3 py-2 text-left">Descrição</th>
                        <th className="px-3 py-2 text-left">Motivo</th>
                        <th className="px-3 py-2 text-left">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedOperation.operation_history || []).length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">
                            Sem histórico detalhado retornado pela V8.
                          </td>
                        </tr>
                      )}
                      {(selectedOperation.operation_history || []).map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="px-3 py-2">{item.action || '—'}</td>
                          <td className="px-3 py-2">{item.description || '—'}</td>
                          <td className="px-3 py-2">{item.reason || '—'}</td>
                          <td className="px-3 py-2">{formatDateTime(item.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}