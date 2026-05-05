# Auditoria de Permissões × RLS — Liberar dados quando o toggle é ativado

## Diagnóstico (causa-raiz)

Hoje temos **duas camadas independentes** de permissão:

1. **Frontend** — `feature_permissions` + `master_feature_toggles` controlam o que aparece na sidebar e quais rotas são acessíveis (`useFeaturePermissions`).
2. **Banco (RLS)** — políticas hard-coded em `is_privileged()` (master/admin/manager) ou `has_role('support')`.

Quando você ativa o toggle "Credenciais Bancos" para **suporte**, a rota libera, mas a RLS de `bank_credentials` só tem:

```
Privileged can manage bank credentials  USING (is_privileged(auth.uid()))
```

→ `support` recebe `SELECT` vazio. Mesmo problema em vários módulos.

## Mapeamento (feature_key → tabela(s) → RLS atual → gap)

| feature_key | Tabela(s) principal | Roles que podem receber toggle | RLS atual permite | Gap |
|---|---|---|---|---|
| `bank_credentials` | `bank_credentials` | manager, support | só `is_privileged` | **support BLOQUEADO** |
| `partners` | `partners`, `partner_kanban_columns` | qualquer | só `is_privileged` | support/seller bloqueados |
| `contract_template` | `contract_templates` | qualquer | SELECT já é `true` p/ autenticado, manage = privileged | OK leitura |
| `commissions` (V1) | `commission_sales`, `commission_settings`, `commission_rates_*`, `seller_pix` | qualquer | SELECT rates/settings = `true`; sales = privileged + own | support não vê todas as vendas |
| `commissions_v2` | `commission_sales_v2` etc | manager+ | privileged + own | OK pelo escopo atual |
| `commission_reports` | `cr_geral`, `cr_relatorio`, `cr_repasse`, `cr_seguros`, `cr_rules_*` | qualquer | só `is_privileged` | support/seller bloqueados |
| `broadcasts` | `broadcast_campaigns`, `broadcast_recipients`, `broadcast_blacklist` | manager+ | só `is_privileged` | OK pelo escopo atual |
| `webhooks`, `chip_monitor`, `queue` | `message_queue`, logs | support, manager | privileged + support | OK |
| `templates` | `message_templates` | seller, support, manager | privileged + support + own seller | OK |
| `quick_replies` | `message_shortcuts` | seller, support, manager | privileged + support + own | OK |
| `audit_logs` | `audit_logs` | support, manager | privileged + support | OK |
| `leads` | `client_leads` | support, manager | privileged + support + own | OK |
| `kanban` | `kanban_cards` | manager | privileged + support + own | manager OK; support depende do toggle |
| `corban_*` (admin) | `corban_propostas_snapshot`, `corban_assets_cache`, `corban_seller_mapping`, `corban_feature_config` | support, manager | SELECT já é `true` autenticado | OK |
| `seller_*` (corban) | mesmas | seller+ | SELECT autenticado | OK |
| `hr` | `hr_candidates`, `hr_employees`, `hr_calendar_events`, `hr_kanban_columns` | qualquer | só `is_privileged` (+support em calendar) | support/seller bloqueados |
| `v8_simulador` | `v8_simulations`, `v8_batches`, `v8_settings` | qualquer | own + privileged; settings só privileged | seller só vê os próprios (intencional) |
| `permissions` | `feature_permissions`, `master_feature_toggles` | só master/admin | privileged | OK |
| `users` | `profiles`, `user_roles` | support, manager | já tratado por edge functions | OK |
| `internal_chat` | `internal_*` | qualquer | já modelado por membership | OK |

**Tabelas que precisam de ajuste de RLS para respeitar o toggle:**
`bank_credentials`, `partners`, `partner_kanban_columns`, `cr_geral`, `cr_relatorio`, `cr_repasse`, `cr_seguros`, `cr_rules_clt`, `cr_rules_fgts`, `commission_sales` (leitura ampla), `hr_candidates`, `hr_employees`, `hr_calendar_events`, `hr_kanban_columns`.

## Solução proposta

### 1. Função SECURITY DEFINER `has_feature_access(_user_id, _feature_key)`

Centraliza a regra: retorna `true` se o usuário é privilegiado **OU** se a `feature_permissions` tem a role/uid do usuário **E** o `master_feature_toggles` está habilitado.

