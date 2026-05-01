import { useEffect, useState, useCallback } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, Shield, Loader2, Save, Smartphone, ChevronDown, ChevronUp, Search, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UserProfile {
  user_id: string;
  email: string;
  name: string | null;
  role: string;
}

interface MetaChip {
  id: string;
  nickname: string | null;
  phone_number: string | null;
  instance_name: string;
  shared_user_ids: string[];
  is_shared: boolean;
}

// Map: userId -> Set<chipId>
type UserChipMap = Record<string, Set<string>>;

export default function MetaUserAccessCard() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [metaChips, setMetaChips] = useState<MetaChip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [vendorSearch, setVendorSearch] = useState("");
  // Local state: which chips each user has access to
  const [userChipMap, setUserChipMap] = useState<UserChipMap>({});
  // Track which users are "enabled" (have at least concept of access)
  const [enabledUsers, setEnabledUsers] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      const [profilesRes, rolesRes, chipsRes] = await Promise.all([
        supabase.rpc("get_visible_profiles"),
        supabase.from("user_roles").select("user_id, role"),
        supabase
          .from("chips")
          .select("id, nickname, phone_number, instance_name, shared_user_ids, is_shared")
          .eq("provider", "meta")
          .order("created_at", { ascending: false }),
      ]);

      if (profilesRes.error) throw profilesRes.error;

      const roleMap = new Map<string, string>();
      (rolesRes.data || []).forEach((r: any) => roleMap.set(r.user_id, r.role));

      const merged: UserProfile[] = (profilesRes.data || []).map((p: any) => ({
        user_id: p.user_id,
        email: p.email,
        name: p.name,
        role: roleMap.get(p.user_id) || "seller",
      }));

      // Only non-privileged users (master/admin always have access)
      const filtered = merged.filter((u) => !["master", "admin"].includes(u.role));
      setUsers(filtered);

      const chips = (chipsRes.data || []) as unknown as MetaChip[];
      setMetaChips(chips);

      // Build initial userChipMap from existing shared_user_ids
      const map: UserChipMap = {};
      const enabled = new Set<string>();

      filtered.forEach((u) => {
        map[u.user_id] = new Set<string>();
      });

      chips.forEach((chip) => {
        const sharedIds = chip.shared_user_ids || [];
        sharedIds.forEach((uid) => {
          if (map[uid]) {
            map[uid].add(chip.id);
            enabled.add(uid);
          }
        });
      });

      setUserChipMap(map);
      setEnabledUsers(enabled);
    } catch (error) {
      console.error("Error fetching meta access data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleUser = (userId: string) => {
    setEnabledUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
        // Clear all chip selections
        setUserChipMap((m) => ({ ...m, [userId]: new Set() }));
        setExpandedUser(null);
      } else {
        next.add(userId);
        // Auto-select all chips
        setUserChipMap((m) => ({
          ...m,
          [userId]: new Set(metaChips.map((c) => c.id)),
        }));
        setExpandedUser(userId);
      }
      return next;
    });
  };

  const toggleChipForUser = (userId: string, chipId: string) => {
    setUserChipMap((prev) => {
      const current = new Set(prev[userId] || []);
      if (current.has(chipId)) {
        current.delete(chipId);
      } else {
        current.add(chipId);
      }
      // If no chips selected, disable user
      if (current.size === 0) {
        setEnabledUsers((e) => {
          const n = new Set(e);
          n.delete(userId);
          return n;
        });
      }
      return { ...prev, [userId]: current };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Build reverse map: chipId -> user_ids that should be in shared_user_ids
      const chipUserMap: Record<string, string[]> = {};
      metaChips.forEach((c) => {
        chipUserMap[c.id] = [];
      });

      Object.entries(userChipMap).forEach(([userId, chipIds]) => {
        chipIds.forEach((chipId) => {
          if (chipUserMap[chipId]) {
            chipUserMap[chipId].push(userId);
          }
        });
      });

      // Update each chip's shared_user_ids and is_shared
      const updates = metaChips.map((chip) => {
        const newSharedIds = chipUserMap[chip.id] || [];
        return supabase
          .from("chips")
          .update({
            shared_user_ids: newSharedIds,
            is_shared: newSharedIds.length > 0,
          } as any)
          .eq("id", chip.id);
      });

      await Promise.all(updates);

      toast({
        title: "Acessos salvos com sucesso",
        description: `${enabledUsers.size} vendedor(es) com acesso configurado`,
      });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const roleLabel = (role: string) => {
    const labels: Record<string, string> = { manager: "Gerente", support: "Suporte", seller: "Vendedor" };
    return labels[role] || role;
  };

  const roleBadgeVariant = (role: string) => {
    if (role === "manager") return "default" as const;
    if (role === "support") return "secondary" as const;
    return "outline" as const;
  };

  const chipLabel = (chip: MetaChip) => chip.nickname || chip.phone_number || chip.instance_name;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (metaChips.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Acesso por Vendedor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhum chip Meta cadastrado. Adicione chips na aba "Chips" primeiro.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Acesso por Vendedor
        </CardTitle>
        <CardDescription>
          Marque o vendedor e escolha quais chips Meta ele pode usar na tela WhatsApp.
          <br />
          <span className="flex items-center gap-1 mt-1">
            <Shield className="w-3 h-3" />
            Admin sempre têm acesso a todos os chips automaticamente.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-primary/30 bg-primary/5 py-3">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription className="text-xs space-y-1.5">
            <p className="font-medium text-sm">Pré-requisitos para funcionar:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>
                Cadastre o chip Meta na aba <strong>"Chips"</strong> com Phone Number ID
              </li>
              <li>
                O chip precisa estar como <strong>"Compartilhado"</strong> (is_shared = true)
              </li>
              <li>
                O vendedor deve estar habilitado na <strong>Fila de Mensagens</strong> (Admin → Fila)
              </li>
              <li>Marque o vendedor abaixo e selecione quais chips ele pode usar</li>
              <li>Admin sempre têm acesso automático — não precisam ser marcados</li>
            </ol>
          </AlertDescription>
        </Alert>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar vendedor por nome ou email..."
            value={vendorSearch}
            onChange={(e) => setVendorSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
          ) : (
            users
              .filter((u) => {
                if (!vendorSearch.trim()) return true;
                const q = vendorSearch.toLowerCase();
                return (u.name || "").toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
              })
              .map((user) => {
                const isEnabled = enabledUsers.has(user.user_id);
                const isExpanded = expandedUser === user.user_id;
                const selectedChips = userChipMap[user.user_id] || new Set();

                return (
                  <div key={user.user_id} className="border rounded-lg transition-colors">
                    <div className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors">
                      <Checkbox checked={isEnabled} onCheckedChange={() => toggleUser(user.user_id)} />
                      <button
                        className="flex-1 min-w-0 text-left"
                        onClick={() => {
                          if (isEnabled) setExpandedUser(isExpanded ? null : user.user_id);
                        }}
                      >
                        <p className="text-sm font-medium truncate">{user.name || user.email}</p>
                        {user.name && <p className="text-xs text-muted-foreground truncate">{user.email}</p>}
                      </button>
                      <Badge variant={roleBadgeVariant(user.role)} className="text-xs shrink-0">
                        {roleLabel(user.role)}
                      </Badge>
                      {isEnabled && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          {selectedChips.size}/{metaChips.length} chip(s)
                        </Badge>
                      )}
                      {isEnabled && (
                        <button
                          onClick={() => setExpandedUser(isExpanded ? null : user.user_id)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>

                    {isEnabled && isExpanded && (
                      <div className="px-3 pb-3 pt-0 border-t space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground mt-2 mb-1">
                          Selecione os chips que {user.name?.split(" ")[0] || "este usuário"} pode usar:
                        </p>
                        {metaChips.map((chip) => (
                          <label
                            key={chip.id}
                            className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedChips.has(chip.id)}
                              onCheckedChange={() => toggleChipForUser(user.user_id, chip.id)}
                            />
                            <Smartphone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{chipLabel(chip)}</p>
                              {chip.phone_number && chip.nickname && (
                                <p className="text-[10px] text-muted-foreground">{chip.phone_number}</p>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
          )}
        </div>

        {enabledUsers.size > 0 && (
          <p className="text-xs text-muted-foreground pt-3 border-t">
            {enabledUsers.size} vendedor(es) com acesso + Master/Admin (automático)
          </p>
        )}

        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar Acessos
        </Button>
      </CardContent>
    </Card>
  );
}
