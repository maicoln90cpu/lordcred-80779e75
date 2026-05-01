/**
 * Per-variable selector for Meta template variables in broadcasts.
 * Lets the user choose a fixed text OR a lead field (auto-mapped per recipient).
 */
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export type VarBinding =
  | { kind: 'text'; value: string }
  | { kind: 'lead_field'; field: string };

export const LEAD_FIELDS: { value: string; label: string }[] = [
  { value: 'nome', label: 'Nome do lead' },
  { value: 'cpf', label: 'CPF' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'banco', label: 'Banco' },
  { value: 'perfil', label: 'Perfil' },
  { value: 'status', label: 'Status' },
];

interface Props {
  label: string;             // e.g. "Body {{1}}"
  binding: VarBinding;
  onChange: (b: VarBinding) => void;
  disableLeadFields?: boolean; // true when source is not 'leads'
}

export default function MetaTemplateVarBinding({ label, binding, onChange, disableLeadFields }: Props) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs text-muted-foreground w-20 shrink-0">{label}</Label>

      <Select
        value={binding.kind === 'text' ? '__text__' : binding.field}
        onValueChange={(v) => {
          if (v === '__text__') onChange({ kind: 'text', value: binding.kind === 'text' ? binding.value : '' });
          else onChange({ kind: 'lead_field', field: v });
        }}
      >
        <SelectTrigger className="h-8 text-xs w-[160px] shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__text__">📝 Texto fixo</SelectItem>
          {LEAD_FIELDS.map(f => (
            <SelectItem key={f.value} value={f.value} disabled={disableLeadFields}>
              👤 {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {binding.kind === 'text' ? (
        <Input
          value={binding.value}
          onChange={(e) => onChange({ kind: 'text', value: e.target.value })}
          placeholder="Mesmo valor para todos"
          className="h-8 text-sm"
        />
      ) : (
        <Badge variant="secondary" className="h-8 px-3 flex items-center text-xs">
          Personalizado por lead → <span className="font-mono ml-1">{binding.field}</span>
        </Badge>
      )}
    </div>
  );
}

/**
 * Convert a binding map to the JSONB component parameters stored in
 * broadcast_campaigns.meta_template_components.
 * The keys are sorted (e.g. {{1}}, {{2}}) to keep stable ordering.
 */
export function bindingsToParameters(bindings: Record<string, VarBinding>): any[] {
  return Object.keys(bindings)
    .sort()
    .map(k => {
      const b = bindings[k];
      if (b.kind === 'lead_field') return { type: 'lead_field', field: b.field };
      return { type: 'text', text: b.value };
    });
}

/** Inverse of bindingsToParameters — for editing existing campaigns (future use). */
export function parametersToBindings(keys: string[], params: any[] | undefined): Record<string, VarBinding> {
  const out: Record<string, VarBinding> = {};
  const sorted = [...keys].sort();
  sorted.forEach((k, i) => {
    const p = params?.[i];
    if (p?.type === 'lead_field') out[k] = { kind: 'lead_field', field: String(p.field || 'nome') };
    else out[k] = { kind: 'text', value: String(p?.text ?? '') };
  });
  return out;
}
