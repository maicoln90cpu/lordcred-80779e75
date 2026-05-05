import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EyeOff, Menu, Unlock } from "lucide-react";

export type RoleScope = "none" | "menu_only" | "full";

interface RoleScopeSelectorProps {
  value: RoleScope;
  onChange: (next: RoleScope) => void;
  disabled?: boolean;
}

// Cores semânticas por scope — visual claro de relance.
// none = cinza (apagado), menu_only = âmbar (parcial), full = verde (liberado)
const SCOPE_STYLES: Record<RoleScope, string> = {
  none:
    "data-[state=on]:bg-muted data-[state=on]:text-muted-foreground data-[state=on]:border data-[state=on]:border-border",
  menu_only:
    "data-[state=on]:bg-amber-500/20 data-[state=on]:text-amber-600 dark:data-[state=on]:text-amber-400 data-[state=on]:border data-[state=on]:border-amber-500/60",
  full:
    "data-[state=on]:bg-emerald-500/20 data-[state=on]:text-emerald-600 dark:data-[state=on]:text-emerald-400 data-[state=on]:border data-[state=on]:border-emerald-500/60",
};

const OPTIONS: { value: RoleScope; label: string; tip: string; Icon: typeof EyeOff }[] = [
  { value: "none", label: "Sem", tip: "Sem acesso (não vê o menu nem a página)", Icon: EyeOff },
  { value: "menu_only", label: "Menu", tip: "Só vê o menu e os próprios dados (não vê dados de outros)", Icon: Menu },
  { value: "full", label: "Total", tip: "Acesso total: vê e edita dados de todos", Icon: Unlock },
];

export function RoleScopeSelector({ value, onChange, disabled }: RoleScopeSelectorProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => {
        if (!v) return;
        onChange(v as RoleScope);
      }}
      disabled={disabled}
      className="gap-0.5"
    >
      {OPTIONS.map(({ value: v, tip, Icon }) => (
        <Tooltip key={v}>
          <TooltipTrigger asChild>
            <ToggleGroupItem
              value={v}
              size="sm"
              aria-label={tip}
              className={`h-7 w-7 p-0 transition-colors ${SCOPE_STYLES[v]}`}
            >
              <Icon className="w-3.5 h-3.5" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs max-w-[200px]">
            {tip}
          </TooltipContent>
        </Tooltip>
      ))}
    </ToggleGroup>
  );
}
