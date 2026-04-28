import { useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, FileSearch, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useV8Operations, type V8OperationSummary } from '@/hooks/useV8Operations';
import { getV8OperationTone, getV8ToneClass, OPERATION_ROWS, V8StatusGlossary } from './V8StatusGlossary';

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

function DateField({ label, value, onChange }: { label: string; value: Date; onChange: (date: Date | undefined) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !value && 'text-muted-foreground')}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, 'dd/MM/yyyy') : <span>Selecione</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={onChange} initialFocus locale={ptBR} className={cn('p-3 pointer-events-auto')} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  return (
    <Badge variant="outline" className={getV8ToneClass(getV8OperationTone(status))}>
      {status || '—'}
    </Badge>
  );
}

function getStatusHint(status?: string | null) {
  return OPERATION_ROWS.find((row) => row.status === status);
}

export default function V8PropostasTab() {
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const { operations, loading, detailLoading, selectedOperation, setSelectedOperation, loadOperations, loadOperationDetail } = useV8Operations();

  const filteredOperations = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    if (!search) return operations;
    const digits = search.replace(/\D/g, '');
    return operations.filter((operation: V8OperationSummary) => {
      const name = String(operation.name || '').toLowerCase();
      const cpf = String(operation.documentNumber || '').replace(/\D/g, '');
      const contract = String(operation.contractNumber || '').toLowerCase();
      const status = String(operation.status || '').toLowerCase();
      return name.includes(search) || contract.includes(search) || status.includes(search) || (digits.length > 0 && cpf.includes(digits));
    });
  }, [operations, searchTerm]);

  async function handleSearch() {
    if (startDate > endDate) {
      toast.error('A data inicial não pode ser maior que a data final');
      return;
    }
    setHasSearched(true);
    const result = await loadOperations({ startDate: toRangeBoundary(startDate, 'start'), endDate: toRangeBoundary(endDate, 'end'), limit: 200, page: 1 });
    if (!result.success) {
      toast.error(result.error || 'Não foi possível consultar as propostas');
      return;
    }
    toast.success(`${result.total} proposta(s) carregada(s)`);
  }

  async function handleOpenDetails(operationId: string) {
    const result = await loadOperationDetail(operationId);
    if (!result.success) {
      toast.error(result.error || 'Não foi possível abrir os detalhes');
      return;
    }
    setDetailsOpen(true);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Propostas V8</span>
            <V8StatusGlossary />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <DateField label="Período inicial" value={startDate} onChange={(date) => date && setStartDate(date)} />
            <DateField label="Período final" value={endDate} onChange={(date) => date && setEndDate(date)} />
            <div className="space-y-2 md:col-span-2">
              <Label>Buscar por CPF, nome, contrato ou status</Label>
              <Input placeholder="Ex.: paid, Maria ou 12345678901" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSearch className="mr-2 h-4 w-4" />}
              Buscar propostas
            </Button>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Orientação</th>
                  <th className="px-3 py-2 text-left">Nome</th>
                  <th className="px-3 py-2 text-left">CPF</th>
                  <th className="px-3 py-2 text-right">Valor bruto</th>
                  <th className="px-3 py-2 text-right">Valor liberado</th>
                  <th className="px-3 py-2 text-left">Contrato</th>
                  <th className="px-3 py-2 text-left">Data</th>
                  <th className="px-3 py-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {!loading && !hasSearched && (
                  <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">Defina o período e clique em <strong>Buscar propostas</strong>.</td></tr>
                )}
                {!loading && hasSearched && filteredOperations.length === 0 && (
                  <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">Nenhuma proposta encontrada para o período informado.</td></tr>
                )}
                {filteredOperations.map((operation) => {
                  const hint = getStatusHint(operation.status);
                  return (
                    <tr key={operation.operationId} className="border-t align-top">
                      <td className="px-3 py-2"><StatusBadge status={operation.status} /></td>
                      <td className="px-3 py-2 max-w-[260px]"><span className="text-xs text-muted-foreground">{hint?.action || 'Verificar detalhes na V8.'}</span></td>
                      <td className="px-3 py-2">{operation.name || '—'}</td>
                      <td className="px-3 py-2 font-mono">{formatCpf(operation.documentNumber)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(operation.issueAmount)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(operation.disbursedIssueAmount)}</td>
                      <td className="px-3 py-2">{operation.contractNumber || '—'}</td>
                      <td className="px-3 py-2">{formatDateTime(operation.createdAt)}</td>
                      <td className="px-3 py-2 text-right"><Button variant="outline" size="sm" onClick={() => handleOpenDetails(operation.operationId)}>Ver detalhes</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={detailsOpen} onOpenChange={(open) => { setDetailsOpen(open); if (!open) setSelectedOperation(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da proposta</DialogTitle>
            <DialogDescription>Visualização simples da proposta retornada pela V8.</DialogDescription>
          </DialogHeader>
          {detailLoading && <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Carregando detalhes...</div>}
          {!detailLoading && selectedOperation && (
            <div className="space-y-6 text-sm">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1"><p className="text-muted-foreground">Status</p><StatusBadge status={selectedOperation.status} /></div>
                <div className="space-y-1"><p className="text-muted-foreground">Contrato</p><p className="font-medium">{selectedOperation.contract_number || '—'}</p></div>
                <div className="space-y-1"><p className="text-muted-foreground">Nome</p><p className="font-medium">{selectedOperation.borrower?.name || '—'}</p></div>
                <div className="space-y-1"><p className="text-muted-foreground">CPF</p><p className="font-medium font-mono">{formatCpf(selectedOperation.document_number)}</p></div>
                <div className="space-y-1"><p className="text-muted-foreground">Valor bruto</p><p className="font-medium">{formatCurrency(selectedOperation.operation_data?.issue_amount)}</p></div>
                <div className="space-y-1"><p className="text-muted-foreground">Valor líquido</p><p className="font-medium">{formatCurrency(selectedOperation.operation_data?.disbursed_issue_amount)}</p></div>
                <div className="space-y-1"><p className="text-muted-foreground">Parcela</p><p className="font-medium">{formatCurrency(selectedOperation.operation_data?.installment_face_value)}</p></div>
                <div className="space-y-1"><p className="text-muted-foreground">Parcelas</p><p className="font-medium">{selectedOperation.operation_data?.number_of_installments ?? '—'}</p></div>
              </div>
              <div className="space-y-2">
                <p className="font-medium">Histórico da operação</p>
                <div className="rounded-md border overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead className="bg-muted/50"><tr><th className="px-3 py-2 text-left">Ação</th><th className="px-3 py-2 text-left">Descrição</th><th className="px-3 py-2 text-left">Motivo</th><th className="px-3 py-2 text-left">Data</th></tr></thead><tbody>{(selectedOperation.operation_history || []).length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">Sem histórico detalhado retornado pela V8.</td></tr>}{(selectedOperation.operation_history || []).map((item) => <tr key={item.id} className="border-t"><td className="px-3 py-2">{item.action || '—'}</td><td className="px-3 py-2">{item.description || '—'}</td><td className="px-3 py-2">{item.reason || '—'}</td><td className="px-3 py-2">{formatDateTime(item.created_at)}</td></tr>)}</tbody></table></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
