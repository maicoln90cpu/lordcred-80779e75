import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Database, Download } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Recebe o texto formatado (1 cliente por linha) pronto para colar no textarea. */
  onLoad: (text: string, count: number) => void;
}

type FilterPreset = 'never' | 'failed' | 'high_margin' | 'all_unblocked';

const PRESETS: { value: FilterPreset; label: string; help: string }[] = [
  { value: 'never', label: 'Nunca simulados', help: 'Contatos que ainda não passaram pela V8.' },
  { value: 'failed', label: 'Falha anterior', help: 'Última simulação resultou em failed/error.' },
  { value: 'high_margin', label: 'Por margem disponível', help: 'Já simulados com margem ≥ valor mínimo.' },
  { value: 'all_unblocked', label: 'Todos não bloqueados', help: 'Qualquer contato ativo do pool (cuidado).' },
];

export default function V8LoadFromPoolDialog({ open, onOpenChange, onLoad }: Props) {
  const [preset, setPreset] = useState<FilterPreset>('never');
  const [limit, setLimit] = useState(100);
  const [minMargin, setMinMargin] = useState('');
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const [loading, setLoading] = useState(false);

  function buildQuery(forCount: boolean) {
    let q = supabase
      .from('v8_contact_pool')
      .select(forCount ? 'id' : 'cpf, full_name, phone, birth_date', { count: 'exact', head: forCount })
      .eq('is_blocked', false);

    if (preset === 'never') {
      q = q.is('last_simulated_at', null);
    } else if (preset === 'failed') {
      q = q.in('last_simulation_status', ['failed', 'error']);
    } else if (preset === 'high_margin') {
      const min = Number(minMargin.replace(',', '.')) || 0;
      q = q.gte('last_available_margin', min);
    }

    return q;
  }

  // Conta matches sempre que muda o filtro
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setCounting(true);
      try {
        const { count, error } = await buildQuery(true);
        if (!cancelled && !error) setMatchCount(count || 0);
      } finally {
        if (!cancelled) setCounting(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preset, minMargin]);

  function formatBirth(b: string | null): string {
    if (!b) return '';
    // YYYY-MM-DD → DD/MM/YYYY
    const [y, m, d] = b.split('-');
    if (!y || !m || !d) return '';
    return `${d}/${m}/${y}`;
  }

  async function handleLoad() {
    setLoading(true);
    try {
      const q = buildQuery(false).order('imported_at', { ascending: true }).limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data || []) as any[];
      if (rows.length === 0) {
        toast.error('Nenhum contato encontrado com esse filtro');
        return;
      }

      // Formato: CPF NOME DD/MM/YYYY TELEFONE  (1 por linha)
      const lines = rows.map(r => {
        const cpf = String(r.cpf).replace(/\D/g, '');
        const parts = [cpf];
        if (r.full_name) parts.push(r.full_name);
        const dob = formatBirth(r.birth_date);
        if (dob) parts.push(dob);
        if (r.phone) parts.push(r.phone);
        return parts.join(' ');
      });

      onLoad(lines.join('\n'), rows.length);
      toast.success(`${rows.length} contatos carregados do pool`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  const showMargin = preset === 'high_margin';
  const presetMeta = PRESETS.find(p => p.value === preset)!;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" /> Carregar contatos do Pool
          </DialogTitle>
          <DialogDescription>
            Puxa contatos da base mestra (Pool de Contatos) direto para o campo de simulação. Aplica o filtro escolhido e respeita o limite.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Filtro</Label>
            <Select value={preset} onValueChange={(v) => setPreset(v as FilterPreset)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRESETS.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">{presetMeta.help}</p>
          </div>

          {showMargin && (
            <div>
              <Label>Margem mínima (R$)</Label>
              <Input
                inputMode="decimal"
                placeholder="Ex.: 100,00"
                value={minMargin}
                onChange={(e) => setMinMargin(e.target.value)}
              />
            </div>
          )}

          <div>
            <Label>Quantidade a carregar</Label>
            <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[50, 100, 200, 500, 1000, 2000].map(n => (
                  <SelectItem key={n} value={String(n)}>{n.toLocaleString('pt-BR')} contatos</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Ordem: mais antigos primeiro (FIFO).</p>
          </div>

          <div className="rounded-lg bg-muted/40 p-3 text-sm">
            {counting ? (
              <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Contando...</span>
            ) : matchCount === null ? null : (
              <>
                <strong>{matchCount.toLocaleString('pt-BR')}</strong> contatos disponíveis com esse filtro.
                {matchCount > limit && (
                  <span className="text-amber-600 dark:text-amber-400 ml-1">
                    Apenas os primeiros {limit.toLocaleString('pt-BR')} serão carregados.
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleLoad} disabled={loading || matchCount === 0} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Carregar para o lote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