```sql
create or replace function public.has_feature_access(_user_id uuid, _feature_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select
    -- master/admin/manager sempre liberados
    public.is_privileged(_user_id)
    or exists (
      select 1
      from public.feature_permissions fp
      left join public.master_feature_toggles mt on mt.feature_key = fp.feature_key
      join public.user_roles ur on ur.user_id = _user_id
      where fp.feature_key = _feature_key
        and coalesce(mt.is_enabled, true) = true
        and (
          ur.role::text = any(coalesce(fp.allowed_roles, '{}'))
          or _user_id = any(coalesce(fp.allowed_user_ids, '{}'))
        )
    );
$$;
```

Vantagem: uma única fonte de verdade, espelhando exatamente o `checkPermission()` do frontend. Sem recursão (security definer + search_path fixo).

### 2. Migration: expandir políticas SELECT (e ALL onde fizer sentido)

Para cada tabela do gap, adicionar política com `has_feature_access()`. Exemplo `bank_credentials`:

```sql
create policy "Feature access can view bank credentials"
  on public.bank_credentials for select to authenticated
  using (has_feature_access(auth.uid(), 'bank_credentials'));
```

Para módulos onde o usuário precisa **editar** (ex.: `partners`, `bank_credentials` para support), adicionar também `INSERT/UPDATE/DELETE` com a mesma checagem. Se for somente leitura (ex.: `cr_*` para support), só `SELECT`.

Tabelas alvo e ação:
- `bank_credentials` → SELECT + UPDATE + INSERT + DELETE via feature_access
- `partners`, `partner_kanban_columns` → idem
- `cr_geral`, `cr_relatorio`, `cr_repasse`, `cr_seguros`, `cr_rules_clt`, `cr_rules_fgts` → SELECT (somente leitura para suporte/vendedor)
- `commission_sales` → SELECT amplo via feature_access (para support/seller que precisem auditar)
- `hr_candidates`, `hr_employees`, `hr_calendar_events`, `hr_kanban_columns` → SELECT + UPDATE + INSERT via feature_access

### 3. Habilitar todos os feature_keys da sidebar como toggles em `master_feature_toggles`

Verificar se todos os 38 feature_keys do `featureRouteMap.ts` existem em `feature_permissions` (alguns como `bank_credentials`, `hr`, `v8_simulador`, `commissions_v2`, `broadcasts`, `integrations` já existem — confirmar `partners`, `contract_template`, `commission_reports`, `commissions`).

### 4. Teste automatizado (Vitest + Deno)

- **Vitest**: estender `useFeaturePermissions.test.ts` com matriz role × feature.
- **SQL test** (manual via Supabase): rodar `select has_feature_access('<uid_support>', 'bank_credentials')` antes/depois.

## Impacto

**Antes**: toggle libera menu mas tela vem vazia/erro.
**Depois**: toggle libera menu **e** dados (mesma visão do admin no escopo daquele módulo).

**Vantagens**
- Coerência: 1 fonte de verdade (frontend = banco).
- Reduz suporte ao usuário ("liberei e não aparece nada").
- Master continua oculto da UI; admin/manager intactos.

**Desvantagens / cuidados**
- Liberar `bank_credentials` para `support` expõe senhas. Recomendo manter `bank_credentials` apenas com toggle, porém mascarar senha no frontend para roles não-privilegiadas (ajuste menor).
- `cr_*` carrega dados financeiros sensíveis — confirmar com você se support/seller realmente devem ver.

## Checklist manual pós-implementação
1. Logar como **support**.
2. Master ativa toggle "Credenciais Bancos" → support deve ver lista preenchida.
3. Master desativa → support continua vendo o menu? Não. Lista some.
4. Repetir para **Parceiros**, **Relat. Comissões**, **RH**.
5. Confirmar que **seller** sem toggle continua sem acesso (regressão).
6. Master/admin continuam com tudo (regressão).

## Pendências (futuro)
- Mascaramento condicional de campos sensíveis (`bank_credentials.password`) por role no frontend.
- UI no painel Master mostrando "Esta feature requer dados sensíveis" como aviso ao alternar para roles não-privilegiadas.
- Auditoria automatizada: query agendada que lista tabelas com `is_privileged` exclusivo e alerta quando uma nova feature for adicionada.

## Prevenção de regressão
- Função `has_feature_access` testada por SQL.
- Vitest cobrindo matriz role × feature_key (4 roles × 38 features).
- Documentar em `docs/SECURITY.md` o padrão: **toda nova tabela ligada a um módulo deve usar `has_feature_access()` na RLS de SELECT**.

---

**Posso prosseguir com a migration + ajustes?**
