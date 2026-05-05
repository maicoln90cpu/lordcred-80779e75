import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EyeOff, Menu, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";

export type RoleScope = "none" | "menu_only" | "full";

interface RoleScopeSelectorProps {
  value: RoleScope;
  onChange: (next: RoleScope) => void;
  disabled?: boolean;
}

// Estilos sólidos por scope quando ATIVO; cinza fraco quando inativo.
// Usamos <button> puro para evitar herdar `hover:bg-muted` e
// `data-[state=on]:bg-accent` do `toggleVariants` do shadcn — esse era o
// motivo das cores aparecerem só no hover anteriormente.
const ACTIVE_STYLES: Record<RoleScope, string> = {
  none: "bg-slate-500 text-white border-slate-600 shadow-sm dark:bg-slate-600",
  menu_only: "bg-blue-500 text-white border-blue-600 shadow-sm dark:bg-blue-600",
  full: "bg-emerald-500 text-white border-emerald-600 shadow-sm dark:bg-emerald-600",
};

const HOVER_HINT: Record<RoleScope, string> = {
  none: "hover:text-slate-500",
  menu_only: "hover:text-blue-500",
  full: "hover:text-emerald-500",
};

const OPTIONS: { value: RoleScope; tip: string; Icon: typeof EyeOff }[] = [
  { value: "none", tip: "Sem acesso (não vê o menu nem a página)", Icon: EyeOff },
  { value: "menu_only", tip: "Só vê o menu e os próprios dados (não vê dados de outros)", Icon: Menu },
  { value: "full", tip: "Acesso total: vê e edita dados de todos", Icon: Unlock },
];

export function RoleScopeSelector({ value, onChange, disabled }: RoleScopeSelectorProps) {
  return (
    <div role="group" className="inline-flex items-center gap-0.5">
      {OPTIONS.map(({ value: v, tip, Icon }) => {
        const active = value === v;
        return (
          <Tooltip key={v}>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled={disabled}
                aria-pressed={active}
                aria-label={tip}
                onClick={() => !disabled && onChange(v)}
                className={cn(
                  "inline-flex items-center justify-center h-7 w-7 p-0 rounded-md border border-transparent transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:pointer-events-none disabled:opacity-50",
                  active
                    ? ACTIVE_STYLES[v]
                    : cn("text-muted-foreground/40 bg-transparent", HOVER_HINT[v]),
                )}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs max-w-[200px]">
              {tip}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
