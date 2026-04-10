import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FieldProps {
  label: string;
  field: string;
  value: any;
  onChange: (field: string, value: any) => void;
  placeholder?: string;
  type?: string;
  colSpan?: boolean;
  required?: boolean;
  error?: string;
}

export function PartnerField({ label, field, value, onChange, placeholder, type = 'text', colSpan = false, required, error }: FieldProps) {
  return (
    <div className={colSpan ? 'col-span-2' : ''}>
      <Label className="text-xs text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Input
        type={type}
        value={value ?? ''}
        onChange={e => onChange(field, e.target.value || null)}
        placeholder={placeholder}
        className={`mt-1 ${error ? 'border-destructive' : ''}`}
      />
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  field: string;
  value: any;
  onChange: (field: string, value: any) => void;
  options: { value: string; label: string }[];
  required?: boolean;
}

export function PartnerSelectField({ label, field, value, onChange, options, required }: SelectFieldProps) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Select value={value ?? ''} onValueChange={v => onChange(field, v)}>
        <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
