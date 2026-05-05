import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { FEATURE_ROUTE_MAP } from "@/lib/featureRouteMap";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Shield, Save, Loader2, Users, Search, UserCog, HelpCircle, AlertTriangle, Power, PowerOff, Lock, Link2, EyeOff, Menu, Unlock } from "lucide-react";
import { RoleScopeSelector, type RoleScope } from "@/components/admin/permissions/RoleScopeSelector";
import { InconsistenciesCard } from "@/components/admin/permissions/InconsistenciesCard";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Features marcadas como sensíveis — exibem badge ⚠️ e exigem confirmação ao liberar para Vendedor
const SENSITIVE_FEATURES = new Set([
  "bank_credentials",
  "commission_reports",
  "audit_logs",
  "commissions",
  "commissions_v2",
  "permissions",
  "master_admin",
]);

const FEATURE_DESCRIPTIONS: Record<string, string> = {
  dashboard: "Painel de aquecimento com métricas de chips",
  chips: "Gerenciamento dos chips WhatsApp do usuário",
  users: "Cadastro e gestão de usuários do sistema",
  leads: "Gerenciamento de leads e clientes",
  performance: "Relatórios de performance da equipe",
  kanban: "Quadro Kanban de acompanhamento de conversas",
  product_info: "Informações sobre produtos disponíveis",
  commissions: "Comissões de parceiros (pagáveis)",
  commission_reports: "Auditoria de comissões recebidas vs esperadas",
  chip_monitor: "Monitoramento em tempo real de todos os chips",
  queue: "Fila de mensagens pendentes",
  webhooks: "Diagnóstico de webhooks recebidos",
  templates: "Templates de mensagens WhatsApp",
  quick_replies: "Notas rápidas e atalhos de mensagem",
  tickets: "Sistema de tickets de suporte",
  internal_chat: "Chat interno entre usuários do sistema",
  links: "Links úteis compartilhados na equipe",
  remote_assistance: "Assistência remota a usuários",
  audit_logs: "Logs de auditoria do sistema",
  permissions: "Gerenciamento de permissões (esta página)",
  corban_dashboard: "Dashboard geral da integração Corban",
  corban_propostas: "Consulta de propostas na NewCorban",
  corban_fgts: "Gestão da fila FGTS administrativa",
  corban_assets: "Assets e tabelas da NewCorban em cache",
  corban_config: "Configuração de visibilidade Corban por papel",
  seller_propostas: "Minhas propostas (visão vendedor)",
  seller_fgts: "Consulta FGTS (visão vendedor)",
  whatsapp: "Acesso ao CRM WhatsApp",
  settings_warming: "Configurações de aquecimento de chips",
  warming_reports: "Relatórios de aquecimento",
  master_admin: "Painel Master com SQL e exportação",
  bank_credentials: "Credenciais de acesso aos bancos parceiros",
  partners: "CRM de gestão de parceiros comerciais",
  contract_template: "Template global de contratos de parceiros",
  broadcasts: "Disparos em massa de mensagens WhatsApp",
  commissions_v2: "Comissões de parceiros (versão 2 — sandbox)",
  v8_simulador: "Simulador V8 CLT para cálculo de propostas",
  integrations: "Configurações de integrações WhatsApp (UazAPI / Meta)",
  hr: "RH/Recrutamento — gestão de candidatos, funcionários e entrevistas",
};

interface FeaturePermission {
  id: string;
  feature_key: string;
  feature_label: string;
  feature_group: string;
  allowed_user_ids: string[];
  allowed_roles: string[];
  role_scopes: Record<string, RoleScope>;
}

interface Profile {
  user_id: string;
  name: string | null;
  email: string;
  role: string;
}

const ROLE_OPTIONS = [
  { value: "seller", label: "Vendedor" },
  { value: "support", label: "Suporte" },
  { value: "manager", label: "Gerente" },
];

interface MasterToggle {
  id: string;
  feature_key: string;
  is_enabled: boolean;
}

