# LordCred — Security Practices

## Princípios

1. **RLS em tudo**: Todas as tabelas têm RLS habilitado
2. **Roles no servidor**: NUNCA em localStorage ou profiles
3. **SECURITY DEFINER**: Funções que acessam roles evitam recursão RLS
4. **Edge Functions como proxy**: Credenciais de APIs externas NUNCA no frontend
5. **Publishable keys OK**: Supabase anon key no frontend é intencional e seguro

---

## Sistema de Roles

### Armazenamento

```sql
-- Roles em tabela separada (NUNCA em profiles)
CREATE TABLE user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);

CREATE TYPE app_role AS ENUM ('master', 'admin', 'manager', 'support', 'seller');
```

### Funções SECURITY DEFINER

```sql
-- Retorna true para master, admin, manager
CREATE FUNCTION is_privileged(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id AND role IN ('master', 'admin', 'manager')
  )
$$;

-- Check role específico (evita recursão RLS)
CREATE FUNCTION has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = _role
  )
$$;
```

### RLS Pattern

```sql
-- Padrão para tabelas administrativas
CREATE POLICY "Privileged users full access"
ON public.some_table FOR ALL TO authenticated
USING (is_privileged(auth.uid()));

-- Padrão para tabelas com ownership
CREATE POLICY "Users see own data"
ON public.some_table FOR SELECT TO authenticated
USING (user_id = auth.uid() OR is_privileged(auth.uid()));
```

---

## Checklist de Segurança

### ✅ Implementado

- [x] RLS habilitado em todas as tabelas
- [x] Roles em tabela separada (`user_roles`)
- [x] `is_privileged()` e `has_role()` SECURITY DEFINER
- [x] Edge Functions como proxy para UazAPI, NewCorban, ClickSign
- [x] CORS headers em todas as edge functions
- [x] JWT validation opcional (verify_jwt=false com validação manual interna)
- [x] Credenciais bancárias em tabela com RLS (apenas privileged)
- [x] Audit logs para ações críticas

### ⚠️ Atenção

- [ ] Rate limiting nas edge functions (não implementado)
- [ ] CSP headers (Content Security Policy)
- [ ] Rotação periódica de tokens UazAPI

---

## Regras Críticas

1. **NUNCA** armazenar roles em `profiles`, `localStorage` ou `sessionStorage`
2. **NUNCA** verificar admin status no cliente — sempre via `is_privileged()` no banco
3. **NUNCA** expor credenciais de API no frontend — usar edge functions como proxy
4. **NUNCA** usar `service_role` key no frontend — apenas em edge functions
5. **SEMPRE** usar `SECURITY DEFINER` com `SET search_path = public` para funções que acessam roles
6. **SEMPRE** testar RLS policies com diferentes roles antes de deploy

---

## Edge Functions — Autenticação

| Função | verify_jwt | Auth interna |
|---|---|---|
| `create-user` | false | Valida service role internamente |
| `delete-user` | false | Valida service role internamente |
| `update-user-role` | false | Valida service role internamente |
| `evolution-webhook` | false | Webhook (sem auth, validação por IP/secret) |
| `meta-webhook` | false | Webhook (validação por verify_token) |
| `clicksign-webhook` | false | Webhook (validação por secret) |
| Todas as outras | false | Validação manual do JWT ou service role |

---

## Ver Também

- [DATABASE-SCHEMA.md](./DATABASE-SCHEMA.md) — Schema e RLS
- [SYSTEM-DESIGN.md](./SYSTEM-DESIGN.md) — Arquitetura
- [EDGE-FUNCTIONS.md](./EDGE-FUNCTIONS.md) — Catálogo de funções
- [CODE-STANDARDS.md](./CODE-STANDARDS.md) — Padrões de código

---

## Padrão "Config via banco com fallback secret"

Aplicado às credenciais Meta WhatsApp (e candidato a outros provedores):

```
1º Edge Function lê de system_settings (banco) — admin pode editar pela tela
2º Se vazio, lê de Deno.env.get('META_*') — secret tradicional
```

### Trade-offs

| Aspecto | Vantagem | Trade-off |
|---|---|---|
| Operação | Admin troca credenciais sem redeploy | Credencial visível no banco para roles privileged |
| Rotação | Imediata via UI | Audit trail obrigatório (registrar quem alterou) |
| Backup | Inclusão em backup do banco | Backups precisam ser criptografados |

### Mitigações
- Tela de edição **só visível para admin/master**.
- `audit_logs` registra alteração de cada campo.
- Backups Supabase são criptografados em repouso.
- Fallback secret continua disponível (rede de segurança).

Detalhes operacionais: [META-WHATSAPP-SETUP.md](./META-WHATSAPP-SETUP.md).

📅 Atualizado em: 2026-04-23
