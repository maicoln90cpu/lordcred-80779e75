

## Plan: 2 Changes

### 1. Suporte ver todos os vendedores e suportes (`src/pages/admin/Users.tsx`)

**Problema**: Linhas 99-103 filtram `role === 'seller' && created_by === currentUser?.id`, limitando suporte a ver apenas vendedores que ele criou.

**Fix**: Alterar o filtro do suporte para mostrar todos os sellers e outros supports (excluindo admin e a si mesmo):

```ts
} else if (isSupport) {
  // Support sees all sellers and other supports, excluding admins and self
  enrichedUsers = enrichedUsers.filter(u => 
    (u.role === 'seller' || u.role === 'support') && u.user_id !== currentUser?.id
  );
}
```

Nota: RLS de `profiles` já permite suporte ver todos os perfis (`Support can view all profiles`), e `user_roles` também (`Support can view all roles`), então não precisa de migration.

---

### 2. Monitor de Chips: abas separadas por tipo (`src/pages/admin/ChipMonitor.tsx`)

**Problema**: Todos os chips aparecem juntos na aba "Status dos Chips".

**Fix**: Dentro da aba "Status dos Chips", adicionar sub-tabs (ou substituir por) duas abas:
- **Aquecimento** — chips com `chip_type === 'warming'`
- **Chat** — chips com `chip_type === 'whatsapp'`

Implementação:
- Adicionar estado `chipTypeTab` (`'warming' | 'whatsapp'`)
- Adicionar `TabsList` secundário dentro do `TabsContent value="status"` com duas opções: "Aquecimento" e "Chat"
- O `filteredChips` existente ganha filtro adicional por `chip_type` baseado na sub-aba ativa
- Atualizar a interface `ChipMonitorData` para incluir `chip_type: string`
- KPIs no topo permanecem globais (todos os chips)

**Arquivos a modificar:**
- `src/pages/admin/Users.tsx` — filtro do suporte
- `src/pages/admin/ChipMonitor.tsx` — sub-abas por tipo de chip