export default function Permissions() {
  const { toast } = useToast();
  const { isMaster } = useAuth();
  const [features, setFeatures] = useState<FeaturePermission[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [masterToggles, setMasterToggles] = useState<Record<string, MasterToggle>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [searchUser, setSearchUser] = useState("");
  const [pendingSellerConfirm, setPendingSellerConfirm] = useState<{ featureId: string; featureLabel: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [featRes, profRes, rolesRes, togglesRes] = await Promise.all([
      supabase.from("feature_permissions").select("*").order("feature_group").order("feature_label"),
      supabase.rpc("get_visible_profiles"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("master_feature_toggles").select("id, feature_key, is_enabled"),
    ]);

    if (togglesRes.data) {
      const map: Record<string, MasterToggle> = {};
      (togglesRes.data as MasterToggle[]).forEach((t) => (map[t.feature_key] = t));
      setMasterToggles(map);
    }

    if (featRes.data) {
      const mapped = featRes.data.map((f) => ({
        ...f,
        allowed_user_ids: (f as any).allowed_user_ids || [],
        allowed_roles: (f as any).allowed_roles || [],
        role_scopes: ((f as any).role_scopes || {}) as Record<string, RoleScope>,
      }));
      setFeatures(mapped as FeaturePermission[]);

      // Validador dev: alerta se houver feature_key em FEATURE_ROUTE_MAP sem registro em feature_permissions
      if (import.meta.env.DEV) {
        const registered = new Set(mapped.map((f) => f.feature_key));
        const missing = Object.keys(FEATURE_ROUTE_MAP).filter(
          (k) => !registered.has(k) && k !== "master_admin",
        );
        if (missing.length > 0) {
          // eslint-disable-next-line no-console
          console.warn("[Permissions] feature_keys sem registro em feature_permissions:", missing);
        }
      }
    }

    const rolesMap: Record<string, string> = {};
    (rolesRes.data || []).forEach((r) => {
      rolesMap[r.user_id] = r.role;
    });

    if (profRes.data) {
      setProfiles((profRes.data as any[]).map((p) => ({ ...p, role: rolesMap[p.user_id] || "seller" })));
    }
    setLoading(false);
  };

  // === Role-based scope (none/menu_only/full) ===
  const applyRoleScope = (featureId: string, role: string, scope: RoleScope) => {
    setFeatures((prev) =>
      prev.map((f) => {
        if (f.id !== featureId) return f;
        const next = { ...f.role_scopes };
        if (scope === "none") {
          delete next[role];
        } else {
          next[role] = scope;
        }
        // Manter allowed_roles em sincronia (legado): role está em allowed_roles se scope != none
        const allowed_roles = scope === "none"
          ? f.allowed_roles.filter((r) => r !== role)
          : Array.from(new Set([...f.allowed_roles, role]));
        return { ...f, role_scopes: next, allowed_roles };
      }),
    );
    setDirty((prev) => new Set(prev).add(featureId));
  };

  const setRoleScope = (featureId: string, role: string, scope: RoleScope) => {
    const feature = features.find((f) => f.id === featureId);
    if (!feature) return;
    const isElevating = scope === "full" && feature.role_scopes[role] !== "full";
    // Confirmação obrigatória ao liberar Vendedor (full) em features sensíveis
    if (role === "seller" && isElevating && SENSITIVE_FEATURES.has(feature.feature_key)) {
      setPendingSellerConfirm({ featureId, featureLabel: feature.feature_label });
      return;
    }
    applyRoleScope(featureId, role, scope);
  };

  // === Master toggle (global) ===
  const toggleMasterFeature = async (featureKey: string, enabled: boolean) => {
    const toggle = masterToggles[featureKey];
    if (!toggle) {
      toast({ title: "Toggle Master não encontrado", description: featureKey, variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("master_feature_toggles")
      .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
      .eq("id", toggle.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setMasterToggles((prev) => ({ ...prev, [featureKey]: { ...toggle, is_enabled: enabled } }));
    toast({ title: enabled ? "Módulo ativado globalmente" : "Módulo ocultado globalmente" });
  };

  const toggleAllRolesForGroup = (groupFeatures: FeaturePermission[], role: string, checked: boolean) => {
    setFeatures((prev) =>
      prev.map((f) => {
        if (!groupFeatures.find((gf) => gf.id === f.id)) return f;
        const roles = checked ? [...new Set([...f.allowed_roles, role])] : f.allowed_roles.filter((r) => r !== role);
        const next = { ...f.role_scopes };
        if (checked) next[role] = "full"; else delete next[role];
        return { ...f, allowed_roles: roles, role_scopes: next };
      }),
    );
    groupFeatures.forEach((f) => setDirty((prev) => new Set(prev).add(f.id)));
  };

  // === User-based toggles ===
  const toggleUser = (featureId: string, userId: string) => {
    setFeatures((prev) =>
      prev.map((f) => {
        if (f.id !== featureId) return f;
        const ids = f.allowed_user_ids.includes(userId)
          ? f.allowed_user_ids.filter((id) => id !== userId)
          : [...f.allowed_user_ids, userId];
        return { ...f, allowed_user_ids: ids };
      }),
    );
    setDirty((prev) => new Set(prev).add(featureId));
  };

  const toggleAllUsersForFeature = (featureId: string, userIds: string[], checked: boolean) => {
    setFeatures((prev) =>
      prev.map((f) => {
        if (f.id !== featureId) return f;
        const current = new Set(f.allowed_user_ids);
        userIds.forEach((id) => (checked ? current.add(id) : current.delete(id)));
        return { ...f, allowed_user_ids: Array.from(current) };
      }),
    );
    setDirty((prev) => new Set(prev).add(featureId));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const dirtyFeatures = features.filter((f) => dirty.has(f.id));
      for (const f of dirtyFeatures) {
        const { error } = await supabase
          .from("feature_permissions")
          .update({
            allowed_user_ids: f.allowed_user_ids,
            allowed_roles: f.allowed_roles,
            role_scopes: f.role_scopes,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", f.id);
        if (error) throw error;
      }
      toast({ title: "Permissões salvas", description: `${dirtyFeatures.length} funcionalidade(s) atualizada(s)` });
      setDirty(new Set());
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "master":
        return "Master";
      case "admin":
        return "Admin";
      case "manager":
        return "Gerente";
      case "support":
        return "Suporte";
      default:
        return "Vendedor";
    }
  };

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "outline" | "destructive" => {
    switch (role) {
      case "master":
        return "destructive";
      case "admin":
        return "default";
      case "manager":
        return "default";
      case "support":
        return "secondary";
      default:
        return "outline";
    }
  };

  // Filter out master_admin from all views
  const editableFeatures = features.filter((f) => f.feature_key !== "master_admin");

  const groups = editableFeatures.reduce<Record<string, FeaturePermission[]>>((acc, f) => {
    (acc[f.feature_group] = acc[f.feature_group] || []).push(f);
    return acc;
  }, {});

  const filteredProfiles = profiles.filter((p) => {
    if (!searchUser) return true;
    const s = searchUser.toLowerCase();
    return p.name?.toLowerCase().includes(s) || p.email.toLowerCase().includes(s);
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando permissões...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Permissões do Sistema</h1>
              <p className="text-sm text-muted-foreground">
                {features.length} funcionalidades mapeadas · {profiles.length} usuários
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving || dirty.size === 0}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar ({dirty.size} alteração{dirty.size !== 1 ? "s" : ""})
          </Button>
        </div>

        <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground space-y-2">
          <p><strong>✅ Enforcement ativo:</strong> Itens do menu lateral e rotas são bloqueados automaticamente. Admin sempre têm acesso total. Gerente tem acesso total exceto esta página.</p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium">Legenda:</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-border bg-muted text-muted-foreground">
              <EyeOff className="w-3 h-3" /> Sem acesso (oculta)
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-amber-500/60 bg-amber-500/15 text-amber-700 dark:text-amber-400">
              <Menu className="w-3 h-3" /> Só menu (próprios dados)
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-emerald-500/60 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
              <Unlock className="w-3 h-3" /> Acesso total (todos os dados)
            </span>
          </div>
        </div>

        <InconsistenciesCard
          registeredFeatureKeys={features.map((f) => f.feature_key)}
          toggleKeys={Object.keys(masterToggles)}
        />

        <TooltipProvider delayDuration={300}>
          <Tabs defaultValue="by-role">
            <TabsList>
              <TabsTrigger value="by-role" className="gap-2">
                <UserCog className="w-4 h-4" />
                Por Cargo
              </TabsTrigger>
              <TabsTrigger value="by-user" className="gap-2">
                <Users className="w-4 h-4" />
                Por Usuário
              </TabsTrigger>
            </TabsList>

            {/* === TAB: Por Cargo === */}
            <TabsContent value="by-role" className="space-y-3 mt-4">
              <Accordion type="multiple" defaultValue={Object.keys(groups)} className="space-y-2">
                {Object.entries(groups).map(([groupName, groupFeatures]) => (
                  <AccordionItem key={groupName} value={groupName} className="border rounded-lg overflow-hidden">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline bg-card">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{groupName}</span>
                        <Badge variant="secondary" className="text-xs">
                          {groupFeatures.length}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-0">
                      {/* Column header with toggle-all per role */}
                      <div className="grid grid-cols-[1fr_130px_120px_120px_120px] gap-2 px-4 py-2 bg-muted/50 border-b text-xs font-semibold text-muted-foreground">
                        <span>Funcionalidade · rota</span>
                        <span className="text-center inline-flex items-center justify-center gap-1">
                          Ativo no sistema
                          {!isMaster && <Lock className="w-3 h-3 text-muted-foreground/60" />}
                        </span>
                        {ROLE_OPTIONS.map((role) => {
                          const allFull = groupFeatures.every((f) => f.role_scopes[role.value] === "full");
                          return (
                            <button
                              key={role.value}
                              className="text-center hover:text-foreground transition-colors"
                              onClick={() => toggleAllRolesForGroup(groupFeatures, role.value, !allFull)}
                            >
                              {role.label}
                              <span className="block text-[10px] text-muted-foreground">
                                {allFull ? "(remover total)" : "(liberar total)"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {groupFeatures.map((feature) => {
                        const masterToggle = masterToggles[feature.feature_key];
                        const masterEnabled = masterToggle ? masterToggle.is_enabled : true;
                        const isSensitive = SENSITIVE_FEATURES.has(feature.feature_key);
                        const route = FEATURE_ROUTE_MAP[feature.feature_key]?.[0];
                        return (
                          <div
                            key={feature.id}
                            className={`grid grid-cols-[1fr_130px_120px_120px_120px] gap-2 px-4 py-2.5 border-t items-center ${!masterEnabled ? "opacity-60" : ""}`}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{feature.feature_label}</span>
                              {route ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-mono px-1.5 py-0.5 rounded bg-muted">
                                      <Link2 className="w-2.5 h-2.5" />
                                      {route}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    Rota destino mapeada para esta funcionalidade
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                  sem rota
                                </Badge>
                              )}
                              {isSensitive && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] px-1.5 py-0 border-destructive/50 text-destructive gap-1"
                                    >
                                      <AlertTriangle className="w-3 h-3" />
                                      Sensível
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Funcionalidade sensível. Liberar para Vendedor exige confirmação.
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {FEATURE_DESCRIPTIONS[feature.feature_key] && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help shrink-0" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    {FEATURE_DESCRIPTIONS[feature.feature_key]}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {dirty.has(feature.id) && (
                                <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                  alterado
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-col items-center gap-0.5">
                              {masterToggle ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex flex-col items-center gap-0.5">
                                      <Switch
                                        checked={masterEnabled}
                                        onCheckedChange={(c) => toggleMasterFeature(feature.feature_key, c)}
                                        disabled={!isMaster}
                                      />
                                      <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                                        {masterEnabled ? (
                                          <><Power className="w-2.5 h-2.5 text-green-500" />ativo</>
                                        ) : (
                                          <><PowerOff className="w-2.5 h-2.5" />oculto</>
                                        )}
                                      </span>
                                    </div>
                                  </TooltipTrigger>
                                  {!isMaster && (
                                    <TooltipContent side="top" className="text-xs max-w-[220px]">
                                      Controle exclusivo do usuário Master. Admin/Gerente não podem alterar.
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">—</span>
                              )}
                            </div>
                            {ROLE_OPTIONS.map((role) => (
                              <div key={role.value} className="flex justify-center">
                                <RoleScopeSelector
                                  value={feature.role_scopes[role.value] || "none"}
                                  onChange={(scope) => setRoleScope(feature.id, role.value, scope)}
                                  disabled={!masterEnabled}
                                />
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </TabsContent>

            {/* === TAB: Por Usuário === */}
            <TabsContent value="by-user" className="space-y-3 mt-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar usuário..."
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Accordion type="multiple" defaultValue={Object.keys(groups)} className="space-y-2">
                {Object.entries(groups).map(([groupName, groupFeatures]) => (
                  <AccordionItem key={groupName} value={groupName} className="border rounded-lg overflow-hidden">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline bg-card">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{groupName}</span>
                        <Badge variant="secondary" className="text-xs">
                          {groupFeatures.length}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-0">
                      {groupFeatures.map((feature) => {
                        const allFilteredSelected =
                          filteredProfiles.length > 0 &&
                          filteredProfiles.every((p) => feature.allowed_user_ids.includes(p.user_id));
                        return (
                          <div key={feature.id} className="border-t">
                            <div className="px-4 py-3 bg-muted/30">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{feature.feature_label}</span>
                                  {FEATURE_DESCRIPTIONS[feature.feature_key] && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help shrink-0" />
                                      </TooltipTrigger>
                                      <TooltipContent side="right" className="max-w-xs text-xs">
                                        {FEATURE_DESCRIPTIONS[feature.feature_key]}
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  <Badge variant="outline" className="text-xs">
                                    {feature.allowed_user_ids.length} usuário(s)
                                  </Badge>
                                  {dirty.has(feature.id) && (
                                    <Badge variant="destructive" className="text-xs">
                                      alterado
                                    </Badge>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() =>
                                    toggleAllUsersForFeature(
                                      feature.id,
                                      filteredProfiles.map((p) => p.user_id),
                                      !allFilteredSelected,
                                    )
                                  }
                                >
                                  {allFilteredSelected ? "Desmarcar todos" : "Marcar todos"}
                                </Button>
                              </div>
                            </div>
                            <div className="px-4 py-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1">
                              {filteredProfiles.map((profile) => (
                                <label
                                  key={profile.user_id}
                                  className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm"
                                >
                                  <Checkbox
                                    checked={feature.allowed_user_ids.includes(profile.user_id)}
                                    onCheckedChange={() => toggleUser(feature.id, profile.user_id)}
                                  />
                                  <span className="truncate">{profile.name || profile.email}</span>
                                  <Badge
                                    variant={getRoleBadgeVariant(profile.role)}
                                    className="text-[10px] px-1 py-0 shrink-0"
                                  >
                                    {getRoleLabel(profile.role)}
                                  </Badge>
                                </label>
                              ))}
                              {filteredProfiles.length === 0 && (
                                <p className="text-xs text-muted-foreground col-span-full py-2">
                                  Nenhum usuário encontrado
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </TabsContent>
          </Tabs>
        </TooltipProvider>

        <AlertDialog open={!!pendingSellerConfirm} onOpenChange={(o) => !o && setPendingSellerConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Liberar funcionalidade sensível para Vendedor?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Você está prestes a liberar <strong>{pendingSellerConfirm?.featureLabel}</strong> para todos os
                usuários com cargo <strong>Vendedor</strong>. Esta funcionalidade contém dados sensíveis (financeiros,
                credenciais ou auditoria). Tem certeza?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (pendingSellerConfirm) {
                    applyRoleScope(pendingSellerConfirm.featureId, "seller", "full");
                    setPendingSellerConfirm(null);
                  }
                }}
              >
                Sim, liberar para Vendedor
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
