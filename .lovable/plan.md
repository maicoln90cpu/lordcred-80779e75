

# Plano Completo de Correcao e Configuracao do Sistema

## Diagnostico

Apos analise completa do projeto, identifiquei 4 problemas criticos:

### Problema 1: types.ts vazio (causa de TODOS os erros de build)
O arquivo `src/integrations/supabase/types.ts` nao reflete as tabelas do banco. Todas as tabelas estao como `[_ in never]: never`, causando erros como `Argument of type '"chips"' is not assignable to parameter of type 'never'` em todos os arquivos que usam o Supabase client.

### Problema 2: Dados antigos precisam ser associados a novos usuarios
O banco ja tem dados vinculados a user_ids antigos:
- `e81a51cb-3f5e-47a2-b357-801033222f05` (maicoln90@hotmail.com - admin)
- `bf39aeb7-ff35-4485-88a1-9e0121e7cbcc` (silascarlosdias@gmail.com - user)

Porem `auth.users` esta vazio (projeto novo). Quando esses usuarios criarem conta, receberao novos UUIDs. O trigger `handle_new_user` cria novas entradas em `profiles` e `user_roles`, mas nao atualiza os dados antigos.

### Problema 3: Secrets ausentes
Apenas `LOVABLE_API_KEY` existe. Faltam:
- `EVOLUTION_API_URL` - necessaria para edge functions (evolution-api, warming-engine, queue-processor)
- `EVOLUTION_API_KEY` - necessaria para as mesmas functions

Nota: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_ANON_KEY` sao fornecidas automaticamente pelo Supabase.

### Problema 4: config.toml incompleto
O `supabase/config.toml` nao tem configuracoes de `verify_jwt` para as edge functions. Functions como `evolution-webhook` precisam de `verify_jwt = false` pois recebem chamadas externas.

---

## Solucao

### Passo 1: Regenerar types.ts
Forcar a regeneracao do arquivo de tipos para que todas as 10 tabelas e o enum `app_role` sejam mapeados corretamente. Isso corrige **todos** os erros de build de uma so vez.

### Passo 2: Criar trigger de associacao automatica
Criar uma database function `associate_existing_data` que sera chamada pelo trigger `handle_new_user` (modificado). Quando um novo usuario se cadastrar com email `maicoln90@hotmail.com` ou `silascarlosdias@gmail.com`, o sistema:

1. Verifica se ja existe um `profile` com esse email
2. Se existir, atualiza o `user_id` antigo para o novo UUID em todas as tabelas:
   - `profiles.user_id`
   - `user_roles.user_id`
   - `chips.user_id`
3. Nao cria registros duplicados (evita o INSERT padrao do `handle_new_user`)
4. Se nao existir dados antigos, segue o fluxo normal de criacao

### Passo 3: Solicitar secrets faltantes
Pedir ao usuario as credenciais:
- `EVOLUTION_API_URL`
- `EVOLUTION_API_KEY`

### Passo 4: Atualizar config.toml
Adicionar configuracoes de `verify_jwt = false` para todas as 9 edge functions.

### Passo 5: Deploy de todas as edge functions
Fazer deploy das 9 functions:
- create-user, delete-user, evolution-api, evolution-webhook
- instance-maintenance, queue-processor, uazapi-api
- update-user-role, warming-engine

---

## Detalhes Tecnicos

### SQL da migracao (Passo 2)

Modificar a function `handle_new_user` para verificar dados existentes antes de criar novos:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing_profile_id uuid;
  old_user_id uuid;
BEGIN
    -- Check if a profile already exists with this email (migrated data)
    SELECT user_id INTO old_user_id
    FROM public.profiles
    WHERE email = NEW.email
    LIMIT 1;

    IF old_user_id IS NOT NULL AND old_user_id != NEW.id THEN
        -- Update all references from old user_id to new user_id
        UPDATE public.profiles SET user_id = NEW.id WHERE user_id = old_user_id;
        UPDATE public.user_roles SET user_id = NEW.id WHERE user_id = old_user_id;
        UPDATE public.chips SET user_id = NEW.id WHERE user_id = old_user_id;
    ELSIF old_user_id IS NULL THEN
        -- No existing data, create fresh profile and role
        INSERT INTO public.profiles (user_id, email)
        VALUES (NEW.id, NEW.email);

        INSERT INTO public.user_roles (user_id, role)
        VALUES (NEW.id, 'seller');
    END IF;
    -- If old_user_id = NEW.id, data is already correct, do nothing

    RETURN NEW;
END;
$$;
```

### config.toml atualizado

```toml
project_id = "sibfqmzsnftscnlyuwiu"

[functions.create-user]
verify_jwt = false

[functions.delete-user]
verify_jwt = false

[functions.evolution-api]
verify_jwt = false

[functions.evolution-webhook]
verify_jwt = false

[functions.instance-maintenance]
verify_jwt = false

[functions.queue-processor]
verify_jwt = false

[functions.uazapi-api]
verify_jwt = false

[functions.update-user-role]
verify_jwt = false

[functions.warming-engine]
verify_jwt = false
```

### Resumo das acoes

| # | Acao | Tipo |
|---|------|------|
| 1 | Regenerar types.ts com todas as tabelas | Correcao de tipos |
| 2 | Alterar handle_new_user para associar dados antigos | Migracao SQL |
| 3 | Solicitar EVOLUTION_API_URL e EVOLUTION_API_KEY | Secrets |
| 4 | Atualizar config.toml com verify_jwt | Configuracao |
| 5 | Deploy das 9 edge functions | Deploy |

