import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sparkles, Upload, Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { parseSmartRates, type ParsedRate } from '@/lib/smartRateParser';

type RateTable =
  | 'commission_rates_fgts'
  | 'commission_rates_fgts_v2'
  | 'commission_rates_clt'
  | 'commission_rates_clt_v2';

interface Props {
  /** Target Supabase table to insert into. */
  tableName: RateTable;
  /** Called after successful insert so the parent can reload the list. */
  onInserted: () => void;
}

/**
 * Smart paste button for rate tables. Parses free-form Brazilian text like
 *   LOTUS 1+
 *   16,00%
 *   HUB Carta na Manga até 250,00
 *   2,75%
 * into structured rows with bank/table/term/value/insurance/rate.
 *
 * Inserts into the table provided by `tableName`. Older V1 tables that don't
 * have term/value/insurance columns receive only the supported subset.
 */
export default function SmartPasteRatesButton({ tableName, onInserted }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<ParsedRate[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const isFGTSv1 = tableName === 'commission_rates_fgts'; // legacy 3-column shape
  const isFGTSv2 = tableName === 'commission_rates_fgts_v2';
  const isCLT = tableName === 'commission_rates_clt' || tableName === 'commission_rates_clt_v2';

  const reparse = (raw: string) => {
    setText(raw);
    if (!raw.trim()) {
      setPreview([]);
      setWarnings([]);
      return;
    }
    const result = parseSmartRates(raw);
    setPreview(result.rates);
    setWarnings(result.warnings);
  };

  const buildPayload = () => {
    const today = new Date().toISOString().slice(0, 10);
    return preview.map(r => {
      if (isFGTSv1) {
        // legacy table only stores rate_no_insurance / rate_with_insurance
        return {
          effective_date: today,
          bank: r.bank,
          rate_no_insurance: r.has_insurance ? 0 : r.rate,
          rate_with_insurance: r.has_insurance ? r.rate : 0,
        };
      }
      if (isCLT) {
        return {
          effective_date: today,
          bank: r.bank,
          table_key: r.table_key,
          term_min: r.term_min,
          term_max: r.term_max,
          has_insurance: r.has_insurance,
          rate: r.rate,
          obs: r.obs,
        };
      }
      // FGTS v2 (full multi-variable)
      return {
        effective_date: today,
        bank: r.bank,
        table_key: r.table_key,
        term_min: r.term_min,
        term_max: r.term_max,
        min_value: r.min_value,
        max_value: r.max_value,
        has_insurance: r.has_insurance,
        rate: r.rate,
        obs: r.obs,
      };
    });
  };

  const handleConfirm = async () => {
    if (preview.length === 0) return;
    setSaving(true);
    const payload = buildPayload();
    const { error } = await supabase.from(tableName).insert(payload as any);
    if (error) {
      toast({ title: 'Erro ao importar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${preview.length} taxas importadas` });
      setOpen(false);
      setText('');
      setPreview([]);
      setWarnings([]);
      onInserted();
    }
    setSaving(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Sparkles className="w-4 h-4 mr-1" /> Colar Inteligente
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Colar Taxas (parser inteligente)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Cole o texto livre no formato <strong>linha do nome</strong> + <strong>linha da %</strong>. Exemplo:</p>
              <pre className="bg-muted/50 rounded p-2 text-[11px] leading-relaxed">{`LOTUS 1+
16,00%
HUB Carta na Manga até 250,00
2,75%
FACTA FGTS GOLD PLUS 2 anos
6,35%
PARANA com seguro 3 anos
7,10%`}</pre>
            </div>

            <div>
              <Label>Texto colado</Label>
              <Textarea
                value={text}
                onChange={e => reparse(e.target.value)}
                placeholder="Cole aqui as taxas em texto livre…"
                className="min-h-[140px] font-mono text-xs"
              />
            </div>

            {warnings.length > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-warning-foreground">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>{warnings.join(' • ')}</div>
              </div>
            )}

            {preview.length > 0 && (
              <div className="border rounded-md p-2 bg-muted/30">
                <p className="text-xs font-medium mb-2">
                  Pré-visualização: {preview.length} taxa(s) detectada(s) — vigência: hoje
                </p>
                <div className="max-h-64 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs p-1">Banco</TableHead>
                        {!isFGTSv1 && <TableHead className="text-xs p-1">Tabela</TableHead>}
                        {!isFGTSv1 && <TableHead className="text-xs p-1">Prazo</TableHead>}
                        {isFGTSv2 && <TableHead className="text-xs p-1">Faixa Valor</TableHead>}
                        {!isFGTSv1 && <TableHead className="text-xs p-1">Seguro</TableHead>}
                        <TableHead className="text-xs p-1 text-right">Taxa</TableHead>
                        <TableHead className="text-xs p-1 text-muted-foreground">Origem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="p-1 font-medium">{r.bank}</TableCell>
                          {!isFGTSv1 && <TableCell className="p-1 text-xs">{r.table_key || '-'}</TableCell>}
                          {!isFGTSv1 && (
                            <TableCell className="p-1 text-xs">
                              {r.term_min === r.term_max && r.term_min > 0 ? `${r.term_min}` : `${r.term_min}-${r.term_max}`}
                            </TableCell>
                          )}
                          {isFGTSv2 && (
                            <TableCell className="p-1 text-xs">
                              {r.max_value >= 999999999
                                ? r.min_value > 0
                                  ? `>${r.min_value}`
                                  : '-'
                                : `${r.min_value}-${r.max_value}`}
                            </TableCell>
                          )}
                          {!isFGTSv1 && <TableCell className="p-1 text-xs">{r.has_insurance ? 'Sim' : 'Não'}</TableCell>}
                          <TableCell className="p-1 text-right font-medium">{r.rate}%</TableCell>
                          <TableCell className="p-1 text-[11px] text-muted-foreground italic truncate max-w-[200px]">{r.source}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={preview.length === 0 || saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
              Importar {preview.length} taxa(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
