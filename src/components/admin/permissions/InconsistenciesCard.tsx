import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { FEATURE_ROUTE_MAP, MASTER_FEATURE_TOGGLE_KEYS } from "@/lib/featureRouteMap";

interface Props {
  registeredFeatureKeys: string[]; // keys vindas de feature_permissions
  toggleKeys: string[]; // keys vindas de master_feature_toggles
}

/**
 * Card de auditoria visual que cruza:
 *  - feature_permissions  (registros no banco)
 *  - master_feature_toggles (registros no banco)
 *  - FEATURE_ROUTE_MAP (mapa rota↔feature do código)
 *  - MASTER_FEATURE_TOGGLE_KEYS (catálogo esperado no código)
 */
export function InconsistenciesCard({ registeredFeatureKeys, toggleKeys }: Props) {
  const registered = new Set(registeredFeatureKeys);
  const toggles = new Set(toggleKeys);
  const routes = new Set(Object.keys(FEATURE_ROUTE_MAP));
  const expected = new Set<string>([...MASTER_FEATURE_TOGGLE_KEYS]);

  // 1. Features no banco (permissions) sem rota no código
  const permsWithoutRoute = registeredFeatureKeys
    .filter((k) => !routes.has(k) && k !== "master_admin");

  // 2. Rotas no código sem registro em feature_permissions
  const routesWithoutPerm = Object.keys(FEATURE_ROUTE_MAP)
    .filter((k) => !registered.has(k) && k !== "master_admin");

  // 3. Features esperadas (catálogo) sem master_toggle cadastrado
  const expectedWithoutToggle = [...expected].filter((k) => !toggles.has(k));

  // 4. Master toggles "soltos" (existem no banco mas não estão no catálogo)
  const togglesWithoutCatalog = toggleKeys.filter((k) => !expected.has(k));

  const total =
    permsWithoutRoute.length +
    routesWithoutPerm.length +
    expectedWithoutToggle.length +
    togglesWithoutCatalog.length;

  if (total === 0) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="flex items-center gap-3 py-3 px-4 text-sm">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span className="font-medium text-green-700 dark:text-green-400">
            Auditoria OK — todas as funcionalidades estão sincronizadas com rotas e toggles.
          </span>
        </CardContent>
      </Card>
    );
  }

  const Section = ({ title, items }: { title: string; items: string[] }) =>
    items.length === 0 ? null : (
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground">
          {title} <span className="text-destructive">({items.length})</span>
        </p>
        <div className="flex flex-wrap gap-1">
          {items.map((k) => (
            <Badge key={k} variant="outline" className="text-[10px] font-mono">
              {k}
            </Badge>
          ))}
        </div>
      </div>
    );

  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardContent className="space-y-3 py-3 px-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <span className="font-semibold text-sm">
            Inconsistências detectadas ({total})
          </span>
        </div>
        <Section title="Permissões sem rota no código" items={permsWithoutRoute} />
        <Section title="Rotas sem registro em permissões" items={routesWithoutPerm} />
        <Section title="Features esperadas sem master toggle" items={expectedWithoutToggle} />
        <Section title="Toggles fora do catálogo" items={togglesWithoutCatalog} />
        <p className="text-[11px] text-muted-foreground pt-1">
          Inconsistências podem causar features abertas a todos por padrão (default-open) ou
          itens órfãos no menu. Corrija criando registros faltantes.
        </p>
      </CardContent>
    </Card>
  );
}
