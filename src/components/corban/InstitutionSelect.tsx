import { useState, useEffect, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface Bank {
  asset_id: string;
  asset_label: string;
}

interface InstitutionSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function InstitutionSelect({ value, onChange, className }: InstitutionSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('corban_assets_cache')
        .select('asset_id, asset_label')
        .eq('asset_type', 'bancos')
        .order('asset_label');
      setBanks(data || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return banks;
    const s = search.toLowerCase();
    return banks.filter(b =>
      b.asset_label.toLowerCase().includes(s) ||
      b.asset_id.toLowerCase().includes(s)
    );
  }, [banks, search]);

  const selectedLabel = banks.find(b => b.asset_id === value)?.asset_label || value || 'Selecionar banco';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between font-normal", className)}
        >
          <span className="truncate text-sm">{selectedLabel}</span>
          {loading ? (
            <Loader2 className="ml-2 h-3.5 w-3.5 shrink-0 animate-spin" />
          ) : (
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <div className="p-2 border-b">
          <Input
            placeholder="Buscar banco..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <ScrollArea className="h-[240px]">
          <div className="p-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                {loading ? 'Carregando...' : 'Nenhum banco encontrado'}
              </p>
            ) : (
              filtered.map(b => (
                <button
                  key={b.asset_id}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent text-left",
                    value === b.asset_id && "bg-accent"
                  )}
                  onClick={() => { onChange(b.asset_id); setOpen(false); setSearch(''); }}
                >
                  <Check className={cn("h-3.5 w-3.5 shrink-0", value === b.asset_id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{b.asset_label}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{b.asset_id}</span>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
        <div className="border-t px-2 py-1.5">
          <p className="text-[10px] text-muted-foreground">
            {banks.length} bancos disponíveis · API exige busca por banco
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
